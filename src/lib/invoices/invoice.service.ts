import { prisma } from '@/lib/prisma';
import { isStorefrontFallbackAllowed } from '@/lib/catalog/public-catalog.service';
import { DEV_ORDERS_STORE, SanitizedOrderResult } from '@/lib/orders/order.service';
import {
  getSellerConfig,
  assertSellerConfigReadyForInvoice,
  SellerConfigData,
  SellerConfigError,
  EInvoiceStatus,
  InvoiceSignatureMode,
} from './seller-config.service';
import { getNextInvoiceSequence, getIndianFinancialYear } from './invoice-number.service';
import { generateTaxInvoicePdf, InvoiceItemSnapshot, TaxInvoicePdfData } from '../pdf/invoice-pdf';
import { generatePackingSlipPdf, PackingSlipItem, PackingSlipPdfData } from '../pdf/packing-slip-pdf';
import { privateStorageService } from '@/services/storage/private-storage.service';
import { enqueueTransactionalEmail } from '../email/email-outbox.service';
import { renderInvoiceAvailableTemplate } from '../email/email-templates';
import { BUSINESS_CONFIG } from '@/config/business';

export class InvoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceValidationError';
  }
}

/** Retail B2C consumer orders (not corporate GSTIN / B2B contract). */
export function isRetailB2COrder(order: { type?: string | null; gstin?: string | null }): boolean {
  const gstin = (order.gstin || '').trim();
  return order.type !== 'B2B' && gstin.length !== 15;
}

