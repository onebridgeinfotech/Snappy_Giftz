import { NextResponse } from 'next/server';
import { getSessionTokenFromContext } from '@/lib/auth/rbac';
import { validateSessionToken } from '@/lib/auth/session';

export async function GET(req: Request) {
  try {
    const token = await getSessionTokenFromContext(req);

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const sessionData = await validateSessionToken(token);
    if (!sessionData || !sessionData.user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const { user } = sessionData;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error('[API_AUTH_ME] Error:', error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}
