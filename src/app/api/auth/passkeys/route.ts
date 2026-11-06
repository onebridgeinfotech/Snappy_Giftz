import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/rbac';
import { listUserPasskeys } from '@/lib/auth/passkey.service';

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const passkeys = await listUserPasskeys(user.id);
    return NextResponse.json({ passkeys });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
