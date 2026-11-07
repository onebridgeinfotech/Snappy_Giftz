import { prisma } from '@/lib/prisma';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { DEV_ORDERS_STORE } from '@/lib/orders/order.service';

/** How long a customer has to approve and pay once the owner sets the delivery charge. */
export const CUSTOMER_APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export class DeliveryError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'DeliveryError';
    this.statusCode = statusCode;
  }
}

import {
  INITIAL_HYDERABAD_PINCODES,
  DEV_PINCODES,
  type ServiceablePincodeDTO
} from '@/lib/shipping/pincode.service';

export {
  INITIAL_HYDERABAD_PINCODES,
  DEV_PINCODES,
  type ServiceablePincodeDTO
};

const DEV_FEE_RULES: DeliveryFeeRuleDTO[] = [
  {
    id: 'rule-free-999',
    name: 'Free Delivery for Orders Above ₹999',
    minOrderAmountPaise: 99900,
    maxOrderAmountPaise: null,
    feePaise: 0,
    priority: 10,
    isActive: true,
  },
  {
    id: 'rule-standard-99',
    name: 'Standard Hyderabad Delivery',
    minOrderAmountPaise: 0,
    maxOrderAmountPaise: 99899,
    feePaise: 9900,
    priority: 1,
    isActive: true,
  },
];

export interface DeliveryFeeRuleDTO {
  id: string;
  name: string;
  minOrderAmountPaise: number;
  maxOrderAmountPaise?: number | null;
  feePaise: number;
  priority: number;
  isActive: boolean;
}


/**
 * Checks whether a given delivery PIN code is serviceable in Hyderabad.
 */
export async function checkHyderabadServiceability(pincode: string): Promise<{
  serviceable: boolean;
  pincode: string;
  city: string;
  state: string;
  stateCode: string;
  areaName?: string | null;
  deliveryDays: number;
  message: string;
}> {
  const clean = pincode ? pincode.trim() : '';
  if (!clean || !/^[1-9][0-9]{5}$/.test(clean)) {
    return {
      serviceable: false,
      pincode: clean,
      city: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      deliveryDays: 0,
      message: 'Invalid Indian PIN code format. Please enter a valid 6-digit code.',
    };
  }

  try {
    const record = await prisma.serviceablePincode.findUnique({
      where: { pincode: clean },
      include: { zone: true },
    });

    if (record && record.isActive) {
      return {
        serviceable: true,
        pincode: record.pincode,
        city: record.city,
        state: record.state,
        stateCode: record.stateCode,
        areaName: record.areaName,
        deliveryDays: record.deliveryDays,
        message: `Personal delivery available in ${record.areaName || record.city} within ${record.deliveryDays} day(s).`,
      };
    }
    if (record && !record.isActive) {
      // Owner paused this PIN code: it must not fall back to the built-in list below.
      return {
        serviceable: false,
        pincode: clean,
        city: record.city,
        state: record.state,
        stateCode: record.stateCode,
        deliveryDays: 0,
        message: `Delivery to PIN code ${clean} is currently paused.`,
      };
    }
  } catch {
    // DB fallback
  }

  // Fallback to dev/seed registry
  const devRecord = DEV_PINCODES.get(clean);
  if (devRecord && devRecord.isActive) {
    return {
      serviceable: true,
      pincode: devRecord.pincode,
      city: devRecord.city,
      state: devRecord.state,
      stateCode: devRecord.stateCode,
      areaName: devRecord.areaName,
      deliveryDays: devRecord.deliveryDays,
      message: `Personal delivery available in ${devRecord.areaName || devRecord.city} within ${devRecord.deliveryDays} day(s).`,
    };
  }

  // If outside Hyderabad seed list
  return {
    serviceable: false,
    pincode: clean,
    city: 'Hyderabad',
    state: 'Telangana',
    stateCode: '36',
    deliveryDays: 0,
    message: `PIN code ${clean} is currently outside our direct personal delivery coverage in Hyderabad.`,
  };
}

