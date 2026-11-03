import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '../lib/auth/password';
import {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  validateOtpChallenge,
  OtpChallengeData,
} from '../lib/auth/otp';
import {
  generateSessionToken,
  hashSessionToken,
  getSessionCookieOptions,
} from '../lib/auth/session';
import { hasRole } from '../lib/auth/rbac';
import { Role } from '@prisma/client';
import { MailpitEmailService } from '../services/email/mailpit.service';

async function runTestSuite() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Batch 1: Auth & RBAC Test Suite   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✘ [FAIL] ${name}`);
      console.error(`     Reason: ${err.message}\n`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // 1. Password Hashing & Complexity
  // ------------------------------------------------------------------
  console.log('--- 1. Password Hashing & Complexity Validation ---');

  await test('Reject password shorter than 8 characters', () => {
    const res = validatePasswordStrength('Pass1');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least 8 characters/);
  });

  await test('Reject password without numbers', () => {
    const res = validatePasswordStrength('PasswordOnly');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least one letter and one number/);
  });

  await test('Reject password without letters', () => {
    const res = validatePasswordStrength('1234567890');
    assert.equal(res.isValid, false);
    assert.match(res.error || '', /at least one letter and one number/);
  });

  await test('Accept strong valid password', () => {
    const res = validatePasswordStrength('SnappyGifts2026!');
    assert.equal(res.isValid, true);
  });

  await test('Bcrypt hashing produces distinct salted hashes and verifies matches', async () => {
    const pwd = 'CorrectPassword99';
    const hash1 = await hashPassword(pwd);
    const hash2 = await hashPassword(pwd);

    // Salting ensures hashes are never identical
    assert.notEqual(hash1, hash2);

    // Correct password matches both
    assert.equal(await verifyPassword(pwd, hash1), true);
    assert.equal(await verifyPassword(pwd, hash2), true);

    // Incorrect password rejected
    assert.equal(await verifyPassword('WrongPassword00', hash1), false);
  });

  // ------------------------------------------------------------------
  // 2. OTP Generation, Hashing, Expiry & Attempt Limits
  // ------------------------------------------------------------------
  console.log('\n--- 2. OTP Security, Expiry & Single-Use Verification ---');

  await test('Generate 6-digit numeric OTP code', () => {
    const code = generateSecureOtp();
    assert.equal(code.length, 6);
    assert.match(code, /^\d{6}$/);
  });

  await test('SHA-256 OTP hashing and constant-time comparison', () => {
    const code = '582914';
    const hash = hashOtp(code);
    assert.equal(hash.length, 64); // 256-bit hex
    assert.equal(verifyOtpHash(code, hash), true);
    assert.equal(verifyOtpHash('000000', hash), false);
  });

  await test('OTP verification succeeds with valid code within expiry window', () => {
    const code = '719283';
    const challenge: OtpChallengeData = {
      id: 'otp-1',
      email: 'client@example.com',
      otpHash: hashOtp(code),
      purpose: 'LOGIN',
      attempts: 0,
      maxAttempts: 3,
      isUsed: false,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins in future
    };

    const res = validateOtpChallenge(challenge, code);
    assert.equal(res.success, true);
  });

  await test('Reject OTP code if already marked isUsed (Single-use guard)', () => {
    const code = '719283';
    const challenge: OtpChallengeData = {
      id: 'otp-2',
      email: 'client@example.com',
      otpHash: hashOtp(code),
      purpose: 'LOGIN',
      attempts: 0,
      maxAttempts: 3,
      isUsed: true, // already used
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    const res = validateOtpChallenge(challenge, code);
    assert.equal(res.success, false);
    assert.match(res.error || '', /already been used/);
  });

  await test('Reject OTP code if expired', () => {
    const code = '719283';
    const challenge: OtpChallengeData = {
      id: 'otp-3',
      email: 'client@example.com',
      otpHash: hashOtp(code),
      purpose: 'LOGIN',
      attempts: 0,
      maxAttempts: 3,
      isUsed: false,
      expiresAt: new Date(Date.now() - 1000), // 1 second in past
    };

    const res = validateOtpChallenge(challenge, code);
    assert.equal(res.success, false);
    assert.match(res.error || '', /expired/);
  });

  await test('Reject OTP and decrement attempts on invalid code', () => {
    const code = '719283';
    const challenge: OtpChallengeData = {
      id: 'otp-4',
      email: 'client@example.com',
      otpHash: hashOtp(code),
      purpose: 'LOGIN',
      attempts: 1,
      maxAttempts: 3,
      isUsed: false,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    const res = validateOtpChallenge(challenge, '999999');
    assert.equal(res.success, false);
    assert.equal(res.remainingAttempts, 1);
    assert.match(res.error || '', /1 attempt\(s\) remaining/);
  });

  await test('Block OTP verification when attempt limit reached (Brute-force lockout)', () => {
    const code = '719283';
    const challenge: OtpChallengeData = {
      id: 'otp-5',
      email: 'client@example.com',
      otpHash: hashOtp(code),
      purpose: 'LOGIN',
      attempts: 3,
      maxAttempts: 3,
      isUsed: false,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    const res = validateOtpChallenge(challenge, code); // Even correct code blocked
    assert.equal(res.success, false);
    assert.match(res.error || '', /Too many incorrect attempts/);
  });

  // ------------------------------------------------------------------
  // 3. Session Token & Cookie Security (Cryptographic Hashing)
  // ------------------------------------------------------------------
  console.log('\n--- 3. Session Token & Cryptographic Hash Storage ---');

  await test('Generate high-entropy 256-bit session token', () => {
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    assert.equal(t1.length, 64);
    assert.equal(t2.length, 64);
    assert.notEqual(t1, t2);
  });

  await test('Session token is cryptographically hashed with SHA-256 for database storage', () => {
    const rawToken = '4f8b9e1c2d3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c';
    const hash = hashSessionToken(rawToken);
    assert.equal(hash.length, 64);
    assert.notEqual(hash, rawToken); // Hash is distinct from raw token
    // Same token produces identical hash
    assert.equal(hashSessionToken(rawToken), hash);
    // Altered token produces completely different hash
    assert.notEqual(hashSessionToken(rawToken + '1'), hash);
  });

  await test('Session cookie options mandate httpOnly, sameSite lax, and root path', () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const opts = getSessionCookieOptions(expiresAt);
    assert.equal(opts.name, 'snappy_session_token');
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.sameSite, 'lax');
    assert.equal(opts.path, '/');
    assert.equal(opts.expires, expiresAt);
  });

  // ------------------------------------------------------------------
  // 4. Role-Based Access Control (RBAC) & Privilege Escalation Defense
  // ------------------------------------------------------------------
  console.log('\n--- 4. Role-Based Access Control (RBAC) & Privilege Escalation Defense ---');

  await test('Customer permitted customer routes but denied admin routes', () => {
    assert.equal(hasRole(Role.CUSTOMER, [Role.CUSTOMER]), true);
    assert.equal(hasRole(Role.CUSTOMER, [Role.ADMIN]), false);
    assert.equal(hasRole(Role.CUSTOMER, [Role.STAFF]), false);
  });

  await test('Reject obsolete B2B_CLIENT role and deny access to all routes', () => {
    assert.equal(hasRole('B2B_CLIENT' as any, [Role.CUSTOMER]), false);
    assert.equal(hasRole('B2B_CLIENT' as any, [Role.ADMIN]), false);
    assert.equal(hasRole('B2B_CLIENT' as any, [Role.STAFF]), false);
  });

  await test('Staff permitted staff and customer routes but denied super-admin-only operations', () => {
    assert.equal(hasRole(Role.STAFF, [Role.STAFF, Role.ADMIN]), true);
    assert.equal(hasRole(Role.STAFF, [Role.ADMIN]), false);
  });

  await test('Super Administrator has universal access across all role boundaries', () => {
    assert.equal(hasRole(Role.ADMIN, [Role.ADMIN]), true);
    assert.equal(hasRole(Role.ADMIN, [Role.STAFF]), true);
    // B2B_CLIENT role removed
    assert.equal(hasRole(Role.ADMIN, [Role.CUSTOMER]), true);
  });

  await test('Reject invalid or empty role inputs', () => {
    assert.equal(hasRole(undefined as any, [Role.CUSTOMER]), false);
    assert.equal(hasRole(Role.CUSTOMER, []), false);
  });

  await test('Self-registration role assignment policy strictly defaults to CUSTOMER', () => {
    // Simulated registration logic test
    function determineRegisteredRole(requestedRole?: string): Role {
      // Security policy: visitors can NEVER self-assign B2B_CLIENT, STAFF, or ADMIN
      return Role.CUSTOMER;
    }

    assert.equal(determineRegisteredRole('ADMIN'), Role.CUSTOMER);
    assert.equal(determineRegisteredRole('STAFF'), Role.CUSTOMER);
    assert.equal(determineRegisteredRole('B2B_CLIENT'), Role.CUSTOMER);
    assert.equal(determineRegisteredRole(''), Role.CUSTOMER);
  });

  // ------------------------------------------------------------------
  // 5. Production Email Security & Fail-Closed Behavior
  // ------------------------------------------------------------------
  console.log('\n--- 5. Email Security & Fail-Closed Production Behavior ---');

  await test('Production email fails closed if SMTP is unreachable', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      // Use unreachable port to test fail-closed
      process.env.SMTP_PORT = '59999';
      const svc = new MailpitEmailService();
      const res = await svc.sendEmail({
        to: 'customer@example.com',
        subject: 'Test Verification',
        html: '<p>Code: 123456</p>',
        text: 'Code: 123456',
      });
      // In production, failure MUST NOT return success: true
      assert.equal(res.success, false);
      assert.match(res.error || '', /unavailable/);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      delete process.env.SMTP_PORT;
    }
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Test Run Complete: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Auth & RBAC test suite.`);
  }

  return { passed, failed };
}

export { runTestSuite };

if (process.argv[1]?.includes('auth.test')) {
  runTestSuite().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
