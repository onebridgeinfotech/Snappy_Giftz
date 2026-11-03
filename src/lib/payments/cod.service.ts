import { prisma } from '@/lib/prisma';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { enqueueTransactionalEmail } from '@/lib/email/email-outbox.service';
import { issueTaxInvoice } from '@/lib/invoices/invoice.service';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { DEV_ORDERS_STORE } from '@/lib/orders/order.service';

export class CodError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'CodError';
    this.statusCode = statusCode;
  }
}

// In-Memory Dev Store for COD Collections when DB is offline
const DEV_COD_COLLECTIONS: Map<string, any> = new Map();

/**
 * Admin action: Approves a pending COD order.
 * Moves order from PENDING_COD_CONFIRMATION to CONFIRMED.
 * Queues customer COD_APPROVED email notification.
 */
export async function approveCodOrder(orderId: string, actor: string = 'admin'): Promise<any> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new CodError('Order not found.', 404);
    }

    if (order.paymentMethod.toUpperCase() !== 'COD') {
      throw new CodError('Order is not a Cash on Delivery order.', 400);
    }

    if (
      order.orderStatus !== ('PENDING_COD_CONFIRMATION' as any) &&
      order.orderStatus !== ('PENDING' as any)
    ) {
      throw new CodError(
        `Order status is "${order.orderStatus}". Only PENDING_COD_CONFIRMATION orders can be approved.`,
        400
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: OrderStatus.CONFIRMED,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.orderStatus,
          toStatus: OrderStatus.CONFIRMED,
          changedBy: actor,
          notes: `COD order approved by ${actor}. Moved to CONFIRMED.`,
        },
      });

      return ord;
    });

    // Enqueue Customer COD Approval Email
    await enqueueTransactionalEmail({
      idempotencyKey: `email:cod-approved:${order.orderNumber}`,
      eventType: 'COD_APPROVED' as any,
      orderId: order.id,
      orderNumber: order.orderNumber,
      recipientEmail: order.customerEmail,
      recipientName: order.customerName,
      subject: `Your SNAPPY GIFTZ COD Order ${order.orderNumber} is Confirmed!`,
      htmlBody: `<p>Dear ${order.customerName},</p><p>Your Cash on Delivery order <strong>${order.orderNumber}</strong> has been approved and is now being handcrafted in our atelier. Please keep ₹${(Number(order.grandTotalPaise) / 100).toFixed(2)} ready upon delivery.</p>`,
    }).catch(() => {});

    return updated;
  } catch (err: any) {
    if (err instanceof CodError) throw err;
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during COD approval.');
    }

    // Dev Fallback
    for (const [key, devOrd] of DEV_ORDERS_STORE.entries()) {
      if (devOrd.id === orderId || devOrd.orderNumber === orderId) {
        devOrd.orderStatus = 'CONFIRMED';
        return devOrd;
      }
    }
    throw new CodError('Order not found in store.', 404);
  }
}

/**
 * Admin action: Rejects a COD order.
 * Transitions order to REJECTED.
 * Atomically releases all reserved inventory stock back to ProductVariant balances.
 * Logs InventoryAdjustment with reason MANUAL_CORRECTION / RETURN_RESTOCK.
 * Queues customer COD_REJECTED email notification.
 */
export async function rejectCodOrder(
  orderId: string,
  actor: string = 'admin',
  reason: string = 'Address verification unconfirmed'
): Promise<any> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new CodError('Order not found.', 404);
    }

    if (order.paymentMethod.toUpperCase() !== 'COD') {
      throw new CodError('Order is not a Cash on Delivery order.', 400);
    }

    if (order.orderStatus === OrderStatus.CANCELLED || order.orderStatus === OrderStatus.REJECTED) {
      throw new CodError(`Order is already ${order.orderStatus}.`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Release reserved inventory
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          });

          const currentVariant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });
          const newStock = currentVariant?.stockQuantity || 0;

          await tx.inventoryAdjustment.create({
            data: {
              variantId: item.variantId,
              sku: item.sku,
              productName: item.productName,
              previousStock: newStock - item.quantity,
              adjustedQty: item.quantity,
              newStock,
              reason: 'MANUAL_CORRECTION',
              referenceId: order.orderNumber,
              userId: null,
              notes: `Stock reservation released upon COD rejection: ${order.orderNumber}. Reason: ${reason}`,
            },
          });
        }
      }

      // 2. Update order status to REJECTED
      const ord = await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: OrderStatus.REJECTED,
          reservationExpiresAt: null,
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledBy: actor,
        },
      });

      // 3. Status History
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.orderStatus,
          toStatus: OrderStatus.REJECTED,
          changedBy: actor,
          notes: `COD order rejected by ${actor}. Reason: ${reason}. Inventory reservations released.`,
        },
      });

      return ord;
    });

    // Enqueue Customer COD Rejection Email
    await enqueueTransactionalEmail({
      idempotencyKey: `email:cod-rejected:${order.orderNumber}`,
      eventType: 'COD_REJECTED' as any,
      orderId: order.id,
      orderNumber: order.orderNumber,
      recipientEmail: order.customerEmail,
      recipientName: order.customerName,
      subject: `Update on your SNAPPY GIFTZ Order ${order.orderNumber}`,
      htmlBody: `<p>Dear ${order.customerName},</p><p>We were unable to verify your Cash on Delivery order <strong>${order.orderNumber}</strong> (${reason}). Any reserved items have been restored. You may place a new order using Razorpay online payment.</p>`,
    }).catch(() => {});

    return updated;
  } catch (err: any) {
    if (err instanceof CodError) throw err;
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during COD rejection.');
    }

    // Dev Fallback
    for (const [key, devOrd] of DEV_ORDERS_STORE.entries()) {
      if (devOrd.id === orderId || devOrd.orderNumber === orderId) {
        devOrd.orderStatus = 'REJECTED';
        devOrd.cancellationReason = reason;
        return devOrd;
      }
    }
    throw new CodError('Order not found in store.', 404);
  }
}