export function isOrderPaidForInvoice(order: { paymentStatus?: string | null }): boolean {
  const ps = (order.paymentStatus || '').toUpperCase();
  return ps === 'PAID' || ps === 'CAPTURED';
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  invoiceDate: Date;
  financialYear: string;
  series: string;
  sequenceNumber: number;
  supplierLegalName: string;
  supplierTradeName?: string | null;
  supplierGstin: string;
  supplierAddress: any;
  supplierState: string;
  supplierStateCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerGstin?: string | null;
  billingAddress: any;
  shippingAddress: any;
  placeOfSupply: string;
  placeOfSupplyStateCode: string;
  isIntraState: boolean;
  itemsSubtotalPaise: number;
  customizationTotalPaise: number;
  discountTotalPaise: number;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxTotalPaise: number;
  shippingTotalPaise: number;
  grandTotalPaise: number;
  itemsJson: InvoiceItemSnapshot[];
  pdfStorageKey?: string | null;
  pdfGeneratedAt?: Date | null;
  isSample: boolean;
  status: string;

  // E-Invoicing & Signature Compliance
  eInvoiceStatus: EInvoiceStatus;
  irn?: string | null;
  signedQrData?: string | null;
  rule46Declaration?: string | null;
  signatureMode: InvoiceSignatureMode;

  // Physical Signature Confirmation (CGST Rule 46(q))
  physicalSignatureConfirmedBy?: string | null;
  physicalSignatureConfirmedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

// In-memory development store for invoices
export const DEV_INVOICES_STORE: Map<string, InvoiceRecord> = new Map();

/**
 * Authoritatively issues a GST Tax Invoice for an order.
 * Strictly idempotent: retrying will reuse the existing invoice record and sequence number.
 */
export async function issueTaxInvoice(
  orderIdOrNumber: string,
  options?: {
    forceReissue?: boolean;
    requestedBy?: string;
    irn?: string;
    signedQrData?: string;
    digitalSignatureDetails?: string;
  }
): Promise<InvoiceRecord> {
  // 1. Fetch Order
  const order = await fetchOrderForInvoicing(orderIdOrNumber);
  if (!order) {
    throw new InvoiceValidationError(`Order not found for invoicing: "${orderIdOrNumber}"`);
  }

  // 2. Lifecycle & Payment check:
  // Must NOT generate tax invoice solely on unconfirmed or pending browser states
  const validStatuses = ['CONFIRMED', 'IN_CUSTOMIZATION', 'QUALITY_CHECK', 'DISPATCHED', 'DELIVERED'];
  if (!validStatuses.includes(order.orderStatus) && order.paymentStatus !== 'PAID') {
    throw new InvoiceValidationError(
      `Cannot issue tax invoice: Order #${order.orderNumber} is in status ${order.orderStatus} with payment status ${order.paymentStatus}. Order must be confirmed and paid.`
    );
  }

  // 3. Idempotency Check:
  // If an invoice already exists for this order, reuse it
  const existingInvoice = await findExistingInvoiceForOrder(order.id, order.orderNumber);
  if (existingInvoice && !options?.forceReissue) {
    // If PDF was already successfully generated, return existing invoice directly
    if (existingInvoice.pdfStorageKey) {
      try {
        await privateStorageService.getPrivateFileBuffer(existingInvoice.pdfStorageKey);
        return existingInvoice;
      } catch {
        // PDF missing from disk, proceed to regenerate using SAME invoice number
      }
    }
  }

  // 4. Retrieve and Validate Seller Configuration
  const sellerConfig = await getSellerConfig();
  const isProduction = process.env.NODE_ENV === 'production' && !isStorefrontFallbackAllowed();
  try {
    assertSellerConfigReadyForInvoice(sellerConfig, isProduction);
  } catch (err: any) {
    if (isProduction) {
      throw err;
    }
  }

  // 4b. Rule 46(s) Declaration Check
  let rule46Declaration: string | null = null;
  if (
    sellerConfig.panAggregateTurnoverExceeds5Cr &&
    sellerConfig.eInvoiceStatus === 'EXEMPT_NOTIFIED_CATEGORY'
  ) {
    rule46Declaration =
      'I/We hereby declare that though our aggregate turnover in any preceding financial year from 2017-18 onwards is more than the aggregate turnover notified under sub-rule (4) of rule 48, we are not required to prepare an invoice in terms of the provisions of the said sub-rule.';
  }

  // 4c. E-Invoicing (Rule 48(4)) verification
  const irn = options?.irn || null;
  const signedQrData = options?.signedQrData || null;

  // Transaction type classification under Rule 48(4):
  // Notification No. 13/2020-CT notifies e-invoicing for supplies to registered persons (B2B), exports, and SEZ units.
  // Retail B2C supplies to unregistered persons are excluded from Rule 48(4) IRP e-invoicing.
  const isB2bSupply = !isRetailB2COrder(order);

  if (sellerConfig.eInvoiceStatus === 'APPLICABLE') {
    if (isB2bSupply) {
      if (!irn || !signedQrData) {
        if (isProduction) {
          throw new InvoiceValidationError(
            'Cannot issue legal tax invoice in production: E-invoicing is APPLICABLE under Rule 48(4) for B2B supplies to registered persons because PAN-level aggregate turnover exceeds ₹5 Crores. An authentic IRN and signed QR code from an approved IRP are mandatory. Under Rule 48(5), an invoice issued without an IRN shall not be treated as an invoice.'
          );
        }
      }
    } else {
      // Retail B2C supply: Rule 48(4) IRP e-invoice is not required for B2C consumer supplies.
      // Standard Rule 46 invoice requirements apply.
    }
  }

  // 4d. Signature Compliance Mode (Rule 46(q))
  const signatureMode = sellerConfig.signatureMode || 'PHYSICAL_SIGNATURE_ON_PRINT';
  if (signatureMode === 'DIGITAL_SIGNATURE_IT_ACT' && !sellerConfig.digitalSignatureConfigured) {
    if (isProduction) {
      throw new InvoiceValidationError(
        'Cannot issue legal tax invoice in production: Signature mode is set to DIGITAL_SIGNATURE_IT_ACT, but no IT Act 2000 Section 5 compliant Digital Signature Certificate (DSC) has been configured. Text disclaimers or decorative images do not fulfill the statutory signature requirement under CGST Rule 46(q).'
      );
    }
  }

  if (
    (signatureMode === 'ELECTRONIC_INVOICE_EXCEPTION' || signatureMode === 'E_INVOICE_IRP_QR') &&
    !sellerConfig.electronicInvoiceSignatureExemptionConfirmed
  ) {
    throw new InvoiceValidationError(
      'Cannot issue legal tax invoice with electronic signature exemption: Under CGST Rule 46, a signed QR code under Rule 46(r) does not automatically exempt the supplier from signature requirements under Rule 46(q). The applicable electronic-invoice signature exception requires explicit accountant confirmation and audit of statutory conditions.'
    );
  }

  const isSample = !sellerConfig.isVerified;

  // 5. Line items & GST verification
  // Ensure every item has valid HSN and tax rate
  const items: InvoiceItemSnapshot[] = [];
  const isIntraState = order.destinationStateCode === sellerConfig.stateCode; // '08' -> Rajasthan

  for (const item of order.items) {
    if (!item.hsnCode || item.hsnCode.trim() === '') {
      throw new InvoiceValidationError(
        `Missing required HSN code for product "${item.productName}". Product tax metadata must be configured.`
      );
    }
    if (typeof item.taxRatePercent !== 'number' || item.taxRatePercent < 0) {
      throw new InvoiceValidationError(
        `Invalid or missing GST rate (${item.taxRatePercent}%) for product "${item.productName}".`
      );
    }

    const unitPricePaise = item.unitPricePaise;
    const taxableAmountPaise = unitPricePaise * item.quantity;
    const itemGstPaise = Math.round((taxableAmountPaise * item.taxRatePercent) / 100);

    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;

    if (isIntraState) {
      cgstPaise = Math.floor(itemGstPaise / 2);
      sgstPaise = itemGstPaise - cgstPaise;
    } else {
      igstPaise = itemGstPaise;
    }

    const totalPaise = taxableAmountPaise + itemGstPaise;

    items.push({
      productName: item.productName,
      sku: item.sku,
      hsnCode: item.hsnCode,
      quantity: item.quantity,
      unitPricePaise,
      taxableAmountPaise,
      taxRatePercent: item.taxRatePercent,
      cgstPaise,
      sgstPaise,
      igstPaise,
      totalPaise,
    });
  }

  // 6. Concurrency-safe Invoice Number Allocation
  let invoiceNumber = existingInvoice?.invoiceNumber;
  let financialYear = existingInvoice?.financialYear;
  let series = existingInvoice?.series || sellerConfig.invoicePrefix || 'SG';
  let sequenceNumber = existingInvoice?.sequenceNumber;

  if (!invoiceNumber || !financialYear || !sequenceNumber) {
    const fyInfo = getIndianFinancialYear();
    financialYear = fyInfo.financialYear;
    sequenceNumber = await getNextInvoiceSequence(financialYear, series);
    const { formatGstInvoiceNumber } = await import('./invoice-number.service');
    invoiceNumber = formatGstInvoiceNumber(series, fyInfo.shortFinancialYear, sequenceNumber);
  }

  // 7. Calculate Aggregates
  const subtotalTaxablePaise = items.reduce((acc, i) => acc + i.taxableAmountPaise, 0);
  const totalCgstPaise = items.reduce((acc, i) => acc + i.cgstPaise, 0);
  const totalSgstPaise = items.reduce((acc, i) => acc + i.sgstPaise, 0);
  const totalIgstPaise = items.reduce((acc, i) => acc + i.igstPaise, 0);

  // Shipping GST (18%)
  const shippingTotalPaise = Number(order.shippingTotalPaise || 0);
  const shippingTaxablePaise = Math.round(shippingTotalPaise / 1.18);
  const shippingGstPaise = shippingTotalPaise - shippingTaxablePaise;

  const totalTaxPaise = totalCgstPaise + totalSgstPaise + totalIgstPaise + shippingGstPaise;
  const grandTotalPaise = subtotalTaxablePaise + totalTaxPaise + shippingTaxablePaise - Number(order.discountTotalPaise || 0);

  const invoiceDate = new Date();
  const formattedInvoiceDate = invoiceDate.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const parsedShipping =
    (typeof order.shippingAddress === 'string'
      ? (JSON.parse(order.shippingAddress || '{}') || {})
      : order.shippingAddress) || {};

  const invoicePdfData: TaxInvoicePdfData = {
    invoiceNumber,
    invoiceDate: formattedInvoiceDate,
    orderNumber: order.orderNumber,
    orderDate: new Date(order.createdAt).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    isSample,
    seller: sellerConfig,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      gstin: order.gstin,
    },
    billingAddress: {
      fullName: parsedShipping.name || parsedShipping.fullName || order.customerName,
      addressLine1: parsedShipping.street || parsedShipping.addressLine1 || '',
      city: parsedShipping.city || '',
      state: parsedShipping.state || '',
      postalCode: parsedShipping.pincode || parsedShipping.postalCode || '',
      country: 'India',
    },
    shippingAddress: {
      fullName: parsedShipping.name || parsedShipping.fullName || order.customerName,
      addressLine1: parsedShipping.street || parsedShipping.addressLine1 || '',
      city: parsedShipping.city || '',
      state: parsedShipping.state || '',
      postalCode: parsedShipping.pincode || parsedShipping.postalCode || '',
      country: 'India',
    },
    placeOfSupply: `${parsedShipping.state || 'Rajasthan'} (Code: ${order.destinationStateCode})`,
    isInterState: !isIntraState,
    items,
    subtotalTaxablePaise,
    totalCgstPaise,
    totalSgstPaise,
    totalIgstPaise,
    shippingTaxablePaise,
    shippingGstPaise,
    discountPaise: Number(order.discountTotalPaise || 0),
    totalTaxPaise,
    grandTotalPaise,
    paymentMethod: order.paymentMethod,
    eInvoiceStatus: sellerConfig.eInvoiceStatus,
    irn,
    signedQrData,
    rule46Declaration,
    signatureMode,
    digitalSignatureDetails: options?.digitalSignatureDetails || null,
    physicalSignatureConfirmedBy: existingInvoice?.physicalSignatureConfirmedBy || null,
    physicalSignatureConfirmedAt: existingInvoice?.physicalSignatureConfirmedAt || null,
  };

  // 8. Generate and Privately Store PDF
  const pdfBuffer = generateTaxInvoicePdf(invoicePdfData);
  const safeFilename = `${invoiceNumber.replace(/[\/\\]/g, '_')}.pdf`;
  const storageResult = await privateStorageService.storePrivateDocument(
    pdfBuffer,
    safeFilename,
    'application/pdf',
    'invoices'
  );

  // 9. Persist Invoice Record
  const invoiceRecord: InvoiceRecord = {
    id: existingInvoice?.id || `inv-${Date.now()}`,
    invoiceNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,
    invoiceDate,
    financialYear,
    series,
    sequenceNumber,
    supplierLegalName: sellerConfig.legalName,
    supplierTradeName: sellerConfig.tradeName,
    supplierGstin: sellerConfig.gstin,
    supplierAddress: {
      street: sellerConfig.registeredStreet,
      city: sellerConfig.city,
      state: sellerConfig.state,
      pincode: sellerConfig.pincode,
    },
    supplierState: sellerConfig.state,
    supplierStateCode: sellerConfig.stateCode,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    customerGstin: order.gstin,
    billingAddress: invoicePdfData.billingAddress,
    shippingAddress: invoicePdfData.shippingAddress,
    placeOfSupply: invoicePdfData.placeOfSupply,
    placeOfSupplyStateCode: order.destinationStateCode,
    isIntraState,
    itemsSubtotalPaise: subtotalTaxablePaise,
    customizationTotalPaise: Number(order.customizationTotalPaise || 0),
    discountTotalPaise: Number(order.discountTotalPaise || 0),
    taxableAmountPaise: subtotalTaxablePaise,
    cgstPaise: totalCgstPaise,
    sgstPaise: totalSgstPaise,
    igstPaise: totalIgstPaise,
    taxTotalPaise: totalTaxPaise,
    shippingTotalPaise,
    grandTotalPaise,
    itemsJson: items,
    pdfStorageKey: storageResult.fileKey,
    pdfGeneratedAt: new Date(),
    isSample,
    status: 'ISSUED',
    eInvoiceStatus: sellerConfig.eInvoiceStatus,
    irn,
    signedQrData,
    rule46Declaration,
    signatureMode,
    physicalSignatureConfirmedBy: existingInvoice?.physicalSignatureConfirmedBy || null,
    physicalSignatureConfirmedAt: existingInvoice?.physicalSignatureConfirmedAt || null,
    createdAt: existingInvoice?.createdAt || new Date(),
    updatedAt: new Date(),
  };

  // Try DB persistence
  try {
    if (existingInvoice) {
      await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          pdfStorageKey: storageResult.fileKey,
          pdfGeneratedAt: new Date(),
          isSample,
          status: 'ISSUED',
        },
      });
    } else {
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          financialYear,
          series,
          sequenceNumber,
          supplierLegalName: sellerConfig.legalName,
          supplierTradeName: sellerConfig.tradeName || null,
          supplierGstin: sellerConfig.gstin,
          supplierAddress: invoiceRecord.supplierAddress,
          supplierState: sellerConfig.state,
          supplierStateCode: sellerConfig.stateCode,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone || null,
          customerGstin: order.gstin || null,
          billingAddress: invoicePdfData.billingAddress,
          shippingAddress: invoicePdfData.shippingAddress,
          placeOfSupply: invoicePdfData.placeOfSupply,
          placeOfSupplyStateCode: order.destinationStateCode,
          isIntraState,
          itemsSubtotalPaise: BigInt(subtotalTaxablePaise),
          customizationTotalPaise: BigInt(order.customizationTotalPaise || 0),
          discountTotalPaise: BigInt(order.discountTotalPaise || 0),
          taxableAmountPaise: BigInt(subtotalTaxablePaise),
          cgstPaise: BigInt(totalCgstPaise),
          sgstPaise: BigInt(totalSgstPaise),
          igstPaise: BigInt(totalIgstPaise),
          taxTotalPaise: BigInt(totalTaxPaise),
          shippingTotalPaise: BigInt(shippingTotalPaise),
          grandTotalPaise: BigInt(grandTotalPaise),
          itemsJson: items as any,
          pdfStorageKey: storageResult.fileKey,
          pdfGeneratedAt: new Date(),
          isSample,
          status: 'ISSUED',
          eInvoiceStatus: sellerConfig.eInvoiceStatus,
          irn,
          signedQrData,
          rule46Declaration,
          signatureMode,
          physicalSignatureConfirmedBy: invoiceRecord.physicalSignatureConfirmedBy,
          physicalSignatureConfirmedAt: invoiceRecord.physicalSignatureConfirmedAt,
        },
      });
    }
  } catch (dbErr: any) {
    if (process.env.NODE_ENV === 'production' && !isStorefrontFallbackAllowed()) {
      console.error('[INVOICE:CRITICAL] Failed to persist invoice to PostgreSQL:', dbErr?.message || dbErr);
    }
  }

  // Always update in-memory fallback store
  DEV_INVOICES_STORE.set(invoiceRecord.id, invoiceRecord);
  DEV_INVOICES_STORE.set(invoiceRecord.invoiceNumber, invoiceRecord);
  DEV_INVOICES_STORE.set(`order:${order.orderNumber}`, invoiceRecord);

  // 10. Enqueue Transactional Email (INVOICE_AVAILABLE)
  // Under CGST Rule 46(q) PHYSICAL_SIGNATURE_ON_PRINT, the invoice must NOT be released
  // to the customer as an authenticated document until authorized staff physically prints and signs it.
  // For electronic modes (DIGITAL_SIGNATURE_IT_ACT or approved ELECTRONIC_INVOICE_EXCEPTION),
  // authentication is already embedded upon issuance.
  const isPhysicalSignPending =
    signatureMode === 'PHYSICAL_SIGNATURE_ON_PRINT' &&
    !invoiceRecord.physicalSignatureConfirmedAt;

  // B2C retail: computer-generated PDF is released to the customer once payment is captured.
  // Warehouse still confirms physical hardcopy signature before dispatch (Rule 46(q)).
  const b2cComputerGeneratedRelease =
    isRetailB2COrder(order) &&
    isOrderPaidForInvoice(order) &&
    signatureMode === 'PHYSICAL_SIGNATURE_ON_PRINT';

  if (!isPhysicalSignPending || b2cComputerGeneratedRelease) {
    await sendInvoiceAvailableEmail(invoiceRecord, sellerConfig, safeFilename, storageResult.fileKey);
  }

  return invoiceRecord;
}

