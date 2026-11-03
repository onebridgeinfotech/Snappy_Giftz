import { NextRequest, NextResponse } from 'next/server';
import { mergeGuestCartIntoUserCart, CartError } from '@/lib/cart/cart.service';
import { requireAuth } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    const guestSessionToken = body.guestSessionToken || req.cookies.get('snappy_cart_session')?.value;

    if (!guestSessionToken) {
      return NextResponse.json(
        { success: false, error: 'guestSessionToken is required to synchronize cart.' },
        { status: 400 }
      );
    }

    const mergedCart = await mergeGuestCartIntoUserCart(user.id, guestSessionToken);

    const response = NextResponse.json({
      success: true,
      message: 'Guest cart merged successfully with customer account.',
      cart: mergedCart,
    });

    // Clear old guest cookie
    response.cookies.delete('snappy_cart_session');

    return response;
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof CartError ? err.statusCode : 401);
    return NextResponse.json(
      { success: false, error: err.message || 'Cart synchronization failed.' },
      { status: statusCode }
    );
  }
}

