import { SellerConfigData } from '../invoices/seller-config.service';

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

/**
 * Common HTML email header wrapper.
 */
function renderHeader(seller: SellerConfigData, title: string): string {
  return `
    <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; letter-spacing: 0.5px;">${escapeHtml(seller.legalName)}</h1>
      <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">${escapeHtml(title)}</p>
    </div>
  `;
}

/**
 * Common HTML email footer wrapper.
 */
function renderFooter(seller: SellerConfigData): string {
  const phonePart = seller.contactPhone ? ` | ${escapeHtml(seller.contactPhone)}` : '';
  return `
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #64748b; border-radius: 0 0 8px 8px;">
      <p style="margin: 0 0 6px 0; font-weight: 600; color: #1e293b;">${escapeHtml(seller.legalName)}</p>
      <p style="margin: 0 0 6px 0;">${escapeHtml(seller.registeredStreet)}, ${escapeHtml(seller.city)}, ${escapeHtml(seller.state)} - ${escapeHtml(seller.pincode)}, India</p>
      <p style="margin: 0;">Support: <a href="mailto:${escapeHtml(seller.contactEmail)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(seller.contactEmail)}</a>${phonePart}</p>
    </div>
  `;
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

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${renderHeader(seller, 'Order Confirmation & Receipt')}
      <div style="padding: 24px; background-color: #ffffff;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Hello ${escapeHtml(order.customerName)},</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">Thank you for your order! We have received your order <strong>#${escapeHtml(order.orderNumber)}</strong> placed on ${escapeHtml(order.orderDate)} and our team is preparing your package.</p>
        
        <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; margin: 18px 0; font-size: 13px; color: #475569;">
          <strong>Deliver to:</strong> ${escapeHtml(order.shippingAddress.fullName)}, ${escapeHtml(order.shippingAddress.addressLine1)}, ${escapeHtml(order.shippingAddress.city)}, ${escapeHtml(order.shippingAddress.state)} - ${escapeHtml(order.shippingAddress.postalCode)}
        </div>

        <h3 style="font-size: 15px; color: #0f172a; margin: 20px 0 10px 0;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 8px 10px; text-align: left; font-size: 12px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Item</th>
              <th style="padding: 8px 10px; text-align: center; font-size: 12px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Qty</th>
              <th style="padding: 8px 10px; text-align: right; font-size: 12px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Unit Rate</th>
              <th style="padding: 8px 10px; text-align: right; font-size: 12px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="width: 250px; margin-left: auto; font-size: 13px; color: #334155; line-height: 1.8;">
          <div style="display: flex; justify-content: space-between;"><span>Taxable Subtotal:</span><span>Rs. ${escapeHtml(order.taxableSubtotalInr)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Taxes (GST):</span><span>Rs. ${escapeHtml(order.taxTotalInr)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Shipping:</span><span>Rs. ${escapeHtml(order.shippingTotalInr)}</span></div>
          <div style="display: flex; justify-content: space-between; border-top: 2px solid #0f172a; padding-top: 6px; font-weight: 700; font-size: 15px; color: #0f172a;">
            <span>Grand Total:</span><span>Rs. ${escapeHtml(order.grandTotalInr)}</span>
          </div>
        </div>

        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Your official GST tax invoice will be issued upon dispatch and sent to you automatically.</p>
      </div>
      ${renderFooter(seller)}
    </div>
  `;

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
Support: ${seller.contactEmail} | ${seller.contactPhone}
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

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${renderHeader(seller, 'Official GST Tax Invoice')}
      <div style="padding: 24px; background-color: #ffffff;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Tax Invoice Generated</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Your official tax invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> has been generated for order <strong>#${escapeHtml(invoice.orderNumber)}</strong>.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; font-size: 13px; color: #334155;">
            <tr><td style="padding: 4px 0; color: #64748b;">Invoice Number:</td><td style="font-weight: 600;">${escapeHtml(invoice.invoiceNumber)}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Invoice Date:</td><td>${escapeHtml(invoice.invoiceDate)}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Order Number:</td><td>#${escapeHtml(invoice.orderNumber)}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Total Amount:</td><td style="font-weight: 700; color: #0f172a;">Rs. ${escapeHtml(invoice.grandTotalInr)}</td></tr>
          </table>
        </div>

        <p style="color: #334155; font-size: 13px;">A copy of your PDF Tax Invoice is attached to this email for your accounting and tax records.</p>
        
        <div style="margin-top: 24px; text-align: center;">
          <a href="${escapeHtml(invoice.downloadUrl || '/orders')}" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500; display: inline-block;">
            View Order in Account
          </a>
        </div>
      </div>
      ${renderFooter(seller)}
    </div>
  `;

  const text = `
TAX INVOICE ISSUED: ${invoice.invoiceNumber}
Order Reference: #${invoice.orderNumber}
Invoice Date: ${invoice.invoiceDate}
Invoice Total: Rs. ${invoice.grandTotalInr}

Your official GST Tax Invoice has been generated and is attached to this email.

Seller: ${seller.legalName} (GSTIN: ${seller.gstin})
Support: ${seller.contactEmail} | ${seller.contactPhone}
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
    ? `
      <div style="margin: 20px 0; text-align: center;">
        <a href="${escapeHtml(shipment.trackingUrl)}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
          Track Shipment Online
        </a>
      </div>
    `
    : '';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${renderHeader(seller, 'Fulfillment & Dispatch Update')}
      <div style="padding: 24px; background-color: #ffffff;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Good news! Your order is on the way.</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Your order <strong>#${escapeHtml(shipment.orderNumber)}</strong> has been packaged with care and handed over to our courier partner for transit.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; font-size: 13px; color: #334155;">
            <tr><td style="padding: 4px 0; color: #64748b;">Carrier Partner:</td><td style="font-weight: 600;">${escapeHtml(shipment.carrierPartner)}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">AWB / Tracking Number:</td><td style="font-weight: 600; font-family: monospace;">${escapeHtml(shipment.awbNumber)}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Destination:</td><td>${escapeHtml(shipment.shippingAddress.city)}, ${escapeHtml(shipment.shippingAddress.state)} - ${escapeHtml(shipment.shippingAddress.postalCode)}</td></tr>
            ${shipment.estimatedDeliveryDate ? `<tr><td style="padding: 4px 0; color: #64748b;">Estimated Delivery:</td><td>${escapeHtml(shipment.estimatedDeliveryDate)}</td></tr>` : ''}
          </table>
        </div>

        ${trackingButton}

        <p style="color: #64748b; font-size: 12px; margin-top: 24px; text-align: center;">
          Tracking details may take 2-4 hours to reflect on the carrier's tracking system.
        </p>
      </div>
      ${renderFooter(seller)}
    </div>
  `;

  const text = `
SHIPMENT DISPATCHED: Order #${shipment.orderNumber}
Carrier: ${shipment.carrierPartner}
AWB / Tracking Number: ${shipment.awbNumber}
Destination: ${shipment.shippingAddress.city}, ${shipment.shippingAddress.state} - ${shipment.shippingAddress.postalCode}
${shipment.trackingUrl ? `Tracking Link: ${shipment.trackingUrl}` : ''}

Your package is on its way!
Seller: ${seller.legalName} (GSTIN: ${seller.gstin})
Support: ${seller.contactEmail} | ${seller.contactPhone}
  `.trim();

  return { subject, html, text };
}
