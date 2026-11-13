import { NextResponse } from 'next/server';
import { audit, handleApiError, HttpError, invalidatePermissions, readJson, requireCms } from '@/lib/cms/api';
import { CMS_SETTING_DEFAULTS, getCmsSetting, setCmsSetting, type CmsSettingKey, type LinkItem } from '@/lib/cms/seo.service';
import { revalidateSite } from '@/lib/cms/revalidate';
import { toStringArray } from '@/lib/cms/site';

const KEYS = Object.keys(CMS_SETTING_DEFAULTS) as CmsSettingKey[];

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const entries = await Promise.all(KEYS.map(async (k) => [k, await getCmsSetting(k)] as const));
    return NextResponse.json({ success: true, data: Object.fromEntries(entries) });
  } catch (error) {
    return handleApiError(error);
  }
}

function cleanLinks(value: unknown, depth = 0): LinkItem[] {
  if (!Array.isArray(value)) throw new HttpError(400, 'Expected a list of links');
  return value.slice(0, 40).map((item) => {
    const label = String((item as any)?.label || '').trim().slice(0, 60);
    const href = String((item as any)?.href || '').trim().slice(0, 500);
    if (!label || !/^(\/|https?:\/\/|#|mailto:|tel:)/i.test(href)) throw new HttpError(400, `Invalid link: "${label || href}"`);
    const children = depth === 0 && Array.isArray((item as any)?.children) ? cleanLinks((item as any).children, 1) : undefined;
    return children?.length ? { label, href, children } : { label, href };
  });
}

function cleanPaths(value: unknown): string[] {
  return toStringArray(value)
    .map((p) => p.slice(0, 200))
    .filter((p) => p.startsWith('/'));
}

export async function PUT(req: Request) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const { key, value } = await readJson<{ key: CmsSettingKey; value: any }>(req);
    if (!KEYS.includes(key)) throw new HttpError(400, 'Unknown setting');

    let clean: unknown;
    if (key === 'navigation' || key === 'footerLinks') clean = cleanLinks(value);
    else if (key === 'robots') {
      const crawl = Number(value?.crawlDelay);
      clean = {
        allow: cleanPaths(value?.allow),
        disallow: cleanPaths(value?.disallow),
        extraRules: Array.isArray(value?.extraRules)
          ? value.extraRules.slice(0, 20).map((r: any) => ({
              userAgent: String(r?.userAgent || '*').slice(0, 80),
              allow: cleanPaths(r?.allow),
              disallow: cleanPaths(r?.disallow),
            }))
          : [],
        crawlDelay: Number.isFinite(crawl) && crawl > 0 ? Math.min(60, crawl) : null,
      };
    } else if (key === 'permissions') {
      clean = { staffCanPublish: value?.staffCanPublish === true };
      invalidatePermissions();
    } else if (key === 'siteSeo') {
      clean = {
        titleSuffix: String(value?.titleSuffix ?? '').slice(0, 60),
        defaultDescription: String(value?.defaultDescription ?? '').slice(0, 320),
        defaultOgImage: String(value?.defaultOgImage ?? '').slice(0, 1000),
        twitterHandle: String(value?.twitterHandle ?? '').replace(/[^\w@]/g, '').slice(0, 40),
      };
    }

    await setCmsSetting(key, clean, user.id);
    await audit(user.id, 'CMS_SETTING_UPDATED', `CmsSetting:${key}`);
    revalidateSite();
    return NextResponse.json({ success: true, data: clean });
  } catch (error) {
    return handleApiError(error);
  }
}
