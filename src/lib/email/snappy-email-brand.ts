import { BUSINESS_CONFIG } from '@/config/business';

export type SnappyEmailBrand = {
  name: string;
  siteUrl: string;
  tagline: string;
  supportEmail: string;
  phoneDisplay: string;
  primary: string;
  primarySoft: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  text: string;
  muted: string;
  border: string;
  bg: string;
  cardBg: string;
  footerBg: string;
  logoUrl: string;
};

const siteUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || BUSINESS_CONFIG.website).replace(
  /\/$/,
  ''
);

function resolveSupportEmail(): string {
  const fromEnv = (process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || '').trim();
  if (fromEnv && fromEnv.includes('@')) return fromEnv;
  return BUSINESS_CONFIG.officialEmail;
}

export const SNAPPY_EMAIL_BRAND: SnappyEmailBrand = {
  name: BUSINESS_CONFIG.brandName,
  siteUrl,
  tagline: 'Turning Moments Into Memories',
  supportEmail: resolveSupportEmail(),
  phoneDisplay: BUSINESS_CONFIG.whatsappFormatted,
  primary: '#08090B',
  primarySoft: '#17181C',
  accent: '#F5BD48',
  accentHover: '#D5A34A',
  accentLight: '#FFF8E7',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  bg: '#eceff3',
  cardBg: '#ffffff',
  footerBg: '#f8fafc',
  logoUrl: `${siteUrl}/assets/snappy-gifts-trimmed.png`,
};

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Logo + dark hero header used on every transactional email. */
export function renderSnappyEmailHeader(eyebrow: string, brand: SnappyEmailBrand = SNAPPY_EMAIL_BRAND): string {
  const safeEyebrow = escapeHtml(eyebrow);
  const safeName = escapeHtml(brand.name);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${brand.primary};border-radius:16px 16px 0 0;">
  <tr>
    <td align="center" style="padding:28px 24px 22px;">
      <a href="${brand.siteUrl}" target="_blank" style="text-decoration:none;">
        <img src="${brand.logoUrl}" width="168" height="64" alt="${safeName}" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:64px;width:auto;max-width:200px;" />
      </a>
      <p style="margin:14px 0 0;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${brand.accent};font-family:Arial,Helvetica,sans-serif;">${safeEyebrow}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(brand.tagline)}</p>
    </td>
  </tr>
  <tr><td style="height:4px;background:linear-gradient(90deg,${brand.accent} 0%,${brand.accentHover} 50%,${brand.accent} 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`;
}

