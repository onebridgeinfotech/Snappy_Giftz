import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, readJson, requireCms } from '@/lib/cms/api';
import { invalidateRedirectCache } from '@/lib/cms/redirects';
import { redirectData } from '@/lib/cms/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const { id } = await params;
    const redirect = await prisma.redirect.update({ where: { id }, data: redirectData(await readJson(req)) });
    invalidateRedirectCache();
    await audit(user.id, 'CMS_REDIRECT_UPDATED', `Redirect:${id}`);
    return NextResponse.json({ success: true, data: redirect });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const { id } = await params;
    const redirect = await prisma.redirect.delete({ where: { id } });
    invalidateRedirectCache();
    await audit(user.id, 'CMS_REDIRECT_DELETED', `Redirect:${id}`, { from: redirect.fromPath });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
