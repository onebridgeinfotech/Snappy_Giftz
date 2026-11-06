import { prisma } from '@/lib/prisma';
import { OrderStatus, PaymentStatus, Role } from '@prisma/client';
import {
  SanitizedOrderResult,
  DEV_ORDERS_STORE,
} from '@/lib/orders/order.service';
import {
  isStorefrontFallbackAllowed,
  CatalogDatabaseError,
} from '@/lib/catalog/public-catalog.service';
import { DEV_PERSONALIZATION_STORE } from '@/lib/personalization/personalization.service';
import {
  issueTaxInvoice,
  recordInvoicePhysicalSignatureConfirmation,
} from '@/lib/invoices/invoice.service';
import { getSellerConfig } from '@/lib/invoices/seller-config.service';
import { enqueueTransactionalEmail } from '@/lib/email/email-outbox.service';
import { renderShipmentDispatchedTemplate } from '@/lib/email/email-templates';
import { INITIAL_PRODUCTS } from '@/data/initialData';

export class OrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderTransitionError';
  }
}

export class OrderFulfillmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderFulfillmentError';
  }
}

export class OrderNotFoundError extends Error {
  constructor(message = 'Order not found.') {
    super(message);
    this.name = 'OrderNotFoundError';
  }
}

export class OrderStateConflictError extends Error {
  constructor(message = 'Conflicting status update detected on order.') {
    super(message);
    this.name = 'OrderStateConflictError';
  }
}

/**
 * Authoritative Order Lifecycle Transition Matrix.
 * Enforces valid state progressions and prevents invalid transitions.
 * Terminal states (DELIVERED, CANCELLED) cannot transition to any other status.
 */
export const ORDER_TRANSITION_MATRIX: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_COD_CONFIRMATION],
  PENDING_PAYMENT: [OrderStatus.CONFIRMED, OrderStatus.EXPIRED, OrderStatus.CANCELLED],
  PENDING_COD_CONFIRMATION: [OrderStatus.CONFIRMED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.IN_CUSTOMIZATION, OrderStatus.QUALITY_CHECK, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.IN_CUSTOMIZATION, OrderStatus.QUALITY_CHECK, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
  IN_CUSTOMIZATION: [OrderStatus.QUALITY_CHECK, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  QUALITY_CHECK: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DISPATCHED, OrderStatus.IN_CUSTOMIZATION, OrderStatus.CANCELLED],
  OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DISPATCHED: [OrderStatus.DELIVERED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: [],
};

/**
 * Validates tracking URL against safe HTTP/HTTPS protocols.
 * Explicitly rejects javascript:, data:, file:, relative paths, and malformed strings.
 */
export function isValidTrackingUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface DispatchInput {
  carrierPartner: string;
  awbNumber: string;
  trackingUrl?: string | null;
  dispatchedAt?: string | Date | null;
  notes?: string | null;
  invoicePhysicalSignatureConfirmed?: boolean;
}

export interface DeliveryInput {
  deliveredAt?: string | Date | null;
  notes?: string | null;
}

export interface AdminOrderListOptions {
  page?: number;
  limit?: number;
  search?: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  sortBy?: 'createdAt' | 'grandTotalPaise' | 'orderNumber';
  sortOrder?: 'asc' | 'desc';
}

// In-memory development stores for offline testing / development fallback
export const DEV_SHIPMENTS_STORE: Map<string, any> = new Map();
export const DEV_STATUS_HISTORY_STORE: Map<string, any[]> = new Map();

/**
 * Validates dispatch input parameters.
 */
export function validateDispatchInput(input: DispatchInput) {
  if (!input) {
    throw new OrderFulfillmentError('Dispatch payload cannot be empty.');
  }

  const carrier = input.carrierPartner?.trim();
  if (!carrier || carrier.length < 2 || carrier.length > 100) {
    throw new OrderFulfillmentError('Carrier name is required and must be between 2 and 100 characters.');
  }

  const awb = input.awbNumber?.trim();
  if (!awb || awb.length < 3 || awb.length > 50) {
    throw new OrderFulfillmentError('Valid AWB / Tracking number is required (between 3 and 50 characters).');
  }

  if (input.trackingUrl && input.trackingUrl.trim()) {
    if (!isValidTrackingUrl(input.trackingUrl)) {
      throw new OrderFulfillmentError('Invalid tracking URL. Only valid HTTP/HTTPS URLs are accepted.');
    }
  }
}

/**
 * Fetch paginated, searchable, and filterable list of orders for Admin & Staff.
 */
export async function listOrdersForAdmin(options: AdminOrderListOptions = {}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (options.orderStatus) {
    where.orderStatus = options.orderStatus;
  }

  if (options.paymentStatus) {
    where.paymentStatus = options.paymentStatus;
  }

  if (options.paymentMethod) {
    where.paymentMethod = options.paymentMethod;
  }

  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      where.createdAt.lte = new Date(options.endDate);
    }
  }

  if (options.search) {
    const s = options.search.trim();
    where.OR = [
      { orderNumber: { contains: s, mode: 'insensitive' } },
      { customerName: { contains: s, mode: 'insensitive' } },
      { customerEmail: { contains: s, mode: 'insensitive' } },
      { customerPhone: { contains: s, mode: 'insensitive' } },
      { shipments: { some: { awbNumber: { contains: s, mode: 'insensitive' } } } },
    ];
  }

  const orderByField = options.sortBy || 'createdAt';
  const orderDirection = options.sortOrder || 'desc';

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderDirection },
        include: {
          items: true,
          payments: {
            select: {
              id: true,
              gateway: true,
              gatewayOrderId: true,
              gatewayPaymentId: true,
              amountPaise: true,
              status: true,
              capturedAt: true,
            },
          },
          shipments: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(formatAdminOrderListItem),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unreachable during admin order list fetch.');
    }

    // Dev / Test Fallback
    let devList = Array.from(DEV_ORDERS_STORE.values());

    if (options.orderStatus) {
      devList = devList.filter((o) => o.orderStatus === options.orderStatus);
    }
    if (options.paymentStatus) {
      devList = devList.filter((o) => o.paymentStatus === options.paymentStatus);
    }
    if (options.paymentMethod) {
      devList = devList.filter((o) => o.paymentMethod === options.paymentMethod);
    }
    if (options.search) {
      const s = options.search.trim().toLowerCase();
      devList = devList.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(s) ||
          o.customerName.toLowerCase().includes(s) ||
          o.customerEmail.toLowerCase().includes(s) ||
          o.customerPhone.includes(s) ||
          (o.shipment?.awbNumber && o.shipment.awbNumber.toLowerCase().includes(s))
      );
    }
    if (options.startDate) {
      const start = new Date(options.startDate).getTime();
      devList = devList.filter((o) => new Date(o.createdAt).getTime() >= start);
    }
    if (options.endDate) {
      const end = new Date(options.endDate).getTime();
      devList = devList.filter((o) => new Date(o.createdAt).getTime() <= end);
    }

    const total = devList.length;
    const paginated = devList.slice(skip, skip + limit);

    return {
      orders: paginated.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        destinationStateCode: o.destinationStateCode,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        itemsCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
        grandTotalPaise: o.grandTotalPaise,
        createdAt: o.createdAt,
        shipment: o.shipment || null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

/**
 * Fetch detailed order information for Admin & Staff, including full item snapshots,
 * address, pricing breakdown, payments, shipments, and status audit history.
 */
export async function getAdminOrderDetails(orderIdOrNumber: string) {
  const cleanKey = orderIdOrNumber?.trim();
  if (!cleanKey) throw new OrderNotFoundError();

  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: cleanKey }, { orderNumber: cleanKey }],
      },
      include: {
        items: {
          include: {
            personalization: true,
          },
        },
        payments: true,
        shipments: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { id: true, name: true, email: true, phone: true, role: true },
        },
      },
    });

    if (!order) {
      if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanKey)) {
        return formatDevOrderDetails(DEV_ORDERS_STORE.get(cleanKey)!);
      }
      throw new OrderNotFoundError(`Order not found: ${cleanKey}`);
    }

    return formatAdminOrderDetails(order);
  } catch (err: any) {
    if (err instanceof OrderNotFoundError) throw err;
    if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanKey)) {
      return formatDevOrderDetails(DEV_ORDERS_STORE.get(cleanKey)!);
    }
    if (!isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unreachable during order details lookup.');
    }
    throw new OrderNotFoundError();
  }
}

