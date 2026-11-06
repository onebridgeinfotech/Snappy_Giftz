import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { getDamageReportById, reviewDamageReport } from '@/lib/damage-reports/damage-report.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);
    const { claimId } = await params;

    const claim = await getDamageReportById(claimId);
    if (!claim) {
      return NextResponse.json({ error: 'Damage claim not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: claim });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const operator = await requireRole([Role.ADMIN], req);
    const { claimId } = await params;

    const body = await req.json();
    const { action, ownerNotes } = body;

    if (!action || !['APPROVE_REPLACEMENT', 'APPROVE_REFUND', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action required: APPROVE_REPLACEMENT, APPROVE_REFUND, or REJECT' },
        { status: 400 }
      );
    }

    if (!ownerNotes || typeof ownerNotes !== 'string' || ownerNotes.trim().length < 5) {
      return NextResponse.json(
        { error: 'Please provide explanatory owner review notes (at least 5 characters).' },
        { status: 400 }
      );
    }

    const updatedClaim = await reviewDamageReport(claimId, {
      action,
      ownerNotes,
      reviewedBy: operator.email || 'STORE_OWNER',
    });

    return NextResponse.json({
      success: true,
      message: `Damage claim ${claimId} successfully updated to ${action}. Customer notified.`,
      data: updatedClaim,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error('[ADMIN_DAMAGE_REPORT_REVIEW_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to review damage report' },
      { status: 500 }
    );
  }
}

