import { NextResponse } from 'next/server';
import { CommentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handleApiError, requireCms } from '@/lib/cms/api';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const status = new URL(req.url).searchParams.get('status');
    const data = await prisma.blogComment.findMany({
      where: status && (Object.values(CommentStatus) as string[]).includes(status) ? { status: status as CommentStatus } : {},
      include: { post: { select: { id: true, title: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}