/**
 * Validates and executes a formal status transition for an order.
 * Strictly checks the state machine matrix, enforces payment decoupling,
 * and transactionally writes both the order update and the OrderStatusHistory audit log.
 */
export async function transitionOrderStatus(
  orderIdOrNumber: string,
  newStatus: OrderStatus,
  actorIdentifier: string,
  notes?: string
) {
  const cleanKey = orderIdOrNumber?.trim();
  if (!cleanKey) throw new OrderNotFoundError();

  if (!Object.values(OrderStatus).includes(newStatus)) {
    throw new OrderTransitionError(`Invalid order status target: "${newStatus}".`);
  }

  // 1. Fetch current order
  let order: any = null;
  try {
    order = await prisma.order.findFirst({
      where: { OR: [{ id: cleanKey }, { orderNumber: cleanKey }] },
      include: {
        shipments: true,
        items: {
          include: {
            personalization: true,
          },
        },
      },
    });
  } catch {
    if (!isStorefrontFallbackAllowed() || process.env.NODE_ENV === 'production') {
      throw new CatalogDatabaseError('Database unreachable during order transition.');
    }
    order = DEV_ORDERS_STORE.get(cleanKey) || null;
    if (!order) {
      for (const devOrd of DEV_ORDERS_STORE.values()) {
        if (devOrd.id === cleanKey || devOrd.orderNumber === cleanKey) {
          order = devOrd;
          break;
        }
      }
    }
  }

  if (!order) {
    for (const devOrd of DEV_ORDERS_STORE.values()) {
      if (devOrd.id === cleanKey || devOrd.orderNumber === cleanKey) {
        order = devOrd;
        break;
      }
    }
    if (!order) {
      throw new OrderNotFoundError(`Order not found: ${cleanKey}`);
    }
  }

  const currentStatus = order.orderStatus as OrderStatus;

  // 2. Already in target status? (Idempotent success)
  if (currentStatus === newStatus) {
    return formatDevOrderDetails(order);
  }

  // 3. State machine validation
  const permittedNextStates = ORDER_TRANSITION_MATRIX[currentStatus] || [];
  if (!permittedNextStates.includes(newStatus)) {
    throw new OrderTransitionError(
      `Cannot transition order from "${currentStatus}" to "${newStatus}". Permitted transitions: [${permittedNextStates.join(', ') || 'None (Terminal state)'}].`
    );
  }

  // 4. Safeguard: An unpaid PENDING order cannot be confirmed or moved to fulfillment without verified payment
  if (currentStatus === OrderStatus.PENDING && newStatus === OrderStatus.CONFIRMED) {
    if (order.paymentStatus !== PaymentStatus.CAPTURED && order.paymentMethod !== 'CORPORATE_CREDIT') {
      throw new OrderTransitionError(
        'Cannot confirm an order with unverified/pending payment. Payment must be CAPTURED before confirmation.'
      );
    }
  }

  // 4b. Safeguard: An order with personalized items pending customer proof approval or rejected by staff cannot proceed to production (IN_CUSTOMIZATION)
  if (newStatus === OrderStatus.IN_CUSTOMIZATION) {
    const items = order.items || [];
    for (const item of items) {
      const pers = item.personalization || (DEV_PERSONALIZATION_STORE.get(item.id) ?? null);
      if (pers) {
        if (pers.staffReviewStatus === 'REJECTED_FOR_REWORK') {
          throw new OrderTransitionError(
            `Cannot transition order to IN_CUSTOMIZATION: personalized item "${item.productName}" proof was rejected by staff for rework.`
          );
        }
        if (pers.customerApprovalStatus === 'PENDING') {
          throw new OrderTransitionError(
            `Cannot transition order to IN_CUSTOMIZATION: personalized item "${item.productName}" has pending customer proof approval.`
          );
        }
      }
    }
  }

  // 5. If transitioning to DISPATCHED directly, ensure carrier & AWB are already recorded
  if (newStatus === OrderStatus.DISPATCHED) {
    const hasShipment = (order.shipments && order.shipments.length > 0 && order.shipments[0].awbNumber) ||
      (order.shipment && order.shipment.awbNumber);
    if (!hasShipment) {
      throw new OrderTransitionError(
        'Cannot transition order to DISPATCHED without recording carrier and AWB tracking details first. Use the dispatch endpoint.'
      );
    }
  }

  // 6. Execute Transaction
  const auditNote = notes?.trim() || `Status updated from ${currentStatus} to ${newStatus}`;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Transactional Concurrency Guard: Re-verify proof approval state inside transaction to prevent race with reviseOrderProof
      if (newStatus === OrderStatus.IN_CUSTOMIZATION) {
        const txOrder = await tx.order.findUnique({
          where: { id: order.id },
          include: {
            items: {
              include: {
                personalization: true,
              },
            },
          },
        });
        if (txOrder?.items) {
          for (const item of txOrder.items) {
            const pers = item.personalization;
            if (pers) {
              if (pers.staffReviewStatus === 'REJECTED_FOR_REWORK') {
                throw new OrderTransitionError(
                  `Cannot transition order to IN_CUSTOMIZATION: personalized item "${item.productName}" proof was rejected by staff for rework.`
                );
              }
              if (pers.customerApprovalStatus === 'PENDING') {
                throw new OrderTransitionError(
                  `Cannot transition order to IN_CUSTOMIZATION: personalized item "${item.productName}" has pending customer proof approval.`
                );
              }
            }
          }
        }
      }

      // Deduct stock only when an order is successfully marked DELIVERED (Deduct actual delivered qty exactly once)
      if (newStatus === OrderStatus.DELIVERED && currentStatus !== OrderStatus.DELIVERED) {
        const existingDeduction = await tx.inventoryAdjustment.findFirst({
          where: {
            referenceId: order.orderNumber,
            reason: 'ORDER_FULFILLMENT',
          },
        });

        if (!existingDeduction) {
          for (const itm of order.items) {
            if (itm.variantId) {
              await tx.productVariant.update({
                where: { id: itm.variantId },
                data: { stockQuantity: { decrement: itm.quantity } },
              });
              const v = await tx.productVariant.findUnique({ where: { id: itm.variantId } });
              const nStock = v?.stockQuantity || 0;
              await tx.inventoryAdjustment.create({
                data: {
                  variantId: itm.variantId,
                  sku: itm.sku,
                  productName: itm.productName,
                  previousStock: nStock + itm.quantity,
                  adjustedQty: -itm.quantity,
                  newStock: nStock,
                  reason: 'ORDER_FULFILLMENT',
                  referenceId: order.orderNumber,
                  userId: null,
                  notes: `Deducted ${itm.quantity} unit(s) upon successful delivery of order ${order.orderNumber}`,
                },
              });
            }
          }
        }
      }

      const orderUpdate = await tx.order.update({
        where: { id: order.id },
        data: {
          orderStatus: newStatus,
          // If cancelling, clear reservation hold
          ...(newStatus === OrderStatus.CANCELLED ? { reservationExpiresAt: null } : {}),
        },
        include: {
          items: true,
          payments: true,
          shipments: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: currentStatus,
          toStatus: newStatus,
          changedBy: actorIdentifier,
          notes: auditNote,
        },
      });

      return orderUpdate;
    });

    return formatAdminOrderDetails(updated);
  } catch (dbErr) {
    if (dbErr instanceof OrderTransitionError) throw dbErr;
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database transaction failed during order status update.');
    }

    // Dev Fallback
    order.orderStatus = newStatus;
    DEV_ORDERS_STORE.set(order.orderNumber, order);

    const history = DEV_STATUS_HISTORY_STORE.get(order.orderNumber) || [];
    history.push({
      id: `dev-hist-${Date.now()}`,
      orderId: order.id,
      fromStatus: currentStatus,
      toStatus: newStatus,
      changedBy: actorIdentifier,
      notes: auditNote,
      createdAt: new Date().toISOString(),
    });
    DEV_STATUS_HISTORY_STORE.set(order.orderNumber, history);

    return formatDevOrderDetails(order);
  }
}

