/**
 * SNAPPY GIFTZ — Order Delivery Charge & Final Amount Approval Service
 *
 * Implements the required 6-stage lifecycle:
 * 1. DRAFT_CART
 * 2. ORDER_AWAITING_OWNER_REVIEW
 * 3. DELIVERY_CHARGE_ASSIGNED / AWAITING_CUSTOMER_APPROVAL
 * 4. CUSTOMER_APPROVED
 * 5. PAYMENT_PENDING
 * 6. CONFIRMED
 */

import { prisma } from '@/lib/prisma';
import { DEV_ORDERS_STORE } from './order.service';
import { DEV_STATUS_HISTORY_STORE } from './order-lifecycle.service';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { enqueueTransactionalEmail } from '@/lib/email/email-outbox.service';
import { getAdminNotificationEmails } from '@/config/business';

export class OrderApprovalError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'OrderApprovalError';
    this.statusCode = statusCode;
  }
}

export type OrderApprovalStage =
  | 'DRAFT_CART'
  | 'ORDER_AWAITING_OWNER_REVIEW'
  | 'AWAITING_CUSTOMER_APPROVAL'
  | 'CUSTOMER_APPROVED'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'CANCELLED';

export interface OrderApprovalStatusDetails {
  orderNumber: string;
  stage: OrderApprovalStage;
  itemsSubtotalPaise: number;
  customizationTotalPaise: number;
  taxTotalPaise: number;
  shippingTotalPaise: number;
  grandTotalPaise: number;
  isDeliveryChargeAssigned: boolean;
  isCustomerApproved: boolean;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  actionsAllowed: {
    canCustomerApprove: boolean;
    canCustomerReject: boolean;
    canInitiatePayment: boolean;
    canOwnerSetDeliveryCharge: boolean;
  };
}

/**
 * Synchronous resolver to evaluate stage directly from an order object
 */
export function resolveOrderApprovalStage(order: any): OrderApprovalStage {
  if (!order) return 'DRAFT_CART';
  const orderStatus = String(order.orderStatus || order.status || '').toUpperCase();
  const paymentStatus = String(order.paymentStatus || '').toUpperCase();

  if (orderStatus === 'CANCELLED' || orderStatus === 'REJECTED') {
    return 'CANCELLED';
  }
  if (
    paymentStatus === 'CAPTURED' ||
    paymentStatus === 'PAID' ||
    ['CONFIRMED', 'IN_CUSTOMIZATION', 'QUALITY_CHECK', 'DISPATCHED', 'DELIVERED'].includes(orderStatus)
  ) {
    return 'CONFIRMED';
  }

  const isCustomerApproved = Boolean(
    order.deliveryChargeCustomerApproved ||
    order.deliveryChargeApproved ||
    order.customerApprovedAt ||
    (order.metadata && (order.metadata as any).customerApprovedFinalAmount)
  );

  const isDeliveryChargeAssigned = Boolean(
    order.deliveryChargeAssigned ||
    order.deliveryChargeAssignedAt ||
    (order.deliveryChargePending === false && (order.shippingFeePaise != null || order.shippingTotalPaise != null)) ||
    (order.shippingFeePaise && order.shippingFeePaise > 0) ||
    (order.shippingTotalPaise && order.shippingTotalPaise > 0) ||
    (order.metadata && (order.metadata as any).deliveryChargeAssigned)
  );

  if (isCustomerApproved) {
    return 'CUSTOMER_APPROVED';
  }
  if (isDeliveryChargeAssigned) {
    return 'AWAITING_CUSTOMER_APPROVAL';
  }
  return 'ORDER_AWAITING_OWNER_REVIEW';
}

/**
 * Evaluates the current approval stage of an order
 */