/**
 * Generates an authorized fulfillment Packing Slip PDF for warehouse packaging.
 * Strictly omits prices, order totals, GST amounts, and staff notes.
 */
export async function generatePackingSlip(
  orderIdOrNumber: string,
  options?: { requestedBy?: string }
): Promise<{ buffer: Buffer; fileKey: string; orderNumber: string }> {
  const order = await fetchOrderForInvoicing(orderIdOrNumber);
  if (!order) {
    throw new InvoiceValidationError(`Order not found for packing slip: "${orderIdOrNumber}"`);
  }

  const sellerConfig = await getSellerConfig();
  const parsedShipping =
    (typeof order.shippingAddress === 'string'
      ? (JSON.parse(order.shippingAddress || '{}') || {})
      : order.shippingAddress) || {};

  const items: PackingSlipItem[] = order.items.map((i: any) => ({
    productName: i.productName,
    sku: i.sku,
    quantity: i.quantity,
    personalizationText: i.personalization?.engravedText || i.customizationNote || null,
    personalizationDetails: [
      i.personalization?.fontFamily ? `Font: ${i.personalization.fontFamily}` : null,
      i.personalization?.ribbonColor ? `Ribbon: ${i.personalization.ribbonColor}` : null,
      i.personalization?.boxWrapStyle ? `Wrap: ${i.personalization.boxWrapStyle}` : null,
      i.personalization?.waxSealColor ? `Seal: ${i.personalization.waxSealColor}` : null,
    ]
      .filter(Boolean)
      .join(', ') || null,
  }));

  const packingSlipData: PackingSlipPdfData = {
    orderNumber: order.orderNumber,
    orderDate: new Date(order.createdAt).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    shipmentReference: (order as any).shipment?.carrierPartner || null,
    awbNumber: (order as any).shipment?.awbNumber || null,
    seller: sellerConfig,
    recipient: {
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail,
    },
    deliveryAddress: {
      fullName: parsedShipping.name || parsedShipping.fullName || order.customerName,
      addressLine1: parsedShipping.street || parsedShipping.addressLine1 || '',
      city: parsedShipping.city || '',
      state: parsedShipping.state || '',
      postalCode: parsedShipping.pincode || parsedShipping.postalCode || '',
      country: 'India',
    },
    items,
    dispatchNotes: 'Fragile luxury gift items. Handle with care. Verify wax seal and ribbon placement before boxing.',
  };

  const buffer = generatePackingSlipPdf(packingSlipData);
  const filename = `packingslip-${order.orderNumber}.pdf`;
  const storageResult = await privateStorageService.storePrivateDocument(
    buffer,
    filename,
    'application/pdf',
    'packing-slips'
  );

  return {
    buffer,
    fileKey: storageResult.fileKey,
    orderNumber: order.orderNumber,
  };
}

