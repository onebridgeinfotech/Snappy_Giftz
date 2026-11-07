import { SellerConfigData } from '../invoices/seller-config.service';
import {
  SNAPPY_EMAIL_BRAND,
  ctaButton,
  wrapSnappyTransactionalEmail,
  renderSnappyEmailCard,
} from './snappy-email-brand';

export interface EmailOrderDetails {
  orderNumber: string;
  orderDate: string;
  customerName: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceInr: string;
    totalInr: string;
  }>;
  taxableSubtotalInr: string;
  taxTotalInr: string;
  shippingTotalInr: string;
  grandTotalInr: string;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

export interface EmailInvoiceDetails {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  grandTotalInr: string;
  downloadUrl?: string;
}

export interface EmailShipmentDetails {
  orderNumber: string;
  carrierPartner: string;
  awbNumber: string;
  trackingUrl?: string | null;
  estimatedDeliveryDate?: string | null;
  shippingAddress: {
    fullName: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

/**
 * Escapes HTML characters to prevent template injection attacks.
 */
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function finalizeEmail(cardInnerHtml: string, preheader?: string): string {
  return wrapSnappyTransactionalEmail({ bodyHtml: cardInnerHtml, preheader });
}

function wrapTemplateCard(eyebrow: string, bodyInnerHtml: string, seller: SellerConfigData): string {
  return renderSnappyEmailCard({
    eyebrow,
    bodyHtml: bodyInnerHtml,
    footer: { legalName: seller.legalName, gstin: seller.gstin || undefined },
  });
}

function supportLineText(seller: SellerConfigData): string {
  return `Support: ${SNAPPY_EMAIL_BRAND.supportEmail} | ${SNAPPY_EMAIL_BRAND.phoneDisplay}`;
}

// -------------------------------------------------------------
// 1. Order Confirmation Template
// -------------------------------------------------------------
export function renderOrderConfirmationTemplate(
  order: EmailOrderDetails,
  seller: SellerConfigData
): { subject: string; html: string; text: string } {
  const subject = `Order Confirmed: #${order.orderNumber} - ${seller.legalName}`;

  const itemsRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">${escapeHtml(item.productName)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b; text-align: right;">Rs. ${escapeHtml(item.unitPriceInr)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b; text-align: right; font-weight: 600;">Rs. ${escapeHtml(item.totalInr)}</td>
      </tr>
    `
    )
    .join('');

  const card = wrapTemplateCard(
    'Order confirmed',
    `
        <h2 style="font-size: 20px; color: ${SNAPPY_EMAIL_BRAND.primary}; margin: 0 0 12px;">Hello ${escapeHtml(order.customerName)},</h2>
        <p style="margin: 0 0 20px;">Thank you for shopping with us. Order <strong>#${escapeHtml(order.orderNumber)}</strong> (${escapeHtml(order.orderDate)}) is confirmed and being prepared.</p>
        <div style="background:${SNAPPY_EMAIL_BRAND.accentLight};border:1px solid ${SNAPPY_EMAIL_BRAND.accent};border-radius:10px;padding:14px 16px;margin:0 0 20px;font-size:13px;">
          <strong>Deliver to:</strong> ${escapeHtml(order.shippingAddress.fullName)}, ${escapeHtml(order.shippingAddress.addressLine1)}, ${escapeHtml(order.shippingAddress.city)}, ${escapeHtml(order.shippingAddress.state)} - ${escapeHtml(order.shippingAddress.postalCode)}
        </div>
        <h3 style="font-size:14px;color:${SNAPPY_EMAIL_BRAND.primary};margin:0 0 10px;text-transform:uppercase;letter-spacing:0.06em;">Order summary</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0;">Item</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0;">Qty</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0;">Rate</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <table role="presentation" align="right" cellpadding="0" cellspacing="0" style="font-size:13px;color:#334155;line-height:1.9;">
          <tr><td style="padding-right:16px;">Taxable subtotal</td><td align="right">Rs. ${escapeHtml(order.taxableSubtotalInr)}</td></tr>
          <tr><td style="padding-right:16px;">GST</td><td align="right">Rs. ${escapeHtml(order.taxTotalInr)}</td></tr>
          <tr><td style="padding-right:16px;">Shipping</td><td align="right">Rs. ${escapeHtml(order.shippingTotalInr)}</td></tr>
          <tr><td style="padding:8px 16px 0 0;font-weight:700;font-size:15px;color:${SNAPPY_EMAIL_BRAND.primary};border-top:2px solid ${SNAPPY_EMAIL_BRAND.primary};">Grand total</td><td align="right" style="padding-top:8px;font-weight:700;font-size:15px;border-top:2px solid ${SNAPPY_EMAIL_BRAND.primary};">Rs. ${escapeHtml(order.grandTotalInr)}</td></tr>
        </table>
        <p style="clear:both;color:#64748b;font-size:12px;margin-top:28px;">Your GST invoice will be emailed when your gift ships.</p>
        ${ctaButton(`${SNAPPY_EMAIL_BRAND.siteUrl}/account/orders`, 'Track your order')}
  `,
    seller
  );

  const html = finalizeEmail(card, `Order #${order.orderNumber} confirmed`);

  const text = `
ORDER CONFIRMATION: #${order.orderNumber}
Thank you for your order, ${order.customerName}!

Order Date: ${order.orderDate}
Shipping Address: ${order.shippingAddress.fullName}, ${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}

Items:
${order.items.map((i) => `- ${i.productName} x${i.quantity}: Rs. ${i.totalInr}`).join('\n')}

Taxable Subtotal: Rs. ${order.taxableSubtotalInr}
GST Total: Rs. ${order.taxTotalInr}
Shipping: Rs. ${order.shippingTotalInr}
Grand Total: Rs. ${order.grandTotalInr}

Seller: ${seller.legalName} (GSTIN: ${seller.gstin})
${supportLineText(seller)}
  `.trim();

  return { subject, html, text };
}

// -------------------------------------------------------------
// 2. Tax Invoice Available Template
// -------------------------------------------------------------
export function renderInvoiceAvailableTemplate(
  invoice: EmailInvoiceDetails,
  seller: SellerConfigData
): { subject: string; html: string; text: string } {
  const subject = `Tax Invoice Available: ${invoice.invoiceNumber} (Order #${invoice.orderNumber}) - ${seller.legalName}`;

  const ordersUrl = `${SNAPPY_EMAIL_BRAND.siteUrl}/orders`;
  const card = wrapTemplateCard(
    'Tax invoice',
    `
        <h2 style="font-size:20px;color:${SNAPPY_EMAIL_BRAND.primary};margin:0 0 12px;">Your GST invoice is ready</h2>
        <p style="margin:0 0 20px;">Invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> for order <strong>#${escapeHtml(invoice.orderNumber)}</strong> is attached as PDF.</p>
        <table style="width:100%;font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:4px 16px;">
          <tr><td style="padding:8px 0;color:#64748b;">Invoice date</td><td style="font-weight:600;">${escapeHtml(invoice.invoiceDate)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Total</td><td style="font-weight:700;color:${SNAPPY_EMAIL_BRAND.primary};">Rs. ${escapeHtml(invoice.grandTotalInr)}</td></tr>
        </table>
        ${ctaButton(invoice.downloadUrl || ordersUrl, 'View order in your account')}
  `,
    seller
  );

  const html = finalizeEmail(card, `Tax invoice ${invoice.invoiceNumber}`);

  const text = `
TAX INVOICE ISSUED: ${invoice.invoiceNumber}
Order Reference: #${invoice.orderNumber}
Invoice Date: ${invoice.invoiceDate}
Invoice Total: Rs. ${invoice.grandTotalInr}

Your official GST Tax Invoice has been generated and is attached to this email.

Seller: ${seller.legalName} (GSTIN: ${seller.gstin})
${supportLineText(seller)}
  `.trim();

  return { subject, html, text };
}

// -------------------------------------------------------------
// 3. Shipment Dispatched Template
// -------------------------------------------------------------
export function renderShipmentDispatchedTemplate(
  shipment: EmailShipmentDetails,
  seller: SellerConfigData
): { subject: string; html: string; text: string } {
  const subject = `Your Order #${shipment.orderNumber} Has Been Dispatched! - ${seller.legalName}`;

  const trackingButton = shipment.trackingUrl
    ? ctaButton(shipment.trackingUrl, 'Track shipment online')
    : '';

  const card = wrapTemplateCard(
    'Shipped',
    `
        <h2 style="font-size:20px;color:${SNAPPY_EMAIL_BRAND.primary};margin:0 0 12px;">Your gift is on the way</h2>
        <p style="margin:0 0 20px;">Order <strong>#${escapeHtml(shipment.orderNumber)}</strong> has left our atelier and is with <strong>${escapeHtml(shipment.carrierPartner)}</strong>.</p>
        <table style="width:100%;font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr><td style="padding:10px 16px;color:#64748b;">Tracking / AWB</td><td style="padding:10px 16px;font-weight:700;font-family:monospace;">${escapeHtml(shipment.awbNumber)}</td></tr>
          <tr><td style="padding:10px 16px;color:#64748b;">Destination</td><td style="padding:10px 16px;">${escapeHtml(shipment.shippingAddress.city)}, ${escapeHtml(shipment.shippingAddress.state)}</td></tr>
          ${shipment.estimatedDeliveryDate ? `<tr><td style="padding:10px 16px;color:#64748b;">Est. delivery</td><td style="padding:10px 16px;">${escapeHtml(shipment.estimatedDeliveryDate)}</td></tr>` : ''}
        </table>
        ${trackingButton}
        <p style="color:#64748b;font-size:12px;margin-top:20px;text-align:center;">Carrier tracking may take 2–4 hours to update.</p>
  `,
    seller
  );

  const html = finalizeEmail(card, `Order #${shipment.orderNumber} dispatched`);

  const text = `
SHIPMENT DISPATCHED: Order #${shipment.orderNumber}
Carrier: ${shipment.carrierPartner}
AWB / Tracking Number: ${shipment.awbNumber}
Destination: ${shipment.shippingAddress.city}, ${shipment.shippingAddress.state} - ${shipment.shippingAddress.postalCode}
${shipment.trackingUrl ? `Tracking Link: ${shipment.trackingUrl}` : ''}

Your package is on its way!
Seller: ${seller.legalName} (GSTIN: ${seller.gstin})
${supportLineText(seller)}
  `.trim();

  return { subject, html, text };
}


export interface OwnerNewOrderDetails {
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  paymentMethod: 'ONLINE' | 'COD';
  totalInr: string;
  codAmountDueInr?: string;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    phone?: string;
  };
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceInr: string;
    totalInr: string;
    isCustomized: boolean;
    customizationNote?: string;
    customizationPhotosCount?: number;
  }>;
}

export function renderOwnerNewOrderTemplate(
  seller: SellerConfigData,
  details: OwnerNewOrderDetails
): { subject: string; html: string; text: string } {
  const subject = `[SNAPPY GIFTZ ALERT] New Order Received #${details.orderNumber} - ${details.paymentMethod === 'COD' ? 'COD (Pending)' : 'Paid Online'}`;

  const itemRowsHtml = details.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 0; font-size: 13px; color: #1e293b;">
          <strong>${escapeHtml(item.productName)}</strong>
          ${
            item.isCustomized
              ? `<br><span style="display: inline-block; font-size: 11px; background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; margin-top: 4px;">Customized (${item.customizationPhotosCount || 0} photo(s))</span>${
                  item.customizationNote ? `<br><em style="font-size: 12px; color: #64748b;">Note: ${escapeHtml(item.customizationNote)}</em>` : ''
                }`
              : ''
          }
        </td>
        <td style="padding: 10px 0; text-align: center; font-size: 13px; color: #475569;">${item.quantity}</td>
        <td style="padding: 10px 0; text-align: right; font-size: 13px; color: #475569;">${item.unitPriceInr}</td>
        <td style="padding: 10px 0; text-align: right; font-size: 13px; font-weight: 600; color: #1e293b;">${item.totalInr}</td>
      </tr>
    `
    )
    .join('');

  const card = wrapTemplateCard(
    'New order alert',
    `
        <h2 style="font-size:20px;color:${SNAPPY_EMAIL_BRAND.primary};margin:0 0 4px;">Order #${escapeHtml(details.orderNumber)}</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#64748b;">${escapeHtml(details.orderDate)}</p>
        <div style="margin:0 0 20px;padding:14px 16px;background:${details.paymentMethod === 'COD' ? '#fffbeb' : '#f0fdf4'};border-radius:10px;font-size:14px;">
          <strong>${details.paymentMethod === 'COD' ? 'Cash on Delivery — pending review' : 'Paid online (Razorpay)'}</strong>
          ${details.codAmountDueInr ? `<div style="margin-top:6px;">Collect on delivery: <strong>${details.codAmountDueInr}</strong></div>` : ''}
        </div>
        <table style="width:100%;font-size:13px;margin-bottom:16px;"><tr>
          <td style="width:50%;vertical-align:top;padding-right:10px;">
            <strong style="color:#64748b;font-size:11px;text-transform:uppercase;">Customer</strong><br/>
            ${escapeHtml(details.customerName)}<br/>${escapeHtml(details.customerEmail)}
          </td>
          <td style="width:50%;vertical-align:top;">
            <strong style="color:#64748b;font-size:11px;text-transform:uppercase;">Ship to</strong><br/>
            ${escapeHtml(details.shippingAddress.city)}, ${escapeHtml(details.shippingAddress.state)}
          </td>
        </tr></table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;"><thead><tr style="font-size:11px;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">
          <th align="left">Item</th><th>Qty</th><th align="right">Total</th></tr></thead><tbody>${itemRowsHtml}</tbody></table>
        <p style="text-align:right;font-size:17px;font-weight:700;margin:0 0 20px;">Total: ${details.totalInr}</p>
        ${ctaButton(`${SNAPPY_EMAIL_BRAND.siteUrl}/admin`, 'Open admin dashboard')}
  `,
    seller
  );

  const html = finalizeEmail(card, `New order #${details.orderNumber}`);

  const text = `
[SNAPPY GIFTZ ALERT] NEW ORDER: #${details.orderNumber}
Customer: ${details.customerName} (${details.customerEmail})
Payment Method: ${details.paymentMethod}
Total: ${details.totalInr}
${details.codAmountDueInr ? `COD Amount to Collect: ${details.codAmountDueInr}\n` : ''}
Delivery Address:
${details.shippingAddress.fullName}
${details.shippingAddress.addressLine1}
${details.shippingAddress.city}, ${details.shippingAddress.state} - ${details.shippingAddress.postalCode}

Items:
${details.items.map((i) => `- ${i.productName} x ${i.quantity} = ${i.totalInr}${i.isCustomized ? ' (Customized)' : ''}`).join('\n')}
  `.trim();

  return { subject, html, text };
}

/**
 * Sent when the owner sets the delivery charge: the customer must come back,
 * approve the final total, and (for online orders) pay.
 */
export function renderDeliveryChargeReadyTemplate(
  seller: SellerConfigData,
  details: {
    orderNumber: string;
    customerName: string;
    deliveryChargeInr: string;
    grandTotalInr: string;
    paymentMethod: string;
    continueUrl: string;
  }
): { subject: string; html: string; text: string } {
  const isCod = details.paymentMethod.toUpperCase() === 'COD';
  const subject = `Action needed: approve the final amount for order #${details.orderNumber} - SNAPPY GIFTZ`;
  const nextStep = isCod
    ? 'Approve the final amount to confirm your Cash on Delivery order.'
    : 'Approve the final amount and complete your secure online payment to confirm your order.';

  const card = wrapTemplateCard(
    'Final amount ready',
    `
        <h2 style="font-size:20px;color:${SNAPPY_EMAIL_BRAND.primary};margin:0 0 12px;">Hi ${escapeHtml(details.customerName)}, your final amount is ready</h2>
        <p style="margin:0 0 16px;">We've added the delivery charge for order <strong>#${escapeHtml(details.orderNumber)}</strong>.</p>
        <div style="background:${SNAPPY_EMAIL_BRAND.accentLight};border:1px solid ${SNAPPY_EMAIL_BRAND.accent};border-radius:10px;padding:16px;">
          <p style="margin:0;">Delivery charge: <strong>${escapeHtml(details.deliveryChargeInr)}</strong></p>
          <p style="margin:6px 0 0;">Final total: <strong style="font-size:18px;color:${SNAPPY_EMAIL_BRAND.primary};">${escapeHtml(details.grandTotalInr)}</strong></p>
        </div>
        <p style="margin:16px 0 0;">${nextStep}</p>
        ${ctaButton(details.continueUrl, isCod ? 'Review & confirm order' : 'Review & pay')}
  `,
    seller
  );

  const html = finalizeEmail(card, `Approve the final amount for order #${details.orderNumber}`);
  const text = `
Hi ${details.customerName},
We've added the delivery charge for order #${details.orderNumber}.
Delivery charge: ${details.deliveryChargeInr}
Final total: ${details.grandTotalInr}

${nextStep}
Continue here: ${details.continueUrl}

${supportLineText(seller)}
  `.trim();

  return { subject, html, text };
}

export function renderCodApprovedTemplate(
  seller: SellerConfigData,
  details: { orderNumber: string; customerName: string; codAmountDueInr: string }
): { subject: string; html: string; text: string } {
  const subject = `Order Confirmed: #${details.orderNumber} (Cash on Delivery) - SNAPPY GIFTZ`;

  const card = wrapTemplateCard(
    'COD confirmed',
    `
        <h2 style="font-size:20px;color:${SNAPPY_EMAIL_BRAND.primary};margin:0 0 12px;">Hi ${escapeHtml(details.customerName)}, you're all set</h2>
        <p style="margin:0 0 20px;">COD order <strong>#${escapeHtml(details.orderNumber)}</strong> is approved and being prepared.</p>
        <div style="background:${SNAPPY_EMAIL_BRAND.accentLight};border:1px solid ${SNAPPY_EMAIL_BRAND.accent};border-radius:10px;padding:16px;">
          <strong>Pay on delivery:</strong> <span style="font-size:18px;color:${SNAPPY_EMAIL_BRAND.primary};">${details.codAmountDueInr}</span>
          <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Cash or UPI to our delivery partner.</p>
        </div>
  `,
    seller
  );

  const html = finalizeEmail(card, `COD order #${details.orderNumber} confirmed`);

  const text = `
Hi ${details.customerName},
Your Cash on Delivery order #${details.orderNumber} has been approved!
Amount Payable on Delivery: ${details.codAmountDueInr}

We are preparing your gift for delivery.
Seller: ${seller.legalName}
${supportLineText(seller)}
  `.trim();

  return { subject, html, text };
}

export function renderCodRejectedTemplate(
  seller: SellerConfigData,
  details: { orderNumber: string; customerName: string; reason?: string }
): { subject: string; html: string; text: string } {
  const subject = `Order Update: #${details.orderNumber} - SNAPPY GIFTZ`;

  const card = wrapTemplateCard(
    'Order update',
    `
        <h2 style="font-size:20px;color:${SNAPPY_EMAIL_BRAND.primary};margin:0 0 12px;">Order #${escapeHtml(details.orderNumber)}</h2>
        <p style="margin:0 0 16px;">Hi ${escapeHtml(details.customerName)}, we couldn't approve this COD order.</p>
        ${
          details.reason
            ? `<div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;padding:14px;margin:0 0 16px;color:#991b1b;font-size:13px;"><strong>Reason:</strong> ${escapeHtml(details.reason)}</div>`
            : ''
        }
        <p style="margin:0;">You can place the order again with online payment anytime.</p>
        ${ctaButton(`${SNAPPY_EMAIL_BRAND.siteUrl}/#catalog-section`, 'Return to shop')}
  `,
    seller
  );

  const html = finalizeEmail(card, `Update on order #${details.orderNumber}`);

  const text = `
Hi ${details.customerName},
We were unable to process your COD order #${details.orderNumber}.
${details.reason ? `Reason: ${details.reason}\n` : ''}
Please visit SNAPPY GIFTZ to place an order or contact us for assistance.
${supportLineText(seller)}
  `.trim();

  return { subject, html, text };
}

export function renderCustomerRegistrationTemplate(
  seller: SellerConfigData,
  details: { customerName: string; customerEmail: string }
): { subject: string; html: string; text: string } {
  const subject = `Welcome to SNAPPY GIFTZ!`;

  const card = wrapTemplateCard(
    'Welcome',
    `
        <h2 style="font-size:22px;color:${SNAPPY_EMAIL_BRAND.primary};margin:0 0 12px;">Welcome, ${escapeHtml(details.customerName)}!</h2>
        <p style="margin:0 0 16px;">Thanks for joining <strong>SNAPPY GIFTZ</strong> — Hyderabad's studio for personalized luxury gifting, custom engraving, and express local delivery.</p>
        <ul style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
          <li>Track orders and delivery in your account</li>
          <li>Save addresses for faster checkout</li>
          <li>Personalize gifts with engraving &amp; artwork</li>
        </ul>
        ${ctaButton(`${SNAPPY_EMAIL_BRAND.siteUrl}/#catalog-section`, 'Explore the collection')}
  `,
    seller
  );

  const html = finalizeEmail(card, 'Welcome to SNAPPY GIFTZ');

  const text = `
Welcome to SNAPPY GIFTZ, ${details.customerName}!
Thank you for creating an account.
Browse gifts and track orders at SNAPPY GIFTZ.
${supportLineText(seller)}
  `.trim();

  return { subject, html, text };
}

export function renderAdminNewRegistrationTemplate(
  seller: SellerConfigData,
  details: { customerName: string; customerEmail: string; role: string }
): { subject: string; html: string; text: string } {
  const subject = `[SNAPPY GIFTZ] New account: ${details.customerEmail}`;

  const card = wrapTemplateCard(
    'New signup',
    `
        <p style="margin:0 0 16px;">A new customer registered on the storefront.</p>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;width:80px;">Name</td><td style="font-weight:600;">${escapeHtml(details.customerName)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Email</td><td>${escapeHtml(details.customerEmail)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Role</td><td>${escapeHtml(details.role)}</td></tr>
        </table>
        ${ctaButton(`${SNAPPY_EMAIL_BRAND.siteUrl}/admin`, 'View in admin')}
  `,
    seller
  );

  const html = finalizeEmail(card, `New signup: ${details.customerEmail}`);
  const text = `New registration\nName: ${details.customerName}\nEmail: ${details.customerEmail}\nRole: ${details.role}`;

  return { subject, html, text };
}
