/**
 * Ensures .env.hostinger contains every key currently on Hostinger (38+).
 * Usage: node scripts/validate-hostinger-env.cjs .env.hostinger
 */
const fs = require('fs');
const path = require('path');

const REQUIRED_KEYS = [
  'SMTP_PASSWORD',
  'NODE_ENV',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXTAUTH_URL',
  'DATABASE_URL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_FROM_EMAIL',
  'SMTP_FROM_NAME',
  'EMAIL_FROM',
  'EMAIL_AUTO_DISPATCH',
  'ADMIN_EMAIL',
  'ADMIN_BOOTSTRAP_PASSWORD',
  'ADMIN_EMAILS',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_DRIVE_ROOT_FOLDER_ID',
  'GOOGLE_DRIVE_PRODUCT_IMAGES_FOLDER_ID',
  'GOOGLE_DRIVE_CUSTOMER_PHOTOS_FOLDER_ID',
  'GOOGLE_DRIVE_ORDER_ATTACHMENTS_FOLDER_ID',
  'GOOGLE_DRIVE_INVOICES_FOLDER_ID',
  'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY',
  'GOOGLE_PICKER_API_KEY',
  'NEXTAUTH_SECRET',
  'SESSION_SECRET',
  'OTP_SECRET',
  'CRON_SECRET',
  'INTERNAL_WORKER_SECRET',
  'ALLOW_DEMO_FALLBACK',
  'RATE_LIMIT_BACKEND',
  'WHATSAPP_ADMIN_NOTIFY_PHONE',
  'SUPPLIER_GST_STATE_CODE',
  'GOOGLE_DRIVE_REDIRECT_URI',
];

const dotenvPath = process.argv[2];
if (!dotenvPath) {
  console.error('Usage: node scripts/validate-hostinger-env.cjs <path-to-dotenv>');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(dotenvPath), 'utf8');
const present = new Set();
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq <= 0) continue;
  present.add(t.slice(0, eq).trim());
}

const missing = REQUIRED_KEYS.filter((k) => !present.has(k));
if (missing.length) {
  console.error('Missing keys (' + missing.length + '):');
  for (const k of missing) console.error('  ' + k);
  process.exit(1);
}
console.log('OK: all', REQUIRED_KEYS.length, 'required keys present.');
