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

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="background-color: #0f172a; padding: 20px 24px; border-top-left-radius: 7px; border-top-right-radius: 7px;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">SNAPPY GIFTZ — Operations Alert</h1>
        <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">New Consumer Order Notice</p>
      </div>
      <div style="padding: 24px; background-color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
          <h2 style="font-size: 18px; color: #0f172a; margin: 0;">Order #${escapeHtml(details.orderNumber)}</h2>
          <span style="font-size: 13px; color: #64748b;">${escapeHtml(details.orderDate)}</span>
        </div>

        <div style="margin: 16px 0; padding: 12px 16px; background-color: ${details.paymentMethod === 'COD' ? '#fffbeb' : '#f0fdf4'}; border: 1px solid ${details.paymentMethod === 'COD' ? '#fef3c7' : '#dcfce7'}; border-radius: 6px;">
          <strong style="color: ${details.paymentMethod === 'COD' ? '#b45309' : '#15803d'}; font-size: 14px;">
            Payment Method: ${details.paymentMethod === 'COD' ? 'Cash on Delivery (Pending Review)' : 'Paid Online (Razorpay)'}
          </strong>
          ${details.codAmountDueInr ? `<div style="font-size: 13px; color: #b45309; margin-top: 4px;">Cash to Collect upon delivery: <strong>${details.codAmountDueInr}</strong></div>` : ''}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 12px;">
              <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; text-transform: uppercase;">Customer Details</h4>
              <div style="font-size: 13px; color: #334155; line-height: 1.5;">
                <strong>${escapeHtml(details.customerName)}</strong><br>
                ${escapeHtml(details.customerEmail)}<br>
                ${details.customerPhone ? `Tel: ${escapeHtml(details.customerPhone)}` : ''}
              </div>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 12px;">
              <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; text-transform: uppercase;">Delivery Address</h4>
              <div style="font-size: 13px; color: #334155; line-height: 1.5;">
                ${escapeHtml(details.shippingAddress.fullName)}<br>
                ${escapeHtml(details.shippingAddress.addressLine1)}<br>
                ${escapeHtml(details.shippingAddress.city)}, ${escapeHtml(details.shippingAddress.state)} - ${escapeHtml(details.shippingAddress.postalCode)}
              </div>
            </td>
          </tr>
        </table>

        <h4 style="margin: 24px 0 8px 0; font-size: 13px; color: #64748b; text-transform: uppercase;">Ordered Items</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; color: #64748b; text-transform: uppercase;">
              <th style="padding: 6px 0; text-align: left;">Item</th>
              <th style="padding: 6px 0; text-align: center;">Qty</th>
              <th style="padding: 6px 0; text-align: right;">Unit Price</th>
              <th style="padding: 6px 0; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>

        <div style="text-align: right; font-size: 16px; font-weight: 700; color: #0f172a; padding: 12px 0; border-top: 2px solid #0f172a;">
          Total Order Value: ${details.totalInr}
        </div>
      </div>
      <div style="padding: 16px 24px; background-color: #f8fafc; border-bottom-left-radius: 7px; border-bottom-right-radius: 7px; font-size: 12px; color: #64748b; text-align: center;">
        SNAPPY GIFTZ Admin & Fulfillment System
      </div>
    </div>
  `;

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

export function renderCodApprovedTemplate(
  seller: SellerConfigData,
  details: { orderNumber: string; customerName: string; codAmountDueInr: string }
): { subject: string; html: string; text: string } {
  const subject = `Order Confirmed: #${details.orderNumber} (Cash on Delivery) - SNAPPY GIFTZ`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${renderHeader(seller, 'COD Order Confirmed')}
      <div style="padding: 24px; background-color: #ffffff;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Hi ${escapeHtml(details.customerName)}, your order is confirmed!</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Your Cash on Delivery order <strong>#${escapeHtml(details.orderNumber)}</strong> has been approved and is now being processed for packing and delivery.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #334155;">
            <strong>Amount Payable on Delivery:</strong> <span style="font-size: 16px; color: #0f172a; font-weight: 700;">${details.codAmountDueInr}</span>
          </p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">
            Please keep the exact cash amount ready at the time of delivery. You may also pay via UPI QR to our delivery executive.
          </p>
        </div>
      </div>
      ${renderFooter(seller)}
    </div>
  `;

  const text = `
Hi ${details.customerName},
Your Cash on Delivery order #${details.orderNumber} has been approved!
Amount Payable on Delivery: ${details.codAmountDueInr}

We are preparing your gift for delivery.
Seller: ${seller.legalName}
Support: ${seller.contactEmail} | ${seller.contactPhone}
  `.trim();

  return { subject, html, text };
}

export function renderCodRejectedTemplate(
  seller: SellerConfigData,
  details: { orderNumber: string; customerName: string; reason?: string }
): { subject: string; html: string; text: string } {
  const subject = `Order Update: #${details.orderNumber} - SNAPPY GIFTZ`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${renderHeader(seller, 'Order Cancellation Notice')}
      <div style="padding: 24px; background-color: #ffffff;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Order #${escapeHtml(details.orderNumber)} Notice</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Hi ${escapeHtml(details.customerName)}, we were unable to process your Cash on Delivery order <strong>#${escapeHtml(details.orderNumber)}</strong>.
        </p>
        ${
          details.reason
            ? `<div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 14px; margin: 16px 0; color: #991b1b; font-size: 13px;">
                <strong>Reason:</strong> ${escapeHtml(details.reason)}
               </div>`
            : ''
        }
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Any reserved items have been restored. If you wish to place this order again with online payment, please visit our website.
        </p>
      </div>
      ${renderFooter(seller)}
    </div>
  `;

  const text = `
Hi ${details.customerName},
We were unable to process your COD order #${details.orderNumber}.
${details.reason ? `Reason: ${details.reason}\n` : ''}
Please visit SNAPPY GIFTZ to place an order or contact us for assistance.
Support: ${seller.contactEmail} | ${seller.contactPhone}
  `.trim();

  return { subject, html, text };
}

export function renderCustomerRegistrationTemplate(
  seller: SellerConfigData,
  details: { customerName: string; customerEmail: string }
): { subject: string; html: string; text: string } {
  const subject = `Welcome to SNAPPY GIFTZ!`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${renderHeader(seller, 'Welcome to SNAPPY GIFTZ')}
      <div style="padding: 24px; background-color: #ffffff;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Welcome, ${escapeHtml(details.customerName)}!</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Thank you for creating an account with SNAPPY GIFTZ. We are thrilled to bring thoughtful, personalized gifting and rapid Hyderabad personal delivery to your fingertips.
        </p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          You can track your orders, manage your delivery addresses, and personalize unique gifts directly from your account.
        </p>
      </div>
      ${renderFooter(seller)}
    </div>
  `;

  const text = `
Welcome to SNAPPY GIFTZ, ${details.customerName}!
Thank you for creating an account.
Browse gifts and track orders at SNAPPY GIFTZ.
Support: ${seller.contactEmail} | ${seller.contactPhone}
  `.trim();

  return { subject, html, text };
}
