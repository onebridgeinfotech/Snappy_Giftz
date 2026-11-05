import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOtpChallenge } from '@/lib/auth/otp';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code, newPassword } = body;

    if (!email || !code || !newPassword || typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ error: 'Email, verification code, and new password are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    const rateLimit = await enforceRateLimit('AUTH_OTP_VERIFY', `${ipAddress}:${cleanEmail}:reset`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) } }
      );
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid reset request.' }, { status: 400 });
    }

    const challenge = await prisma.otpChallenge.findFirst({
      where: { email: cleanEmail, purpose: 'PASSWORD_RESET', isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      return NextResponse.json({ error: 'No active reset code found. Request a new one.' }, { status: 404 });
    }

    const result = validateOtpChallenge(challenge, cleanCode);
    if (!result.success) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      }).catch(() => {});
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const consumption = await prisma.otpChallenge.updateMany({
      where: { id: challenge.id, isUsed: false },
      data: { isUsed: true },
    });

    if (consumption.count === 0) {
      return NextResponse.json({ error: 'This code was already used. Request a new one.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true, message: 'Your password has been updated. You can sign in now.' });
  } catch (error) {
    console.error('[API_AUTH_RESET_PASSWORD] Error:', error);
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 500 });
  }
}
