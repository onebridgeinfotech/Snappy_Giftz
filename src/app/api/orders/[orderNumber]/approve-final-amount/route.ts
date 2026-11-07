import { NextResponse } from 'next/server';
import { getOptionalUser } from '@/lib/auth/rbac';
import {
  getOrderApprovalStage,
  customerProcessFinalAmount,
  assertCustomerOrderAccess,
  OrderApprovalError,
} from '@/lib/orders/order-approval.service';

/** Guest checkouts prove ownership with the token returned at order creation (sent as a header, never in the URL). */
function readGuestToken(req: Request, body?: any): string | undefined {
  const fromHeader = req.headers.get('x-order-token');
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  if (body && typeof body.guestToken === 'string' && body.guestToken.trim()) return body.guestToken.trim();
  return undefined;
}
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const user = await getOptionalUser(req);
    await assertCustomerOrderAccess(orderNumber, {
      userId: user?.id,
      userRole: user?.role,
      guestToken: readGuestToken(req),
    });
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
    await assertCustomerOrderAccess(orderNumber, {
      userId: user?.id,
      userRole: user?.role,
      guestToken: readGuestToken(req, body),
    });
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

