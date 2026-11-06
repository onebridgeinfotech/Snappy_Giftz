import { BUSINESS_CONFIG } from '@/config/business';

function siteUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || BUSINESS_CONFIG.website).replace(/\/$/, '');
}

/** Registrable domain for WebAuthn (never use www subdomain as rpID). */
export function getWebAuthnRpId(): string {
  try {
    return new URL(siteUrl()).hostname.replace(/^www\./i, '');
  } catch {
    return 'localhost';
  }
}

export function getWebAuthnOrigins(): string[] {
  const web = siteUrl();
  const origins = new Set<string>([web]);
  try {
    const u = new URL(web);
    const host = u.hostname;
    if (host.startsWith('www.')) {
      origins.add(`${u.protocol}//${host.slice(4)}`);
    } else if (host.includes('.') && host !== 'localhost') {
      origins.add(`${u.protocol}//www.${host}`);
    }
  } catch {
    /* ignore */
  }
  return Array.from(origins);
}

export const WEBAUTHN_RP_NAME = BUSINESS_CONFIG.brandName;
