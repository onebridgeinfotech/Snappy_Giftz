import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { googleDriveService } from '@/services/storage/google-drive.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);

    const status = await googleDriveService.getConnectionStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve Google Drive status.' },
      { status: 500 }
    );
  }
}