/**
 * Retrieves the invoice record for an order if one has been generated.
 */
export async function getInvoiceForOrder(orderIdOrNumber: string): Promise<InvoiceRecord | null> {
  return findExistingInvoiceForOrder(orderIdOrNumber, orderIdOrNumber);
}

/**
 * Retrieves the PDF binary buffer for an authorized invoice download.
 */
export async function getInvoicePdfBuffer(invoice: InvoiceRecord): Promise<Buffer> {
  if (!invoice.pdfStorageKey) {
    throw new InvoiceValidationError(`Invoice PDF has not been generated for ${invoice.invoiceNumber}`);
  }
  return privateStorageService.getPrivateFileBuffer(invoice.pdfStorageKey);
}

// -------------------------------------------------------------
// Internal Helper Functions
// -------------------------------------------------------------

async function fetchOrderForInvoicing(orderIdOrNumber: string): Promise<any> {
  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderIdOrNumber }, { orderNumber: orderIdOrNumber }],
      },
      include: {
        items: {
          include: {
            personalization: true,
          },
        },
        shipments: true,
      },
    });
    if (order) return order;
  } catch {
    // DB offline, fall through to in-memory store
  }

  for (const order of DEV_ORDERS_STORE.values()) {
    if (order.id === orderIdOrNumber || order.orderNumber === orderIdOrNumber) {
      return order;
    }
  }

  return null;
}

