import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { getDamageReports } from '@/lib/damage-reports/damage-report.service';

export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const claims = await getDamageReports({ status, search });

    return NextResponse.json({
      success: true,
      data: claims,
      meta: {
        total: claims.length,
        pendingReviewCount: claims.filter((c) => c.status === 'PENDING_OWNER_REVIEW').length,
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error('[ADMIN_DAMAGE_REPORTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve damage reports.' }, { status: 500 });
  }
}