export async function getOrderApprovalStage(
  orderIdOrNumber: string
): Promise<OrderApprovalStatusDetails> {
  const cleanKey = (orderIdOrNumber || '').trim();
  if (!cleanKey) {
    throw new OrderApprovalError('Order identifier is required.', 400);
  }

  let order: any = null;
  try {
    order = await prisma.order.findFirst({
      where: { OR: [{ id: cleanKey }, { orderNumber: cleanKey }] },
      include: {
        payments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
  } catch {
    if (!isStorefrontFallbackAllowed() || process.env.NODE_ENV === 'production') {
      throw new CatalogDatabaseError('Database unreachable during order stage lookup.');
    }
    order = DEV_ORDERS_STORE.get(cleanKey) || null;
  }

  if (!order) {
    if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanKey)) {
      order = DEV_ORDERS_STORE.get(cleanKey)!;
    } else {
      throw new OrderApprovalError(`Order "${cleanKey}" not found.`, 404);
    }
  }

  const shippingTotalPaise = Number(order.shippingTotalPaise || 0);
  const itemsSubtotalPaise = Number(order.itemsSubtotalPaise || 0);
  const customizationTotalPaise = Number(order.customizationTotalPaise || 0);
  const taxTotalPaise = Number(order.taxTotalPaise || 0);
  const grandTotalPaise = Number(order.grandTotalPaise || 0);

  // Check if owner has assigned delivery charge:
  // In the DB, an order status history note contains "Owner manually set delivery charge"
  // or deliveryFeeRuleId is set, or notes or in-memory flag.
  const history = order.statusHistory || (isStorefrontFallbackAllowed() ? DEV_STATUS_HISTORY_STORE.get(order.orderNumber) || [] : []);
  const ownerAssignedInHistory = history.some(
    (h: any) => h.notes && h.notes.toLowerCase().includes('delivery charge')
  );
  const isDeliveryChargeAssigned = Boolean(
    order.deliveryChargeAssigned ||
    order.deliveryFeeRuleId === 'OWNER_SET' ||
    ownerAssignedInHistory ||
    (order.metadata && (order.metadata as any).deliveryChargeAssigned)
  );

  const isCustomerApproved = Boolean(
    order.deliveryChargeCustomerApproved ||
    (order.metadata && (order.metadata as any).customerApprovedFinalAmount) ||
    history.some((h: any) => h.notes && h.notes.toLowerCase().includes('customer approved final amount'))
  );

  let stage: OrderApprovalStage = 'ORDER_AWAITING_OWNER_REVIEW';

  if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'REJECTED') {
    stage = 'CANCELLED';
  } else if (order.paymentStatus === 'CAPTURED' || order.paymentStatus === 'PAID' || order.orderStatus === 'CONFIRMED') {
    stage = 'CONFIRMED';
  } else if (isCustomerApproved) {
    stage = 'CUSTOMER_APPROVED';
  } else if (isDeliveryChargeAssigned) {
    stage = 'AWAITING_CUSTOMER_APPROVAL';
  } else {
    stage = 'ORDER_AWAITING_OWNER_REVIEW';
  }

  const canCustomerApprove = stage === 'AWAITING_CUSTOMER_APPROVAL';
  const canCustomerReject = stage === 'ORDER_AWAITING_OWNER_REVIEW' || stage === 'AWAITING_CUSTOMER_APPROVAL';
  const canInitiatePayment = stage === 'CUSTOMER_APPROVED' && order.paymentStatus !== 'CAPTURED';
  const canOwnerSetDeliveryCharge = stage === 'ORDER_AWAITING_OWNER_REVIEW' || stage === 'AWAITING_CUSTOMER_APPROVAL';

  return {
    orderNumber: order.orderNumber,
    stage,
    itemsSubtotalPaise,
    customizationTotalPaise,
    taxTotalPaise,
    shippingTotalPaise,
    grandTotalPaise,
    isDeliveryChargeAssigned,
    isCustomerApproved,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    actionsAllowed: {
      canCustomerApprove,
      canCustomerReject,
      canInitiatePayment,
      canOwnerSetDeliveryCharge,
    },
  };
}

/**
 * Customer Action: Explicitly approve or reject the final payable amount
 */