/** In-card footer: address + support (never legacy Gmail). */
export function renderSnappyEmailCardFooter(opts?: {
  legalName?: string;
  gstin?: string;
  brand?: SnappyEmailBrand;
}): string {
  const brand = opts?.brand || SNAPPY_EMAIL_BRAND;
  const legal = escapeHtml(opts?.legalName || brand.name);
  const addr = escapeHtml(BUSINESS_CONFIG.address.formattedSingleLine);
  const gstinLine = opts?.gstin
    ? `<tr><td style="padding:0 0 8px;font-size:12px;color:${brand.muted};font-family:Arial,Helvetica,sans-serif;">GSTIN: ${escapeHtml(opts.gstin)}</td></tr>`
    : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${brand.footerBg};border-top:1px solid ${brand.border};border-radius:0 0 16px 16px;">
  <tr>
    <td style="padding:22px 28px;font-family:Arial,Helvetica,sans-serif;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${brand.primary};">${legal}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:480px;">
        <tr><td style="padding:0 0 8px;font-size:12px;line-height:1.55;color:${brand.muted};">${addr}</td></tr>
        ${gstinLine}
        <tr>
          <td style="padding:8px 0 0;font-size:12px;color:${brand.text};">
            <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${brand.accentHover};font-weight:600;text-decoration:none;">${escapeHtml(brand.supportEmail)}</a>
            ${brand.phoneDisplay ? `<span style="color:${brand.muted};"> · </span><a href="tel:${brand.phoneDisplay.replace(/\s/g, '')}" style="color:${brand.text};text-decoration:none;">${escapeHtml(brand.phoneDisplay)}</a>` : ''}
          </td>
        </tr>
        <tr><td style="padding:10px 0 0;font-size:11px;color:${brand.muted};">${escapeHtml(BUSINESS_CONFIG.operatingHours)}</td></tr>
        <tr>
          <td style="padding:14px 0 0;font-size:11px;color:${brand.muted};">
            Developed by <a href="https://www.onebridgeinfotech.com" target="_blank" rel="noopener noreferrer" style="color:${brand.accentHover};text-decoration:none;font-weight:600;">Onebridge Infotech</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Single cohesive e-commerce card (header + body + footer). */
export function renderSnappyEmailCard(opts: {
  eyebrow: string;
  bodyHtml: string;
  footer?: { legalName?: string; gstin?: string };
  brand?: SnappyEmailBrand;
}): string {
  const brand = opts.brand || SNAPPY_EMAIL_BRAND;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;margin:0 auto;background:${brand.cardBg};border:1px solid ${brand.border};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(8,9,11,0.08);">
  <tr><td style="padding:0;line-height:0;">${renderSnappyEmailHeader(opts.eyebrow, brand)}</td></tr>
  <tr><td style="padding:32px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${brand.text};background:${brand.cardBg};">${opts.bodyHtml}</td></tr>
  <tr><td style="padding:0;">${renderSnappyEmailCardFooter({ ...opts.footer, brand })}</td></tr>
</table>`;
}

/** Bulletproof gold CTA (e-commerce standard). */
export function ctaButton(href: string, label: string, brand: SnappyEmailBrand = SNAPPY_EMAIL_BRAND): string {
  const safeHref = String(href || brand.siteUrl).replace(/"/g, '&quot;');
  const safeLabel = escapeHtml(label || 'Continue');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;">
  <tr>
    <td align="center" bgcolor="${brand.accentHover}" style="border-radius:999px;background-color:${brand.accentHover};">
      <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.2;font-weight:700;color:${brand.primary};text-decoration:none;border-radius:999px;letter-spacing:0.02em;">${safeLabel}</a>
    </td>
  </tr>
</table>`;
}

export function secondaryLink(href: string, label: string, brand: SnappyEmailBrand = SNAPPY_EMAIL_BRAND): string {
  return `<p style="margin:16px 0 0;font-size:13px;text-align:center;"><a href="${href.replace(/"/g, '&quot;')}" style="color:${brand.accentHover};font-weight:600;text-decoration:none;">${escapeHtml(label)} →</a></p>`;
}

/**
 * Full HTML document wrapper for all transactional emails.
 */
export function wrapSnappyTransactionalEmail(opts: {
  bodyHtml: string;
  preheader?: string;
  brand?: SnappyEmailBrand;
}): string {
  const brand = opts.brand || SNAPPY_EMAIL_BRAND;
  const preheader = (opts.preheader || '').replace(/</g, '&lt;');
  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}</div>`
    : '';
  const siteHost = brand.siteUrl.replace(/^https?:\/\//, '');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(brand.name)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.bg};font-family:Arial,Helvetica,sans-serif;color:${brand.text};-webkit-text-size-adjust:100%;">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${brand.bg};">
    <tr><td align="center" style="padding:36px 16px 28px;">
      ${opts.bodyHtml}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;margin:20px auto 0;">
        <tr>
          <td align="center" style="padding:0 12px;font-size:11px;line-height:1.6;color:${brand.muted};">
            <p style="margin:0 0 8px;">You received this email from <strong style="color:${brand.primary};">${escapeHtml(brand.name)}</strong>.</p>
            <p style="margin:0;">
              <a href="${brand.siteUrl}" style="color:${brand.accentHover};text-decoration:none;">${siteHost}</a>
              · <a href="${brand.siteUrl}/privacy" style="color:${brand.muted};text-decoration:underline;">Privacy</a>
              · <a href="${brand.siteUrl}/contact" style="color:${brand.muted};text-decoration:underline;">Contact</a>
            </p>
            <p style="margin:12px 0 0;font-size:10px;color:#94a3b8;">© ${new Date().getFullYear()} ${escapeHtml(brand.name)}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type OtpEmailPurpose = 'LOGIN' | 'REGISTER' | 'PASSWORD_RESET';

export function renderOtpEmailHtml(opts: {
  code: string;
  purpose: OtpEmailPurpose;
  expiryMinutes: number;
}): { html: string; text: string; subject: string } {
  const brand = SNAPPY_EMAIL_BRAND;
  const purposeCopy: Record<OtpEmailPurpose, { headline: string; lead: string; subject: string; eyebrow: string }> = {
    LOGIN: {
      headline: 'Your sign-in code',
      lead: 'Enter this one-time code to access your account.',
      subject: `Your SNAPPY GIFTZ sign-in code: ${opts.code}`,
      eyebrow: 'Secure sign-in',
    },
    REGISTER: {
      headline: 'Verify your email',
      lead: 'Enter this code to complete your registration.',
      subject: `Verify your SNAPPY GIFTZ account: ${opts.code}`,
      eyebrow: 'Email verification',
    },
    PASSWORD_RESET: {
      headline: 'Reset your password',
      lead: 'Enter this code to set a new password.',
      subject: `Reset your SNAPPY GIFTZ password: ${opts.code}`,
      eyebrow: 'Password reset',
    },
  };
  const copy = purposeCopy[opts.purpose];

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:${brand.primary};">${copy.headline}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${brand.muted};">
      ${copy.lead} This code expires in <strong style="color:${brand.primary};">${opts.expiryMinutes} minutes</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="background:${brand.accentLight};border:1px solid ${brand.accent};border-radius:12px;padding:20px 16px;">
          <span style="display:inline-block;font-size:32px;line-height:1;font-weight:700;letter-spacing:0.32em;color:${brand.primary};font-family:Consolas,Monaco,monospace;padding-left:0.32em;">${escapeHtml(opts.code)}</span>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:${brand.muted};">
      If you did not request this, ignore this email. Never share your code with anyone — including our team.
    </p>`;

  const card = renderSnappyEmailCard({ eyebrow: copy.eyebrow, bodyHtml });
  const html = wrapSnappyTransactionalEmail({ bodyHtml: card, preheader: `${copy.headline}: ${opts.code}` });
  const text = `${copy.headline}\n\nYour code: ${opts.code}\nValid for ${opts.expiryMinutes} minutes.\n\n${brand.supportEmail}\n${brand.siteUrl}`;

  return { html, text, subject: copy.subject };
}
