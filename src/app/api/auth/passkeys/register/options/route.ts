import { NextResponse } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/rbac';
import { passkeyRegistrationOptions } from '@/lib/auth/passkey.service';

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const options = await passkeyRegistrationOptions(user.id);
    return NextResponse.json({ options });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[PASSKEY_REGISTER_OPTIONS]', err);
    return NextResponse.json({ error: 'Could not start passkey registration.' }, { status: 500 });
  }
}