/**
 * Computes authoritative delivery fee based on active order-value slabs (DeliveryFeeRule).
 */
export async function calculateAuthoritativeDeliveryFee(orderSubtotalPaise: number): Promise<{
  feePaise: number;
  appliedRuleName: string;
  isFreeDelivery: boolean;
}> {
  try {
    const rules = await prisma.deliveryFeeRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      const minPaise = Number(rule.minOrderAmountPaise);
      const maxPaise = rule.maxOrderAmountPaise !== null ? Number(rule.maxOrderAmountPaise) : Infinity;

      if (orderSubtotalPaise >= minPaise && orderSubtotalPaise <= maxPaise) {
        const fee = Number(rule.feePaise);
        return {
          feePaise: fee,
          appliedRuleName: rule.name,
          isFreeDelivery: fee === 0,
        };
      }
    }
  } catch {
    // DB fallback
  }

  // Fallback evaluation
  for (const rule of DEV_FEE_RULES.filter((r) => r.isActive).sort((a, b) => b.priority - a.priority)) {
    const minPaise = rule.minOrderAmountPaise;
    const maxPaise = rule.maxOrderAmountPaise !== null && rule.maxOrderAmountPaise !== undefined ? rule.maxOrderAmountPaise : Infinity;

    if (orderSubtotalPaise >= minPaise && orderSubtotalPaise <= maxPaise) {
      return {
        feePaise: rule.feePaise,
        appliedRuleName: rule.name,
        isFreeDelivery: rule.feePaise === 0,
      };
    }
  }

  // Default standard fallback
  const isFree = orderSubtotalPaise >= 99900;
  return {
    feePaise: isFree ? 0 : 9900,
    appliedRuleName: isFree ? 'Free Delivery (> ₹999)' : 'Standard Delivery',
    isFreeDelivery: isFree,
  };
}

/**
 * Lists all serviceable PIN codes (Admin).
 */
function toPincodeDTO(r: any): ServiceablePincodeDTO {
  return {
    id: r.id,
    pincode: r.pincode,
    areaName: r.areaName,
    city: r.city,
    state: r.state,
    stateCode: r.stateCode,
    zoneId: r.zoneId,
    zoneName: r.zone?.name || null,
    isActive: r.isActive,
    deliveryDays: r.deliveryDays,
    notes: r.notes,
  };
}

/**
 * Lists every PIN code checkout knows about: the built-in Hyderabad list, overridden by any
 * owner-saved database entries (which can add new PIN codes or pause existing ones).
 */
export async function listServiceablePincodes(): Promise<ServiceablePincodeDTO[]> {
  const merged = new Map<string, ServiceablePincodeDTO>();
  for (const [pin, rec] of DEV_PINCODES.entries()) merged.set(pin, rec);
  try {
    const records = await prisma.serviceablePincode.findMany({
      include: { zone: true },
      orderBy: { pincode: 'asc' },
    });
    for (const r of records) {
      const dto = toPincodeDTO(r);
      merged.set(dto.pincode, dto);
      DEV_PINCODES.set(dto.pincode, dto);
    }
  } catch {
    // Database unavailable: the in-memory registry is all we have.
  }
  return Array.from(merged.values()).sort((a, b) => a.pincode.localeCompare(b.pincode));
}

/**
 * Loads the owner's saved setting for one PIN code (if any) into the in-memory registry that
 * checkout's serviceability checks read, so admin changes take effect on every server instance.
 */
export async function primePincodeFromDatabase(pincode: string): Promise<void> {
  const clean = (pincode || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(clean)) return;
  try {
    const r = await prisma.serviceablePincode.findUnique({ where: { pincode: clean }, include: { zone: true } });
    if (r) DEV_PINCODES.set(clean, toPincodeDTO(r));
  } catch {
    // Keep the built-in registry when the database is unreachable.
  }
}

