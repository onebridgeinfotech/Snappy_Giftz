import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import {
  CartItemInput,
  calculateCartPricing,
  PricingValidationError,
  CartPricingQuote,
  isWoodenCrateSurchargeApproved,
} from '@/lib/pricing/pricing.service';
import {
  isValidIndianPincode,
  resolveStateCode,
  checkPincodeServiceability,
} from '@/lib/shipping/pincode.service';
import {
  isStorefrontFallbackAllowed,
  CatalogDatabaseError,
} from '@/lib/catalog/public-catalog.service';
import { INITIAL_PRODUCTS } from '@/data/initialData';
import {
  DEV_PERSONALIZATION_STORE,
  DEV_ARTWORK_UPLOADS_STORE,
  generateCustomerProofPngBuffer,
  createArtworkUploadRecord,
  getArtworkRecord,
} from '@/lib/personalization/personalization.service';
import { privateStorageService } from '@/services/storage/private-storage.service';
import { enqueueTransactionalEmail } from '@/lib/email/email-outbox.service';
import { renderOwnerNewOrderTemplate } from '@/lib/email/email-templates';
import { getSellerConfig } from '@/lib/invoices/seller-config.service';
import {
  validateAndDecodeProofDataUrl as validateProofDataUrlInternal,
  DecodedProofPng,
} from '@/lib/personalization/proof-validator';

export interface ShippingAddressInput {
  name: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  company?: string;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  gstin?: string;
  shippingAddress: ShippingAddressInput;
  items: CartItemInput[];
  paymentMethod: string;
  userId?: string;
  // organizationId removed
  idempotencyKey?: string;
}

export interface SanitizedOrderResult {
  id: string;
  orderNumber: string;
  userId?: string | null;
  type?: string;
  gstin?: string | null;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  destinationStateCode: string;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    hsnCode: string;
    taxRatePercent: number;
    unitPricePaise: number;
    quantity: number;
    subtotalPaise: number;
    customizationNote?: string | null;
    proofImageUrl?: string | null;
    customizationMeta?: any | null;
    personalization?: {
      id: string;
      orderItemId: string;
      personalizationType: string;
      engravedText?: string | null;
      fontFamily?: string | null;
      giftNote?: string | null;
      ribbonColor?: string | null;
      boxWrapStyle?: string | null;
      waxSealColor?: string | null;
      proofImageUrl?: string | null;
      proofVersion: number;
      customerApprovalStatus: string;
      customerApprovedAt?: string | null;
      customerApprovedBy?: string | null;
      staffReviewStatus: string;
      staffReviewedAt?: string | null;
    } | null;
  }>;
  itemsSubtotalPaise: number;
  taxTotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  shippingTotalPaise: number;
  grandTotalPaise: number;
  reservationExpiresAt: string;
  cancellationReason?: string | null;
  guestLookupToken: string;
  createdAt: string;
  shipment?: {
    carrierPartner: string | null;
    awbNumber: string | null;
    trackingUrl: string | null;
    dispatchStatus: string;
    dispatchedAt: string | null;
    deliveredAt: string | null;
  } | null;
}

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

export class InsufficientStockError extends Error {
  constructor(productName: string, available: number, requested: number) {
    super(
      `Insufficient inventory for "${productName}". Requested: ${requested}, Available in stock: ${available}.`
    );
    this.name = 'InsufficientStockError';
  }
}

// In-memory development store when PostgreSQL is not yet provisioned locally
export const DEV_ORDERS_STORE: Map<string, SanitizedOrderResult> = new Map();
export const DEV_IDEMPOTENCY_STORE: Map<string, string> = new Map();

/**
 * Validate customer contact and shipping address details.
 */
