import { NextRequest, NextResponse } from 'next/server';
import { updateCartItemQuantity, removeCartItem, CartError } from '@/lib/cart/cart.service';
import { getSessionTokenFromContext } from '@/lib/auth/rbac';
import { validateSessionToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

async function resolveCartIdentity(req: NextRequest) {
  const token = await getSessionTokenFromContext(req);
  if (token) {
    const session = await validateSessionToken(token);
    if (session?.user) {
      return { userId: session.user.id, sessionToken: null };
    }
  }

  const guestHeader = req.headers.get('x-cart-session') || req.headers.get('x-guest-token');
  const guestCookie = req.cookies.get('snappy_cart_session')?.value;
  return { userId: null, sessionToken: guestHeader || guestCookie || null };
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, sessionToken } = await resolveCartIdentity(req);

    if (!body.cartItemId || typeof body.cartItemId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'cartItemId is required.' },
        { status: 400 }
      );
    }

    if (typeof body.quantity !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Numeric quantity is required.' },
        { status: 400 }
      );
    }

    const cart = await updateCartItemQuantity({
      userId,
      sessionToken,
      cartItemId: body.cartItemId,
      quantity: body.quantity,
    });

    return NextResponse.json({
      success: true,
      message: 'Cart updated.',
      cart,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof CartError ? err.statusCode : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update cart item.' },
      { status: statusCode }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cartItemId = searchParams.get('id');
    const { userId, sessionToken } = await resolveCartIdentity(req);

    if (!cartItemId) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "id" (cartItemId) is required.' },
        { status: 400 }
      );
    }

    const cart = await removeCartItem({
      userId,
      sessionToken,
      cartItemId,
    });

    return NextResponse.json({
      success: true,
      message: 'Item removed from cart.',
      cart,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof CartError ? err.statusCode : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to remove cart item.' },
      { status: statusCode }
    );
  }
}

