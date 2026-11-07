import { NextResponse } from 'next/server';
import { emailService } from '@/services/email/smtp.service';

/**
 * GET /api/health/email — SMTP connectivity (no secrets in response).
 */
export async function GET() {
  const user = (process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || '').trim();
  const host = process.env.SMTP_HOST || 'localhost';
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 1025;
  const hasPassword = Boolean(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);
  const verify = await emailService.verifyConnection();

  return NextResponse.json({
    success: true,
    data: {
      smtpConfigured: Boolean(host && user && hasPassword),
      host,
      port,
      user,
      verifyOk: verify.ok,
      verifyMessage: verify.message,
    },
  });
}
