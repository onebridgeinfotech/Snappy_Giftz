import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, readJson, requireCms } from '@/lib/cms/api';
import { revalidateContentPage } from '@/lib/cms/revalidate';
import { pageData } from '@/lib/cms/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req);
    const { id } = await params;
    const page = await prisma.contentPage.update({ where: { id }, data: pageData(await readJson(req)) });
    await audit(user.id, 'CMS_LANDING_PAGE_UPDATED', `ContentPage:${id}`, { slug: page.slug });
    revalidateContentPage(page.kind, page.slug);
    return NextResponse.json({ success: true, data: page });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'content:delete');
    const { id } = await params;
    const page = await prisma.contentPage.delete({ where: { id } });
    await audit(user.id, 'CMS_LANDING_PAGE_DELETED', `ContentPage:${id}`, { slug: page.slug });
    revalidateContentPage(page.kind, page.slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
