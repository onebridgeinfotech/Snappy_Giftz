import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { googleDriveService } from '@/services/storage/google-drive.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = await requireRole([Role.ADMIN], req);

    const url = new URL(req.url);
    const redirectOrigin = url.origin;
    const customCallbackUri = `${redirectOrigin}/api/integrations/google-drive/callback`;

    const authUrl = googleDriveService.generateAuthUrl(admin.id, customCallbackUri);

    const acceptHeader = req.headers.get('accept') || '';
    const wantsJson = acceptHeader.includes('application/json') || url.searchParams.get('format') === 'json';

    if (wantsJson) {
      return NextResponse.json({
        success: true,
        url: authUrl,
      });
    }

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: err.message || 'Failed to initialize Google Drive authorization.' },
      { status: 500 }
    );
  }
}

