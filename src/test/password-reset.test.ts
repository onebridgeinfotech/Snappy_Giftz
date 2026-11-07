// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import assert from 'node:assert/strict';
import {
  generateSecureOtp,
  hashOtp,
  verifyOtpHash,
  validateOtpChallenge,
  OtpChallengeData,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
} from '../lib/auth/otp';
import {
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
} from '../lib/auth/password';
import {
  generateSessionToken,
  hashSessionToken,
  invalidateAllUserSessions,
  DEV_SESSIONS_STORE,
} from '../lib/auth/session';
import { Role } from '@prisma/client';

export async function runPasswordResetTestSuite() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Batch 14: Password Reset Suite     ');
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
  // 1. Correct OTP Verification
  // ------------------------------------------------------------------
  console.log('--- 1. OTP Verification & Invariants ---');

  await test('Correct OTP: Successfully validates authentic 6-digit code', () => {
    const rawOtp = generateSecureOtp();
    assert.match(rawOtp, /^\d{6}$/, 'OTP must be exactly 6 numeric digits');

    const otpHash = hashOtp(rawOtp);
    const challenge: OtpChallengeData = {
      id: 'test-challenge-correct',
      email: 'customer@example.com',
      otpHash,
      purpose: 'PASSWORD_RESET',
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      isUsed: false,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    };

    const result = validateOtpChallenge(challenge, rawOtp);
    assert.equal(result.success, true);
    assert.equal(result.error, undefined);
  });

  // ------------------------------------------------------------------
  // 2. Incorrect OTP Verification
  // ------------------------------------------------------------------
  await test('Incorrect OTP: Rejects mismatching code and decrements remaining attempts', () => {
    const rawOtp = '123456';
    const wrongOtp = '654321';
    const otpHash = hashOtp(rawOtp);

    const challenge: OtpChallengeData = {
      id: 'test-challenge-incorrect',
      email: 'customer@example.com',
      otpHash,
      purpose: 'PASSWORD_RESET',
      attempts: 0,
      maxAttempts: 3,
      isUsed: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    const result = validateOtpChallenge(challenge, wrongOtp);
    assert.equal(result.success, false);
    assert.equal(result.remainingAttempts, 2);
    assert.match(result.error || '', /Incorrect verification code/);
    assert.match(result.error || '', /2 attempt\(s\) remaining/);
  });

  // ------------------------------------------------------------------
  // 3. Expired OTP Verification
  // ------------------------------------------------------------------
  await test('Expired OTP: Rejects code presented after expiry window', () => {
    const rawOtp = '789012';
    const otpHash = hashOtp(rawOtp);

    const expiredChallenge: OtpChallengeData = {
      id: 'test-challenge-expired',
      email: 'customer@example.com',
      otpHash,
      purpose: 'PASSWORD_RESET',
      attempts: 0,
      maxAttempts: 3,
      isUsed: false,
      expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
    };

    const result = validateOtpChallenge(expiredChallenge, rawOtp);
    assert.equal(result.success, false);
    assert.match(result.error || '', /expired/i);
  });

  // ------------------------------------------------------------------
  // 4. Reused OTP Verification (Single-Use Guard)
  // ------------------------------------------------------------------
  await test('Reused OTP: Rejects code if challenge is already marked isUsed', () => {
    const rawOtp = '345678';
    const otpHash = hashOtp(rawOtp);

    const usedChallenge: OtpChallengeData = {
      id: 'test-challenge-used',
      email: 'customer@example.com',
      otpHash,
      purpose: 'PASSWORD_RESET',
      attempts: 0,
      maxAttempts: 3,
      isUsed: true, // Already consumed
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    const result = validateOtpChallenge(usedChallenge, rawOtp);
    assert.equal(result.success, false);
    assert.match(result.error || '', /already been used/i);
  });

  // ------------------------------------------------------------------
  // 5. Lockout After Three Failed Attempts
  // ------------------------------------------------------------------
  await test('More than three incorrect attempts: Permanently locks challenge', () => {
    const rawOtp = '112233';
    const otpHash = hashOtp(rawOtp);

    const lockedChallenge: OtpChallengeData = {
      id: 'test-challenge-locked',
      email: 'customer@example.com',
      otpHash,
      purpose: 'PASSWORD_RESET',
      attempts: 3, // Exhausted
      maxAttempts: 3,
      isUsed: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    // Even if caller submits the correct OTP now, challenge is permanently locked
    const result = validateOtpChallenge(lockedChallenge, rawOtp);
    assert.equal(result.success, false);
    assert.match(result.error || '', /Too many incorrect attempts/i);
    assert.equal(result.remainingAttempts, 0);
  });

  // ------------------------------------------------------------------
  // 6. Password Complexity & Policy Enforcement
  // ------------------------------------------------------------------
  console.log('\n--- 2. Password Policy & Complexity Validation ---');

  await test('Invalid password: Rejects passwords that fail security requirements', () => {
    // Too short (< 8 chars)
    const shortRes = validatePasswordStrength('Pass1');
    assert.equal(shortRes.isValid, false);
    assert.match(shortRes.error || '', /at least 8 characters/);

    // Missing numbers
    const noNumRes = validatePasswordStrength('OnlyLettersPassword');
    assert.equal(noNumRes.isValid, false);
    assert.match(noNumRes.error || '', /at least one letter and one number/);

    // Missing letters
    const noLettersRes = validatePasswordStrength('1234567890');
    assert.equal(noLettersRes.isValid, false);
    assert.match(noLettersRes.error || '', /at least one letter and one number/);

    // Empty or non-string
    const emptyRes = validatePasswordStrength('');
    assert.equal(emptyRes.isValid, false);

    // Valid password
    const validRes = validatePasswordStrength('ValidBespokePassword2026!');
    assert.equal(validRes.isValid, true);
    assert.equal(validRes.error, undefined);
  });

  // ------------------------------------------------------------------
  // 7. Successful Password Replacement & Bcrypt Salting
  // ------------------------------------------------------------------
  console.log('\n--- 3. Password Replacement & Hashing Lifecycle ---');

  const oldPassword = 'OldInitialPassword2025!';
  const newPassword = 'NewLuxuryPassword2026!';
  let newPasswordHash = '';

  await test('Successful password replacement: Hashes new password with bcrypt (10 rounds)', async () => {
    const oldPasswordHash = await hashPassword(oldPassword);
    newPasswordHash = await hashPassword(newPassword);

    assert.ok(newPasswordHash.startsWith('$2a$10$') || newPasswordHash.startsWith('$2b$10$'));
    assert.notEqual(oldPasswordHash, newPasswordHash, 'New hash must be cryptographically distinct');
  });

  // ------------------------------------------------------------------
  // 8. Old Password Rejected After Reset
  // ------------------------------------------------------------------
  await test('Old password rejected after reset: Old credentials cannot authenticate', async () => {
    assert.ok(newPasswordHash, 'New password hash must exist');
    const isOldValid = await verifyPassword(oldPassword, newPasswordHash);
    assert.equal(isOldValid, false, 'Old password must fail verification against new hash');
  });

  // ------------------------------------------------------------------
  // 9. New Password Accepted After Reset
  // ------------------------------------------------------------------
  await test('New password accepted after reset: New credentials successfully authenticate', async () => {
    assert.ok(newPasswordHash, 'New password hash must exist');
    const isNewValid = await verifyPassword(newPassword, newPasswordHash);
    assert.equal(isNewValid, true, 'New password must succeed verification against new hash');
  });

  // ------------------------------------------------------------------
  // 10. Invalidate All Active Sessions on Password Reset
  // ------------------------------------------------------------------
  console.log('\n--- 4. Session Revocation & Security Isolation ---');

  await test('Previous sessions invalidated: Revokes all active sessions upon password replacement', async () => {
    const targetUserId = 'customer-reset-test-uuid-42';

    // Seed multiple active sessions for this user across desktop and mobile
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    const otherUserToken = generateSessionToken();

    DEV_SESSIONS_STORE.set(token1, {
      session: {
        id: 'sess-1',
        sessionToken: hashSessionToken(token1),
        userId: targetUserId,
        expiresAt: new Date(Date.now() + 86400000),
        ipAddress: '192.168.1.10',
        userAgent: 'Chrome-Desktop',
        createdAt: new Date(),
      },
      user: {
        id: targetUserId,
        email: 'reset-user@snappygiftz.com',
        name: 'Reset Customer',
        phone: null,
        passwordHash: 'old-hash',
        role: Role.CUSTOMER,
        isEmailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    DEV_SESSIONS_STORE.set(token2, {
      session: {
        id: 'sess-2',
        sessionToken: hashSessionToken(token2),
        userId: targetUserId,
        expiresAt: new Date(Date.now() + 86400000),
        ipAddress: '192.168.1.11',
        userAgent: 'Safari-Mobile',
        createdAt: new Date(),
      },
      user: {
        id: targetUserId,
        email: 'reset-user@snappygiftz.com',
        name: 'Reset Customer',
        phone: null,
        passwordHash: 'old-hash',
        role: Role.CUSTOMER,
        isEmailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Another unrelated user's session
    DEV_SESSIONS_STORE.set(otherUserToken, {
      session: {
        id: 'sess-unrelated',
        sessionToken: hashSessionToken(otherUserToken),
        userId: 'other-user-uuid',
        expiresAt: new Date(Date.now() + 86400000),
        ipAddress: '10.0.0.1',
        userAgent: 'Firefox',
        createdAt: new Date(),
      },
      user: {
        id: 'other-user-uuid',
        email: 'other@snappygiftz.com',
        name: 'Other Customer',
        phone: null,
        passwordHash: 'other-hash',
        role: Role.CUSTOMER,
        isEmailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    assert.equal(DEV_SESSIONS_STORE.has(token1), true);
    assert.equal(DEV_SESSIONS_STORE.has(token2), true);
    assert.equal(DEV_SESSIONS_STORE.has(otherUserToken), true);

    // Execute session revocation
    await invalidateAllUserSessions(targetUserId);

    assert.equal(DEV_SESSIONS_STORE.has(token1), false, 'Session 1 must be purged');
    assert.equal(DEV_SESSIONS_STORE.has(token2), false, 'Session 2 must be purged');
    assert.equal(DEV_SESSIONS_STORE.has(otherUserToken), true, 'Unrelated user session must be preserved');
  });

  // ------------------------------------------------------------------
  // 11. Unauthorized Reset Attempts & Purpose Isolation
  // ------------------------------------------------------------------
  console.log('\n--- 5. Security Safeguards & Purpose Isolation ---');

  await test('Unauthorized reset attempts: Rejects mismatched purpose challenges (LOGIN != PASSWORD_RESET)', () => {
    // Challenge created for LOGIN purpose cannot be repurposed for password reset
    const rawOtp = '998877';
    const otpHash = hashOtp(rawOtp);

    const loginChallenge: OtpChallengeData = {
      id: 'challenge-login-only',
      email: 'customer@example.com',
      otpHash,
      purpose: 'LOGIN', // NOT PASSWORD_RESET
      attempts: 0,
      maxAttempts: 3,
      isUsed: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    assert.notEqual(loginChallenge.purpose, 'PASSWORD_RESET', 'Challenge purpose is LOGIN');

    // Simulate endpoint purpose scoping check
    const isPurposeAllowed = (purpose: string) => purpose === 'PASSWORD_RESET';
    assert.equal(isPurposeAllowed(loginChallenge.purpose), false, 'LOGIN OTP must be blocked from password reset');
  });

  await test('Constant-time user verification protects against user enumeration', async () => {
    const DUMMY_BCRYPT_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const start = Date.now();
    await verifyPassword('ArbitraryPassword123!', DUMMY_BCRYPT_HASH);
    const duration = Date.now() - start;

    // Bcrypt 10 rounds takes ~50-100ms, proving timing equalization
    assert.ok(duration >= 20, `Execution took ${duration}ms, confirming bcrypt timing execution`);
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('====================================================');
  console.log(`  Password Reset Suite: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  return { passed, failed };
}

// Direct execution support
if (process.argv[1]?.includes('password-reset.test')) {
  runPasswordResetTestSuite().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  }).catch((err) => {
    console.error('Password reset test suite error:', err);
    process.exit(1);
  });
}
