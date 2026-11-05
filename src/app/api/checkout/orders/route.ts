import { NextResponse } from 'next/server';
import { createOrder, OrderValidationError, InsufficientStockError } from '@/lib/orders/order.service';
import { getOptionalUser } from '@/lib/auth/rbac';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check optional authenticated session
    let userId: string | undefined = undefined;
    const user = await getOptionalUser(req);
    if (user) {
      userId = user.id;
    }

    const orderPayload = {
      ...body,
      userId,
    };

    const result = await createOrder(orderPayload);

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 } // Conflict: out of stock
      );
    }
    if (error instanceof CatalogDatabaseError) {
      const catalogSync = /Authoritative database pricing|not found in production/i.test(error.message || '');
      return NextResponse.json(
        {
          error: catalogSync
            ? 'Your cart items are not available in our live catalog yet. Clear your cart, refresh the shop, and try again—or contact support if this continues.'
            : 'Checkout service is temporarily unavailable. Please try again shortly.',
          code: catalogSync ? 'CATALOG_SYNC' : 'DATABASE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process checkout and create order' },
      { status: 500 }
    );
  }
}