async function findExistingInvoiceForOrder(orderId: string, orderNumber: string): Promise<InvoiceRecord | null> {
  try {
    const inv = await prisma.invoice.findFirst({
      where: {
        OR: [{ orderId }, { orderNumber }],
      },
    });
    if (inv) {
      return {
        ...inv,
        itemsSubtotalPaise: Number(inv.itemsSubtotalPaise),
        customizationTotalPaise: Number(inv.customizationTotalPaise),
        discountTotalPaise: Number(inv.discountTotalPaise),
        taxableAmountPaise: Number(inv.taxableAmountPaise),
        cgstPaise: Number(inv.cgstPaise),
        sgstPaise: Number(inv.sgstPaise),
        igstPaise: Number(inv.igstPaise),
        taxTotalPaise: Number(inv.taxTotalPaise),
        shippingTotalPaise: Number(inv.shippingTotalPaise),
        grandTotalPaise: Number(inv.grandTotalPaise),
        itemsJson: inv.itemsJson as any,
        eInvoiceStatus: (inv.eInvoiceStatus as EInvoiceStatus) || 'PENDING_ACCOUNTANT_CONFIRMATION',
        irn: inv.irn,
        signedQrData: inv.signedQrData,
        rule46Declaration: inv.rule46Declaration,
        signatureMode: (inv.signatureMode as InvoiceSignatureMode) || 'PHYSICAL_SIGNATURE_ON_PRINT',
        physicalSignatureConfirmedBy: inv.physicalSignatureConfirmedBy,
        physicalSignatureConfirmedAt: inv.physicalSignatureConfirmedAt,
      };
    }
  } catch {
    // Fall through to memory
  }

  // Check DEV_INVOICES_STORE
  for (const item of DEV_INVOICES_STORE.values()) {
    if (item.orderId === orderId || item.orderNumber === orderNumber) {
      return item;
    }
  }

  return null;
}

