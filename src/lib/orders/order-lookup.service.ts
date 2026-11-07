import { prisma } from '@/lib/prisma';
import { buildTrackingTimeline } from '@/lib/shipping/courier-tracking.service';
import { SanitizedOrderResult, DEV_ORDERS_STORE } from '@/lib/orders/order.service';
import { DEV_PERSONALIZATION_STORE } from '@/lib/personalization/personalization.service';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export class OrderAuthorizationError extends Error {
  constructor(message = 'Unauthorized to access this order.') {
    super(message);
    this.name = 'OrderAuthorizationError';
  }
}

export class OrderNotFoundError extends Error {
  constructor(message = 'Order not found with provided reference and contact details.') {
    super(message);
    this.name = 'OrderNotFoundError';
  }
}

/**
 * In-memory rate-limiter for guest order lookups (prevents brute-force guessing of order numbers).
 * 
 * SCOPE & ARCHITECTURE NOTE:
 * - This rate limiter operates strictly IN-MEMORY within the local Node.js process runtime.
 * - It is NOT shared across distributed deployment instances, clustered Node workers, or serverless function invocations.
 * - In a multi-instance production deployment (e.g. multiple Kubernetes pods or Vercel serverless containers),
 *   each instance maintains its own isolated counter (allowing up to 10 attempts per minute per instance).
 * - Production Roadmap / Next Step: Batch 11 introduces a distributed, shared store (e.g. Redis / Upstash KV)
 *   with sliding-window or token-bucket rate limiting for multi-instance cluster protection.
 */
import { enforceRateLimit } from '../security/rate-limit';

const GUEST_LOOKUP_RATE_LIMIT: Map<string, { count: number; resetAt: number }> = new Map();

export function checkGuestLookupRateLimit(ipOrKey: string): boolean {
  const now = Date.now();
  const record = GUEST_LOOKUP_RATE_LIMIT.get(ipOrKey);

  if (!record || now > record.resetAt) {
    GUEST_LOOKUP_RATE_LIMIT.set(ipOrKey, { count: 1, resetAt: now + 60 * 1000 }); // 1-minute window
    return true;
  }

  if (record.count >= 10) {
    return false; // Limit exceeded: 10 attempts per minute per process
  }

  record.count++;
  return true;
}

export async function checkGuestLookupRateLimitDistributed(ipOrKey: string): Promise<boolean> {
  const result = await enforceRateLimit('GUEST_LOOKUP', ipOrKey);
  return result.allowed;
}

/**
 * Fetch order with server-side authorization check (Authenticated Customer / Staff / Admin).
 */
export async function getOrderForUser(
  orderNumber: string,
  userId: string,
  userRole: string
): Promise<SanitizedOrderResult> {
  const cleanNum = orderNumber?.trim();
  if (!cleanNum) throw new OrderNotFoundError();

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: cleanNum },
      include: {
        items: {
          include: {
            personalization: true,
          },
        },
        shipments: { include: { trackingEvents: { orderBy: { eventAt: 'desc' } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanNum)) {
        const devOrder = DEV_ORDERS_STORE.get(cleanNum)!;
        const isStaffOrAdmin = userRole === 'ADMIN' || userRole === 'STAFF';
        const isOwner = (devOrder as any).userId === userId;
        if (!isOwner && !isStaffOrAdmin) {
          throw new OrderAuthorizationError();
        }
        return formatOrderView(devOrder);
      }
      throw new OrderNotFoundError();
    }

    const isStaffOrAdmin = userRole === 'ADMIN' || userRole === 'STAFF';
    const isOwner = order.userId === userId;

    if (!isOwner && !isStaffOrAdmin) {
      throw new OrderAuthorizationError();
    }

    return formatOrderView(order);
  } catch (err: any) {
    if (err instanceof OrderAuthorizationError || err instanceof OrderNotFoundError) {
      throw err;
    }
    if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanNum)) {
      const devOrder = DEV_ORDERS_STORE.get(cleanNum)!;
      const isStaffOrAdmin = userRole === 'ADMIN' || userRole === 'STAFF';
      const isOwner = (devOrder as any).userId === userId;
      if (!isOwner && !isStaffOrAdmin) {
        throw new OrderAuthorizationError();
      }
      return formatOrderView(devOrder);
    }
    if (!isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unreachable during order lookup.');
    }
    throw new OrderNotFoundError();
  }
}

/**
 * Privacy-safe guest order lookup. Requires Order Number + (Matching Email OR Matching Mobile Phone).
 */