export function validateOrderInput(input: CreateOrderInput) {
  if (!input) throw new OrderValidationError('Order payload cannot be empty.');

  const name = input.customerName?.trim();
  if (!name || name.length < 2 || name.length > 100) {
    throw new OrderValidationError('Customer name must be between 2 and 100 characters.');
  }

  const email = input.customerEmail?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OrderValidationError('Please provide a valid customer email address.');
  }

  const phone = input.customerPhone?.trim().replace(/[\s\-]/g, '');
  if (!phone || !/^(?:\+91)?[6-9]\d{9}$/.test(phone)) {
    throw new OrderValidationError('Please provide a valid 10-digit Indian mobile number.');
  }

  const addr = input.shippingAddress;
  if (!addr) throw new OrderValidationError('Shipping address is required.');

  if (!addr.street?.trim() || addr.street.trim().length > 200) {
    throw new OrderValidationError('Street address is required and must not exceed 200 characters.');
  }
  if (!addr.city?.trim() || addr.city.trim().length > 100) {
    throw new OrderValidationError('City is required and must not exceed 100 characters.');
  }
  if (!addr.state?.trim()) {
    throw new OrderValidationError('State is required.');
  }

  if (!isValidIndianPincode(addr.pincode)) {
    throw new OrderValidationError('Please provide a valid 6-digit Indian delivery PIN code.');
  }

  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new OrderValidationError('Order must contain at least one item.');
  }

  for (const item of input.items) {
    if (
      item.customization?.boxWrapStyle &&
      item.customization.boxWrapStyle.toLowerCase().includes('wooden') &&
      !isWoodenCrateSurchargeApproved()
    ) {
      throw new OrderValidationError(
        'Cannot create order: Vintage Wooden Keepsake Crate packaging is unavailable pending store owner price approval.'
      );
    }

    // Reject personalized order without a required proof
    if (item.customization?.requireProof === true && !item.customization.clientProofDataUrl) {
      throw new OrderValidationError(
        'Personalized order item requires a valid customer preview proof snapshot from the personalization studio.'
      );
    }

    // Strictly validate client proof data URL if supplied
    if (item.customization?.clientProofDataUrl !== undefined && item.customization.clientProofDataUrl !== null) {
      validateAndDecodeProofDataUrl(item.customization.clientProofDataUrl);
    }
  }

  const paymentMethod = input.paymentMethod?.trim();
  if (!paymentMethod) {
    throw new OrderValidationError('Payment method must be specified.');
  }
}

/**
 * Strictly validates and decodes a client-supplied proof PNG data URL.
 * Delegates to proof-validator using OrderValidationError for full backwards-compatibility.
 */
export function validateAndDecodeProofDataUrl(dataUrl: unknown): DecodedProofPng {
  return validateProofDataUrlInternal(dataUrl, OrderValidationError);
}

/**
 * Resolves or generates the distinct customer preview proof asset for an order item.
 * Supports:
 * 1. Customer-facing preview canvas export (PNG base64 data URL) capturing natively decoded
 *    artwork (JPEG/PNG/WebP) and exact typography.
 * 2. High-fidelity server-side rasterized proof asset fallback (explicitly marked as unapproved).
 * Strictly isolates proof under `storage/private/proofs/` with a unique versioned key.
 * Original customer artwork is preserved separately under `customer-artwork/`.
 */
