import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { googleDriveService } from '@/services/storage/google-drive.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const admin = await requireRole([Role.ADMIN], req);

    await googleDriveService.disconnect(admin.id);

    return NextResponse.json({
      success: true,
      message: 'Google Drive disconnected successfully and credentials removed.',
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to disconnect Google Drive.' },
      { status: 500 }
    );
  }
}

