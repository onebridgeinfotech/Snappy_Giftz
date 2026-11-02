import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { cleanupExpiredArtworkUploads } from '@/lib/personalization/personalization.service';
import { Role } from '@prisma/client';

/**
 * POST /api/admin/personalization/uploads/cleanup
 * Administrative endpoint to trigger cleanup of expired, unattached artwork uploads.
 * Requires ADMIN role.
 * Guarantees that attached customer artwork and generated proofs are never deleted.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await requireRole([Role.ADMIN], req);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin privileges required.' },
        { status: 403 }
      );
    }

    let dryRun = false;
    try {
      const body = await req.json();
      if (body && typeof body.dryRun === 'boolean') {
        dryRun = body.dryRun;
      }
    } catch {
      // Body is optional
    }

    const cleanupResult = await cleanupExpiredArtworkUploads({ dryRun });

    return NextResponse.json({
      success: true,
      data: cleanupResult,
      triggeredBy: authUser.email,
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error during upload cleanup.' },
      { status: 500 }
    );
  }
}