async function resolveOrderItemProof(
  itemId: string,
  line: any,
  custom: any,
  userId: string | null,
  guestToken: string | null
): Promise<{ proofUrl: string | null; proofAssetKey: string | null; isCustomerApprovedProof: boolean }> {
  if (!custom) return { proofUrl: null, proofAssetKey: null, isCustomerApprovedProof: false };

  const hasCustom =
    line.customizationFeePaise > 0 ||
    !!(custom.engravedText || custom.giftNote || custom.artworkUploadId || custom.note);
  if (!hasCustom) return { proofUrl: null, proofAssetKey: null, isCustomerApprovedProof: false };

  const version = custom.proofVersion || 1;

  // Case A: Customer preview canvas export provided
  if (custom.clientProofDataUrl !== undefined && custom.clientProofDataUrl !== null) {
    // Strictly validate and decode preview PNG. Rejects malformed or oversized content.
    const { buffer: proofBuffer } = validateAndDecodeProofDataUrl(custom.clientProofDataUrl);

    // Secure versioned key preventing arbitrary client path or filename injection
    const uniqueKey = `proof-${itemId}-v${version}-${crypto.randomBytes(6).toString('hex')}.png`;
    const proofUpload = await privateStorageService.storePrivateUpload(
      proofBuffer,
      uniqueKey,
      'image/png',
      'proofs'
    );
    const proofRecord = await createArtworkUploadRecord(proofUpload, {
      userId,
      guestToken,
    });
    return {
      proofUrl: `/api/personalization/uploads/${proofRecord.id}/file`,
      proofAssetKey: proofUpload.fileKey,
      isCustomerApprovedProof: true,
    };
  }

  // Case B: Client proof is missing
  if (custom.requireProof === true) {
    throw new OrderValidationError(
      'Personalized order item requires a valid customer preview proof snapshot from the personalization studio.'
    );
  }

  // Otherwise: Generate versioned server-side reference proof asset as fallback.
  // Note: Fallback proof CANNOT be automatically marked as customer approved!
  try {
    let artworkBuffer: Buffer | null = null;
    if (custom.artworkUploadId) {
      const art = await getArtworkRecord(custom.artworkUploadId);
      if (art?.fileKey) {
        artworkBuffer = await privateStorageService.getPrivateFileBuffer(art.fileKey).catch(() => null);
      }
    }

    const proofBuffer = generateCustomerProofPngBuffer({
      productName: line.productName,
      variantName: line.variantName,
      engravedText: custom.engravedText,
      fontFamily: custom.fontFamily,
      giftNote: custom.giftNote,
      ribbonColor: custom.ribbonColor,
      boxWrapStyle: custom.boxWrapStyle,
      hasArtwork: !!custom.artworkUploadId,
      artworkBuffer,
      cropSettings: custom.cropSettings,
      placementSettings: custom.placementSettings,
      version,
    });

    const uniqueKey = `proof-${itemId}-v${version}-${crypto.randomBytes(6).toString('hex')}.png`;
    const proofUpload = await privateStorageService.storePrivateUpload(
      proofBuffer,
      uniqueKey,
      'image/png',
      'proofs'
    );
    const proofRecord = await createArtworkUploadRecord(proofUpload, {
      userId,
      guestToken,
    });
    return {
      proofUrl: `/api/personalization/uploads/${proofRecord.id}/file`,
      proofAssetKey: proofUpload.fileKey,
      isCustomerApprovedProof: false, // Inaccurate fallback proof CANNOT be approved automatically!
    };
  } catch {
    return {
      proofUrl: custom.artworkUploadId ? `/api/personalization/uploads/${custom.artworkUploadId}/file` : null,
      proofAssetKey: null,
      isCustomerApprovedProof: false,
    };
  }
}

/**
 * Authoritatively create an order, reserve inventory stock for 15 minutes,
 * and record immutable audit ledger entries in a database transaction.
 */
