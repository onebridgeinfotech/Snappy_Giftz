import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/catalog/validation';
import { audit, handleApiError, HttpError, readJson, requireCms, str } from '@/lib/cms/api';
import { revalidateContentPage } from '@/lib/cms/revalidate';
import { pageData } from '@/lib/cms/validators';

/** Lists every product (with its landing page if one exists) plus all service pages. */
export async function GET(req: Request) {
  try {
    await requireCms(req);
    const [products, services] = await Promise.all([
      prisma.product.findMany({
        where: { isArchived: false },
        select: { id: true, name: true, slug: true, isActive: true, contentPage: true },
        orderBy: { name: 'asc' },
      }),
      prisma.contentPage.findMany({ where: { kind: 'SERVICE' }, orderBy: { title: 'asc' } }),
    ]);
    return NextResponse.json({ success: true, data: { products, services } });
  } catch (error) {
    return handleApiError(error);
  }
}


/** Create a landing page: for a product (productId) or a standalone service. */
export async function POST(req: Request) {
  try {
    const user = await requireCms(req);
    const body = await readJson(req);
    const data = pageData(body);
    const productId = str(body.productId, 64);
    let page;
    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new HttpError(404, 'Product not found', 'NOT_FOUND');
      page = await prisma.contentPage.upsert({
        where: { productId },
        create: { ...data, kind: 'PRODUCT', productId, slug: product.slug },
        update: data,
      });
    } else {
      const slug = slugify(str(body.slug, 120) || data.title);
      if (!slug) throw new HttpError(400, 'A slug is required');
      page = await prisma.contentPage.create({ data: { ...data, kind: 'SERVICE', slug } });
    }
    await audit(user.id, 'CMS_LANDING_PAGE_SAVED', `ContentPage:${page.id}`, { kind: page.kind, slug: page.slug });
    revalidateContentPage(page.kind, page.slug);
    return NextResponse.json({ success: true, data: page }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