/**
 * Upserts a serviceable PIN code (Admin).
 */
export async function upsertServiceablePincode(data: {
  pincode: string;
  areaName?: string;
  zoneId?: string | null;
  isActive?: boolean;
  deliveryDays?: number;
  notes?: string;
}): Promise<ServiceablePincodeDTO> {
  const cleanPin = data.pincode.trim();
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    throw new DeliveryError('Valid 6-digit Indian PIN code required.');
  }

  try {
    const result = await prisma.serviceablePincode.upsert({
      where: { pincode: cleanPin },
      create: {
        pincode: cleanPin,
        areaName: data.areaName || null,
        city: 'Hyderabad',
        state: 'Telangana',
        stateCode: '36',
        zoneId: data.zoneId || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        deliveryDays: data.deliveryDays || 1,
        notes: data.notes || null,
      },
      update: {
        areaName: data.areaName,
        zoneId: data.zoneId,
        isActive: data.isActive,
        deliveryDays: data.deliveryDays,
        notes: data.notes,
      },
      include: { zone: true },
    });

    const dto = toPincodeDTO(result);
    DEV_PINCODES.set(cleanPin, dto);
    return dto;
  } catch {
    const existing: ServiceablePincodeDTO = DEV_PINCODES.get(cleanPin) || {
      id: `dev-pin-${cleanPin}`,
      pincode: cleanPin,
      areaName: 'Hyderabad Central',
      city: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      zoneId: 'hyderabad-direct',
      zoneName: 'Hyderabad Direct Zone',
      isActive: true,
      deliveryDays: 1,
      notes: 'Express Personal Delivery',
    };

    const updated: ServiceablePincodeDTO = {
      ...existing,
      areaName: data.areaName || existing.areaName,
      zoneId: data.zoneId !== undefined ? data.zoneId : existing.zoneId,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      deliveryDays: data.deliveryDays || existing.deliveryDays || 1,
      notes: data.notes || existing.notes,
    };

    DEV_PINCODES.set(cleanPin, updated);
    return updated;
  }
}

/**
 * Lists all active and inactive delivery pricing slabs (Admin).
 */
export async function listDeliveryFeeRules(): Promise<DeliveryFeeRuleDTO[]> {
  try {
    const rules = await prisma.deliveryFeeRule.findMany({
      orderBy: { priority: 'desc' },
    });
    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      minOrderAmountPaise: Number(r.minOrderAmountPaise),
      maxOrderAmountPaise: r.maxOrderAmountPaise !== null ? Number(r.maxOrderAmountPaise) : null,
      feePaise: Number(r.feePaise),
      priority: r.priority,
      isActive: r.isActive,
    }));
  } catch {
    return DEV_FEE_RULES;
  }
}

/**
 * Creates or updates a delivery fee pricing slab (Admin).
 */
