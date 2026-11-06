import { NextResponse } from 'next/server';
import { passkeyAuthenticationOptions } from '@/lib/auth/passkey.service';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const rateLimit = await enforceRateLimit('AUTH_LOGIN', `${ipAddress}:${email}:passkey`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) } }
      );
    }

    const { options, challengeId } = await passkeyAuthenticationOptions(email);
    return NextResponse.json({ options, challengeId });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'NO_PASSKEYS') {
      return NextResponse.json(
        {
          error:
            'No Face ID or fingerprint is set up for this email yet. Sign in with password once, then enable it under My Account → Security.',
        },
        { status: 400 }
      );
    }
    console.error('[PASSKEY_LOGIN_OPTIONS]', err);
    return NextResponse.json({ error: 'Could not start biometric sign-in.' }, { status: 500 });
  }
}
