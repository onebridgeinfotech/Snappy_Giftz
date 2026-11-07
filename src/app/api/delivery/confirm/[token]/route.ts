import { NextResponse } from 'next/server';
import {
  getDeliveryLinkContext,
  confirmDeliveryFromLink,
  DeliveryLinkError,
} from '@/lib/delivery/delivery-link.service';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/client-ip';

export const dynamic = 'force-dynamic';

/** GET: delivery details for a valid, open delivery link (no login; the link itself is the access). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limit = await enforceRateLimit('GUEST_LOOKUP', `delivery-link:${getClientIp(req)}`);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
    }
    const ctx = await getDeliveryLinkContext(token);
    return NextResponse.json({ success: true, data: { ...ctx, orderId: undefined } });
  } catch (error: any) {
    if (error instanceof DeliveryLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Could not open this delivery link.' }, { status: 500 });
  }
}

/** POST { otp, collectionMethod? }: confirm delivery with the customer's OTP. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limit = await enforceRateLimit('DELIVERY_OTP_VERIFY', `delivery-link-ip:${getClientIp(req)}`);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const result = await confirmDeliveryFromLink(token, {
      otp: typeof body.otp === 'string' ? body.otp : '',
      collectionMethod: body.collectionMethod === 'UPI_ON_DELIVERY' ? 'UPI_ON_DELIVERY' : 'CASH',
    });
    return NextResponse.json({ success: true, data: result, message: `Order #${result.orderNumber} marked delivered.` });
  } catch (error: any) {
    if (error instanceof DeliveryLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Could not confirm delivery. Please try again.' }, { status: 500 });
  }
}