export async function upsertDeliveryFeeRule(data: {
  id?: string;
  name: string;
  minOrderAmountPaise: number;
  maxOrderAmountPaise?: number | null;
  feePaise: number;
  priority?: number;
  isActive?: boolean;
}): Promise<DeliveryFeeRuleDTO> {
  if (!data.name || data.feePaise < 0 || data.minOrderAmountPaise < 0) {
    throw new DeliveryError('Invalid delivery fee rule parameters.');
  }

  try {
    if (data.id) {
      const updated = await prisma.deliveryFeeRule.update({
        where: { id: data.id },
        data: {
          name: data.name,
          minOrderAmountPaise: BigInt(data.minOrderAmountPaise),
          maxOrderAmountPaise: data.maxOrderAmountPaise !== null && data.maxOrderAmountPaise !== undefined ? BigInt(data.maxOrderAmountPaise) : null,
          feePaise: BigInt(data.feePaise),
          priority: data.priority || 0,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });
      return {
        id: updated.id,
        name: updated.name,
        minOrderAmountPaise: Number(updated.minOrderAmountPaise),
        maxOrderAmountPaise: updated.maxOrderAmountPaise !== null ? Number(updated.maxOrderAmountPaise) : null,
        feePaise: Number(updated.feePaise),
        priority: updated.priority,
        isActive: updated.isActive,
      };
    } else {
      const created = await prisma.deliveryFeeRule.create({
        data: {
          name: data.name,
          minOrderAmountPaise: BigInt(data.minOrderAmountPaise),
          maxOrderAmountPaise: data.maxOrderAmountPaise !== null && data.maxOrderAmountPaise !== undefined ? BigInt(data.maxOrderAmountPaise) : null,
          feePaise: BigInt(data.feePaise),
          priority: data.priority || 0,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });
      return {
        id: created.id,
        name: created.name,
        minOrderAmountPaise: Number(created.minOrderAmountPaise),
        maxOrderAmountPaise: created.maxOrderAmountPaise !== null ? Number(created.maxOrderAmountPaise) : null,
        feePaise: Number(created.feePaise),
        priority: created.priority,
        isActive: created.isActive,
      };
    }
  } catch {
    const id = data.id || `dev-rule-${Date.now()}`;
    const rule: DeliveryFeeRuleDTO = {
      id,
      name: data.name,
      minOrderAmountPaise: data.minOrderAmountPaise,
      maxOrderAmountPaise: data.maxOrderAmountPaise,
      feePaise: data.feePaise,
      priority: data.priority || 0,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
    const idx = DEV_FEE_RULES.findIndex((r) => r.id === id);
    if (idx >= 0) {
      DEV_FEE_RULES[idx] = rule;
    } else {
      DEV_FEE_RULES.push(rule);
    }
    return rule;
  }
}

/**
 * Creates or updates personal delivery tracking record for an order (Hyderabad direct fulfillment).
 */
export async function assignDeliveryRecord(input: {
  orderId: string;
  assignedPerson: string;
  assignedPhone?: string;
  notes?: string;
  codAmountDuePaise?: number;
}): Promise<any> {
  try {
    return await prisma.deliveryRecord.upsert({
      where: { orderId: input.orderId },
      create: {
        orderId: input.orderId,
        assignedPerson: input.assignedPerson,
        assignedPhone: input.assignedPhone || null,
        deliveryStatus: 'ASSIGNED',
        deliveryNotes: input.notes || null,
        startedAt: new Date(),
        codAmountDuePaise: BigInt(input.codAmountDuePaise || 0),
      },
      update: {
        assignedPerson: input.assignedPerson,
        assignedPhone: input.assignedPhone,
        deliveryNotes: input.notes,
        deliveryStatus: 'ASSIGNED',
      },
    });
  } catch {
    return {
      id: `dev-del-${input.orderId}`,
      orderId: input.orderId,
      assignedPerson: input.assignedPerson,
      deliveryStatus: 'ASSIGNED',
      startedAt: new Date(),
    };
  }
}

/**
 * Allows the store owner to manually set or update the delivery charge for an order.
 * Business Rule: Delivery charges are manually entered by the owner for each order.
 */
export async function updateOrderDeliveryCharge(
  orderId: string,
  deliveryChargePaise: number,
  actor: string
): Promise<any> {
  if (typeof deliveryChargePaise !== 'number' || deliveryChargePaise < 0) {
    throw new DeliveryError('Delivery charge must be a non-negative integer paise amount.');
  }

  const cleanCharge = Math.round(deliveryChargePaise);

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new DeliveryError('Order not found.', 404);

    const oldShipping = Number(order.shippingTotalPaise);
    const newGrandTotal = Number(order.grandTotalPaise) - oldShipping + cleanCharge;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingTotalPaise: BigInt(cleanCharge),
        grandTotalPaise: BigInt(newGrandTotal),
        // A changed charge needs the customer's approval again (clears AUTO_DISTANCE / OWNER_SET).
        deliveryFeeRuleId: null,
        // The customer can only review and pay after the owner sets the charge, so the
        // original short checkout hold must restart from here or it expires before payment.
        reservationExpiresAt: new Date(Date.now() + CUSTOMER_APPROVAL_WINDOW_MS),
      },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.orderStatus,
        toStatus: order.orderStatus,
        changedBy: actor,
        notes: `Owner manually set delivery charge to ₹${(cleanCharge / 100).toFixed(2)} (Previous: ₹${(oldShipping / 100).toFixed(2)})`,
      },
    });

    await notifyCustomerDeliveryChargeReady(updated).catch((err) =>
      console.warn(`[DELIVERY_CHARGE] Customer notification failed for #${updated.orderNumber}:`, err)
    );

    return updated;
  } catch (err: any) {
    if (err instanceof DeliveryError) throw err;
    // Dev fallback
    for (const [key, devOrd] of DEV_ORDERS_STORE.entries()) {
      if (devOrd.id === orderId || devOrd.orderNumber === orderId) {
        const oldShipping = devOrd.shippingTotalPaise || 0;
        devOrd.shippingTotalPaise = cleanCharge;
        devOrd.grandTotalPaise = (devOrd.grandTotalPaise || 0) - oldShipping + cleanCharge;
        (devOrd as any).deliveryChargeAssigned = true;
        (devOrd as any).deliveryChargeCustomerApproved = false;
        devOrd.reservationExpiresAt = new Date(Date.now() + CUSTOMER_APPROVAL_WINDOW_MS).toISOString();
        return devOrd;
      }
    }
    throw new DeliveryError('Order not found.', 404);
  }
}

