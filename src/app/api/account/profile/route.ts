import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/rbac';
import { getCustomerProfile, updateCustomerProfile } from '@/lib/account/account.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const profile = await getCustomerProfile(user.id);

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: profile,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve profile.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    const updated = await updateCustomerProfile(user.id, {
      name: body.name,
      phone: body.phone,
    });

    return NextResponse.json({
      success: true,
      user: updated,
      message: 'Profile updated successfully.',
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update profile.' },
      { status: 400 }
    );
  }
}

