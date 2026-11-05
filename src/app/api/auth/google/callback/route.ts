import { NextResponse } from 'next/server';

/**
 * Google OAuth Callback Handler
 * 
 * Safely handles authorization code exchange when Google OAuth is fully configured.
 * Strictly avoids mock authentication or unverified sessions when credentials are pending.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code) {
    const errorUrl = new URL('/login', appUrl);
    errorUrl.searchParams.set('oauth_error', error || 'missing_auth_code');
    return NextResponse.redirect(errorUrl.toString());
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const errorUrl = new URL('/login', appUrl);
    errorUrl.searchParams.set('oauth_error', 'google_pending_credentials');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Placeholder for lead when Google credentials and user OAuth account table are connected
  const errorUrl = new URL('/login', appUrl);
  errorUrl.searchParams.set('oauth_error', 'google_db_pending');
  return NextResponse.redirect(errorUrl.toString());
}

