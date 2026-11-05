import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, invalidateSession } from '@/lib/auth/session';

export async function POST(req?: Request) {
  try {
    let sessionToken: string | undefined;

    if (req) {
      const cookieHeader = req.headers.get('cookie') || '';
      const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match) sessionToken = match[1].trim();
    }

    if (!sessionToken) {
      try {
        const cookieStore = await cookies();
        sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {
        // Safe fallback when executed outside Next.js request store
      }
    }

    if (sessionToken) {
      await invalidateSession(sessionToken);
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    response.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0, expires: new Date(0) });
    return response;
  } catch (error) {
    console.error('[API_AUTH_LOGOUT] Error:', error);
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0, expires: new Date(0) });
    return response;
  }
}
