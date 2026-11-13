import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, toStringArray } from './site';

// ---------------------------------------------------------------------------
// CMS key/value settings
// ---------------------------------------------------------------------------

export interface RobotsSettings {
  disallow: string[];
  allow: string[];
  extraRules: Array<{ userAgent: string; allow?: string[]; disallow?: string[] }>;
  crawlDelay?: number | null;
}

export interface LinkItem {
  label: string;
  href: string;
  children?: LinkItem[];
}

export interface SiteSeoDefaults {
  titleSuffix: string;
  defaultDescription: string;
  defaultOgImage: string;
  twitterHandle: string;
}

export const CMS_SETTING_DEFAULTS = {
  robots: {
    allow: ['/'],
    disallow: ['/api/admin/', '/api/auth/', '/api/b2b/', '/api/', '/admin', '/account', '/cart', '/checkout', '/login', '/register', '/reset-password', '/delivery/', '/blog/preview/', '/*?*admin=*'],
    extraRules: [],
    crawlDelay: null,
  } as RobotsSettings,
  navigation: [
    { label: 'Shop', href: '/#catalog-section' },
    { label: 'Services', href: '/services' },
    { label: 'Blog', href: '/blog' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ] as LinkItem[],
  footerLinks: [
    { label: 'Gifting Journal', href: '/blog' },
    { label: 'Gifting Services', href: '/services' },
    { label: 'RSS Feed', href: '/rss.xml' },
  ] as LinkItem[],
  permissions: { staffCanPublish: false } as { staffCanPublish: boolean },
  siteSeo: {
    titleSuffix: ` | ${SITE_NAME}`,
    defaultDescription: 'Personalized luxury gifts, custom engraving and express delivery across Hyderabad.',
    defaultOgImage: DEFAULT_OG_IMAGE,
    twitterHandle: '',
  } as SiteSeoDefaults,
};

export type CmsSettingKey = keyof typeof CMS_SETTING_DEFAULTS;

export async function getCmsSetting<K extends CmsSettingKey>(key: K): Promise<(typeof CMS_SETTING_DEFAULTS)[K]> {
  try {
    const row = await prisma.cmsSetting.findUnique({ where: { key } });
    if (row?.value !== undefined && row.value !== null) {
      const fallback = CMS_SETTING_DEFAULTS[key];
      if (Array.isArray(fallback)) return row.value as unknown as (typeof CMS_SETTING_DEFAULTS)[K];
      return { ...(fallback as object), ...(row.value as object) } as unknown as (typeof CMS_SETTING_DEFAULTS)[K];
    }
  } catch {
    // DB unavailable — fall through to defaults
  }
  return CMS_SETTING_DEFAULTS[key];
}

export async function setCmsSetting(key: CmsSettingKey, value: unknown, updatedBy?: string) {
  return prisma.cmsSetting.upsert({
    where: { key },
    create: { key, value: value as object, updatedBy },
    update: { value: value as object, updatedBy },
  });
}

// ---------------------------------------------------------------------------
// Metadata builder shared by product, service, blog and static pages
// ---------------------------------------------------------------------------

export interface SeoFields {
  seoTitle?: string | null;
  metaDescription?: string | null;
  keywords?: unknown;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  twitterImageUrl?: string | null;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
}

export function buildMetadata(opts: {
  path: string;
  title: string;
  description: string;
  image?: string | null;
  type?: 'website' | 'article';
  seo?: SeoFields | null;
  keywords?: string[];
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
  authors?: string[];
  section?: string | null;
  tags?: string[];
  titleIsAbsolute?: boolean;
}): Metadata {
  const seo = opts.seo || {};
  const title = seo.seoTitle?.trim() || opts.title;
  const description = (seo.metaDescription?.trim() || opts.description).slice(0, 320);
  const canonical = seo.canonicalUrl?.trim() || opts.path;
  const ogImage = seo.ogImageUrl || opts.image || DEFAULT_OG_IMAGE;
  const twitterImage = seo.twitterImageUrl || ogImage;
  const keywords = [...new Set([...toStringArray(seo.keywords), ...(opts.keywords || [])])];
  const index = seo.robotsIndex !== false;
  const follow = seo.robotsFollow !== false;
  const fullTitle = opts.titleIsAbsolute || /\|\s*SNAPPY GIFTZ/i.test(title) ? title : `${title} | ${SITE_NAME}`;

  return {
    title: { absolute: fullTitle },
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: { canonical },
    robots: { index, follow, googleBot: { index, follow, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: {
      title: fullTitle,
      description,
      url: absoluteUrl(opts.path),
      siteName: SITE_NAME,
      locale: 'en_IN',
      type: opts.type || 'website',
      images: [{ url: ogImage, alt: title }],
      ...(opts.type === 'article'
        ? {
            publishedTime: opts.publishedTime?.toISOString(),
            modifiedTime: opts.modifiedTime?.toISOString(),
            authors: opts.authors,
            section: opts.section || undefined,
            tags: opts.tags,
          }
        : {}),
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [twitterImage] },
  };
}

/** Admin-managed overrides for any route (SeoEntry), merged over page defaults. */
export async function getSeoEntry(path: string) {
  try {
    return await prisma.seoEntry.findUnique({ where: { path } });
  } catch {
    return null;
  }
}

export async function metadataForStaticPath(path: string, defaults: { title: string; description: string; image?: string }): Promise<Metadata> {
  const entry = await getSeoEntry(path);
  return buildMetadata({ path, title: defaults.title, description: defaults.description, image: defaults.image, seo: entry });
}
