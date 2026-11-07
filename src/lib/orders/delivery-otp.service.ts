/**
 * Delivery handover OTP for the store's own deliveries (e.g. parcels sent via Rapido).
 *
 * - Every order has a fixed 6-digit OTP, derived with HMAC from the order id and a server secret,
 *   so the plain code is never stored and the same code can be re-sent in any email.
 * - The customer receives it in the order confirmation and out-for-delivery emails.
 * - When the parcel arrives, the store calls the customer, the customer reads out the OTP, and staff
 *   enter it in the admin. Only then can an own-delivery order be marked DELIVERED.
 *
 * Verification is recorded in the existing Order.pickupVerifiedAt / pickupVerifiedBy columns
 * (the store-pickup handover fields, unused until now), so no database migration is required.
 */
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export class DeliveryOtpError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'DeliveryOtpError';
    this.statusCode = statusCode;
  }
}

function otpSecret(): string {
  const secret = process.env.DELIVERY_OTP_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new DeliveryOtpError('Delivery OTP secret is not configured (set NEXTAUTH_SECRET).', 500);
  }
  return 'snappy-giftz-dev-delivery-otp-secret';
}

/** The order's 6-digit delivery OTP (stable for the life of the order). */
export function getDeliveryOtp(orderId: string): string {
  const digest = crypto.createHmac('sha256', otpSecret()).update(`delivery-otp:v1:${orderId}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

/** Safe variant for emails: never lets an OTP problem block an email. */
export function getDeliveryOtpForEmail(orderId: string | null | undefined): string | null {
  if (!orderId) return null;
  try {
    return getDeliveryOtp(orderId);
  } catch (err) {
    console.warn('[DELIVERY_OTP] Could not derive OTP for email:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function isDeliveryOtpVerified(order: { pickupVerifiedAt?: Date | string | null }): boolean {
  return Boolean(order?.pickupVerifiedAt);
}

/**
 * Checks the OTP the customer read out and records the verification.
 * Rate-limited per order so the 6-digit code cannot be guessed.
 */
export async function verifyDeliveryOtp(
  order: { id: string; orderNumber: string; orderStatus: string; pickupVerifiedAt?: Date | string | null },
  suppliedOtp: string,
  actor: string
): Promise<{ verifiedAt: Date; alreadyVerified: boolean }> {
  if (order.pickupVerifiedAt) {
    return { verifiedAt: new Date(order.pickupVerifiedAt), alreadyVerified: true };
  }

  const clean = String(suppliedOtp || '').replace(/\D/g, '');
  if (clean.length !== 6) {
    throw new DeliveryOtpError('Enter the 6-digit delivery OTP the customer received by email.');
  }

  const limit = await enforceRateLimit('DELIVERY_OTP_VERIFY', order.id);
  if (!limit.allowed) {
    throw new DeliveryOtpError(
      'Too many wrong OTP attempts for this order. Please wait a few minutes and try again.',
      429
    );
  }

  const expected = Buffer.from(getDeliveryOtp(order.id));
  const given = Buffer.from(clean);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    throw new DeliveryOtpError('Incorrect delivery OTP. Ask the customer to check their order email and read it again.');
  }

  const verifiedAt = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { pickupVerifiedAt: verifiedAt, pickupVerifiedBy: actor },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.orderStatus as any,
        toStatus: order.orderStatus as any,
        changedBy: actor,
        notes: 'Delivery OTP confirmed with the customer.',
      },
    }),
  ]);

  return { verifiedAt, alreadyVerified: false };
}