/**
 * Enqueues the transactional customer email for an issued and authenticated invoice.
 */
export async function sendInvoiceAvailableEmail(
  invoiceRecord: InvoiceRecord,
  sellerConfig: SellerConfigData,
  safeFilename: string,
  pdfStorageKey: string
): Promise<void> {
  try {
    const formattedInvoiceDate = new Date(invoiceRecord.invoiceDate).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const emailData = renderInvoiceAvailableTemplate(
      {
        invoiceNumber: invoiceRecord.invoiceNumber,
        invoiceDate: formattedInvoiceDate,
        orderNumber: invoiceRecord.orderNumber,
        grandTotalInr: (invoiceRecord.grandTotalPaise / 100).toFixed(2),
        downloadUrl: `/orders`,
      },
      sellerConfig
    );

    // 1. Dispatch invoice available notification to customer
    await enqueueTransactionalEmail({
      idempotencyKey: `email-invoice-${invoiceRecord.invoiceNumber}`,
      eventType: 'INVOICE_AVAILABLE',
      orderId: invoiceRecord.orderId,
      orderNumber: invoiceRecord.orderNumber,
      recipientEmail: invoiceRecord.customerEmail,
      recipientName: invoiceRecord.customerName,
      subject: emailData.subject,
      htmlBody: emailData.html,
      textBody: emailData.text,
      attachmentKey: pdfStorageKey,
      attachmentFilename: safeFilename,
    });

    // 2. Dispatch official tax invoice archive copy to protected admin account
    const adminEmail = BUSINESS_CONFIG.adminEmail || 'ezonetechnologies2124@gmail.com';
    await enqueueTransactionalEmail({
      idempotencyKey: `email:admin_invoice_archive:${invoiceRecord.invoiceNumber}`,
      eventType: 'ADMIN_INVOICE_ARCHIVE',
      orderId: invoiceRecord.orderId,
      orderNumber: invoiceRecord.orderNumber,
      recipientEmail: adminEmail,
      recipientName: 'SNAPPY GIFTZ Admin Desk',
      subject: `[INVOICE ARCHIVE] ${invoiceRecord.invoiceNumber} for Order #${invoiceRecord.orderNumber}`,
      htmlBody: emailData.html,
      textBody: emailData.text,
      attachmentKey: pdfStorageKey,
      attachmentFilename: safeFilename,
    });
  } catch (emailErr) {
    console.warn('[INVOICE] Email enqueue failed non-fatally:', emailErr);
  }
}

