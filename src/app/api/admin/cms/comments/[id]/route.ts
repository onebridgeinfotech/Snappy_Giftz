import { NextResponse } from 'next/server';
import { CommentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handleApiError, HttpError, readJson, requireCms } from '@/lib/cms/api';
import { revalidateBlog } from '@/lib/cms/revalidate';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireCms(req);
    const { id } = await params;
    const { status } = await readJson<{ status?: string }>(req);
    if (!status || !(Object.values(CommentStatus) as string[]).includes(status)) throw new HttpError(400, 'Invalid status');
    const comment = await prisma.blogComment.update({ where: { id }, data: { status: status as CommentStatus }, include: { post: { select: { slug: true } } } });
    revalidateBlog(comment.post.slug);
    return NextResponse.json({ success: true, data: comment });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await requireCms(req, 'content:delete');
    const { id } = await params;
    const comment = await prisma.blogComment.delete({ where: { id }, include: { post: { select: { slug: true } } } });
    revalidateBlog(comment.post.slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
