/**
 * One-order delivery confirmation links for the store's own delivery person (e.g. a Rapido rider
 * or staff member). The link opens /delivery/confirm/<token>, shows that order's delivery details,
 * and lets the delivery person enter the customer's OTP to mark the order delivered.
 *
 * The token is signed (HMAC) — nothing is stored in the database — and it stops working when:
 *  - the order is delivered (or cancelled), i.e. it is no longer OUT_FOR_DELIVERY;
 *  - the delivery is reassigned (the token is bound to the assignment's start time);
 *  - 48 hours pass.
 * The link alone cannot mark an order delivered: the customer's 6-digit OTP is still required.
 */
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const DELIVERY_LINK_TTL_MS = 48 * 60 * 60 * 1000;

export class DeliveryLinkError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'DeliveryLinkError';
    this.statusCode = statusCode;
  }
}

function linkSecret(): string {
  const secret = process.env.DELIVERY_LINK_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new DeliveryLinkError('Delivery link secret is not configured (set NEXTAUTH_SECRET).', 500);
  }
  return 'snappy-giftz-dev-delivery-link-secret';
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

function sign(payload: string): string {
  return crypto.createHmac('sha256', linkSecret()).update(`delivery-link:v1:${payload}`).digest('base64url');
}

function siteUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://snappygiftz.com').replace(/\/$/, '');
}

/** Builds the link for an order's current own-delivery assignment. */
export function createDeliveryConfirmLink(orderId: string, assignmentStartedAt: Date | string): { url: string; token: string; expiresAt: Date } {
  const startedMs = new Date(assignmentStartedAt).getTime();
  const expiresAt = new Date(Date.now() + DELIVERY_LINK_TTL_MS);
  const payload = `${orderId}.${startedMs}.${expiresAt.getTime()}`;
  const token = `${b64(payload)}.${sign(payload)}`;
  return { url: `${siteUrl()}/delivery/confirm/${token}`, token, expiresAt };
}

function parseToken(token: string): { orderId: string; startedMs: number; expiresMs: number } {
  const [p, sig] = String(token || '').split('.');
  if (!p || !sig || p.length > 400) throw new DeliveryLinkError('This delivery link is invalid.', 404);
  let payload: string;
  try {
    payload = unb64(p);
  } catch {
    throw new DeliveryLinkError('This delivery link is invalid.', 404);
  }
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new DeliveryLinkError('This delivery link is invalid.', 404);
  }
  const [orderId, startedMs, expiresMs] = payload.split('.');
  return { orderId, startedMs: Number(startedMs), expiresMs: Number(expiresMs) };
}

export interface DeliveryLinkContext {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  itemsCount: number;
  isCod: boolean;
  amountToCollectPaise: number;
  deliveryPerson: string | null;
  expiresAt: string;
}

/** Validates the link against the live order and returns what the delivery person needs. */
export async function getDeliveryLinkContext(token: string): Promise<DeliveryLinkContext> {
  const t = parseToken(token);
  if (!t.expiresMs || Date.now() > t.expiresMs) {
    throw new DeliveryLinkError('This delivery link has expired. Ask the store to resend it.', 410);
  }
  const order = await prisma.order.findUnique({
    where: { id: t.orderId },
    include: { deliveryRecord: true, items: { select: { quantity: true } } },
  });
  if (!order) throw new DeliveryLinkError('This delivery link is invalid.', 404);
  if (order.orderStatus === 'DELIVERED') {
    throw new DeliveryLinkError(`Order #${order.orderNumber} is already marked delivered. This link is closed.`, 410);
  }
  if (order.orderStatus !== 'OUT_FOR_DELIVERY' || !order.deliveryRecord?.startedAt) {
    throw new DeliveryLinkError('This order is not out for delivery any more. This link is closed.', 410);
  }
  if (new Date(order.deliveryRecord.startedAt).getTime() !== t.startedMs) {
    throw new DeliveryLinkError('This delivery was reassigned. This link is closed.', 410);
  }

  const addr: any = typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : order.shippingAddress || {};
  const isCod = String(order.paymentMethod || '').toUpperCase() === 'COD' && order.paymentStatus !== 'CAPTURED';
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: addr.name || order.customerName,
    customerPhone: addr.phone || order.customerPhone,
    address: [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
    itemsCount: order.items.reduce((n, i) => n + Number(i.quantity || 1), 0),
    isCod,
    amountToCollectPaise: isCod ? Number(order.grandTotalPaise) : 0,
    deliveryPerson: order.deliveryRecord.assignedPerson || null,
    expiresAt: new Date(t.expiresMs).toISOString(),
  };
}

/**
 * Confirms delivery from the link: verifies the customer's OTP and marks the order delivered.
 * COD: also records the cash/UPI collected (must be at least the order total).
 */
export async function confirmDeliveryFromLink(
  token: string,
  input: { otp: string; collectionMethod?: 'CASH' | 'UPI_ON_DELIVERY' }
): Promise<{ orderNumber: string }> {
  const ctx = await getDeliveryLinkContext(token);
  const actor = `delivery-link:${ctx.deliveryPerson || 'delivery person'}`;
  const otp = String(input.otp || '').replace(/\D/g, '');
  if (otp.length !== 6) throw new DeliveryLinkError("Enter the customer's 6-digit OTP.");

  if (ctx.isCod) {
    const { recordCodCollection } = await import('@/lib/payments/cod.service');
    try {
      await recordCodCollection({
        orderId: ctx.orderId,
        amountCollectedPaise: ctx.amountToCollectPaise,
        collector: actor,
        collectionMethod: input.collectionMethod === 'UPI_ON_DELIVERY' ? 'UPI_ON_DELIVERY' : 'CASH',
        notes: 'Confirmed by delivery person via delivery link',
        deliveryOtp: otp,
      });
    } catch (err: any) {
      throw new DeliveryLinkError(err?.message || 'Could not confirm delivery.', err?.statusCode === 429 ? 429 : 400);
    }
  } else {
    const { confirmOrderDelivery } = await import('@/lib/orders/order-lifecycle.service');
    try {
      await confirmOrderDelivery(ctx.orderId, { deliveryOtp: otp, notes: 'Confirmed by delivery person via delivery link' }, actor);
    } catch (err: any) {
      throw new DeliveryLinkError(err?.message || 'Could not confirm delivery.', 400);
    }
  }
  return { orderNumber: ctx.orderNumber };
}
