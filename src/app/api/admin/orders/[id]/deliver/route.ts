import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import {
  confirmOrderDelivery,
  OrderTransitionError,
  OrderFulfillmentError,
  OrderNotFoundError,
} from '@/lib/orders/order-lifecycle.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([Role.ADMIN, Role.STAFF], req);
    const { id } = await params;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed
    }

    const actor = user.name || user.email || 'STAFF';
    const result = await confirmOrderDelivery(
      id,
      {
        deliveredAt: body.deliveredAt,
        notes: body.notes || undefined,
        deliveryOtp: typeof body.deliveryOtp === 'string' ? body.deliveryOtp : undefined,
      },
      actor
    );

    return NextResponse.json({
      success: true,
      message: 'Order delivery confirmed and inventory updated successfully.',
      data: result,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof OrderFulfillmentError) {
      return NextResponse.json({ error: error.message, code: 'DELIVERY_OTP_REQUIRED' }, { status: 400 });
    }
    if (error instanceof OrderTransitionError) {
      return NextResponse.json({ error: error.message, code: 'INVALID_TRANSITION' }, { status: 422 });
    }
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to confirm order delivery.' },
      { status: 500 }
    );
  }
}