export async function createOrder(input: CreateOrderInput): Promise<SanitizedOrderResult> {
  validateOrderInput(input);

  const cleanEmail = input.customerEmail.trim().toLowerCase();
  const cleanPhone = input.customerPhone.trim();
  const destinationStateCode = resolveStateCode(input.shippingAddress.state);

  // 1. Idempotency Guard: prevent duplicate orders on network retries
  if (input.idempotencyKey) {
    const cleanKey = input.idempotencyKey.trim();
    if (cleanKey) {
      try {
        const existingOrder = await prisma.order.findUnique({
          where: { idempotencyKey: cleanKey },
          include: { items: true },
        });

        if (existingOrder) {
          return formatOrderResponse(existingOrder);
        }
      } catch {
        if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
          throw new CatalogDatabaseError('Database offline during idempotency check.');
        }
        // Dev fallback check
        const existingOrderNum = DEV_IDEMPOTENCY_STORE.get(cleanKey);
        if (existingOrderNum && DEV_ORDERS_STORE.has(existingOrderNum)) {
          return DEV_ORDERS_STORE.get(existingOrderNum)!;
        }
      }
    }
  }

  // 2. Authoritative Price Recalculation on the Server
  const pricing: CartPricingQuote = await calculateCartPricing(input.items, destinationStateCode);

  // 3. Generate Order Identifiers and 15-Minute Expiry
  const currentYear = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const orderNumber = `SG-${currentYear}-${randomSuffix}`;
  const guestLookupToken = crypto.randomUUID();
  const isCodOrder = input.paymentMethod?.toUpperCase() === 'COD';
  const reservationExpiresAt = isCodOrder ? new Date(Date.now() + 24 * 60 * 60 * 1000) : new Date(Date.now() + 15 * 60 * 1000);

  // 4. Transactional Order Creation & Concurrency-Safe Stock Reservation
  let resolvedProofs: Array<{ proofUrl: string | null; proofAssetKey: string | null; isCustomerApprovedProof: boolean }> = [];

  try {
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Step A: Inventory maintained manually by owner.
      // Do not reserve or deduct inventory when an order is placed.
      // Stock is deducted only upon successful DELIVERED status.

      // Step B: Resolve proofs for custom items before creating Order record
      resolvedProofs = await Promise.all(
        pricing.items.map((line, idx) => {
          const itemInput = input.items[idx];
          const custom = itemInput?.customization;
          const tempItemId = crypto.randomUUID();
          return resolveOrderItemProof(
            tempItemId,
            line,
            custom,
            input.userId || null,
            guestLookupToken
          );
        })
      );

      // Step C: Create Order record
      const order = await tx.order.create({
        data: {
          orderNumber,
                    userId: input.userId || null,
                    customerName: input.customerName.trim(),
          customerEmail: cleanEmail,
          customerPhone: cleanPhone,
          gstin: input.gstin?.trim() || null,
          shippingAddress: input.shippingAddress as any,
          shippingPincode: input.shippingAddress.pincode,
          destinationStateCode,
          itemsSubtotalPaise: BigInt(pricing.itemsSubtotalPaise),
          customizationTotalPaise: BigInt(pricing.customizationTotalPaise),
          discountTotalPaise: BigInt(pricing.discountTotalPaise),
          taxableAmountPaise: BigInt(pricing.taxableAmountPaise),
          taxTotalPaise: BigInt(pricing.taxTotalPaise),
          cgstPaise: BigInt(pricing.cgstPaise),
          sgstPaise: BigInt(pricing.sgstPaise),
          igstPaise: BigInt(pricing.igstPaise),
          shippingTotalPaise: BigInt(pricing.shippingTotalPaise),
          grandTotalPaise: BigInt(pricing.grandTotalPaise),
          orderStatus: input.paymentMethod.toUpperCase() === 'COD' ? 'PENDING_COD_CONFIRMATION' : 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: input.paymentMethod,
          idempotencyKey: input.idempotencyKey?.trim() || null,
          reservationExpiresAt,
          guestLookupToken,
          items: {
            create: pricing.items.map((line, idx) => {
              const itemInput = input.items[idx];
              const custom = itemInput?.customization;
              const hasCustom = line.customizationFeePaise > 0 || !!(custom?.engravedText || custom?.giftNote || custom?.artworkUploadId || custom?.note);
              const customNote = custom?.note || (custom?.engravedText ? `Engrave: ${custom.engravedText} (${custom.fontFamily || 'Calligraphy Romance'})` : null);
              const { proofUrl, proofAssetKey, isCustomerApprovedProof } = resolvedProofs[idx];
              const isCustomerApproved = Boolean(custom?.proofApproved && isCustomerApprovedProof);

              return {
                variantId: line.variantId || null,
                productName: line.productName,
                sku: line.sku,
                hsnCode: line.hsnCode,
                taxRatePercent: line.taxRatePercent,
                unitPricePaise: line.unitPricePaise,
                quantity: line.quantity,
                subtotalPaise: BigInt(line.lineSubtotalPaise),
                isCustomized: hasCustom,
                customizationNote: customNote,
                customizationFeePaise: line.customizationFeePaise,
                proofImageUrl: proofUrl,
                customizationMeta: custom ? {
                  personalizationType: custom.personalizationType || 'TEXT_ENGRAVING',
                  engravedText: custom.engravedText || null,
                  fontFamily: custom.fontFamily || null,
                  giftNote: custom.giftNote || null,
                  ribbonColor: custom.ribbonColor || null,
                  boxWrapStyle: custom.boxWrapStyle || null,
                  waxSealColor: custom.waxSealColor || null,
                  artworkUploadId: custom.artworkUploadId || null,
                  cropSettings: custom.cropSettings || null,
                  placementSettings: custom.placementSettings || null,
                  proofVersion: custom.proofVersion || 1,
                  proofApproved: isCustomerApproved,
                  proofSource: isCustomerApprovedProof ? 'CLIENT_PREVIEW_CANVAS' : 'SERVER_FALLBACK_REFERENCE',
                } : null,
                personalization: hasCustom ? {
                  create: {
                    personalizationType: custom?.personalizationType || 'TEXT_ENGRAVING',
                    engravedText: custom?.engravedText || null,
                    fontFamily: custom?.fontFamily || null,
                    giftNote: custom?.giftNote || null,
                    ribbonColor: custom?.ribbonColor || null,
                    boxWrapStyle: custom?.boxWrapStyle || null,
                    waxSealColor: custom?.waxSealColor || null,
                    artworkUploadId: custom?.artworkUploadId || null,
                    cropSettings: custom?.cropSettings ? JSON.parse(JSON.stringify(custom.cropSettings)) : null,
                    placementSettings: custom?.placementSettings ? JSON.parse(JSON.stringify(custom.placementSettings)) : null,
                    proofImageUrl: proofUrl,
                    proofVersion: custom?.proofVersion || 1,
                    approvalStatus: isCustomerApproved ? 'APPROVED_BY_CUSTOMER' : 'DRAFT',
                    approvedAt: isCustomerApproved ? new Date() : null,
                    approvedBy: isCustomerApproved ? cleanEmail : null,
                    customerApprovalStatus: isCustomerApproved ? 'APPROVED' : 'PENDING',
                    customerApprovedAt: isCustomerApproved ? new Date() : null,
                    customerApprovedBy: isCustomerApproved ? cleanEmail : null,
                    staffReviewStatus: 'PENDING_REVIEW',
                    customizationFeePaise: line.customizationFeePaise,
                    metadata: {
                      craftingLocation: 'SNAPPY GIFTZ Central Atelier',
                      laserResolution: '0.05mm',
                      productName: line.productName,
                      variantName: line.variantName || 'Standard Edition',
                      proofSource: isCustomerApprovedProof ? 'CLIENT_PREVIEW_CANVAS' : 'SERVER_FALLBACK_REFERENCE',
                      requiresCustomerProof: !isCustomerApprovedProof,
                      proofApprovalStatus: isCustomerApproved ? 'APPROVED' : 'PENDING_CUSTOMER_PROOF',
                    },
                  },
                } : undefined,
              };
            }),
          },
          statusHistory: {
            create: {
              fromStatus: 'PENDING',
              toStatus: 'PENDING',
              changedBy: cleanEmail,
              notes: 'Order initiated with 15-minute inventory reservation',
            },
          },
        },
        include: {
          items: {
            include: {
              personalization: true,
            },
          },
        },
      });

      return order;
    });

    const formatted = formatOrderResponse(createdOrder);
    notifyOwnerOfNewOrder(formatted, input).catch(() => {});
    return formatted;
  } catch (err: any) {
    // If order reservation or transaction failed, clean up any uncommitted proof files
    if (
      err instanceof InsufficientStockError ||
      err instanceof OrderValidationError ||
      process.env.NODE_ENV === 'production' ||
      !isStorefrontFallbackAllowed()
    ) {
      for (const p of resolvedProofs) {
        if (p?.proofAssetKey) {
          await privateStorageService.deletePrivateFile(p.proofAssetKey).catch(() => {});
        }
      }
    }

    if (err instanceof InsufficientStockError || err instanceof OrderValidationError) {
      throw err;
    }

    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError(
        'Database transaction failed during order creation. Orders cannot be created in production without durable PostgreSQL persistence.'
      );
    }

    // Development/test transactional fallback
    const devOrder: SanitizedOrderResult = {
      id: `dev-ord-${randomSuffix}`,
      orderNumber,
      userId: input.userId || null,
      orderStatus: input.paymentMethod?.toUpperCase() === 'COD' ? 'PENDING_COD_CONFIRMATION' : 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: input.paymentMethod,
      customerName: input.customerName.trim(),
      customerEmail: cleanEmail,
      customerPhone: cleanPhone,
      destinationStateCode,
      items: await Promise.all(
        pricing.items.map(async (l, idx) => {
          const itemInput = input.items[idx];
          const custom = itemInput?.customization;
          const customNote = custom?.note || (custom?.engravedText ? `Engrave: ${custom.engravedText} (${custom.fontFamily || 'Calligraphy Romance'})` : null);
          const itemId = `dev-item-${orderNumber}-${idx}`;
          let proofUrl: string | null = null;
          let proofAssetKey: string | null = null;

          if (custom) {
            if (custom.artworkUploadId && DEV_ARTWORK_UPLOADS_STORE.has(custom.artworkUploadId)) {
              const art = DEV_ARTWORK_UPLOADS_STORE.get(custom.artworkUploadId)!;
              art.status = 'ATTACHED';
              DEV_ARTWORK_UPLOADS_STORE.set(custom.artworkUploadId, art);
            }

            const resolved = await resolveOrderItemProof(
              itemId,
              l,
              custom,
              input.userId || null,
              guestLookupToken
            );
            proofUrl = resolved.proofUrl;
            proofAssetKey = resolved.proofAssetKey;
            const isCustomerApproved = Boolean(custom.proofApproved && resolved.isCustomerApprovedProof);

            DEV_PERSONALIZATION_STORE.set(itemId, {
              id: `pers-${itemId}`,
              orderItemId: itemId,
              personalizationType: custom.personalizationType || 'TEXT_ENGRAVING',
              engravedText: custom.engravedText || null,
              fontFamily: custom.fontFamily || null,
              giftNote: custom.giftNote || null,
              ribbonColor: custom.ribbonColor || null,
              boxWrapStyle: custom.boxWrapStyle || null,
              waxSealColor: custom.waxSealColor || null,
              artworkUploadId: custom.artworkUploadId || null,
              cropSettings: custom.cropSettings || null,
              placementSettings: custom.placementSettings || null,
              proofImageUrl: proofUrl,
              proofAssetKey,
              proofVersion: custom.proofVersion || 1,
              approvalStatus: isCustomerApproved ? 'APPROVED_BY_CUSTOMER' : 'DRAFT',
              approvedAt: isCustomerApproved ? new Date().toISOString() : null,
              approvedBy: isCustomerApproved ? cleanEmail : null,
              customerApprovalStatus: isCustomerApproved ? 'APPROVED' : 'PENDING',
              customerApprovedAt: isCustomerApproved ? new Date().toISOString() : null,
              customerApprovedBy: isCustomerApproved ? cleanEmail : null,
              staffReviewStatus: 'PENDING_REVIEW',
              staffReviewedAt: null,
              staffReviewedBy: null,
              customizationFeePaise: l.customizationFeePaise,
              staffNotes: null,
              metadata: {
                craftingLocation: 'SNAPPY GIFTZ Central Atelier',
                laserResolution: '0.05mm',
                productName: l.productName,
                variantName: l.variantName || 'Standard Edition',
                proofSource: resolved.isCustomerApprovedProof ? 'CLIENT_PREVIEW_CANVAS' : 'SERVER_FALLBACK_REFERENCE',
                requiresCustomerProof: !resolved.isCustomerApprovedProof,
                proofApprovalStatus: isCustomerApproved ? 'APPROVED' : 'PENDING_CUSTOMER_PROOF',
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          return {
            id: itemId,
            productName: l.productName,
            sku: l.sku,
            hsnCode: l.hsnCode,
            taxRatePercent: l.taxRatePercent,
            unitPricePaise: l.unitPricePaise,
            quantity: l.quantity,
            subtotalPaise: l.lineSubtotalPaise,
            customizationNote: customNote,
            proofImageUrl: proofUrl,
            customizationMeta: custom ? {
              personalizationType: custom.personalizationType || 'TEXT_ENGRAVING',
              engravedText: custom.engravedText || null,
              fontFamily: custom.fontFamily || null,
              giftNote: custom.giftNote || null,
              ribbonColor: custom.ribbonColor || null,
              boxWrapStyle: custom.boxWrapStyle || null,
              waxSealColor: custom.waxSealColor || null,
              artworkUploadId: custom.artworkUploadId || null,
              cropSettings: custom.cropSettings || null,
              placementSettings: custom.placementSettings || null,
              proofVersion: custom.proofVersion || 1,
              proofApproved: Boolean(custom.proofApproved && DEV_PERSONALIZATION_STORE.get(itemId)?.customerApprovalStatus === 'APPROVED'),
              proofSource: DEV_PERSONALIZATION_STORE.get(itemId)?.metadata?.proofSource || 'SERVER_FALLBACK_REFERENCE',
            } : null,
          };
        })
      ),
      itemsSubtotalPaise: pricing.itemsSubtotalPaise,
      taxTotalPaise: pricing.taxTotalPaise,
      cgstPaise: pricing.cgstPaise,
      sgstPaise: pricing.sgstPaise,
      igstPaise: pricing.igstPaise,
      shippingTotalPaise: pricing.shippingTotalPaise,
      grandTotalPaise: pricing.grandTotalPaise,
      reservationExpiresAt: reservationExpiresAt.toISOString(),
      guestLookupToken,
      createdAt: new Date().toISOString(),
    };

    DEV_ORDERS_STORE.set(orderNumber, devOrder);
    if (input.idempotencyKey) {
      DEV_IDEMPOTENCY_STORE.set(input.idempotencyKey.trim(), orderNumber);
    }

    notifyOwnerOfNewOrder(devOrder, input).catch(() => {});
    return devOrder;
  }
}

/**
 * Format Prisma database entity into a clean, JSON-serializable public response.
 */

async function notifyOwnerOfNewOrder(order: SanitizedOrderResult, rawInput: CreateOrderInput) {
  try {
    const seller = await getSellerConfig();
    const formattedDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const isCod = order.paymentMethod.toUpperCase() === 'COD';
    const emailData = renderOwnerNewOrderTemplate(seller, {
      orderNumber: order.orderNumber,
      orderDate: formattedDate,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      paymentMethod: isCod ? 'COD' : 'ONLINE',
      totalInr: `₹${(order.grandTotalPaise / 100).toFixed(2)}`,
      codAmountDueInr: isCod ? `₹${(order.grandTotalPaise / 100).toFixed(2)}` : undefined,
      shippingAddress: {
        fullName: rawInput.shippingAddress.name,
        addressLine1: rawInput.shippingAddress.street,
        city: rawInput.shippingAddress.city,
        state: rawInput.shippingAddress.state,
        postalCode: rawInput.shippingAddress.pincode,
        phone: rawInput.shippingAddress.phone,
      },
      items: order.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPriceInr: `₹${(i.unitPricePaise / 100).toFixed(2)}`,
        totalInr: `₹${(i.subtotalPaise / 100).toFixed(2)}`,
        isCustomized: Boolean(i.customizationNote || i.customizationMeta || i.proofImageUrl),
        customizationNote: i.customizationNote || undefined,
        customizationPhotosCount: i.customizationMeta?.artworkUploadId ? 1 : 0,
      })),
    });

    await enqueueTransactionalEmail({
      idempotencyKey: `email:owner_new_order:${order.orderNumber}`,
      eventType: 'OWNER_NEW_ORDER',
      orderId: order.id,
      orderNumber: order.orderNumber,
      recipientEmail: seller.contactEmail || 'orders@snappygiftz.com',
      recipientName: 'SNAPPY GIFTZ Operations',
      subject: emailData.subject,
      htmlBody: emailData.html,
      textBody: emailData.text,
    });
  } catch (err) {
    console.error(`[ORDER_NOTIFICATION] Failed to enqueue owner new order alert for #${order.orderNumber}:`, err);
  }
}

