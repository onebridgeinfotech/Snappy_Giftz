import { prisma } from '@/lib/prisma';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { DEV_ORDERS_STORE } from '@/lib/orders/order.service';

export class DeliveryError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'DeliveryError';
    this.statusCode = statusCode;
  }
}

export interface ServiceablePincodeDTO {
  id: string;
  pincode: string;
  areaName?: string | null;
  city: string;
  state: string;
  stateCode: string;
  zoneId?: string | null;
  zoneName?: string | null;
  isActive: boolean;
  deliveryDays: number;
  notes?: string | null;
}

export interface DeliveryFeeRuleDTO {
  id: string;
  name: string;
  minOrderAmountPaise: number;
  maxOrderAmountPaise?: number | null;
  feePaise: number;
  priority: number;
  isActive: boolean;
}

// Initial default Hyderabad pincodes seed list for local fallback / development
export const INITIAL_HYDERABAD_PINCODES: Record<string, { area: string; days: number }> = {
  '500001': { area: 'Hyderabad GPO, Abids, Koti', days: 1 },
  '500002': { area: 'Charminar, Moghalpura', days: 1 },
  '500003': { area: 'Secunderabad, Clock Tower', days: 1 },
  '500004': { area: 'Khairatabad, Raj Bhavan', days: 1 },
  '500007': { area: 'Kacheguda, Barkatpura', days: 1 },
  '500016': { area: 'Begumpet, Prakash Nagar', days: 1 },
  '500028': { area: 'Mehdipatnam, Humayun Nagar', days: 1 },
  '500032': { area: 'Gachibowli, Telecom Nagar', days: 1 },
  '500033': { area: 'Jubilee Hills, Road No 36', days: 1 },
  '500034': { area: 'Banjara Hills, Panjagutta', days: 1 },
  '500072': { area: 'Kukatpally, KPHB Colony', days: 1 },
  '500081': { area: 'Madhapur, Hitech City, Cyber Towers', days: 1 },
  '500082': { area: 'Somajiguda, Raj Bhavan Road', days: 1 },
  '500084': { area: 'Kondapur, Whitefields', days: 1 },
  '500089': { area: 'Manikonda, Puppalguda', days: 1 },
  '500090': { area: 'Nizampet, Pragathi Nagar', days: 1 },
  '500095': { area: 'Sultan Bazar, Bank Street', days: 1 },
};

// In-Memory Dev Store for Delivery Rules when DB is offline
export const DEV_PINCODES = new Map<string, ServiceablePincodeDTO>();
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
    feePaise: 9900, // ₹99
    priority: 1,
    isActive: true,
  },
];

// Initialize dev pincodes store
for (const [pin, info] of Object.entries(INITIAL_HYDERABAD_PINCODES)) {
  DEV_PINCODES.set(pin, {
    id: `dev-pin-${pin}`,
    pincode: pin,
    areaName: info.area,
    city: 'Hyderabad',
    state: 'Telangana',
    stateCode: '36',
    zoneId: null,
    zoneName: 'Central Zone',
    isActive: true,
    deliveryDays: info.days,
  });
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
export async function listServiceablePincodes(): Promise<ServiceablePincodeDTO[]> {
  try {
    const records = await prisma.serviceablePincode.findMany({
      include: { zone: true },
      orderBy: { pincode: 'asc' },
    });

    return records.map((r) => ({
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
    }));
  } catch {
    return Array.from(DEV_PINCODES.values());
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

    return {
      id: result.id,
      pincode: result.pincode,
      areaName: result.areaName,
      city: result.city,
      state: result.state,
      stateCode: result.stateCode,
      zoneId: result.zoneId,
      zoneName: result.zone?.name || null,
      isActive: result.isActive,
      deliveryDays: result.deliveryDays,
      notes: result.notes,
    };
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

    return updated;
  } catch (err: any) {
    if (err instanceof DeliveryError) throw err;
    // Dev fallback
    for (const [key, devOrd] of DEV_ORDERS_STORE.entries()) {
      if (devOrd.id === orderId || devOrd.orderNumber === orderId) {
        const oldShipping = devOrd.shippingTotalPaise || 0;
        devOrd.shippingTotalPaise = cleanCharge;
        devOrd.grandTotalPaise = (devOrd.grandTotalPaise || 0) - oldShipping + cleanCharge;
        return devOrd;
      }
    }
    throw new DeliveryError('Order not found.', 404);
  }
}
