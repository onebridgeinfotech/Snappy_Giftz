import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, HttpError, readJson, requireCms, str } from '@/lib/cms/api';
import { categoryData } from '@/lib/cms/validators';
import { revalidateBlog } from '@/lib/cms/revalidate';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const data = await prisma.blogCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { posts: true, children: true } } },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}


export async function POST(req: Request) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const category = await prisma.blogCategory.create({ data: categoryData(await readJson(req)) });
    await audit(user.id, 'CMS_CATEGORY_CREATED', `BlogCategory:${category.id}`, { name: category.name });
    revalidateBlog();
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
