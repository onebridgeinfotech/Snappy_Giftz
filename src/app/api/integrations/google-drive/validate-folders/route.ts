import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { googleDriveService } from '@/services/storage/google-drive.service';

export const dynamic = 'force-dynamic';

/**
 * GET & POST /api/integrations/google-drive/validate-folders
 * Admin-only diagnostic endpoint testing real Google Drive API access to the 5 configured folder IDs.
 * Does not create replacement folders. Returns granular per-folder accessibility status.
 */
async function handleValidateFolders(req: Request) {
  try {
    await requireRole([Role.ADMIN], req);

    const status = await googleDriveService.getConnectionStatus();
    if (!status.isConnected) {
      return NextResponse.json(
        {
          success: false,
          isConnected: false,
          error: 'Google Drive is not connected. Administrator OAuth connection required first.',
        },
        { status: 400 }
      );
    }

    const { drive } = await googleDriveService.getAuthenticatedDriveClient(false);
    const validation = await googleDriveService.validateFolderAccess(drive);

    return NextResponse.json({
      success: validation.allAccessible,
      isConnected: true,
      allAccessible: validation.allAccessible,
      folders: validation.folders,
      zeroSilentReplacementsEnforced: true,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to validate Google Drive folders.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleValidateFolders(req);
}

export async function POST(req: Request) {
  return handleValidateFolders(req);
}