/**
 * Records packing and dispatch details for an order, including carrier partner,
 * AWB tracking number, dispatch timestamp, and optional HTTP/HTTPS tracking URL.
 * Moves order to DISPATCHED and logs OrderStatusHistory audit entry.
 */
export async function recordOrderDispatch(
  orderIdOrNumber: string,
  input: DispatchInput,
  actorIdentifier: string
) {
  validateDispatchInput(input);

  const cleanKey = orderIdOrNumber?.trim();
  if (!cleanKey) throw new OrderNotFoundError();

  const cleanCarrier = input.carrierPartner.trim();
  const cleanAwb = input.awbNumber.trim();
  const cleanTrackingUrl = input.trackingUrl?.trim() || null;
  const dispatchTimestamp = input.dispatchedAt ? new Date(input.dispatchedAt) : new Date();

  // 1. Fetch current order
  let order: any = null;
  try {
    order = await prisma.order.findFirst({
      where: { OR: [{ id: cleanKey }, { orderNumber: cleanKey }] },
      include: { shipments: true },
    });
  } catch {
    if (!isStorefrontFallbackAllowed() || process.env.NODE_ENV === 'production') {
      throw new CatalogDatabaseError('Database unreachable during order dispatch.');
    }
    order = DEV_ORDERS_STORE.get(cleanKey) || null;
  }

  if (!order) {
    for (const devOrd of DEV_ORDERS_STORE.values()) {
      if (devOrd.id === cleanKey || devOrd.orderNumber === cleanKey) {
        order = devOrd;
        break;
      }
    }
  }

  if (!order) {
    if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanKey)) {
      order = DEV_ORDERS_STORE.get(cleanKey)!;
    } else {
      throw new OrderNotFoundError(`Order not found: ${cleanKey}`);
    }
  }

  const currentStatus = order.orderStatus as OrderStatus;

  // 2. Validate permitted source state for dispatch
  if (currentStatus === OrderStatus.DELIVERED || currentStatus === OrderStatus.CANCELLED) {
    throw new OrderTransitionError(`Cannot dispatch an order that is already in terminal state "${currentStatus}".`);
  }

  if (currentStatus === OrderStatus.PENDING) {
    throw new OrderTransitionError('Cannot dispatch an unconfirmed order with pending payment.');
  }

  // Mandatory GST Compliance Gate (Section 31(1) of CGST Act, 2017):
  // Tax invoice must be issued before or at the time goods are removed/handed over for dispatch.
  // Dispatch CANNOT complete if a legally required tax invoice cannot be issued.
  const invoice = await issueTaxInvoice(order.orderNumber);

  // Mandatory GST Rule 46(q) Physical Signature Confirmation Gate:
  // For PHYSICAL_SIGNATURE_ON_PRINT, staff MUST explicitly confirm that the invoice
  // has been physically printed and signed prior to goods removal/courier handover.
  if (invoice.signatureMode === 'PHYSICAL_SIGNATURE_ON_PRINT') {
    if (!input.invoicePhysicalSignatureConfirmed) {
      throw new OrderFulfillmentError(
        'Dispatch blocked: Tax invoice requires physical signature on print prior to goods removal (CGST Rule 46(q)). Staff must explicitly confirm that the invoice has been physically printed and signed.'
      );
    }
    await recordInvoicePhysicalSignatureConfirmation(order.orderNumber, actorIdentifier);
  }

  // 3. Execute Transaction: upsert Shipment + update OrderStatus + create OrderStatusHistory
  let auditNote = input.notes?.trim()
    ? `Dispatched via ${cleanCarrier} (AWB: ${cleanAwb}). ${input.notes.trim()}`
    : `Dispatched via ${cleanCarrier} with AWB tracking number: ${cleanAwb}`;

  if (invoice.signatureMode === 'PHYSICAL_SIGNATURE_ON_PRINT' && input.invoicePhysicalSignatureConfirmed) {
    auditNote += ` • Tax invoice physically signed per Rule 46(q) confirmed by ${actorIdentifier}.`;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Find existing shipment or create
      const existingShipment = await tx.shipment.findFirst({
        where: { orderId: order.id },
      });

      if (existingShipment) {
        await tx.shipment.update({
          where: { id: existingShipment.id },
          data: {
            carrierPartner: cleanCarrier,
            awbNumber: cleanAwb,
            trackingUrl: cleanTrackingUrl,
            dispatchStatus: 'DISPATCHED',
            dispatchedAt: dispatchTimestamp,
            invoicePhysicallySignedBy: input.invoicePhysicalSignatureConfirmed ? actorIdentifier : existingShipment.invoicePhysicallySignedBy,
            invoicePhysicallySignedAt: input.invoicePhysicalSignatureConfirmed ? dispatchTimestamp : existingShipment.invoicePhysicallySignedAt,
          },
        });
      } else {
        const address = typeof order.shippingAddress === 'string'
          ? JSON.parse(order.shippingAddress)
          : order.shippingAddress || {};

        await tx.shipment.create({
          data: {
            orderId: order.id,
            recipientName: address.name || order.customerName,
            recipientEmail: order.customerEmail,
            recipientPhone: address.phone || order.customerPhone,
            addressStreet: address.street || 'Address Street',
            city: address.city || 'City',
            state: address.state || 'State',
            pincode: address.pincode || '305001',
            carrierPartner: cleanCarrier,
            awbNumber: cleanAwb,
            trackingUrl: cleanTrackingUrl,
            dispatchStatus: 'DISPATCHED',
            dispatchedAt: dispatchTimestamp,
            invoicePhysicallySignedBy: input.invoicePhysicalSignatureConfirmed ? actorIdentifier : null,
            invoicePhysicallySignedAt: input.invoicePhysicalSignatureConfirmed ? dispatchTimestamp : null,
          },
        });
      }

      // Update Order Status to DISPATCHED
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          orderStatus: OrderStatus.DISPATCHED,
        },
        include: {
          items: true,
          payments: true,
          shipments: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });

      // Audit Record
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: currentStatus,
          toStatus: OrderStatus.DISPATCHED,
          changedBy: actorIdentifier,
          notes: auditNote,
        },
      });

      return updatedOrder;
    });

    await triggerPostDispatchNotifications(order, cleanCarrier, cleanAwb, cleanTrackingUrl);
    return formatAdminOrderDetails(updated);
  } catch (dbErr) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database transaction failed during order dispatch.');
    }

    // Dev Fallback
    const shipmentObj = {
      carrierPartner: cleanCarrier,
      awbNumber: cleanAwb,
      trackingUrl: cleanTrackingUrl,
      dispatchStatus: 'DISPATCHED',
      dispatchedAt: dispatchTimestamp.toISOString(),
      deliveredAt: null,
      invoicePhysicallySignedBy: input.invoicePhysicalSignatureConfirmed ? actorIdentifier : null,
      invoicePhysicallySignedAt: input.invoicePhysicalSignatureConfirmed ? dispatchTimestamp.toISOString() : null,
    };

    order.shipment = shipmentObj;
    order.orderStatus = OrderStatus.DISPATCHED;
    DEV_ORDERS_STORE.set(order.orderNumber, order);
    DEV_SHIPMENTS_STORE.set(order.orderNumber, shipmentObj);

    const history = DEV_STATUS_HISTORY_STORE.get(order.orderNumber) || [];
    history.push({
      id: `dev-hist-${Date.now()}`,
      orderId: order.id,
      fromStatus: currentStatus,
      toStatus: OrderStatus.DISPATCHED,
      changedBy: actorIdentifier,
      notes: auditNote,
      createdAt: new Date().toISOString(),
    });
    DEV_STATUS_HISTORY_STORE.set(order.orderNumber, history);

    await triggerPostDispatchNotifications(order, cleanCarrier, cleanAwb, cleanTrackingUrl);
    return formatDevOrderDetails(order);
  }
}

