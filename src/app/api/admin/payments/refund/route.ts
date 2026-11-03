import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { processOrderRefund, RefundError } from '@/lib/payments/refund.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([Role.ADMIN], req);
    const body = await req.json();

    const { orderId, amountPaise, reason, idempotencyKey } = body;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'orderId is required.' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { success: false, error: 'A valid refund reason is required.' },
        { status: 400 }
      );
    }

    const result = await processOrderRefund({
      orderId,
      amountPaise,
      reason,
      processedBy: user.id || user.email,
      idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      message: 'Refund processed successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof RefundError ? err.statusCode : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process refund.' },
      { status: statusCode }
    );
  }
}

