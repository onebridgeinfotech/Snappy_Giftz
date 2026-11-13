import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, HttpError, readJson, requireCms } from '@/lib/cms/api';
import { revalidateBlog } from '@/lib/cms/revalidate';
import { categoryData } from '@/lib/cms/validators';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const { id } = await params;
    const data = categoryData(await readJson(req));
    if (data.parentId === id) throw new HttpError(400, 'A category cannot be its own parent');
    if (data.parentId) {
      const parent = await prisma.blogCategory.findUnique({ where: { id: data.parentId } });
      if (parent?.parentId) throw new HttpError(400, 'Sub-categories can only be one level deep');
    }
    const category = await prisma.blogCategory.update({ where: { id }, data });
    await audit(user.id, 'CMS_CATEGORY_UPDATED', `BlogCategory:${id}`, { name: category.name });
    revalidateBlog();
    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const { id } = await params;
    // Posts and sub-categories are kept (FK is SET NULL)
    await prisma.blogCategory.delete({ where: { id } });
    await audit(user.id, 'CMS_CATEGORY_DELETED', `BlogCategory:${id}`);
    revalidateBlog();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
