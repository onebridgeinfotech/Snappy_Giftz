import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validatePasswordStrength, hashPassword } from '@/lib/auth/password';
import { validateOtpChallenge } from '@/lib/auth/otp';
import { invalidateAllUserSessions, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, otp, code, newPassword, confirmPassword } = body;

    const rawCode = (otp || code || '').trim();

    // 1. Validate input presence and formats
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!rawCode || !/^\d{6}$/.test(rawCode)) {
      return NextResponse.json(
        { error: 'Please enter a valid 6-digit verification code.' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'Please enter your new password.' },
        { status: 400 }
      );
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New password and confirmation do not match.' },
        { status: 400 }
      );
    }

    // 2. Validate password strength against authoritative policy
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      return NextResponse.json(
        { error: strength.error || 'Password must be at least 8 characters long and contain both letters and numbers.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // 3. Rate Limiting Guard: Prevent brute-force password reset attempts
    const rateLimit = await enforceRateLimit('AUTH_RESET_PASSWORD', `${ipAddress}:${cleanEmail}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again after one minute.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
        }
      );
    }

    // 4. Find the latest active OTP challenge scoped strictly to PASSWORD_RESET
    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        email: cleanEmail,
        purpose: 'PASSWORD_RESET',
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      return NextResponse.json(
        { error: 'No active password reset verification code found for this email. Please request a new code.' },
        { status: 404 }
      );
    }

    // 5. Validate OTP challenge rules (expiry, attempt count, code match)
    const verification = validateOtpChallenge(challenge, rawCode);

    if (!verification.success) {
      // Increment attempt counter atomically in database
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      }).catch(() => {});

      return NextResponse.json(
        {
          error: verification.error,
          remainingAttempts: verification.remainingAttempts,
        },
        { status: 400 }
      );
    }

    // 6. Look up the user account
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      // Consume the challenge to avoid reuse and protect from enumeration
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { isUsed: true },
      }).catch(() => {});

      return NextResponse.json(
        { error: 'No registered user account found for this email address.' },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'This account has been deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // 7. Hash the new password with bcryptjs (10 salt rounds)
    const newPasswordHash = await hashPassword(newPassword);

    // 8. Atomically consume the OTP challenge and update user's password hash in a database transaction
    await prisma.$transaction(async (tx) => {
      // Consume challenge atomically with guard condition
      const consumption = await tx.otpChallenge.updateMany({
        where: {
          id: challenge.id,
          isUsed: false,
        },
        data: { isUsed: true },
      });

      if (consumption.count === 0) {
        throw new Error('CHALLENGE_ALREADY_USED');
      }

      // Update password hash and mark email as verified
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          isEmailVerified: true,
        },
      });
    });

    // 9. Invalidate ALL existing active sessions for this user across all devices
    await invalidateAllUserSessions(user.id);

    // 10. Prepare safe, user-friendly response and clear any session cookie on current client
    const response = NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. Please sign in with your new password.',
    });

    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (error: any) {
    console.error('[API_AUTH_RESET_PASSWORD] Error:', error);

    if (error?.message === 'CHALLENGE_ALREADY_USED') {
      return NextResponse.json(
        { error: 'This verification code has already been consumed. Please request a new code.' },
        { status: 400 }
      );
    }

    if (
      error?.code === 'P1001' ||
      error?.name === 'PrismaClientInitializationError' ||
      /reach database|connection|ECONNREFUSED|ETIMEDOUT|PrismaClientInitializationError/i.test(error?.message || '')
    ) {
      return NextResponse.json(
        {
          error: 'Authentication database is temporarily unreachable. Please try again in a few moments or contact support.',
          code: 'DATABASE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while resetting your password. Please try again.' },
      { status: 500 }
    );
  }
}
