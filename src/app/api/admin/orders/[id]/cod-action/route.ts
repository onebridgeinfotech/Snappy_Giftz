import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { approveCodOrder, rejectCodOrder, CodError } from '@/lib/payments/cod.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([Role.ADMIN, Role.STAFF], req);
    const { id } = await params;
    const body = await req.json();

    const { action, reason } = body; // action: "APPROVE" | "REJECT"

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be APPROVE or REJECT.' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'APPROVE') {
      result = await approveCodOrder(id, user.name || user.email);
    } else {
      result = await rejectCodOrder(id, user.name || user.email, reason || 'Address verification failed');
    }

    return NextResponse.json({
      success: true,
      message: `COD order ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof CodError ? err.statusCode : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'COD action failed.' },
      { status: statusCode }
    );
  }
}

