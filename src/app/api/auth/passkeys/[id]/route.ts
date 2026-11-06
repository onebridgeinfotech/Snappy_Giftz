import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/rbac';
import { removeUserPasskey } from '@/lib/auth/passkey.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const user = await requireAuth(req);
    const { id } = await context.params;
    await removeUserPasskey(user.id, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'PASSKEY_NOT_FOUND') {
      return NextResponse.json({ error: 'Passkey not found.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
