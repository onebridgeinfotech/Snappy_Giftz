import crypto from 'node:crypto';

export interface OtpChallengeData {
  id: string;
  email: string;
  otpHash: string;
  purpose: string;
  attempts: number;
  maxAttempts: number;
  isUsed: boolean;
  expiresAt: Date;
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}

export const OTP_EXPIRY_MINUTES = 15;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/**
 * Generates a cryptographically secure 6-digit OTP code
 */
export function generateSecureOtp(): string {
  const codeInt = crypto.randomInt(100000, 1000000);
  return codeInt.toString();
}

/**
 * Hashes an OTP code with SHA-256 for secure database storage
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

/**
 * Timing-safe comparison of provided OTP against stored hash
 */
export function verifyOtpHash(providedOtp: string, storedHash: string): boolean {
  if (!providedOtp || !storedHash) return false;
  const computedHash = hashOtp(providedOtp);
  try {
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Validates an OTP challenge against expiry, usage, attempt limits, and code correctness.
 */
export function validateOtpChallenge(
  challenge: OtpChallengeData,
  providedOtp: string,
  now: Date = new Date()
): VerifyOtpResult {
  // 1. Single-use check
  if (challenge.isUsed) {
    return {
      success: false,
      error: 'This verification code has already been used. Please request a new code.',
      remainingAttempts: 0,
    };
  }

  // 2. Expiry check
  if (now.getTime() > new Date(challenge.expiresAt).getTime()) {
    return {
      success: false,
      error: 'This verification code has expired. Please request a new code.',
      remainingAttempts: 0,
    };
  }

  // 3. Attempt limit check
  if (challenge.attempts >= challenge.maxAttempts) {
    return {
      success: false,
      error: 'Too many incorrect attempts. This code is now invalid. Please request a new code.',
      remainingAttempts: 0,
    };
  }

  // 4. Code verification
  const isMatch = verifyOtpHash(providedOtp, challenge.otpHash);
  if (!isMatch) {
    const nextAttempts = challenge.attempts + 1;
    const remaining = Math.max(0, challenge.maxAttempts - nextAttempts);
    return {
      success: false,
      error: remaining > 0 
        ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
        : 'Too many incorrect attempts. This code is now invalid.',
      remainingAttempts: remaining,
    };
  }

  return { success: true };
}
