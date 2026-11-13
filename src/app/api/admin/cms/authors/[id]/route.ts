import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, readJson, requireCms } from '@/lib/cms/api';
import { revalidateBlog } from '@/lib/cms/revalidate';
import { authorData } from '@/lib/cms/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const { id } = await params;
    const author = await prisma.blogAuthor.update({ where: { id }, data: authorData(await readJson(req)) });
    await audit(user.id, 'CMS_AUTHOR_UPDATED', `BlogAuthor:${id}`);
    revalidateBlog();
    return NextResponse.json({ success: true, data: author });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const { id } = await params;
    await prisma.blogAuthor.delete({ where: { id } });
    await audit(user.id, 'CMS_AUTHOR_DELETED', `BlogAuthor:${id}`);
    revalidateBlog();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
