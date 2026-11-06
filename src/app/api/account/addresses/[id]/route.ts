import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/rbac';
import {
  updateCustomerAddress,
  deleteCustomerAddress,
} from '@/lib/account/account.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    const address = await updateCustomerAddress(user.id, id, {
      name: body.name,
      company: body.company,
      street: body.street,
      city: body.city,
      state: body.state,
      stateCode: body.stateCode,
      pincode: body.pincode,
      phone: body.phone,
      isDefault: body.isDefault,
    });

    return NextResponse.json({
      success: true,
      address,
      message: 'Address updated successfully.',
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update address.' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    await deleteCustomerAddress(user.id, id);

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully.',
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to delete address.' },
      { status: 400 }
    );
  }
}

