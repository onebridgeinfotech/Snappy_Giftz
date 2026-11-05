import { NextResponse } from 'next/server';
import { createAndSendOtpChallenge } from '@/lib/auth/send-otp-email';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    const rateLimit = await enforceRateLimit('AUTH_OTP_SEND', `${ipAddress}:${cleanEmail}:reset`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many reset requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) } }
      );
    }

    await createAndSendOtpChallenge({
      email: cleanEmail,
      purpose: 'PASSWORD_RESET',
      requirePasswordAccount: true,
    });

    return NextResponse.json({
      success: true,
      message: 'If an account exists for this email, we sent a reset code.',
    });
  } catch (error) {
    console.error('[API_AUTH_FORGOT_PASSWORD] Error:', error);
    return NextResponse.json({ error: 'Could not start password reset. Please try again.' }, { status: 500 });
  }
}
