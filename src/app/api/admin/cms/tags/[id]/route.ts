import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/catalog/validation';
import { handleApiError, HttpError, readJson, requireCms, str } from '@/lib/cms/api';
import { revalidateBlog } from '@/lib/cms/revalidate';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireCms(req, 'cms:settings');
    const { id } = await params;
    const body = await readJson(req);
    const name = str(body.name, 60);
    if (!name) throw new HttpError(400, 'Tag name is required');
    const tag = await prisma.blogTag.update({ where: { id }, data: { name, slug: slugify(str(body.slug, 80) || name) } });
    revalidateBlog();
    return NextResponse.json({ success: true, data: tag });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await requireCms(req, 'cms:settings');
    const { id } = await params;
    await prisma.blogTag.delete({ where: { id } });
    revalidateBlog();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
