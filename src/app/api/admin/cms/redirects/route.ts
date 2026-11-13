import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, readJson, requireCms } from '@/lib/cms/api';
import { invalidateRedirectCache } from '@/lib/cms/redirects';
import { redirectData } from '@/lib/cms/validators';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const data = await prisma.redirect.findMany({ orderBy: { updatedAt: 'desc' } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const data = redirectData(await readJson(req));
    const redirect = await prisma.redirect.upsert({ where: { fromPath: data.fromPath }, create: data, update: data });
    invalidateRedirectCache();
    await audit(user.id, 'CMS_REDIRECT_SAVED', `Redirect:${redirect.id}`, { from: redirect.fromPath, to: redirect.toPath, code: redirect.statusCode });
    return NextResponse.json({ success: true, data: redirect }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
