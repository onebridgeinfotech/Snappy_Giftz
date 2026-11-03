import { NextRequest, NextResponse } from 'next/server';
import { getCartSummary, addItemToCart, clearCart, CartError } from '@/lib/cart/cart.service';
import { getSessionTokenFromContext } from '@/lib/auth/rbac';
import { validateSessionToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

async function resolveCartIdentity(req: NextRequest): Promise<{ userId: string | null; sessionToken: string | null }> {
  // Check authenticated user
  const token = await getSessionTokenFromContext(req);
  if (token) {
    const session = await validateSessionToken(token);
    if (session?.user) {
      return { userId: session.user.id, sessionToken: null };
    }
  }

  // Check guest session token from header or cookie
  const guestHeader = req.headers.get('x-cart-session') || req.headers.get('x-guest-token');
  const guestCookie = req.cookies.get('snappy_cart_session')?.value;
  const guestToken = guestHeader || guestCookie || null;

  return { userId: null, sessionToken: guestToken };
}

export async function GET(req: NextRequest) {
  try {
    const { userId, sessionToken } = await resolveCartIdentity(req);
    // If neither exists, generate an ephemeral guest token
    const effectiveGuestToken = !userId && !sessionToken ? `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` : sessionToken;

    const cart = await getCartSummary(userId, effectiveGuestToken);

    const response = NextResponse.json({
      success: true,
      cart,
    });

    if (!userId && !sessionToken && effectiveGuestToken) {
      response.cookies.set('snappy_cart_session', effectiveGuestToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return response;
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to fetch cart.',
      },
      { status: statusCode }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, sessionToken } = await resolveCartIdentity(req);
    const effectiveGuestToken = !userId && !sessionToken ? `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` : sessionToken;

    if (!body.productId || typeof body.productId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Product ID is required.' },
        { status: 400 }
      );
    }

    const cart = await addItemToCart({
      userId,
      sessionToken: effectiveGuestToken,
      productId: body.productId,
      variantId: body.variantId || null,
      quantity: typeof body.quantity === 'number' ? body.quantity : 1,
      isCustomized: !!body.isCustomized,
      customizationData: body.customizationData || null,
      uploadIds: Array.isArray(body.uploadIds) ? body.uploadIds : undefined,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Item added to cart.',
      cart,
    });

    if (!userId && !sessionToken && effectiveGuestToken) {
      response.cookies.set('snappy_cart_session', effectiveGuestToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof CartError ? err.statusCode : 500);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to add item to cart.',
      },
      { status: statusCode }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, sessionToken } = await resolveCartIdentity(req);
    if (!userId && !sessionToken) {
      return NextResponse.json({ success: true, message: 'Cart already empty.' });
    }

    const cart = await clearCart(userId, sessionToken);
    return NextResponse.json({
      success: true,
      message: 'Cart cleared successfully.',
      cart,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to clear cart.' },
      { status: 500 }
    );
  }
}