async function triggerPostDispatchNotifications(
  order: any,
  cleanCarrier: string,
  cleanAwb: string,
  cleanTrackingUrl: string | null
): Promise<void> {
  try {
    // Enqueue SHIPMENT_DISPATCHED transactional email (tax invoice was verified and issued prior to dispatch)
    const seller = await getSellerConfig();
    const parsedAddr =
      typeof order.shippingAddress === 'string'
        ? JSON.parse(order.shippingAddress)
        : order.shippingAddress || {};

    const emailData = renderShipmentDispatchedTemplate(
      {
        orderNumber: order.orderNumber,
        carrierPartner: cleanCarrier,
        awbNumber: cleanAwb,
        trackingUrl: cleanTrackingUrl,
        shippingAddress: {
          fullName: parsedAddr.name || parsedAddr.fullName || order.customerName,
          city: parsedAddr.city || '',
          state: parsedAddr.state || '',
          postalCode: parsedAddr.pincode || parsedAddr.postalCode || '',
        },
      },
      seller
    );

    await enqueueTransactionalEmail({
      idempotencyKey: `email-shipment-dispatched-${order.orderNumber}-${cleanAwb}`,
      eventType: 'SHIPMENT_DISPATCHED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      recipientEmail: order.customerEmail,
      recipientName: order.customerName,
      subject: emailData.subject,
      htmlBody: emailData.html,
      textBody: emailData.text,
    });
  } catch (err) {
    console.warn('[DISPATCH:HOOKS] Post-dispatch notification non-fatal error:', err);
  }
}

