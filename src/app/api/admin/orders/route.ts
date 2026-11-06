import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role, OrderStatus, PaymentStatus } from '@prisma/client';
import { listOrdersForAdmin } from '@/lib/orders/order-lifecycle.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || undefined;
    const orderStatus = searchParams.get('orderStatus') as OrderStatus | undefined;
    const paymentStatus = searchParams.get('paymentStatus') as PaymentStatus | undefined;
    const paymentMethod = searchParams.get('paymentMethod') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';

    const result = await listOrdersForAdmin({
      page,
      limit,
      search,
      orderStatus,
      paymentStatus,
      paymentMethod,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve admin order list.' },
      { status: 500 }
    );
  }
}
