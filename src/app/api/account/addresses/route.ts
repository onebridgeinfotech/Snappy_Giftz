import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/rbac';
import {
  listCustomerAddresses,
  createCustomerAddress,
} from '@/lib/account/account.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const addresses = await listCustomerAddresses(user.id);

    return NextResponse.json({
      success: true,
      addresses,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve addresses.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    const address = await createCustomerAddress(user.id, {
      name: body.name,
      company: body.company,
      street: body.street,
      city: body.city,
      state: body.state,
      stateCode: body.stateCode || '36',
      pincode: body.pincode,
      phone: body.phone,
      isDefault: Boolean(body.isDefault),
    });

    return NextResponse.json(
      {
        success: true,
        address,
        message: 'Address saved successfully.',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to save address.' },
      { status: 400 }
    );
  }
}

