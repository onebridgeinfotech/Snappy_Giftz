import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, HttpError, readJson, requireCms, str } from '@/lib/cms/api';
import { normalizePath } from '@/lib/cms/redirects';
import { revalidateSite } from '@/lib/cms/revalidate';
import { seoFieldsData } from '@/lib/cms/validators';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const data = await prisma.seoEntry.findMany({ orderBy: { path: 'asc' } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Create or update the SEO override for a path. */
export async function POST(req: Request) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const body = await readJson(req);
    const rawPath = str(body.path, 500);
    if (!rawPath) throw new HttpError(400, 'Path is required (e.g. /about)');
    const path = normalizePath(rawPath);
    const priority = Number(body.sitemapPriority);
    const freq = str(body.changeFrequency, 20);
    const data = {
      ...seoFieldsData(body),
      sitemapPriority: Number.isFinite(priority) ? Math.min(1, Math.max(0, priority)) : 0.5,
      changeFrequency: freq && ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].includes(freq) ? freq : 'weekly',
      updatedBy: user.id,
    };
    const entry = await prisma.seoEntry.upsert({ where: { path }, create: { path, ...data }, update: data });
    await audit(user.id, 'CMS_SEO_ENTRY_SAVED', `SeoEntry:${entry.id}`, { path });
    revalidateSite();
    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    return handleApiError(error);
  }
}
