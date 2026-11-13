import type { MetadataRoute } from 'next';
import { getCmsSetting } from '@/lib/cms/seo.service';
import { getSiteUrl } from '@/lib/cms/site';

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = getSiteUrl();
  const settings = await getCmsSetting('robots');
  const rules: MetadataRoute.Robots['rules'] = [
    { userAgent: '*', allow: settings.allow, disallow: settings.disallow, ...(settings.crawlDelay ? { crawlDelay: settings.crawlDelay } : {}) },
    ...settings.extraRules.map((r) => ({ userAgent: r.userAgent, allow: r.allow, disallow: r.disallow })),
  ];
  return { rules, sitemap: `${base}/sitemap.xml`, host: base };
}
