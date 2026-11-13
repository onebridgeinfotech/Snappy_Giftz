import { NextResponse } from 'next/server';
import { audit, handleApiError, requireCms } from '@/lib/cms/api';
import { generateProductLandingPages } from '@/lib/cms/product-pages';
import { revalidateSite } from '@/lib/cms/revalidate';

/** Create a dedicated landing page for every product that lacks one (existing pages are untouched). */
export async function POST(req: Request) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const result = await generateProductLandingPages();
    await audit(user.id, 'CMS_PRODUCT_PAGES_GENERATED', 'ContentPage:bulk', result);
    revalidateSite();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
