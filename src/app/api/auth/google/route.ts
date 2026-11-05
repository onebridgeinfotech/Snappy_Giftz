import { NextResponse } from 'next/server';

/**
 * Google OAuth Entrypoint Handler
 * 
 * Verifies whether GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured.
 * When real credentials are provided in production, redirects to Google's OAuth 2.0 flow.
 * When unconfigured (pending Hostinger lead setup), safely returns a 501 status with
 * an explicit architectural explanation, avoiding any fake or mock authentication.
 */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const acceptsJson = req.headers.get('accept')?.includes('application/json');

  if (!clientId || !clientSecret) {
    const errorPayload = {
      configured: false,
      status: 'UNVERIFIED_PENDING_CREDENTIALS',
      provider: 'google',
      message:
        'Google OAuth is awaiting GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configuration in Hostinger environment variables by the technical lead.',
    };

    if (acceptsJson) {
      return NextResponse.json(errorPayload, { status: 501 });
    }

    // If accessed directly via browser redirect without JSON header, redirect to /login with error query
    const loginUrl = new URL('/login', appUrl);
    loginUrl.searchParams.set('oauth_error', 'google_pending_credentials');
    return NextResponse.redirect(loginUrl.toString());
  }

  // When credentials exist, redirect to Google OAuth 2.0 consent screen
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(googleAuthUrl.toString());
}

