import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { recordCodCollection, CodError } from '@/lib/payments/cod.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([Role.ADMIN, Role.STAFF], req);
    const { id } = await params;
    const body = await req.json();

    const { amountCollectedPaise, collectionMethod, receiptNumber, notes, deliveryOtp } = body;

    if (typeof amountCollectedPaise !== 'number' || amountCollectedPaise <= 0) {
      return NextResponse.json(
        { success: false, error: 'Positive integer amountCollectedPaise is required.' },
        { status: 400 }
      );
    }

    const result = await recordCodCollection({
      orderId: id,
      amountCollectedPaise,
      collector: user.name || user.email,
      collectionMethod: collectionMethod || 'CASH',
      receiptNumber,
      notes,
      deliveryOtp: typeof deliveryOtp === 'string' ? deliveryOtp : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Cash on Delivery collection recorded successfully. Payment marked CAPTURED and invoice issued.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof CodError ? err.statusCode : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to record COD collection.' },
      { status: statusCode }
    );
  }
}

