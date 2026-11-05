import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { googleDriveService, BUSINESS_DRIVE_FOLDERS } from '@/services/storage/google-drive.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/google-drive/picker-config
 * Admin-only endpoint providing public client parameters needed to open the Google Picker dialog.
 * Strictly never exposes client secrets, refresh tokens, access tokens, or token encryption keys.
 */
export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN], req);

    const creds = googleDriveService.getCredentials();
    const status = await googleDriveService.getConnectionStatus();

    return NextResponse.json({
      success: true,
      isConfigured: creds.isConfigured,
      isConnected: status.isConnected,
      accountEmail: status.accountEmail,
      clientId: creds.clientId,
      developerKey: creds.developerKey,
      pickerEnabled: Boolean(creds.developerKey),
      scope: 'https://www.googleapis.com/auth/drive.file',
      requiredFolders: BUSINESS_DRIVE_FOLDERS,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve Google Picker configuration.' },
      { status: 500 }
    );
  }
}

