import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { updateOrderDeliveryCharge, DeliveryError } from '@/lib/delivery/delivery.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/delivery-charge
 * Allows store owner / admin / staff to manually update delivery charge for an order.
 * Body: { deliveryChargePaise: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([Role.ADMIN, Role.STAFF], req);
    const { id } = await params;
    const body = await req.json();

    const { deliveryChargePaise } = body;

    if (typeof deliveryChargePaise !== 'number' || deliveryChargePaise < 0) {
      return NextResponse.json(
        { success: false, error: 'deliveryChargePaise must be a non-negative integer amount.' },
        { status: 400 }
      );
    }

    const updatedOrder = await updateOrderDeliveryCharge(
      id,
      deliveryChargePaise,
      user.name || user.email || 'Owner'
    );

    return NextResponse.json({
      success: true,
      message: `Delivery charge updated to ₹${(deliveryChargePaise / 100).toFixed(2)}.`,
      data: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        shippingTotalPaise: Number(updatedOrder.shippingTotalPaise),
        grandTotalPaise: Number(updatedOrder.grandTotalPaise),
      },
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof DeliveryError ? err.statusCode : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update delivery charge.' },
      { status: statusCode }
    );
  }
}
