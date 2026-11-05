import { BUSINESS_CONFIG } from '@/config/business';

export type SnappyEmailBrand = {
  name: string;
  siteUrl: string;
  tagline: string;
  supportEmail: string;
  phoneDisplay: string;
  primary: string;
  accent: string;
  accentHover: string;
  muted: string;
  border: string;
  bg: string;
  cardBg: string;
  logoUrl: string;
};

const siteUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || BUSINESS_CONFIG.website).replace(
  /\/$/,
  ''
);

export const SNAPPY_EMAIL_BRAND: SnappyEmailBrand = {
  name: BUSINESS_CONFIG.brandName,
  siteUrl,
  tagline: 'Turning Moments Into Memories',
  supportEmail: BUSINESS_CONFIG.officialEmail,
  phoneDisplay: BUSINESS_CONFIG.whatsappFormatted,
  primary: '#08090B',
  accent: '#F5BD48',
  accentHover: '#D5A34A',
  muted: '#64748b',
  border: '#e6eaf0',
  bg: '#f4f4f5',
  cardBg: '#ffffff',
  logoUrl: `${siteUrl}/assets/snappy-gifts-trimmed.png`,
};

/** Bulletproof CTA button (OneSocial-style table layout). */
export function ctaButton(href: string, label: string, brand: SnappyEmailBrand = SNAPPY_EMAIL_BRAND): string {
  const safeHref = String(href || brand.siteUrl).replace(/"/g, '&quot;');
  const safeLabel = String(label || 'Continue')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
  <tr>
    <td align="left" bgcolor="${brand.accentHover}" style="border-radius:10px;background-color:${brand.accentHover};">
      <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.2;font-weight:700;color:${brand.primary};text-decoration:none;border-radius:10px;">${safeLabel}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:${brand.muted};">Button not working? Paste this link into your browser:<br/>
<a href="${safeHref}" style="color:${brand.accentHover};word-break:break-all;">${safeHref}</a></p>`;
}

/**
 * Full HTML document wrapper for transactional emails (table layout for clients).
 */
export function wrapSnappyTransactionalEmail(opts: {
  bodyHtml: string;
  preheader?: string;
  brand?: SnappyEmailBrand;
}): string {
  const brand = opts.brand || SNAPPY_EMAIL_BRAND;
  const preheader = (opts.preheader || '').replace(/</g, '&lt;');
  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>${brand.name}</title>
</head>
<body style="margin:0;padding:0;background:${brand.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${brand.primary};">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${brand.bg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td style="font-size:15px;line-height:1.65;color:${brand.primary};">
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 8px 0;font-size:11px;line-height:1.55;color:${brand.muted};text-align:center;">
            © ${new Date().getFullYear()} ${brand.name} · <a href="${brand.siteUrl}" style="color:${brand.accentHover};text-decoration:none;">${brand.siteUrl.replace(/^https?:\/\//, '')}</a><br/>
            Need help? <a href="mailto:${brand.supportEmail}" style="color:${brand.muted};">${brand.supportEmail}</a>${brand.phoneDisplay ? ` · ${brand.phoneDisplay}` : ''}
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
  const purposeCopy: Record<OtpEmailPurpose, { headline: string; lead: string; subject: string }> = {
    LOGIN: {
      headline: 'Your sign-in code',
      lead: 'Enter this code to sign in to your SNAPPY GIFTZ account.',
      subject: `Your SNAPPY GIFTZ sign-in code: ${opts.code}`,
    },
    REGISTER: {
      headline: 'Verify your email',
      lead: 'Enter this code to complete your registration.',
      subject: `Verify your SNAPPY GIFTZ account: ${opts.code}`,
    },
    PASSWORD_RESET: {
      headline: 'Reset your password',
      lead: 'Enter this code to choose a new password for your account.',
      subject: `Reset your SNAPPY GIFTZ password: ${opts.code}`,
    },
  };
  const copy = purposeCopy[opts.purpose];

  const inner = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${brand.cardBg};border:1px solid ${brand.border};border-radius:12px;">
  <tr>
    <td align="center" style="padding:28px 32px 20px;border-bottom:1px solid #eef2f6;background:${brand.primary};border-radius:12px 12px 0 0;">
      <a href="${brand.siteUrl}" style="text-decoration:none;display:inline-block;">
        <img src="${brand.logoUrl}" width="120" height="48" alt="${brand.name}" style="display:block;margin:0 auto 8px;border:0;outline:none;height:48px;width:auto;max-width:160px;" />
        <span style="display:block;text-align:center;color:#F1F5F9;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">${brand.tagline}</span>
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <h1 style="margin:0 0 10px;font-size:20px;line-height:1.35;font-weight:700;color:${brand.primary};">${copy.headline}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:${brand.muted};">
        ${copy.lead} It expires in <strong style="color:${brand.primary};">${opts.expiryMinutes} minutes</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="background:#fafafa;border:1px solid ${brand.border};border-radius:10px;padding:18px 12px;">
            <span style="display:inline-block;white-space:nowrap;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:0.28em;color:${brand.primary};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding-left:0.28em;">
              ${opts.code}
            </span>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:${brand.muted};">
        If you did not request this, you can safely ignore this email. Never share this code with anyone.
      </p>
    </td>
  </tr>
</table>`;

  const html = wrapSnappyTransactionalEmail({
    bodyHtml: inner,
    preheader: `${copy.headline}: ${opts.code}`,
  });

  const text = `${copy.headline}\n\nYour code: ${opts.code}\nValid for ${opts.expiryMinutes} minutes.\n\n${brand.siteUrl}`;

  return { html, text, subject: copy.subject };
}