/**
 * Confirms delivery of a dispatched order.
 * Moves order from DISPATCHED to DELIVERED, records deliveredAt,
 * and creates OrderStatusHistory audit entry.
 */
export async function confirmOrderDelivery(
  orderIdOrNumber: string,
  input: DeliveryInput = {},
  actorIdentifier: string
) {
  const cleanKey = orderIdOrNumber?.trim();
  if (!cleanKey) throw new OrderNotFoundError();

  const deliveryTimestamp = input.deliveredAt ? new Date(input.deliveredAt) : new Date();

  // 1. Fetch current order
  let order: any = null;
  try {
    order = await prisma.order.findFirst({
      where: { OR: [{ id: cleanKey }, { orderNumber: cleanKey }] },
      include: { shipments: true },
    });
  } catch {
    if (!isStorefrontFallbackAllowed() || process.env.NODE_ENV === 'production') {
      throw new CatalogDatabaseError('Database unreachable during delivery confirmation.');
    }
    order = DEV_ORDERS_STORE.get(cleanKey) || null;
  }

  if (!order) {
    for (const devOrd of DEV_ORDERS_STORE.values()) {
      if (devOrd.id === cleanKey || devOrd.orderNumber === cleanKey) {
        order = devOrd;
        break;
      }
    }
  }

  if (!order) {
    if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanKey)) {
      order = DEV_ORDERS_STORE.get(cleanKey)!;
    } else {
      throw new OrderNotFoundError(`Order not found: ${cleanKey}`);
    }
  }

  const currentStatus = order.orderStatus as OrderStatus;

  // 2. Order must be currently DISPATCHED
  if (currentStatus !== OrderStatus.DISPATCHED) {
    throw new OrderTransitionError(
      `Cannot confirm delivery for order currently in "${currentStatus}" status. Orders must be DISPATCHED first.`
    );
  }

  const auditNote = input.notes?.trim() || 'Delivery confirmed successfully.';

  // 3. Execute Transaction
  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Update shipment
      const existingShipment = await tx.shipment.findFirst({
        where: { orderId: order.id },
      });

      if (existingShipment) {
        await tx.shipment.update({
          where: { id: existingShipment.id },
          data: {
            dispatchStatus: 'DELIVERED',
            deliveredAt: deliveryTimestamp,
          },
        });
      }

      // Update Order Status to DELIVERED
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          orderStatus: OrderStatus.DELIVERED,
        },
        include: {
          items: true,
          payments: true,
          shipments: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });

      // Deduct inventory exactly once upon confirmed delivery
      for (const item of updatedOrder.items || []) {
        if (item.variantId) {
          const alreadyDeducted = await tx.inventoryAdjustment.findFirst({
            where: {
              variantId: item.variantId,
              referenceId: order.orderNumber,
              reason: 'ORDER_FULFILLMENT',
            },
          });
          if (!alreadyDeducted) {
            const variant = await tx.productVariant.findUnique({
              where: { id: item.variantId },
              include: { product: true },
            });
            if (variant) {
              const previousStock = variant.stockQuantity;
              const newStock = Math.max(0, previousStock - item.quantity);
              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stockQuantity: newStock },
              });
              await tx.inventoryAdjustment.create({
                data: {
                  variantId: item.variantId,
                  sku: variant.sku,
                  productName: variant.product.name,
                  previousStock,
                  adjustedQty: -item.quantity,
                  newStock,
                  reason: 'ORDER_FULFILLMENT',
                  referenceId: order.orderNumber,
                  notes: `Stock deducted on delivery confirmation for order #${order.orderNumber}`,
                },
              });
            }
          }
        }
      }

      // Audit Record
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.DISPATCHED,
          toStatus: OrderStatus.DELIVERED,
          changedBy: actorIdentifier,
          notes: auditNote,
        },
      });

      return updatedOrder;
    });

    return formatAdminOrderDetails(updated);
  } catch (dbErr) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database transaction failed during delivery confirmation.');
    }

    // Dev Fallback
    if (order.shipment) {
      order.shipment.dispatchStatus = 'DELIVERED';
      order.shipment.deliveredAt = deliveryTimestamp.toISOString();
    }
    order.orderStatus = OrderStatus.DELIVERED;
    if (!order.inventoryDeductedOnDelivery) {
      order.inventoryDeductedOnDelivery = true;
      for (const item of order.items || []) {
        const prod = INITIAL_PRODUCTS.find((p) => p.id === item.productId || p.name === item.productName);
        if (prod && typeof prod.stock === 'number') {
          prod.stock = Math.max(0, prod.stock - item.quantity);
        }
      }
    }
    DEV_ORDERS_STORE.set(order.orderNumber, order);

    const history = DEV_STATUS_HISTORY_STORE.get(order.orderNumber) || [];
    history.push({
      id: `dev-hist-${Date.now()}`,
      orderId: order.id,
      fromStatus: OrderStatus.DISPATCHED,
      toStatus: OrderStatus.DELIVERED,
      changedBy: actorIdentifier,
      notes: auditNote,
      createdAt: new Date().toISOString(),
    });
    DEV_STATUS_HISTORY_STORE.set(order.orderNumber, history);

    return formatDevOrderDetails(order);
  }
}

