import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/catalog/validation';
import { handleApiError, HttpError, readJson, requireCms, str } from '@/lib/cms/api';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const data = await prisma.blogTag.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { posts: true } } } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireCms(req);
    const body = await readJson(req);
    const name = str(body.name, 60);
    if (!name) throw new HttpError(400, 'Tag name is required');
    const slug = slugify(str(body.slug, 80) || name);
    const tag = await prisma.blogTag.upsert({ where: { slug }, create: { name, slug }, update: {} });
    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
