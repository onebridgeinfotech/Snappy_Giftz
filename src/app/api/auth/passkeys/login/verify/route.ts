import { NextResponse } from 'next/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { passkeyAuthenticationVerify } from '@/lib/auth/passkey.service';
import { prisma } from '@/lib/prisma';
import { jsonWithNewSession } from '@/lib/auth/auth-session-response';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
    const response = body.response as AuthenticationResponseJSON | undefined;
    if (!challengeId || !response) {
      return NextResponse.json({ error: 'Invalid passkey response.' }, { status: 400 });
    }

    const { userId } = await passkeyAuthenticationVerify(challengeId, response);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'Sign-in failed.' }, { status: 401 });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;
    return jsonWithNewSession(user, { ipAddress, userAgent });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'CHALLENGE_EXPIRED' || code === 'UNKNOWN_PASSKEY' || code === 'PASSKEY_VERIFY_FAILED') {
      return NextResponse.json({ error: 'Face ID sign-in failed or timed out. Try again.' }, { status: 401 });
    }
    if (code === 'USER_INACTIVE') {
      return NextResponse.json({ error: 'This account is deactivated.' }, { status: 403 });
    }
    console.error('[PASSKEY_LOGIN_VERIFY]', err);
    return NextResponse.json({ error: 'Could not verify passkey.' }, { status: 500 });
  }
}