/**
 * Fetch authenticated customer's own order history.
 * Strictly derives identity from userId and excludes internal staff notes.
 */
export async function listOrdersForCustomer(
  userId: string,
  options: { page?: number; limit?: number } = {}
) {
  if (!userId?.trim()) {
    throw new Error('User ID is required to fetch customer order history.');
  }

  const cleanUserId = userId.trim();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: cleanUserId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          shipments: true,
        },
      }),
      prisma.order.count({ where: { userId: cleanUserId } }),
    ]);

    return {
      orders: orders.map(formatCustomerOrderListItem),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unreachable during customer order history fetch.');
    }

    // Dev Fallback
    const userOrders = Array.from(DEV_ORDERS_STORE.values()).filter(
      (o: any) => o.userId === cleanUserId
    );
    const total = userOrders.length;
    const paginated = userOrders.slice(skip, skip + limit);

    return {
      orders: paginated.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        items: o.items,
        itemsSubtotalPaise: o.itemsSubtotalPaise,
        taxTotalPaise: o.taxTotalPaise,
        shippingTotalPaise: o.shippingTotalPaise,
        grandTotalPaise: o.grandTotalPaise,
        createdAt: o.createdAt,
        shipment: o.shipment || null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

// ----------------- Formatters -----------------

function formatAdminOrderListItem(order: any) {
  const shipment = order.shipments && order.shipments.length > 0 ? order.shipments[0] : null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    destinationStateCode: order.destinationStateCode,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    itemsCount: order.items ? order.items.reduce((s: number, i: any) => s + i.quantity, 0) : 0,
    grandTotalPaise: Number(order.grandTotalPaise),
    createdAt: new Date(order.createdAt).toISOString(),
    shipment: shipment
      ? {
        carrierPartner: shipment.carrierPartner,
        awbNumber: shipment.awbNumber,
        trackingUrl: shipment.trackingUrl,
        dispatchStatus: shipment.dispatchStatus,
        dispatchedAt: shipment.dispatchedAt ? new Date(shipment.dispatchedAt).toISOString() : null,
        deliveredAt: shipment.deliveredAt ? new Date(shipment.deliveredAt).toISOString() : null,
        invoicePhysicallySignedBy: shipment.invoicePhysicallySignedBy || null,
        invoicePhysicallySignedAt: shipment.invoicePhysicallySignedAt ? new Date(shipment.invoicePhysicallySignedAt).toISOString() : null,
      }
      : null,
  };
}

