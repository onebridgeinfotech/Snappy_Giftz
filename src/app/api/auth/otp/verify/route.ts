import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOtpChallenge } from '@/lib/auth/otp';
import { createSession, getSessionCookieOptions } from '@/lib/auth/session';
import { Role } from '@prisma/client';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code, purpose = 'LOGIN' } = body;

    if (!email || !code || typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ error: 'Please provide both your email address and verification code.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // Rate Limiting Guard: Prevent brute-force 6-digit OTP guessing
    const rateLimit = await enforceRateLimit('AUTH_OTP_VERIFY', `${ipAddress}:${cleanEmail}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many incorrect verification attempts. Please request a new code or try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
        }
      );
    }

    // 1. Find the latest active OTP challenge
    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        email: cleanEmail,
        purpose,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      return NextResponse.json({
        error: 'No active verification code found for this email. Please request a new code.',
      }, { status: 404 });
    }

    // 2. Validate OTP challenge rules (expiry, attempt count, code match)
    const result = validateOtpChallenge(challenge, cleanCode);

    if (!result.success) {
      // Increment attempt counter in database atomically
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      }).catch(() => {});

      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 3. Atomically consume the OTP challenge to prevent race conditions & replay attacks
    const consumption = await prisma.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        isUsed: false, // Must still be unconsumed
      },
      data: { isUsed: true },
    });

    // If count === 0, another concurrent request consumed this challenge first
    if (consumption.count === 0) {
      return NextResponse.json({
        error: 'This verification code has already been consumed. Please request a new code.',
      }, { status: 400 });
    }

    // 4. Find or create user
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          role: Role.CUSTOMER,
          isEmailVerified: true,
        },
      });

      // New account via email OTP: send the same welcome email as password sign-up (non-blocking).
      const newUser = user;
      void (async () => {
        try {
          const [{ getSellerConfig }, { renderCustomerRegistrationTemplate }, { enqueueTransactionalEmail }] = await Promise.all([
            import('@/lib/invoices/seller-config.service'),
            import('@/lib/email/email-templates'),
            import('@/lib/email/email-outbox.service'),
          ]);
          const seller = await getSellerConfig();
          const emailContent = renderCustomerRegistrationTemplate(seller, {
            customerName: newUser.name,
            customerEmail: newUser.email,
          });
          await enqueueTransactionalEmail({
            idempotencyKey: `email:welcome:${newUser.id}`,
            eventType: 'CUSTOMER_REGISTRATION',
            recipientEmail: newUser.email,
            recipientName: newUser.name,
            subject: emailContent.subject,
            htmlBody: emailContent.html,
            textBody: emailContent.text,
          });
        } catch (err) {
          console.warn('[OTP_SIGNUP] Welcome email not queued:', err);
        }
      })();
    } else {
      // Security Check: Block deactivated accounts from bypassing suspension via OTP
      if (!user.isActive) {
        return NextResponse.json(
          { error: 'This account has been deactivated. Please contact support.' },
          { status: 403 }
        );
      }

      if (!user.isEmailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { isEmailVerified: true },
        });
      }
    }

    // 5. Create persistent session with token hash in DB and set HTTP-only cookie
    const userAgent = req.headers.get('user-agent') || undefined;

    const { sessionToken, expiresAt } = await createSession(user.id, { userAgent, ipAddress });
    const cookieOptions = getSessionCookieOptions(expiresAt);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });

    response.cookies.set(cookieOptions.name, sessionToken, cookieOptions);
    return response;
  } catch (error) {
    console.error('[API_AUTH_OTP_VERIFY] Error:', error);
    return NextResponse.json({ error: 'Failed to verify code. Please try again.' }, { status: 500 });
  }
}
