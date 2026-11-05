import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { googleDriveService } from '@/services/storage/google-drive.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/integrations/google-drive/picker-authorize
 * Admin-only endpoint receiving folder selections made in Google Picker dialog.
 * Authoritatively verifies folder IDs and MIME types against Google Drive API before persisting.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole([Role.ADMIN], req);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload.' }, { status: 400 });
    }

    const { folders } = body;
    if (!folders || !Array.isArray(folders) || folders.length === 0) {
      return NextResponse.json(
        { error: 'A non-empty "folders" array with folder IDs is required.' },
        { status: 400 }
      );
    }

    const result = await googleDriveService.authorizeFoldersViaPicker(folders);

    // Optional audit log recording
    try {
      await prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: 'GOOGLE_DRIVE_FOLDERS_AUTHORIZED',
          resource: 'GoogleDriveIntegration:default',
          details: {
            verifiedCount: result.verifiedCount,
            authorizedFolders: result.folders,
          },
        },
      });
    } catch {
      // Non-fatal if DB is in fallback mode
    }

    return NextResponse.json({
      success: true,
      message: `Successfully verified and authorized ${result.verifiedCount} Google Drive folder(s).`,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to authorize Google Drive folders via Picker.' },
      { status: 400 }
    );
  }
}