function formatAdminOrderDetails(order: any) {
  const shipment = order.shipments && order.shipments.length > 0 ? order.shipments[0] : null;
  const address = typeof order.shippingAddress === 'string'
    ? JSON.parse(order.shippingAddress)
    : order.shippingAddress || {};

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    gstin: order.gstin || null,
    shippingAddress: address,
    destinationStateCode: order.destinationStateCode,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    itemsSubtotalPaise: Number(order.itemsSubtotalPaise),
    customizationTotalPaise: Number(order.customizationTotalPaise || 0),
    discountTotalPaise: Number(order.discountTotalPaise || 0),
    taxableAmountPaise: Number(order.taxableAmountPaise),
    taxTotalPaise: Number(order.taxTotalPaise),
    cgstPaise: Number(order.cgstPaise || 0),
    sgstPaise: Number(order.sgstPaise || 0),
    igstPaise: Number(order.igstPaise || 0),
    shippingTotalPaise: Number(order.shippingTotalPaise || 0),
    grandTotalPaise: Number(order.grandTotalPaise),
    reservationExpiresAt: order.reservationExpiresAt
      ? new Date(order.reservationExpiresAt).toISOString()
      : null,
    createdAt: new Date(order.createdAt).toISOString(),
    updatedAt: new Date(order.updatedAt).toISOString(),
    items: (order.items || []).map((item: any) => ({
      id: item.id,
      productName: item.productName,
      sku: item.sku,
      hsnCode: item.hsnCode,
      taxRatePercent: item.taxRatePercent,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      subtotalPaise: Number(item.subtotalPaise),
      isCustomized: item.isCustomized,
      customizationNote: item.customizationNote,
      customizationFeePaise: item.customizationFeePaise,
      proofImageUrl: item.proofImageUrl || item.personalization?.proofImageUrl || null,
      customizationMeta: item.customizationMeta || (item.personalization ? {
        personalizationType: item.personalization.personalizationType,
        engravedText: item.personalization.engravedText,
        fontFamily: item.personalization.fontFamily,
        giftNote: item.personalization.giftNote,
        ribbonColor: item.personalization.ribbonColor,
        boxWrapStyle: item.personalization.boxWrapStyle,
        waxSealColor: item.personalization.waxSealColor,
        artworkUploadId: item.personalization.artworkUploadId,
        cropSettings: item.personalization.cropSettings,
        placementSettings: item.personalization.placementSettings,
        proofVersion: item.personalization.proofVersion,
        approvalStatus: item.personalization.approvalStatus,
        approvedAt: item.personalization.approvedAt,
        approvedBy: item.personalization.approvedBy,
        staffNotes: item.personalization.staffNotes,
      } : null),
      personalization: item.personalization || (DEV_PERSONALIZATION_STORE.get(item.id) ?? null),
    })),
    payments: (order.payments || []).map((p: any) => ({
      id: p.id,
      gateway: p.gateway,
      gatewayOrderId: p.gatewayOrderId,
      gatewayPaymentId: p.gatewayPaymentId,
      amountPaise: Number(p.amountPaise),
      currency: p.currency,
      status: p.status,
      capturedAt: p.capturedAt ? new Date(p.capturedAt).toISOString() : null,
      errorMessage: p.errorMessage,
    })),
    shipments: (order.shipments || []).map((s: any) => ({
      id: s.id,
      carrierPartner: s.carrierPartner,
      awbNumber: s.awbNumber,
      trackingUrl: s.trackingUrl,
      dispatchStatus: s.dispatchStatus,
      dispatchedAt: s.dispatchedAt ? new Date(s.dispatchedAt).toISOString() : null,
      deliveredAt: s.deliveredAt ? new Date(s.deliveredAt).toISOString() : null,
      invoicePhysicallySignedBy: s.invoicePhysicallySignedBy || null,
      invoicePhysicallySignedAt: s.invoicePhysicallySignedAt ? new Date(s.invoicePhysicallySignedAt).toISOString() : null,
    })),
    statusHistory: (order.statusHistory || []).map((h: any) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedBy: h.changedBy,
      notes: h.notes,
      createdAt: new Date(h.createdAt).toISOString(),
    })),
    user: order.user || null,
    organization: order.organization || null,
  };
}

