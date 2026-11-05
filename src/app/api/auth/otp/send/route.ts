import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSecureOtp, hashOtp, OTP_EXPIRY_MINUTES, OTP_RESEND_COOLDOWN_SECONDS } from '@/lib/auth/otp';
import { emailService } from '@/services/email/mailpit.service';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, purpose = 'LOGIN' } = body;

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // Rate Limiting Guard: Enforce distributed abuse limit on OTP dispatch
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

    // 1. Check rate-limit cooldown
    const recentChallenge = await prisma.otpChallenge.findFirst({
      where: {
        email: cleanEmail,
        purpose,
        createdAt: {
          gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentChallenge) {
      return NextResponse.json({
        error: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new code.`,
      }, { status: 429 });
    }

    // 2. Invalidate any existing unused OTP challenges for this email and purpose
    await prisma.otpChallenge.updateMany({
      where: { email: cleanEmail, purpose, isUsed: false },
      data: { isUsed: true },
    });

    // 3. Generate secure OTP and hash
    const rawOtp = generateSecureOtp();
    const otpHash = hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Check if user exists (without revealing status to the client)
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    // 4. Store challenge in database
    await prisma.otpChallenge.create({
      data: {
        email: cleanEmail,
        otpHash,
        purpose,
        expiresAt,
        maxAttempts: 3,
        userId: user ? user.id : undefined,
      },
    });

    // 5. Send via transactional email adapter
    const isReset = purpose === 'PASSWORD_RESET';
    const emailSubject = isReset
      ? `Snappy Gifts — Password Reset Code: ${rawOtp}`
      : `Snappy Gifts — Your Verification Code: ${rawOtp}`;
    const emailHeadline = isReset ? 'Snappy Gifts Password Reset' : 'Snappy Gifts Verification';
    const emailIntro = isReset
      ? 'Use the following 6-digit one-time code to reset your account password:'
      : 'Use the following 6-digit one-time code to sign in or verify your account:';

    await emailService.sendEmail({
      to: cleanEmail,
      subject: emailSubject,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0e4de; border-radius: 12px; background-color: #fffdfb;">
          <h2 style="color: #2f0b10; margin-bottom: 8px;">${emailHeadline}</h2>
          <p style="color: #55403b; font-size: 14px;">${emailIntro}</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #a21d32; padding: 16px; background-color: #faf4f0; border-radius: 8px; text-align: center; margin: 20px 0;">
            ${rawOtp}
          </div>
          <p style="color: #8c6d68; font-size: 12px;">This verification code will expire in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `${emailIntro} ${rawOtp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
    });

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