export async function lookupGuestOrder(
  orderNumber: string,
  emailOrPhone: string,
  clientIp = 'unknown'
): Promise<SanitizedOrderResult> {
  if (!checkGuestLookupRateLimit(clientIp)) {
    throw new Error('Too many order lookup attempts. Please try again after one minute.');
  }

  const cleanNum = orderNumber?.trim();
  const cleanContact = emailOrPhone?.trim().toLowerCase();

  if (!cleanNum || !cleanContact) {
    throw new OrderNotFoundError('Please provide both Order Number and matching Email or Phone.');
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: cleanNum },
      include: {
        items: {
          include: {
            personalization: true,
          },
        },
        shipments: { include: { trackingEvents: { orderBy: { eventAt: 'desc' } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanNum)) {
        const devOrder = DEV_ORDERS_STORE.get(cleanNum)!;
        const emailMatch = devOrder.customerEmail.toLowerCase() === cleanContact;
        const cleanPhoneInput = cleanContact.replace(/[\s\-\+]/g, '');
        const cleanOrderPhone = devOrder.customerPhone.replace(/[\s\-\+]/g, '');
        const phoneMatch = cleanPhoneInput.length >= 10 && cleanOrderPhone.endsWith(cleanPhoneInput.slice(-10));

        if (!emailMatch && !phoneMatch) {
          throw new OrderNotFoundError('No order found matching the provided reference and contact details.');
        }
        return formatOrderView(devOrder);
      }
      throw new OrderNotFoundError();
    }

    const emailMatch = order.customerEmail.toLowerCase() === cleanContact;
    const cleanPhoneInput = cleanContact.replace(/[\s\-\+]/g, '');
    const cleanOrderPhone = order.customerPhone.replace(/[\s\-\+]/g, '');
    const phoneMatch = cleanPhoneInput.length >= 10 && cleanOrderPhone.endsWith(cleanPhoneInput.slice(-10));

    if (!emailMatch && !phoneMatch) {
      throw new OrderNotFoundError('No order found matching the provided reference and contact details.');
    }

    return formatOrderView(order);
  } catch (err: any) {
    if (err instanceof OrderNotFoundError) {
      throw err;
    }
    if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanNum)) {
      const devOrder = DEV_ORDERS_STORE.get(cleanNum)!;
      const emailMatch = devOrder.customerEmail.toLowerCase() === cleanContact;
      const cleanPhoneInput = cleanContact.replace(/[\s\-\+]/g, '');
      const cleanOrderPhone = devOrder.customerPhone.replace(/[\s\-\+]/g, '');
      const phoneMatch = cleanPhoneInput.length >= 10 && cleanOrderPhone.endsWith(cleanPhoneInput.slice(-10));

      if (!emailMatch && !phoneMatch) {
        throw new OrderNotFoundError('No order found matching the provided reference and contact details.');
      }
      return formatOrderView(devOrder);
    }
    if (!isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unreachable during guest order lookup.');
    }
    throw new OrderNotFoundError();
  }
}

function formatOrderView(order: any): SanitizedOrderResult {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    destinationStateCode: order.destinationStateCode,
    items: order.items.map((item: any) => {
      const pers = item.personalization || DEV_PERSONALIZATION_STORE.get(item.id) || null;
      return {
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        hsnCode: item.hsnCode,
        taxRatePercent: item.taxRatePercent,
        unitPricePaise: item.unitPricePaise,
        quantity: item.quantity,
        subtotalPaise: Number(item.subtotalPaise),
        customizationNote: item.customizationNote,
        proofImageUrl: pers?.proofImageUrl || item.proofImageUrl || null,
        personalization: pers ? {
          id: pers.id,
          orderItemId: pers.orderItemId,
          personalizationType: pers.personalizationType,
          engravedText: pers.engravedText,
          fontFamily: pers.fontFamily,
          giftNote: pers.giftNote,
          ribbonColor: pers.ribbonColor,
          boxWrapStyle: pers.boxWrapStyle,
          waxSealColor: pers.waxSealColor,
          proofImageUrl: pers.proofImageUrl,
          proofVersion: pers.proofVersion,
          customerApprovalStatus: pers.customerApprovalStatus,
          customerApprovedAt: pers.customerApprovedAt ? new Date(pers.customerApprovedAt).toISOString() : null,
          customerApprovedBy: pers.customerApprovedBy,
          staffReviewStatus: pers.staffReviewStatus,
          staffReviewedAt: pers.staffReviewedAt ? new Date(pers.staffReviewedAt).toISOString() : null,
        } : null,
      };
    }),
    itemsSubtotalPaise: Number(order.itemsSubtotalPaise),
    taxTotalPaise: Number(order.taxTotalPaise),
    cgstPaise: Number(order.cgstPaise || 0),
    sgstPaise: Number(order.sgstPaise || 0),
    igstPaise: Number(order.igstPaise || 0),
    shippingTotalPaise: Number(order.shippingTotalPaise || 0),
    grandTotalPaise: Number(order.grandTotalPaise),
    reservationExpiresAt: order.reservationExpiresAt
      ? new Date(order.reservationExpiresAt).toISOString()
      : '',
    guestLookupToken: order.guestLookupToken || '',
    createdAt: new Date(order.createdAt).toISOString(),
    shipment: order.shipments && order.shipments.length > 0 ? {
      carrierPartner: order.shipments[0].carrierPartner || null,
      awbNumber: order.shipments[0].awbNumber || null,
      trackingUrl: order.shipments[0].trackingUrl || null,
      dispatchStatus: order.shipments[0].dispatchStatus || 'PENDING',
      dispatchedAt: order.shipments[0].dispatchedAt ? new Date(order.shipments[0].dispatchedAt).toISOString() : null,
      deliveredAt: order.shipments[0].deliveredAt ? new Date(order.shipments[0].deliveredAt).toISOString() : null,
    } : (order.shipment || null),
    trackingTimeline: buildTrackingTimeline(order),
  };
}