function formatCustomerOrderListItem(order: any) {
  const shipment = order.shipments && order.shipments.length > 0 ? order.shipments[0] : null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: (order.items || []).map((item: any) => ({
      id: item.id,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      subtotalPaise: Number(item.subtotalPaise),
      customizationNote: item.customizationNote,
    })),
    itemsSubtotalPaise: Number(order.itemsSubtotalPaise),
    taxTotalPaise: Number(order.taxTotalPaise),
    shippingTotalPaise: Number(order.shippingTotalPaise || 0),
    grandTotalPaise: Number(order.grandTotalPaise),
    createdAt: new Date(order.createdAt).toISOString(),
    shipment: shipment
      ? {
        carrierPartner: shipment.carrierPartner,
        awbNumber: shipment.awbNumber,
        trackingUrl: shipment.trackingUrl,
        dispatchStatus: shipment.dispatchStatus,
        dispatchedAt: shipment.dispatchedAt ? new Date(shipment.dispatchedAt).toISOString() : null,
        deliveredAt: shipment.deliveredAt ? new Date(shipment.deliveredAt).toISOString() : null,
      }
      : null,
  };
}

function formatDevOrderDetails(devOrder: any) {
  const history = DEV_STATUS_HISTORY_STORE.get(devOrder.orderNumber) || [];
  return {
    id: devOrder.id,
    orderNumber: devOrder.orderNumber,
    type: 'B2C',
    customerName: devOrder.customerName,
    customerEmail: devOrder.customerEmail,
    customerPhone: devOrder.customerPhone,
    gstin: null,
    shippingAddress: {
      name: devOrder.customerName,
      phone: devOrder.customerPhone,
      street: 'Sample Street',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
    },
    destinationStateCode: devOrder.destinationStateCode,
    orderStatus: devOrder.orderStatus,
    paymentStatus: devOrder.paymentStatus,
    paymentMethod: devOrder.paymentMethod,
    itemsSubtotalPaise: devOrder.itemsSubtotalPaise,
    customizationTotalPaise: 0,
    discountTotalPaise: 0,
    taxableAmountPaise: devOrder.itemsSubtotalPaise,
    taxTotalPaise: devOrder.taxTotalPaise,
    cgstPaise: devOrder.cgstPaise || 0,
    sgstPaise: devOrder.sgstPaise || 0,
    igstPaise: devOrder.igstPaise || 0,
    shippingTotalPaise: devOrder.shippingTotalPaise || 0,
    grandTotalPaise: devOrder.grandTotalPaise,
    reservationExpiresAt: devOrder.reservationExpiresAt || null,
    createdAt: devOrder.createdAt,
    updatedAt: devOrder.createdAt,
    items: (devOrder.items || []).map((item: any) => ({
      ...item,
      personalization: item.personalization || DEV_PERSONALIZATION_STORE.get(item.id) || null,
    })),
    payments: [],
    shipments: devOrder.shipment ? [devOrder.shipment] : [],
    statusHistory: history,
    user: null,
    organization: null,
  };
}
