import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/rbac';
import { changeCustomerPassword } from '@/lib/account/account.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const rateLimit = await enforceRateLimit('AUTH_CHANGE_PASSWORD', `${ipAddress}:${user.id}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many password change attempts. Please wait one minute.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) } }
      );
    }

    const result = await changeCustomerPassword(
      user.id,
      currentPassword,
      newPassword,
      confirmPassword
    );

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update password.' },
      { status: 400 }
    );
  }
}

