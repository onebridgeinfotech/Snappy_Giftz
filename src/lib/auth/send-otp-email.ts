import { prisma } from '@/lib/prisma';
import {
  generateSecureOtp,
  hashOtp,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '@/lib/auth/otp';
import { renderOtpEmailHtml, type OtpEmailPurpose } from '@/lib/email/snappy-email-brand';
import { emailService } from '@/services/email/mailpit.service';

export async function createAndSendOtpChallenge(opts: {
  email: string;
  purpose: OtpEmailPurpose;
  requireExistingUser?: boolean;
  requirePasswordAccount?: boolean;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cleanEmail = opts.email.trim().toLowerCase();

  const recentChallenge = await prisma.otpChallenge.findFirst({
    where: {
      email: cleanEmail,
      purpose: opts.purpose,
      createdAt: {
        gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000),
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentChallenge) {
    return {
      ok: false,
      status: 429,
      error: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new code.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

  if (opts.requireExistingUser && !user) {
    // Do not reveal whether the account exists
    return { ok: true };
  }

  if (opts.requirePasswordAccount && (!user || !user.passwordHash)) {
    return { ok: true };
  }

  await prisma.otpChallenge.updateMany({
    where: { email: cleanEmail, purpose: opts.purpose, isUsed: false },
    data: { isUsed: true },
  });

  const rawOtp = generateSecureOtp();
  const otpHash = hashOtp(rawOtp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpChallenge.create({
    data: {
      email: cleanEmail,
      otpHash,
      purpose: opts.purpose,
      expiresAt,
      maxAttempts: 3,
      userId: user?.id,
    },
  });

  const mail = renderOtpEmailHtml({
    code: rawOtp,
    purpose: opts.purpose,
    expiryMinutes: OTP_EXPIRY_MINUTES,
  });

  await emailService.sendEmail({
    to: cleanEmail,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  return { ok: true };
}
