import { NextResponse } from 'next/server';
import { googleDriveService } from '@/services/storage/google-drive.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const adminSettingsUrl = new URL('/admin', url.origin);
  adminSettingsUrl.searchParams.set('tab', 'settings');

  // 1. Handle user cancellation or OAuth error from Google
  if (errorParam) {
    adminSettingsUrl.searchParams.set('gdrive_error', errorParam);
    return NextResponse.redirect(adminSettingsUrl.toString());
  }

  // 2. Validate mandatory query parameters
  if (!code || !state) {
    adminSettingsUrl.searchParams.set('gdrive_error', 'missing_code_or_state');
    return NextResponse.redirect(adminSettingsUrl.toString());
  }

  // 3. Cryptographically verify CSRF state token
  const stateVerification = googleDriveService.verifySignedState(state);
  if (!stateVerification.valid || !stateVerification.adminUserId) {
    adminSettingsUrl.searchParams.set('gdrive_error', stateVerification.error || 'invalid_state');
    return NextResponse.redirect(adminSettingsUrl.toString());
  }

  try {
    const customCallbackUri = `${url.origin}/api/integrations/google-drive/callback`;
    await googleDriveService.handleCallback(code, stateVerification.adminUserId, customCallbackUri);

    adminSettingsUrl.searchParams.set('gdrive', 'connected');
    return NextResponse.redirect(adminSettingsUrl.toString());
  } catch (err: any) {
    console.error('[GoogleDriveCallback] Failed to complete integration handshake:', err);
    adminSettingsUrl.searchParams.set('gdrive_error', err.message || 'token_exchange_failed');
    return NextResponse.redirect(adminSettingsUrl.toString());
  }
}

