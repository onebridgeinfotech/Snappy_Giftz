import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import {
  startLocalDelivery,
  OrderFulfillmentError,
  OrderTransitionError,
  OrderNotFoundError,
} from '@/lib/orders/order-lifecycle.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/local-delivery
 * Hands the order to the store's own delivery person (no courier / AWB) and marks it OUT_FOR_DELIVERY.
 * Body: { assignedPerson: string, assignedPhone?: string, notes?: string, invoicePhysicalSignatureConfirmed?: boolean }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([Role.ADMIN, Role.STAFF], req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const updated = await startLocalDelivery(
      id,
      {
        assignedPerson: typeof body.assignedPerson === 'string' ? body.assignedPerson : '',
        assignedPhone: typeof body.assignedPhone === 'string' ? body.assignedPhone : null,
        assignedEmail: typeof body.assignedEmail === 'string' ? body.assignedEmail : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        invoicePhysicalSignatureConfirmed: Boolean(body.invoicePhysicalSignatureConfirmed),
      },
      user.name || user.email || 'STAFF'
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Order is out for delivery with ${String(body.assignedPerson || '').trim()}.`,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof OrderFulfillmentError) {
      return NextResponse.json({ error: error.message, code: 'FULFILLMENT_VALIDATION_ERROR' }, { status: 400 });
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
      { error: error.message || 'Failed to start local delivery.' },
      { status: 500 }
    );
  }
}