function formatOrderResponse(order: any): SanitizedOrderResult {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    destinationStateCode: order.destinationStateCode,
    items: order.items.map((item: any) => ({
      id: item.id,
      productName: item.productName,
      sku: item.sku,
      hsnCode: item.hsnCode,
      taxRatePercent: item.taxRatePercent,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      subtotalPaise: Number(item.subtotalPaise),
      customizationNote: item.customizationNote,
      proofImageUrl: item.proofImageUrl || (item.personalization?.proofImageUrl ?? null),
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
      } : null),
    })),
    itemsSubtotalPaise: Number(order.itemsSubtotalPaise),
    taxTotalPaise: Number(order.taxTotalPaise),
    cgstPaise: Number(order.cgstPaise || 0),
    sgstPaise: Number(order.sgstPaise || 0),
    igstPaise: Number(order.igstPaise || 0),
    shippingTotalPaise: Number(order.shippingTotalPaise || 0),
    grandTotalPaise: Number(order.grandTotalPaise),
    reservationExpiresAt: order.reservationExpiresAt
      ? new Date(order.reservationExpiresAt).toISOString()
      : '',
    guestLookupToken: order.guestLookupToken || '',
    createdAt: new Date(order.createdAt).toISOString(),
    shipment: order.shipments && order.shipments.length > 0 ? {
      carrierPartner: order.shipments[0].carrierPartner || null,
      awbNumber: order.shipments[0].awbNumber || null,
      trackingUrl: order.shipments[0].trackingUrl || null,
      dispatchStatus: order.shipments[0].dispatchStatus || 'PENDING',
      dispatchedAt: order.shipments[0].dispatchedAt ? new Date(order.shipments[0].dispatchedAt).toISOString() : null,
      deliveredAt: order.shipments[0].deliveredAt ? new Date(order.shipments[0].deliveredAt).toISOString() : null,
    } : (order.shipment || null),
  };
}
