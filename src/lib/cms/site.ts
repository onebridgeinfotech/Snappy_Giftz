import { BUSINESS_CONFIG } from '@/config/business';

/** Canonical public origin, without trailing slash. */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || BUSINESS_CONFIG.website).replace(/\/$/, '');
}

export function absoluteUrl(pathOrUrl: string | null | undefined): string {
  const base = getSiteUrl();
  if (!pathOrUrl) return base;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export const SITE_NAME = BUSINESS_CONFIG.brandName;
export const DEFAULT_OG_IMAGE = '/assets/luxury_hero_banner_full.jpg';

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…';
}
