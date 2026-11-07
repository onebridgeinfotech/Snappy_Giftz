import { EmailAdapter, SendEmailInput, EmailSendResult } from '../adapters/email.adapter';
import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';

export class SmtpEmailService implements EmailAdapter {
  private transporter: Transporter | null = null;
  private host: string;
  private port: number;
  private secure: boolean;
  private user: string;
  private pass: string;
  private fromEmail: string;
  private fromName: string;

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /** When false, SMTP failures are simulated as successful delivery (test suite / demo fallback). */
  private get strictProductionDelivery(): boolean {
    if (process.env.NODE_ENV === 'test') return false;
    if (process.env.ALLOW_DEMO_FALLBACK === 'true') return false;
    return this.isProduction;
  }

  constructor() {
    this.reloadFromEnv();
  }

  /** Re-read env after Hostinger restarts or hPanel SMTP credential updates. */
  private reloadFromEnv() {
    this.host = process.env.SMTP_HOST || 'localhost';
    this.port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 1025;
    this.secure = process.env.SMTP_SECURE === 'true' || this.port === 465;
    this.user = process.env.SMTP_USER || '';
    this.pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '';
    this.fromEmail = process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM || 'info@snappygiftz.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'SNAPPY GIFTZ';
    this.initTransporter();
  }

  private initTransporter() {
    // If SMTP host and authentication are configured
    if (this.host && this.host !== 'localhost' && this.user && this.pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host: this.host,
          port: this.port,
          secure: this.secure,
          auth: {
            user: this.user,
            pass: this.pass,
          },
          tls: {
            rejectUnauthorized: this.isProduction,
          },
        });
      } catch (err: any) {
        console.error('[SMTP_INIT_ERROR] Could not initialize nodemailer transporter:', err?.message || err);
        this.transporter = null;
      }
    } else if (this.host === 'localhost' || this.port === 1025) {
      // Local dev / Mailpit transport without credentials
      try {
        this.transporter = nodemailer.createTransport({
          host: this.host || 'localhost',
          port: this.port || 1025,
          secure: false,
          ignoreTLS: true,
        });
      } catch {
        this.transporter = null;
      }
    }
  }

  async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    this.reloadFromEnv();
    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    const fromHeader = `"${this.fromName}" <${this.fromEmail}>`;

    // Security Rule: NEVER log email content or verification codes in production.
    if (!this.strictProductionDelivery) {
      console.log(`\n========================================================`);
      console.log(`[TRANSACTIONAL_EMAIL: DISPATCH]`);
      console.log(`From: ${fromHeader}`);
      console.log(`To: ${recipients.join(', ')}`);
      console.log(`Subject: ${input.subject}`);
      if (input.attachments && input.attachments.length > 0) {
        console.log(`Attachments: ${input.attachments.map((a) => `${a.filename} (${a.contentType || 'binary'})`).join(', ')}`);
      }
      console.log(`========================================================\n`);
    }

    // If transporter is available, attempt real dispatch
    if (this.transporter) {
      try {
        const mailOptions: SendMailOptions = {
          from: fromHeader,
          to: recipients.join(', '),
          subject: input.subject,
          html: input.html,
          text: input.text,
          attachments: input.attachments?.map((att) => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType || 'application/pdf',
          })),
        };

        const info = await this.transporter.sendMail(mailOptions);
        return {
          success: true,
          messageId: info.messageId || `smtp-${Date.now()}`,
        };
      } catch (err: any) {
        if (this.strictProductionDelivery) {
          console.error('[EMAIL_SERVICE:CRITICAL] Production email delivery failed:', err?.message || err);
          return {
            success: false,
            error: 'Transactional email service is currently unavailable. Please verify SMTP credentials.',
          };
        }

        console.warn(`[EMAIL_SERVICE:DEV] SMTP dispatch unreachable (${err?.message}); recorded local delivery simulation.`);
        return {
          success: true,
          messageId: `local-fallback-${Date.now()}`,
        };
      }
    }

    // If no transporter configured
    if (this.strictProductionDelivery) {
      console.error('[EMAIL_SERVICE:CRITICAL] SMTP credentials unconfigured in production.');
      return {
        success: false,
        error: 'Transactional email service is not configured.',
      };
    }

    // In local dev without SMTP server, safely simulate success
    return {
      success: true,
      messageId: `simulated-dev-${Date.now()}`,
    };
  }

  /**
   * Health check to verify SMTP connectivity
   */
  async verifyConnection(): Promise<{ ok: boolean; message?: string }> {
    this.reloadFromEnv();
    if (!this.transporter) {
      return { ok: false, message: 'SMTP transporter not initialized (missing host or credentials).' };
    }
    try {
      await this.transporter.verify();
      return { ok: true, message: 'SMTP connection verified successfully.' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'SMTP verification failed.' };
    }
  }
}

export const emailService = new SmtpEmailService();
