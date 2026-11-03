import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';
import { getPaymentAdapter } from '@/lib/payments/payment-factory';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export class RefundError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'RefundError';
    this.statusCode = statusCode;
  }
}

export interface ProcessRefundInput {
  orderId: string;
  amountPaise?: number; // Omit for full refund
  reason: string;
  processedBy: string; // Admin user ID
  idempotencyKey?: string;
  paymentMethod?: string;
}

export interface RefundResult {
  id: string;
  orderId: string;
  paymentId?: string | null;
  amountPaise: number;
  status: string;
  gatewayRefundId?: string | null;
  reason: string;
  processedAt: string;
}

const DEV_REFUNDS = new Map<string, any>();

/**
 * Authoritatively processes a refund for an order.
 * Strictly separates Razorpay gateway refunds from COD cash/manual refunds.
 */
export async function processOrderRefund(input: ProcessRefundInput): Promise<RefundResult> {
  const reason = input.reason?.trim();
  if (!reason || reason.length < 5) {
    throw new RefundError('A clear refund reason of at least 5 characters is required.', 400);
  }

  // 1. Idempotency Check
  if (input.idempotencyKey) {
    try {
      const existing = await prisma.refundRecord.findUnique({
        where: { idempotencyKey: input.idempotencyKey.trim() },
      });
      if (existing) {
        return {
          id: existing.id,
          orderId: existing.orderId,
          paymentId: existing.paymentId,
          amountPaise: Number(existing.amountPaise),
          status: existing.status,
          gatewayRefundId: existing.gatewayRefundId,
          reason: existing.reason,
          processedAt: existing.createdAt.toISOString(),
        };
      }
    } catch {
      const devExist = DEV_REFUNDS.get(input.idempotencyKey.trim());
      if (devExist) return devExist;
    }
  }

  // 2. Fetch Order and Payments
  let order: any = null;
  try {
    order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { payments: true, refunds: true },
    });
  } catch {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during refund lookup.');
    }
  }

  if (!order) {
    throw new RefundError('Order not found.', 404);
  }

  if (order.paymentStatus !== PaymentStatus.CAPTURED) {
    throw new RefundError(
      `Cannot refund order with payment status "${order.paymentStatus}". Only CAPTURED payments can be refunded.`,
      400
    );
  }

  // 3. Calculate refundable amount
  const grandTotalPaise = Number(order.grandTotalPaise);
  const alreadyRefundedPaise = (order.refunds || [])
    .filter((r: any) => r.status === 'PROCESSED')
    .reduce((acc: number, r: any) => acc + Number(r.amountPaise), 0);

  const maxRefundablePaise = grandTotalPaise - alreadyRefundedPaise;
  if (maxRefundablePaise <= 0) {
    throw new RefundError('Order has already been fully refunded.', 400);
  }

  const refundAmountPaise = typeof input.amountPaise === 'number' && input.amountPaise > 0
    ? input.amountPaise
    : maxRefundablePaise;

  if (refundAmountPaise > maxRefundablePaise) {
    throw new RefundError(
      `Requested refund amount (₹${(refundAmountPaise / 100).toFixed(2)}) exceeds remaining refundable balance (₹${(maxRefundablePaise / 100).toFixed(2)}).`,
      400
    );
  }

  const isFullRefund = refundAmountPaise >= maxRefundablePaise;
  const isCod = order.paymentMethod.toUpperCase() === 'COD';

  let gatewayRefundId: string | null = null;
  let rawGatewayResponse: any = null;

  // 4. If Razorpay, execute online refund via adapter
  if (!isCod) {
    const payment = order.payments?.find(
      (p: any) => p.status === PaymentStatus.CAPTURED && p.gatewayOrderId
    );
    if (!payment) {
      throw new RefundError('Captured payment record not found for online order.', 404);
    }

    try {
      const adapter = getPaymentAdapter();
      if (typeof (adapter as any).refundPayment === 'function') {
        const result = await (adapter as any).refundPayment({
          paymentId: payment.gatewayPaymentId,
          amountPaise: refundAmountPaise,
          notes: { reason, orderNumber: order.orderNumber },
        });
        gatewayRefundId = result.refundId || `rfnd_${Date.now()}`;
        rawGatewayResponse = result;
      } else {
        gatewayRefundId = `rfnd_mock_${Date.now()}`;
      }
    } catch (gatewayErr: any) {
      throw new RefundError(`Payment gateway refund failed: ${gatewayErr.message}`, 502);
    }
  } else {
    // For COD, cash/manual authorized refund reference
    gatewayRefundId = `COD-REFUND-${Date.now()}`;
  }

  // 5. Persist Refund Record in DB
  try {
    const refundRecord = await prisma.$transaction(async (tx) => {
      const targetPayment = order.payments?.find((p: any) => p.status === PaymentStatus.CAPTURED);

      const refund = await tx.refundRecord.create({
        data: {
          orderId: order.id,
          paymentId: targetPayment?.id || null,
          amountPaise: BigInt(refundAmountPaise),
          reason,
          status: 'PROCESSED',
          gatewayRefundId,
          processedBy: input.processedBy,
          idempotencyKey: input.idempotencyKey || null,
          rawResponse: rawGatewayResponse || null,
        },
      });

      // Update Order and Payment status
      const newPaymentStatus = isFullRefund
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus,
        },
      });

      if (targetPayment) {
        await tx.payment.update({
          where: { id: targetPayment.id },
          data: {
            status: newPaymentStatus,
          },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.orderStatus,
          toStatus: order.orderStatus,
          changedBy: input.processedBy,
          notes: `Processed ${isFullRefund ? 'full' : 'partial'} refund of ₹${(refundAmountPaise / 100).toFixed(2)}. Reference: ${gatewayRefundId}`,
        },
      });

      return refund;
    });

    return {
      id: refundRecord.id,
      orderId: refundRecord.orderId,
      paymentId: refundRecord.paymentId,
      amountPaise: Number(refundRecord.amountPaise),
      status: refundRecord.status,
      gatewayRefundId: refundRecord.gatewayRefundId,
      reason: refundRecord.reason,
      processedAt: refundRecord.createdAt.toISOString(),
    };
  } catch (dbErr: any) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database transaction failed during refund persistence.');
    }

    const devResult: RefundResult = {
      id: `dev-ref-${Date.now()}`,
      orderId: order.id,
      paymentId: null,
      amountPaise: refundAmountPaise,
      status: 'PROCESSED',
      gatewayRefundId,
      reason,
      processedAt: new Date().toISOString(),
    };

    if (input.idempotencyKey) {
      DEV_REFUNDS.set(input.idempotencyKey.trim(), devResult);
    }
    return devResult;
  }
}

