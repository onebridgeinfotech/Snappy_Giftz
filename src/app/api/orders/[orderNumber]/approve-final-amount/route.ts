import { NextResponse } from 'next/server';
import { getOptionalUser } from '@/lib/auth/rbac';
import {
  getOrderApprovalStage,
  customerProcessFinalAmount,
  OrderApprovalError,
} from '@/lib/orders/order-approval.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const details = await getOrderApprovalStage(orderNumber);

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error: any) {
    if (error instanceof OrderApprovalError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to check order approval stage.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const body = await req.json();
    const { action = 'APPROVE', rejectionReason } = body;

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "APPROVE" or "REJECT".' },
        { status: 400 }
      );
    }

    const user = await getOptionalUser(req);
    const result = await customerProcessFinalAmount(
      orderNumber,
      action,
      user?.id,
      rejectionReason
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error instanceof OrderApprovalError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process final amount approval.' },
      { status: 500 }
    );
  }
}

