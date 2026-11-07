import { prisma } from '@/lib/prisma';
import { getSellerConfig } from '@/lib/invoices/seller-config.service';
import { enqueueTransactionalEmail } from '@/lib/email/email-outbox.service';
import { renderOwnerNewOrderTemplate, renderOrderConfirmationTemplate } from '@/lib/email/email-templates';
import { getAdminNotificationEmails } from '@/config/business';
import { notifyNewOrderWhatsApp } from '@/lib/notifications/whatsapp-notify.service';
import type { SanitizedOrderResult } from './order.service';

type ShippingAddressInput = {
  name: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
};

function formatOrderDate(d: Date | string = new Date()): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function mapLineItems(order: SanitizedOrderResult | any) {
  return (order.items || []).map((i: any) => ({
    productName: i.productName,
    quantity: i.quantity,
    unitPriceInr: `₹${(Number(i.unitPricePaise) / 100).toFixed(2)}`,
    totalInr: `₹${(Number(i.subtotalPaise ?? i.unitPricePaise * i.quantity) / 100).toFixed(2)}`,
    isCustomized: Boolean(i.customizationNote || i.customizationMeta || i.proofImageUrl),
    customizationNote: i.customizationNote || undefined,
    customizationPhotosCount: i.customizationMeta?.artworkUploadId ? 1 : 0,
  }));
}

/** Owner / ops inboxes — new order or payment confirmed. */
export async function enqueueOwnerOrderAlertEmails(
  order: SanitizedOrderResult | any,
  options?: { shippingAddress?: ShippingAddressInput; eventSuffix?: string }
): Promise<void> {
  const seller = await getSellerConfig();
  const formattedDate = formatOrderDate(order.createdAt);
  const isCod = String(order.paymentMethod || '').toUpperCase() === 'COD';
  const paid =
    ['CAPTURED', 'PAID'].includes(String(order.paymentStatus || '').toUpperCase()) ||
    String(order.orderStatus || '').toUpperCase() === 'CONFIRMED';

  const emailData = renderOwnerNewOrderTemplate(seller, {
    orderNumber: order.orderNumber,
    orderDate: formattedDate,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    paymentMethod: isCod ? 'COD' : 'ONLINE',
    totalInr: `₹${(Number(order.grandTotalPaise) / 100).toFixed(2)}`,
    codAmountDueInr: isCod ? `₹${(Number(order.grandTotalPaise) / 100).toFixed(2)}` : undefined,
    shippingAddress: options?.shippingAddress
      ? {
          fullName: options.shippingAddress.name,
          addressLine1: options.shippingAddress.street,
          city: options.shippingAddress.city,
          state: options.shippingAddress.state,
          postalCode: options.shippingAddress.pincode,
          phone: options.shippingAddress.phone,
        }
      : {
          fullName: order.customerName,
          addressLine1: '',
          city: '',
          state: '',
          postalCode: order.shippingPincode || '',
          phone: order.customerPhone,
        },
    items: mapLineItems(order),
  });

  const suffix = options?.eventSuffix || 'placed';
  const eventType = paid ? 'OWNER_ORDER_PAID' : 'OWNER_NEW_ORDER';

  for (const adminEmail of getAdminNotificationEmails()) {
    await enqueueTransactionalEmail({
      idempotencyKey: `email:owner_order:${suffix}:${order.orderNumber}:${adminEmail}`,
      eventType,
      orderId: order.id,
      orderNumber: order.orderNumber,
      recipientEmail: adminEmail,
      recipientName: 'SNAPPY GIFTZ Admin Desk',
      subject: emailData.subject,
      htmlBody: emailData.html,
      textBody: emailData.text,
    });
  }
}

/** Prefer linked account email over stale checkout/demo customerEmail. */
export function resolveOrderNotificationEmail(order: {
  customerEmail?: string | null;
  user?: { email?: string | null } | null;
}): string | null {
  const account = order.user?.email?.trim().toLowerCase();
  const checkout = order.customerEmail?.trim().toLowerCase();
  return account || checkout || null;
}

/** Customer order receipt — send once payment is confirmed (or immediately for COD). */
export async function enqueueCustomerOrderConfirmationEmail(
  order: SanitizedOrderResult | any,
  shippingAddress?: ShippingAddressInput,
  options?: { recipientEmail?: string; idempotencySuffix?: string }
): Promise<void> {
  const recipientEmail = (options?.recipientEmail || resolveOrderNotificationEmail(order) || '').trim();
  if (!recipientEmail) return;

  const seller = await getSellerConfig();
  const formattedDate = formatOrderDate(order.createdAt);
  const addr = shippingAddress || {
    name: order.customerName,
    street: '',
    city: '',
    state: '',
    pincode: order.shippingPincode || '',
    phone: order.customerPhone,
  };

  const custEmailData = renderOrderConfirmationTemplate(
    {
      orderNumber: order.orderNumber,
      orderDate: formattedDate,
      customerName: order.customerName,
      items: (order.items || []).map((i: any) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceInr: (Number(i.unitPricePaise) / 100).toFixed(2),
        totalInr: (Number(i.subtotalPaise ?? i.unitPricePaise * i.quantity) / 100).toFixed(2),
      })),
      taxableSubtotalInr: (Number(order.itemsSubtotalPaise) / 100).toFixed(2),
      taxTotalInr: (Number(order.taxTotalPaise) / 100).toFixed(2),
      shippingTotalInr: (Number(order.shippingTotalPaise) / 100).toFixed(2),
      grandTotalInr: (Number(order.grandTotalPaise) / 100).toFixed(2),
      shippingAddress: {
        fullName: addr.name,
        addressLine1: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.pincode,
      },
    },
    seller
  );

  const suffix = options?.idempotencySuffix ? `:${options.idempotencySuffix}` : '';
  await enqueueTransactionalEmail({
    idempotencyKey: `email:customer_receipt:${order.orderNumber}${suffix}`,
    eventType: 'ORDER_CONFIRMED',
    orderId: order.id,
    orderNumber: order.orderNumber,
    recipientEmail,
    recipientName: order.customerName,
    subject: custEmailData.subject,
    htmlBody: custEmailData.html,
    textBody: custEmailData.text,
  });
}