/**
 * Records physical cash/UPI collection for a delivered COD order.
 * Creates CodCollectionRecord, updates Payment status to CAPTURED,
 * updates Order paymentStatus to CAPTURED, and issues final GST tax invoice.
 */
export async function recordCodCollection(input: {
  orderId: string;
  amountCollectedPaise: number;
  collector: string;
  collectionMethod?: 'CASH' | 'UPI_ON_DELIVERY';
  receiptNumber?: string;
  notes?: string;
}): Promise<any> {
  const method = input.collectionMethod || 'CASH';

  try {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { payments: true, items: true },
    });

    if (!order) {
      throw new CodError('Order not found.', 404);
    }

    if (order.paymentMethod.toUpperCase() !== 'COD') {
      throw new CodError('Order is not a Cash on Delivery order.', 400);
    }

    const expectedAmountPaise = Number(order.grandTotalPaise);
    if (input.amountCollectedPaise < expectedAmountPaise) {
      throw new CodError(
        `Collected amount (₹${(input.amountCollectedPaise / 100).toFixed(2)}) is less than total amount due (₹${(expectedAmountPaise / 100).toFixed(2)}).`,
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create or update COD collection record
      const collectionRecord = await tx.codCollectionRecord.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          amountCollectedPaise: BigInt(input.amountCollectedPaise),
          collectedAt: new Date(),
          collectedBy: input.collector,
          collectionMethod: method,
          receiptNumber: input.receiptNumber || `COD-RCP-${Date.now()}`,
          notes: input.notes || null,
        },
        update: {
          amountCollectedPaise: BigInt(input.amountCollectedPaise),
          collectedAt: new Date(),
          collectedBy: input.collector,
          collectionMethod: method,
          receiptNumber: input.receiptNumber,
          notes: input.notes,
        },
      });

      // 2. Create or update Payment record
      const existingPayment = order.payments.find((p) => p.gateway === 'COD');
      if (existingPayment) {
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: PaymentStatus.CAPTURED,
            capturedAt: new Date(),
            amountPaise: BigInt(input.amountCollectedPaise),
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: order.id,
            gateway: 'COD',
            gatewayOrderId: `COD_ORD_${order.orderNumber}`,
            gatewayPaymentId: input.receiptNumber || `COD_PAY_${Date.now()}`,
            amountPaise: BigInt(input.amountCollectedPaise),
            currency: 'INR',
            status: PaymentStatus.CAPTURED,
            capturedAt: new Date(),
          },
        });
      }

      // 3. Update Order status to DELIVERED and payment status to CAPTURED
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          orderStatus: OrderStatus.DELIVERED,
          paymentStatus: PaymentStatus.CAPTURED,
        },
      });

      // 4. Deduct actual delivered quantity exactly once upon DELIVERED
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

      // 4. Update status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.orderStatus,
          toStatus: order.orderStatus,
          changedBy: input.collector,
          notes: `Recorded COD collection of ₹${(input.amountCollectedPaise / 100).toFixed(2)} via ${method}. Receipt: ${collectionRecord.receiptNumber}`,
        },
      });

      return {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        orderStatus: updatedOrder.orderStatus,
        paymentStatus: 'PAID',
        collectionReceipt: collectionRecord,
        order: updatedOrder,
        collection: collectionRecord,
      };
    });

    // 5. Issue final paid tax invoice
    try {
      await issueTaxInvoice(order.id);
    } catch (invErr) {
      console.warn('[COD] Note: Tax invoice generation after COD collection:', invErr);
    }

    return result;
  } catch (err: any) {
    if (err instanceof CodError) throw err;
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during COD collection recording.');
    }

    // Dev Fallback
    const receipt = input.receiptNumber || `COD-RCP-${Date.now()}`;
    const collection = {
      id: `dev-cod-${input.orderId}`,
      orderId: input.orderId,
      amountCollectedPaise: input.amountCollectedPaise,
      collectedAt: new Date(),
      collectedBy: input.collector,
      collectionMethod: method,
      receiptNumber: receipt,
      notes: input.notes,
    };
    DEV_COD_COLLECTIONS.set(input.orderId, collection);

    let matchedDevOrder: any = null;
    for (const [key, devOrd] of DEV_ORDERS_STORE.entries()) {
      if (devOrd.id === input.orderId || devOrd.orderNumber === input.orderId) {
        devOrd.orderStatus = 'DELIVERED';
        devOrd.paymentStatus = 'PAID';
        (devOrd as any).collectionReceipt = collection;
        matchedDevOrder = devOrd;
        break;
      }
    }

    return {
      orderId: input.orderId,
      orderNumber: matchedDevOrder?.orderNumber || input.orderId,
      orderStatus: 'DELIVERED',
      paymentStatus: 'PAID',
      collectionReceipt: collection,
      order: matchedDevOrder,
      collection,
    };
  }
}