/**
 * Confirms that a tax invoice requiring physical signature on print has been
 * physically printed and signed prior to goods removal/courier dispatch (CGST Rule 46(q)).
 * Records the confirming staff user and timestamp, regenerates the customer-facing PDF
 * with the authenticated signature seal, and enqueues the customer INVOICE_AVAILABLE email.
 */
export async function recordInvoicePhysicalSignatureConfirmation(
  orderIdOrNumber: string,
  staffIdentifier: string
): Promise<InvoiceRecord | null> {
  const now = new Date();

  // 1. Locate the existing invoice
  let invoice = await findExistingInvoiceForOrder(orderIdOrNumber, orderIdOrNumber);
  if (!invoice) {
    for (const inv of DEV_INVOICES_STORE.values()) {
      if (
        inv.orderId === orderIdOrNumber ||
        inv.orderNumber === orderIdOrNumber ||
        inv.invoiceNumber === orderIdOrNumber
      ) {
        invoice = inv;
        break;
      }
    }
  }

  if (!invoice) {
    return null;
  }

  // 2. Update signature confirmation metadata
  invoice.physicalSignatureConfirmedBy = staffIdentifier;
  invoice.physicalSignatureConfirmedAt = now;
  invoice.updatedAt = now;

  // 3. Regenerate customer-facing PDF containing the authenticated signature seal
  const order = await fetchOrderForInvoicing(invoice.orderNumber);
  const sellerConfig = await getSellerConfig();
  let storageFileKey = invoice.pdfStorageKey;
  const safeFilename = `${invoice.invoiceNumber.replace(/[\/\\]/g, '_')}.pdf`;

  if (order) {
    const formattedInvoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const isIntraState = order.destinationStateCode === sellerConfig.stateCode;
    const shippingTotalPaise = Number(order.shippingTotalPaise || 0);
    const shippingTaxablePaise = Math.round(shippingTotalPaise / 1.18);
    const shippingGstPaise = shippingTotalPaise - shippingTaxablePaise;

    const finalPdfData: TaxInvoicePdfData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: formattedInvoiceDate,
      orderNumber: invoice.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      isSample: invoice.isSample,
      seller: sellerConfig,
      customer: {
        name: invoice.customerName,
        email: invoice.customerEmail,
        phone: invoice.customerPhone,
        gstin: invoice.customerGstin,
      },
      billingAddress: invoice.billingAddress,
      shippingAddress: invoice.shippingAddress,
      placeOfSupply: invoice.placeOfSupply,
      isInterState: !isIntraState,
      items: invoice.itemsJson,
      subtotalTaxablePaise: invoice.itemsSubtotalPaise,
      totalCgstPaise: invoice.cgstPaise,
      totalSgstPaise: invoice.sgstPaise,
      totalIgstPaise: invoice.igstPaise,
      shippingTaxablePaise,
      shippingGstPaise,
      discountPaise: invoice.discountTotalPaise,
      totalTaxPaise: invoice.taxTotalPaise,
      grandTotalPaise: invoice.grandTotalPaise,
      paymentMethod: order.paymentMethod || 'PREPAID',
      eInvoiceStatus: invoice.eInvoiceStatus,
      irn: invoice.irn,
      signedQrData: invoice.signedQrData,
      rule46Declaration: invoice.rule46Declaration,
      signatureMode: invoice.signatureMode,
      digitalSignatureDetails: null,
      physicalSignatureConfirmedBy: staffIdentifier,
      physicalSignatureConfirmedAt: now,
    };

    const finalPdfBuffer = generateTaxInvoicePdf(finalPdfData);
    const storageResult = await privateStorageService.storePrivateDocument(
      finalPdfBuffer,
      safeFilename,
      'application/pdf',
      'invoices'
    );
    storageFileKey = storageResult.fileKey;
    invoice.pdfStorageKey = storageFileKey;
    invoice.pdfGeneratedAt = now;
  }

  // 4. Update in-memory fallback stores
  DEV_INVOICES_STORE.set(invoice.id, invoice);
  DEV_INVOICES_STORE.set(invoice.invoiceNumber, invoice);
  DEV_INVOICES_STORE.set(`order:${invoice.orderNumber}`, invoice);

  // 5. Update database
  try {
    await prisma.invoice.updateMany({
      where: {
        OR: [
          { orderId: orderIdOrNumber },
          { orderNumber: orderIdOrNumber },
          { invoiceNumber: orderIdOrNumber },
        ],
      },
      data: {
        physicalSignatureConfirmedBy: staffIdentifier,
        physicalSignatureConfirmedAt: now,
        pdfStorageKey: storageFileKey,
        pdfGeneratedAt: now,
      },
    });
  } catch {
    // DB offline fallback
  }

  // 6. Enqueue the customer INVOICE_AVAILABLE email now that the final signed invoice is ready
  if (storageFileKey) {
    await sendInvoiceAvailableEmail(invoice, sellerConfig, safeFilename, storageFileKey);
  }

  return invoice;
}
