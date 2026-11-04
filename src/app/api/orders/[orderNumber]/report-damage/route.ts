import { NextResponse } from 'next/server';
import { getOptionalUser } from '@/lib/auth/rbac';
import { lookupGuestOrder, getOrderForUser, OrderNotFoundError, OrderAuthorizationError } from '@/lib/orders/order-lookup.service';
import { enqueueTransactionalEmail } from '@/lib/email/email-outbox.service';
import { BUSINESS_CONFIG } from '@/config/business';
import { prisma } from '@/lib/prisma';
import { DEV_ORDERS_STORE } from '@/lib/orders/order.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const body = await req.json();
    const {
      customerContact,
      description,
      photoUrls = [],
      requestedResolution = 'REPLACEMENT',
      isChangeOfMind = false,
    } = body;

    // 1. Strict Policy Guard: No General Change of Mind Refunds
    if (isChangeOfMind) {
      return NextResponse.json(
        {
          error: 'Personalized products cannot be returned or refunded for general change of mind. Goods are produced according to individual specifications.',
          code: 'CHANGE_OF_MIND_NOT_PERMITTED',
        },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a clear description of the damage or defect (at least 10 characters).' },
        { status: 400 }
      );
    }

    // 2. Authorize & Fetch Order
    let order: any = null;
    const user = await getOptionalUser(req);

    if (user) {
      try {
        order = await getOrderForUser(orderNumber, user.id, user.role);
      } catch (authErr: any) {
        if (authErr instanceof OrderAuthorizationError) {
          return NextResponse.json({ error: authErr.message }, { status: 403 });
        }
      }
    }

    if (!order && customerContact) {
      order = await lookupGuestOrder(orderNumber, String(customerContact).trim());
    }

    if (!order) {
      // Direct lookup from DEV_ORDERS_STORE if running fallback
      const devOrder = DEV_ORDERS_STORE.get(orderNumber);
      if (devOrder) {
        order = devOrder;
      }
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found. Please provide valid matching order number and contact email or phone.' },
        { status: 404 }
      );
    }

    // 3. Status Verification: Must be DELIVERED to claim transit damage
    const normalizedStatus = String(order.orderStatus || '').toUpperCase();
    if (normalizedStatus !== 'DELIVERED') {
      return NextResponse.json(
        {
          error: `Transit damage can only be reported for delivered orders. Current order status is "${order.orderStatus}". If you need order updates, contact us on WhatsApp: ${BUSINESS_CONFIG.whatsappPhone}.`,
          code: 'ORDER_NOT_DELIVERED',
        },
        { status: 400 }
      );
    }

    // 4. 24-Hour Reporting Window Validation
    // Check delivery timestamp from status history, updatedAt or deliveredAt
    const deliveredAtTime = order.deliveredAt
      ? new Date(order.deliveredAt).getTime()
      : order.updatedAt
      ? new Date(order.updatedAt).getTime()
      : Date.now();

    const elapsedHours = (Date.now() - deliveredAtTime) / (1000 * 60 * 60);

    if (elapsedHours > 24) {
      return NextResponse.json(
        {
          error: `Damaged-product reports must be submitted within 24 hours of delivery as per store policy. Delivered ${Math.round(elapsedHours)} hours ago. For urgent assistance, please contact the owner on WhatsApp: ${BUSINESS_CONFIG.whatsappPhone}.`,
          code: 'REPORTING_WINDOW_EXPIRED',
        },
        { status: 400 }
      );
    }

    // 5. Generate Claim Tracking Record
    const claimId = `CLM-${orderNumber.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`;
    const claimData = {
      claimId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      description: description.trim(),
      photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
      requestedResolution: requestedResolution === 'REFUND' ? 'REFUND' : 'REPLACEMENT',
      submittedAt: new Date().toISOString(),
      status: 'PENDING_OWNER_REVIEW',
    };

    // Store claim in audit logs or order metadata if DB available
    try {
      await prisma.auditLog.create({
        data: {
          action: 'DAMAGED_PRODUCT_REPORTED',
          resource: `ORDER:${order.id || order.orderNumber}`,
          details: claimData,
          userId: user?.id || null,
        },
      });
    } catch {
      // In-memory / dev fallback
    }

    // 6. Alert Owner & Admin Account (phoenixnot13@gmail.com)
    await enqueueTransactionalEmail({
      idempotencyKey: `email:damage_report_admin:${claimId}`,
      eventType: 'SYSTEM_ALERT',
      orderId: order.id || order.orderNumber,
      orderNumber: order.orderNumber,
      recipientEmail: BUSINESS_CONFIG.adminEmail || 'phoenixnot13@gmail.com',
      recipientName: 'SNAPPY GIFTZ Owner Review Desk',
      subject: `[ACTION REQUIRED] Damaged Product Report #${order.orderNumber} (${claimId})`,
      htmlBody: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #991b1b; margin-top: 0;">⚠️ Damaged Product Report (Within 24 Hours)</h2>
          <p>A customer has reported transit damage for a delivered order. Please review and arrange an eligible replacement or refund.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Claim ID:</strong></td><td>${claimId}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Order Number:</strong></td><td>${order.orderNumber}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Customer:</strong></td><td>${order.customerName} (${order.customerEmail})</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Phone:</strong></td><td>${order.customerPhone}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Requested Resolution:</strong></td><td><strong>${claimData.requestedResolution}</strong></td></tr>
          </table>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #334155;"><strong>Customer Description:</strong></p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #0f172a;">${description.trim()}</p>
          </div>
          ${claimData.photoUrls.length > 0 ? `<p style="font-size: 12px; color: #64748b;">Photos Attached: ${claimData.photoUrls.length} file(s)</p>` : ''}
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Direct customer contact on WhatsApp: <a href="https://wa.me/${order.customerPhone?.replace(/\D/g, '')}">${order.customerPhone}</a></p>
        </div>
      `,
      textBody: `Damaged Product Report: Claim ${claimId} for Order ${order.orderNumber}. Customer: ${order.customerName} (${order.customerEmail}, ${order.customerPhone}). Requested Resolution: ${claimData.requestedResolution}. Description: ${description.trim()}`,
    });

    // 7. Acknowledge Customer
    if (order.customerEmail) {
      await enqueueTransactionalEmail({
        idempotencyKey: `email:damage_report_ack:${claimId}`,
        eventType: 'CUSTOMER_ALERT',
        orderId: order.id || order.orderNumber,
        orderNumber: order.orderNumber,
        recipientEmail: order.customerEmail,
        recipientName: order.customerName,
        subject: `Damage Report Received #${order.orderNumber} - SNAPPY GIFTZ`,
        htmlBody: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-top: 0;">We Have Received Your Report</h2>
            <p>Dear ${order.customerName},</p>
            <p>We are sorry to hear that your gift arrived damaged. Your claim (<strong>${claimId}</strong>) has been routed directly to the store owner for priority review.</p>
            <p>We will review your photographs and reach out within a few business hours to coordinate an immediate replacement or eligible refund.</p>
            <p>If you have additional details or want to chat with us immediately, message us directly on WhatsApp at <strong>+91 ${BUSINESS_CONFIG.whatsappPhone}</strong>.</p>
            <p style="margin-top: 24px; font-size: 12px; color: #64748b;">Warm regards,<br>The SNAPPY GIFTZ Team</p>
          </div>
        `,
        textBody: `Dear ${order.customerName}, your damage report ${claimId} for Order ${order.orderNumber} has been received and is being reviewed by the store owner. We will contact you shortly or you can reach us on WhatsApp: +91 ${BUSINESS_CONFIG.whatsappPhone}.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Damage report received within 24-hour window and submitted for owner review.',
      claim: claimData,
    });
  } catch (error: any) {
    console.error('[API_REPORT_DAMAGE_ERROR]', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the damage report. Please try again or contact WhatsApp.' },
      { status: 500 }
    );
  }
}