export async function notifyOrderPlacedEmails(
  order: SanitizedOrderResult,
  rawInput: { paymentMethod: string; shippingAddress: ShippingAddressInput }
): Promise<void> {
  try {
    await enqueueOwnerOrderAlertEmails(order, {
      shippingAddress: rawInput.shippingAddress,
      eventSuffix: 'placed',
    });

    void notifyNewOrderWhatsApp({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      totalInr: `₹${(order.grandTotalPaise / 100).toFixed(2)}`,
      paymentMethod: order.paymentMethod || 'ONLINE',
    });

    const method = rawInput.paymentMethod.toUpperCase();
    const deferUntilPaid = method === 'RAZORPAY' || method === 'ONLINE';
    if (!deferUntilPaid) {
      await enqueueCustomerOrderConfirmationEmail(order, rawInput.shippingAddress);
    }
  } catch (err) {
    console.error(`[ORDER_NOTIFICATION] Failed for #${order.orderNumber}:`, err);
  }
}

/** Load full order and send post-payment customer + admin emails (idempotent outbox keys). */
export async function notifyOrderPaidByOrderNumber(orderNumber: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderNumber.trim() },
      include: { items: true, user: { select: { email: true } } },
    });
    if (order) {
      await notifyOrderPaidEmails(order);
    }
  } catch (err) {
    console.warn('[ORDER_PAID_NOTIFICATION] load failed', err);
  }
}

/** After Razorpay capture — customer receipt + paid alert to ops. */
export async function notifyOrderPaidEmails(order: SanitizedOrderResult | any): Promise<void> {
  try {
    let shipping: ShippingAddressInput | undefined;
    if (order.shippingAddress) {
      const parsed =
        typeof order.shippingAddress === 'string'
          ? JSON.parse(order.shippingAddress)
          : order.shippingAddress;
      shipping = {
        name: parsed.name || parsed.fullName || order.customerName,
        street: parsed.street || parsed.addressLine1 || '',
        city: parsed.city || '',
        state: parsed.state || '',
        pincode: parsed.pincode || parsed.postalCode || '',
        phone: parsed.phone || order.customerPhone,
      };
    }
    await enqueueCustomerOrderConfirmationEmail(order, shipping);
    await enqueueOwnerOrderAlertEmails(order, { shippingAddress: shipping, eventSuffix: 'paid' });
  } catch (err) {
    console.warn('[ORDER_PAID_NOTIFICATION]', err);
  }
}

/** Admin: re-queue paid notifications to the correct account email. */
export async function adminResendOrderEmails(orderId: string): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  orderNumber?: string;
  recipientEmail?: string;
}> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId.trim() },
      include: { items: true, user: { select: { email: true, name: true } } },
    });
    if (!order) {
      return { ok: false, status: 404, error: 'Order not found.' };
    }
    const recipientEmail = resolveOrderNotificationEmail(order);
    if (!recipientEmail) {
      return { ok: false, status: 400, error: 'No recipient email on file for this order.' };
    }

    const resendTag = `admin-${Date.now()}`;
    let shipping: ShippingAddressInput | undefined;
    if (order.shippingAddress) {
      const parsed =
        typeof order.shippingAddress === 'string'
          ? JSON.parse(order.shippingAddress)
          : order.shippingAddress;
      shipping = {
        name: parsed.name || parsed.fullName || order.customerName,
        street: parsed.street || parsed.addressLine1 || '',
        city: parsed.city || '',
        state: parsed.state || '',
        pincode: parsed.pincode || parsed.postalCode || '',
        phone: parsed.phone || order.customerPhone,
      };
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        customerEmail: recipientEmail,
        customerName: order.user?.name?.trim() || order.customerName,
      },
    });

    const orderForEmail = { ...order, customerEmail: recipientEmail, customerName: order.user?.name || order.customerName };
    await enqueueCustomerOrderConfirmationEmail(orderForEmail, shipping, {
      recipientEmail,
      idempotencySuffix: resendTag,
    });
    await enqueueOwnerOrderAlertEmails(orderForEmail, {
      shippingAddress: shipping,
      eventSuffix: `paid-resend-${resendTag}`,
    });

    return { ok: true, orderNumber: order.orderNumber, recipientEmail };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message || 'Resend failed.' };
  }
}