/**
 * Emails the customer a link back to checkout once the delivery charge is set, so they can
 * approve and pay even if they closed the checkout page. Guest links carry the order token
 * in the URL fragment (#t=...), which browsers never send to the server or in Referer headers.
 */
async function notifyCustomerDeliveryChargeReady(order: any): Promise<void> {
  if (!order?.customerEmail) return;
  if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'REJECTED') return;

  const [{ getSellerConfig }, { enqueueTransactionalEmail }, { renderDeliveryChargeReadyTemplate }, { SNAPPY_EMAIL_BRAND }] =
    await Promise.all([
      import('@/lib/invoices/seller-config.service'),
      import('@/lib/email/email-outbox.service'),
      import('@/lib/email/email-templates'),
      import('@/lib/email/snappy-email-brand'),
    ]);

  const base = `${SNAPPY_EMAIL_BRAND.siteUrl}/checkout?order=${encodeURIComponent(order.orderNumber)}`;
  const continueUrl = !order.userId && order.guestLookupToken
    ? `${base}#t=${encodeURIComponent(order.guestLookupToken)}`
    : base;

  const seller = await getSellerConfig();
  const shippingPaise = Number(order.shippingTotalPaise || 0);
  const totalPaise = Number(order.grandTotalPaise || 0);
  const email = renderDeliveryChargeReadyTemplate(seller, {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    deliveryChargeInr: `₹${(shippingPaise / 100).toFixed(2)}`,
    grandTotalInr: `₹${(totalPaise / 100).toFixed(2)}`,
    paymentMethod: order.paymentMethod || 'RAZORPAY',
    continueUrl,
  });

  await enqueueTransactionalEmail({
    // A revised charge must send a fresh email, so the key includes the amount and time.
    idempotencyKey: `email:delivery_charge_ready:${order.orderNumber}:${shippingPaise}:${Date.now()}`,
    eventType: 'DELIVERY_CHARGE_READY',
    orderId: order.id,
    orderNumber: order.orderNumber,
    recipientEmail: order.customerEmail,
    recipientName: order.customerName,
    subject: email.subject,
    htmlBody: email.html,
    textBody: email.text,
  });
}
