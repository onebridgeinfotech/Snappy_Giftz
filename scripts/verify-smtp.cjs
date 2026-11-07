/**
 * Verify Hostinger Titan SMTP credentials (does not send mail).
 * Usage:
 *   set SMTP_USER=info@snappygiftz.com
 *   set SMTP_PASSWORD=***
 *   node scripts/verify-smtp.cjs
 */
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
const port = Number(process.env.SMTP_PORT || 465);
const secure = process.env.SMTP_SECURE === 'false' ? false : port === 465;
const user = (process.env.SMTP_USER || 'info@snappygiftz.com').trim();
const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '';

if (!pass) {
  console.error('Set SMTP_PASSWORD (or SMTP_PASS) before running.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
});

transporter
  .verify()
  .then(() => {
    console.log(`OK: SMTP login verified for ${user} @ ${host}:${port}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('FAIL:', err?.message || err);
    process.exit(1);
  });