export async function customerProcessFinalAmount(
  orderNumber: string,
  action: 'APPROVE' | 'REJECT',
  actorUserId?: string | null,
  rejectionReason?: string
): Promise<{ success: boolean; stage: OrderApprovalStage; message: string }> {
  const cleanNumber = (orderNumber || '').trim();
  if (!cleanNumber) {
    throw new OrderApprovalError('Order number is required.', 400);
  }

  let order: any = null;
  try {
    order = await prisma.order.findUnique({
      where: { orderNumber: cleanNumber },
      include: { items: true },
    });
  } catch {
    if (!isStorefrontFallbackAllowed() || process.env.NODE_ENV === 'production') {
      throw new CatalogDatabaseError('Database unreachable during customer approval.');
    }
    order = DEV_ORDERS_STORE.get(cleanNumber) || null;
  }

  if (!order) {
    if (isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanNumber)) {
      order = DEV_ORDERS_STORE.get(cleanNumber)!;
    } else {
      throw new OrderApprovalError(`Order "${cleanNumber}" not found.`, 404);
    }
  }

  // Authorization ownership check: If order has userId, caller must match
  if (order.userId && actorUserId && order.userId !== actorUserId) {
    throw new OrderApprovalError('Unauthorized: You do not own this order.', 403);
  }

  if (action === 'REJECT') {
    const reason = rejectionReason?.trim() || 'Customer rejected the delivery charge and final amount.';
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          orderStatus: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledBy: 'CUSTOMER',
        },
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.orderStatus,
          toStatus: 'CANCELLED',
          changedBy: order.customerEmail || 'Customer',
          notes: `Customer rejected final amount. Reason: ${reason}`,
        },
      });
    } catch {
      order.orderStatus = 'CANCELLED';
      order.cancellationReason = reason;
      DEV_ORDERS_STORE.set(cleanNumber, order);
    }

    return {
      success: true,
      stage: 'CANCELLED',
      message: 'Order has been cancelled per your request.',
    };
  }

  // Action is APPROVE
  const grandTotalPaise = Number(order.grandTotalPaise);
  const shippingPaise = Number(order.shippingTotalPaise);

  try {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        deliveryFeeRuleId: 'OWNER_SET', // flag indicating delivery fee was formally approved
      },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.orderStatus,
        toStatus: order.paymentMethod?.toUpperCase() === 'COD' ? 'CONFIRMED' : order.orderStatus,
        changedBy: order.customerEmail || 'Customer',
        notes: `Customer approved final amount of ₹${(grandTotalPaise / 100).toFixed(2)} (including ₹${(shippingPaise / 100).toFixed(2)} delivery charge).`,
      },
    });

    // If COD, order can immediately be marked confirmed
    if (order.paymentMethod?.toUpperCase() === 'COD') {
      await prisma.order.update({
        where: { id: order.id },
        data: { orderStatus: 'CONFIRMED' },
      });
    }
  } catch {
    order.deliveryChargeCustomerApproved = true;
    if (order.paymentMethod?.toUpperCase() === 'COD') {
      order.orderStatus = 'CONFIRMED';
    }
    DEV_ORDERS_STORE.set(cleanNumber, order);

    const history = DEV_STATUS_HISTORY_STORE.get(cleanNumber) || [];
    history.push({
      id: `hist-${Date.now()}`,
      orderId: order.id,
      fromStatus: order.orderStatus,
      toStatus: order.paymentMethod?.toUpperCase() === 'COD' ? 'CONFIRMED' : order.orderStatus,
      changedBy: order.customerEmail || 'Customer',
      notes: `Customer approved final amount of ₹${(grandTotalPaise / 100).toFixed(2)} (including ₹${(shippingPaise / 100).toFixed(2)} delivery charge).`,
      createdAt: new Date(),
    });
    DEV_STATUS_HISTORY_STORE.set(cleanNumber, history);
  }

  // Enqueue notification for store owner
  try {
    for (const adminEmail of getAdminNotificationEmails()) {
      await enqueueTransactionalEmail({
        idempotencyKey: `email:approval:${order.id}:${Date.now()}`,
        eventType: 'CUSTOMER_APPROVAL_RECEIVED',
        recipientEmail: adminEmail,
        recipientName: 'SNAPPY GIFTZ Admin',
        subject: `[SNAPPY GIFTZ] Customer Approved Final Amount for Order #${cleanNumber}`,
        textBody: `Customer ${order.customerName} has approved the final grand total of ₹${(grandTotalPaise / 100).toFixed(2)} for Order #${cleanNumber}. Payment Method: ${order.paymentMethod}.`,
        htmlBody: `<p>Customer <strong>${order.customerName}</strong> has approved the final grand total of <strong>₹${(grandTotalPaise / 100).toFixed(2)}</strong> for Order #${cleanNumber}.</p><p>Payment Method: ${order.paymentMethod}</p>`,
      });
    }
  } catch {
    // Non-fatal notification failure
  }

  return {
    success: true,
    stage: order.paymentMethod?.toUpperCase() === 'COD' ? 'CONFIRMED' : 'CUSTOMER_APPROVED',
    message: order.paymentMethod?.toUpperCase() === 'COD'
      ? 'Final amount approved. Your Cash on Delivery order is now confirmed for artisan preparation!'
      : 'Final amount approved. You can now proceed to secure online payment.',
  };
}
