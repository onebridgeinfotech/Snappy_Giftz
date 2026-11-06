import { NextResponse } from 'next/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { AuthError, requireAuth } from '@/lib/auth/rbac';
import { passkeyRegistrationVerify } from '@/lib/auth/passkey.service';

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const response = body.response as RegistrationResponseJSON | undefined;
    const nickname = typeof body.nickname === 'string' ? body.nickname : undefined;
    if (!response) {
      return NextResponse.json({ error: 'Invalid registration response.' }, { status: 400 });
    }

    await passkeyRegistrationVerify(user.id, response, nickname);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : '';
    if (message === 'PASSKEY_REGISTER_FAILED' || message === 'CHALLENGE_EXPIRED') {
      return NextResponse.json({ error: 'Face ID setup failed or timed out. Try again.' }, { status: 400 });
    }
    console.error('[PASSKEY_REGISTER_VERIFY]', err);
    return NextResponse.json({ error: 'Could not save passkey.' }, { status: 500 });
  }
}
