import { NextResponse } from 'next/server';
import { createAndSendOtpChallenge } from '@/lib/auth/send-otp-email';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import type { OtpEmailPurpose } from '@/lib/email/snappy-email-brand';

const ALLOWED_PURPOSES: OtpEmailPurpose[] = ['LOGIN', 'REGISTER', 'PASSWORD_RESET'];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, purpose = 'LOGIN' } = body;

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (!ALLOWED_PURPOSES.includes(purpose)) {
      return NextResponse.json({ error: 'Invalid verification purpose.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    const rateLimit = await enforceRateLimit('AUTH_OTP_SEND', `${ipAddress}:${cleanEmail}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification code requests. Please try again after one minute.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
        }
      );
    }

    const result = await createAndSendOtpChallenge({
      email: cleanEmail,
      purpose,
      requirePasswordAccount: purpose === 'PASSWORD_RESET',
    });

    if (result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: `A verification code has been sent to ${cleanEmail}.`,
    });
  } catch (error: any) {
    console.error('[API_AUTH_OTP_SEND] Error:', error);
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
    return NextResponse.json({ error: 'Failed to send verification code. Please try again.' }, { status: 500 });
  }
}
