import { EmailAdapter, SendEmailInput, EmailSendResult } from '../adapters/email.adapter';
import { SmtpEmailService, emailService as smtpEmailService } from './smtp.service';

/**
 * Backward compatibility alias: MailpitEmailService now uses the robust SmtpEmailService
 * backed by nodemailer with full MIME attachment and TLS support.
 */
export class MailpitEmailService extends SmtpEmailService {}

export const emailService: EmailAdapter = smtpEmailService;
