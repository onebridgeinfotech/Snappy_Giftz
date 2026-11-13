import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, bool, handleApiError, HttpError, readJson, requireCms, str } from '@/lib/cms/api';
import { authorData } from '@/lib/cms/validators';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const data = await prisma.blogAuthor.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { posts: true } } } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}


export async function POST(req: Request) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const author = await prisma.blogAuthor.create({ data: authorData(await readJson(req)) });
    await audit(user.id, 'CMS_AUTHOR_CREATED', `BlogAuthor:${author.id}`, { name: author.name });
    return NextResponse.json({ success: true, data: author }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
