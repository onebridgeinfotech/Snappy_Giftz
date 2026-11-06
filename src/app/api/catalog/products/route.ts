import { NextResponse } from 'next/server';
import { getPublicProducts, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const occasion = searchParams.get('occasion') || undefined;
    const rawType = searchParams.get('productType');
    const productType = (rawType === 'REGULAR' || rawType === 'CUSTOMIZABLE') ? rawType : undefined;
    const sort = (searchParams.get('sort') as any) || undefined;
    const page = searchParams.has('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
    const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await getPublicProducts({
      search,
      category,
      occasion,
      productType,
      sort,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const status = error instanceof CatalogDatabaseError ? 503 : 500;
    return NextResponse.json(
      { error: 'Public catalog service is temporarily unavailable' },
      { status }
    );
  }
}
