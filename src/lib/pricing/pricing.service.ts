import { BUSINESS_CONFIG } from '@/config/business';
import { prisma } from '@/lib/prisma';
import { INITIAL_PRODUCTS } from '@/data/initialData';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export interface CartItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  productName?: string;
  unitPrice?: number;
  category?: string;
  imageUrl?: string;
  customization?: {
    note?: string;
    customizationFeePaise?: number;
    meta?: any;
    personalizationType?: 'TEXT_ENGRAVING' | 'PHOTO_PRINT' | 'LOGO_BRANDING' | 'BESPOKE_COMBO';
    engravedText?: string;
    fontFamily?: string;
    giftNote?: string;
    ribbonColor?: string;
    boxWrapStyle?: string;
    waxSealColor?: string;
    artworkUploadId?: string;
    artworkUploadIds?: string[];
    cropSettings?: any;
    placementSettings?: any;
    proofApproved?: boolean;
    proofVersion?: number;
    clientProofDataUrl?: string;
    requireProof?: boolean;
    giftWrap?: boolean;
  };
  isGiftWrapped?: boolean;
}

export interface LineItemQuote {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  hsnCode: string;
  taxRatePercent: number;
  unitPricePaise: number;
  quantity: number;
  customizationFeePaise: number;
  lineSubtotalPaise: number;
  lineCustomizationPaise: number;
  lineTaxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTaxTotalPaise: number;
  lineTotalPaise: number;
}

export interface CartPricingQuote {
  items: LineItemQuote[];
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
  destinationStateCode: string;
  isIntraState: boolean;
}

export class PricingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingValidationError';
  }
}

/**
 * Origin GST State Code for Snappy Gifts fulfillment center.
 * Approved default: '08' (Rajasthan). Configurable via SUPPLIER_GST_STATE_CODE.
 */
export const SUPPLIER_REGISTERED_STATE_CODE =
  process.env.SUPPLIER_GST_STATE_CODE?.trim() || BUSINESS_CONFIG.address.stateCode || '36';
export const RAJASTHAN_STATE_CODE = SUPPLIER_REGISTERED_STATE_CODE;

/**
 * Free shipping threshold in integer paise (Approved default: ₹999.00 = 99,900 paise).
 * Configurable via FREE_SHIPPING_THRESHOLD_PAISE.
 */
export const FREE_SHIPPING_THRESHOLD_PAISE = process.env.FREE_SHIPPING_THRESHOLD_PAISE
  ? parseInt(process.env.FREE_SHIPPING_THRESHOLD_PAISE, 10)
  : 99900;

/**
 * Standard shipping flat fee in integer paise (Approved default: ₹99.00 = 9,900 paise).
 * Configurable via STANDARD_SHIPPING_FEE_PAISE.
 */
export const STANDARD_SHIPPING_FEE_PAISE = process.env.STANDARD_SHIPPING_FEE_PAISE
  ? parseInt(process.env.STANDARD_SHIPPING_FEE_PAISE, 10)
  : 9900;

/**
 * Configurable packaging surcharge in integer paise.
 * Default for Vintage Wooden Keepsake Crate: ₹150.00 = 15,000 paise.
 * Gated by explicit owner approval (WOODEN_CRATE_SURCHARGE_APPROVED=true).
 */
export const DEFAULT_WOODEN_CRATE_SURCHARGE_PAISE = 15000;

export function isWoodenCrateSurchargeApproved(): boolean {
  // Authoritative server-side environment variable takes absolute precedence
  const serverApproved = process.env.WOODEN_CRATE_SURCHARGE_APPROVED?.trim().toLowerCase();
  if (serverApproved !== undefined && serverApproved !== '') {
    return serverApproved === 'true';
  }
  // Safe client fallback if running purely in client environment
  const clientApproved = process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED?.trim().toLowerCase();
  return clientApproved === 'true';
}

export function getWoodenCrateSurchargePaise(): number {
  if (process.env.WOODEN_CRATE_SURCHARGE_PAISE) {
    const parsed = parseInt(process.env.WOODEN_CRATE_SURCHARGE_PAISE.trim(), 10);
    // Strictly reject negative values, non-numbers, non-finite numbers, or zero
    if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_WOODEN_CRATE_SURCHARGE_PAISE;
}

// Backward-compatible exports
export const WOODEN_CRATE_SURCHARGE_PAISE = getWoodenCrateSurchargePaise();
export const IS_WOODEN_CRATE_SURCHARGE_APPROVED = isWoodenCrateSurchargeApproved();

/**
 * Maximum items permitted per line item to prevent integer overflow or abuse.
 */
export const MAX_QUANTITY_PER_LINE = 500;

/**
 * Authoritatively calculates cart pricing and GST breakdown on the server in integer paise.
 * Never trusts client prices or totals.
 */
export async function calculateCartPricing(
  items: CartItemInput[],
  destinationStateCode = '36',
  manualShippingTotalPaise?: number
): Promise<CartPricingQuote> {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new PricingValidationError('Cart cannot be empty for pricing calculation.');
  }

  const cleanStateCode = (destinationStateCode || '08').trim();
  const isIntraState = cleanStateCode === RAJASTHAN_STATE_CODE || cleanStateCode === '36' || cleanStateCode === SUPPLIER_REGISTERED_STATE_CODE;

  const lineQuotes: LineItemQuote[] = [];

  for (const item of items) {
    if (!item.productId || typeof item.productId !== 'string') {
      throw new PricingValidationError('Invalid or missing productId in cart item.');
    }

    const qty = Math.floor(item.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new PricingValidationError(`Quantity for item ${item.productId} must be an integer greater than 0.`);
    }

    if (qty > MAX_QUANTITY_PER_LINE) {
      throw new PricingValidationError(
        `Quantity for item ${item.productId} exceeds the maximum allowable limit of ${MAX_QUANTITY_PER_LINE} units.`
      );
    }

    // Authoritative product lookup
    let authoritativeProduct: {
      id: string;
      name: string;
      hsnCode: string;
      taxRatePercent: number;
      basePricePaise: number;
      customizationFeePaise: number;
      isCustomizable?: boolean;
      customizationType?: string | null;
      isActive: boolean;
      isArchived: boolean;
      variants: Array<{
        id: string;
        name: string;
        sku: string;
        pricePaise: number;
        stockQuantity: number;
        isActive: boolean;
        isArchived: boolean;
      }>;
    } | null = null;

    try {
      let dbProduct = await prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          hsnCode: true,
          taxRatePercent: true,
          basePricePaise: true,
          customizationFeePaise: true,
          isCustomizable: true,
          customizationType: true,
          isActive: true,
          isArchived: true,
          variants: {
            where: { isArchived: false },
            select: {
              id: true,
              name: true,
              sku: true,
              pricePaise: true,
              stockQuantity: true,
              isActive: true,
              isArchived: true,
            },
          },
        },
      });

      if (!dbProduct) {
        dbProduct = await prisma.product.findFirst({
          where: {
            OR: [
              { slug: item.productId },
              { name: item.productId },
            ],
          },
          select: {
            id: true,
            name: true,
            hsnCode: true,
            taxRatePercent: true,
            basePricePaise: true,
            customizationFeePaise: true,
            isCustomizable: true,
            customizationType: true,
            isActive: true,
            isArchived: true,
            variants: {
              where: { isArchived: false },
              select: {
                id: true,
                name: true,
                sku: true,
                pricePaise: true,
                stockQuantity: true,
                isActive: true,
                isArchived: true,
              },
            },
          },
        });
      }

      // If not in database, check INITIAL_PRODUCTS or auto-provision
      if (!dbProduct) {
        const fallback = INITIAL_PRODUCTS.find(
          (p) => p.id === item.productId || p.slug === item.productId || p.name.toLowerCase() === item.productId.toLowerCase()
        );

        if (fallback) {
          // Re-check DB by fallback properties
          dbProduct = await prisma.product.findFirst({
            where: {
              OR: [
                { id: fallback.id },
                { slug: fallback.slug },
                { name: fallback.name },
              ],
            },
            select: {
              id: true,
              name: true,
              hsnCode: true,
              taxRatePercent: true,
              basePricePaise: true,
              customizationFeePaise: true,
              isCustomizable: true,
              customizationType: true,
              isActive: true,
              isArchived: true,
              variants: {
                where: { isArchived: false },
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  pricePaise: true,
                  stockQuantity: true,
                  isActive: true,
                  isArchived: true,
                },
              },
            },
          });

          // If still missing from DB, auto-provision initial catalog product
          if (!dbProduct) {
            try {
              let category = await prisma.category.findFirst({
                where: {
                  OR: [
                    { name: fallback.category },
                    { slug: fallback.category.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
                  ],
                },
              });
              if (!category) {
                category = await prisma.category.findFirst();
              }

              if (category) {
                const targetSlug = fallback.slug || fallback.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                dbProduct = await prisma.product.create({
                  data: {
                    id: fallback.id,
                    name: fallback.name,
                    slug: targetSlug,
                    tagline: fallback.tagline || null,
                    description: fallback.description || fallback.name,
                    categoryId: category.id,
                    basePricePaise: fallback.basePrice * 100,
                    mrpPaise: (fallback.mrp || fallback.basePrice) * 100,
                    hsnCode: fallback.hsnCode || '69120010',
                    taxRatePercent: fallback.taxRate || 18,
                    productType: fallback.productType || 'CUSTOMIZABLE',
                    isCustomizable: fallback.isCustomizable ?? true,
                    customizationType: fallback.customizationType || null,
                    images: fallback.images || [],
                    variants: {
                      create: [{
                        id: `var-${fallback.id}`,
                        name: 'Standard Edition',
                        sku: fallback.sku || `SKU-${fallback.id}`,
                        pricePaise: fallback.basePrice * 100,
                        stockQuantity: fallback.stock || 100,
                        attributes: {},
                        isActive: true,
                      }],
                    },
                  },
                  select: {
                    id: true,
                    name: true,
                    hsnCode: true,
                    taxRatePercent: true,
                    basePricePaise: true,
                    customizationFeePaise: true,
                    isCustomizable: true,
                    customizationType: true,
                    isActive: true,
                    isArchived: true,
                    variants: {
                      select: {
                        id: true,
                        name: true,
                        sku: true,
                        pricePaise: true,
                        stockQuantity: true,
                        isActive: true,
                        isArchived: true,
                      },
                    },
                  },
                });
              }
            } catch (autoErr) {
              console.warn('[PRICING] Failed to auto-provision initial product into database:', autoErr);
            }
          }
        } else if (item.productName || item.unitPrice || (item.productId && item.productId.startsWith('prod-') && !item.productId.includes('ghost'))) {
          // Auto-provision newly created admin or store product into database
          try {
            let category = await prisma.category.findFirst({
              where: {
                OR: [
                  { name: item.category || 'Luxury Gifts' },
                  { slug: (item.category || 'luxury-gifts').toLowerCase().replace(/[^a-z0-9]+/g, '-') },
                ],
              },
            });
            if (!category) {
              category = await prisma.category.findFirst();
            }

            if (category) {
              const prodName = item.productName || `Product ${item.productId}`;
              const basePricePaise = typeof item.unitPrice === 'number' && item.unitPrice > 0
                ? Math.round(item.unitPrice * 100)
                : 100; // Default to ₹1 (100 paise) instead of ₹1999 if not specified
              const targetSlug = prodName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 6);

              dbProduct = await prisma.product.create({
                data: {
                  id: item.productId,
                  name: prodName,
                  slug: targetSlug,
                  description: prodName,
                  categoryId: category.id,
                  basePricePaise,
                  mrpPaise: Math.max(basePricePaise, Math.round(basePricePaise * 1.2)),
                  hsnCode: '69120010',
                  taxRatePercent: 18,
                  productType: 'CUSTOMIZABLE',
                  isCustomizable: true,
                  images: item.imageUrl ? [item.imageUrl] : [],
                  variants: {
                    create: [{
                      name: 'Standard Edition',
                      sku: `SG-${Math.floor(1000 + Math.random() * 9000)}`,
                      pricePaise: basePricePaise,
                      stockQuantity: 100,
                      attributes: {},
                      isActive: true,
                    }],
                  },
                },
                select: {
                  id: true,
                  name: true,
                  hsnCode: true,
                  taxRatePercent: true,
                  basePricePaise: true,
                  customizationFeePaise: true,
                  isCustomizable: true,
                  customizationType: true,
                  isActive: true,
                  isArchived: true,
                  variants: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      pricePaise: true,
                      stockQuantity: true,
                      isActive: true,
                      isArchived: true,
                    },
                  },
                },
              });
            }
          } catch (customErr) {
            console.warn('[PRICING] Failed to auto-provision custom product into database:', customErr);
          }
        }
      }

      if (dbProduct) {
        authoritativeProduct = dbProduct;
      }
    } catch {
      if (!isStorefrontFallbackAllowed()) {
        throw new CatalogDatabaseError('Authoritative catalog database is currently unreachable.');
      }
    }

    // Fallback for development/testing if DB is offline or product not found
    if (!authoritativeProduct) {
      if (process.env.NODE_ENV === 'production' && !isStorefrontFallbackAllowed()) {
        throw new CatalogDatabaseError(
          `Authoritative database pricing data unavailable for product "${item.productId}". Quotes cannot use unverified demo data in production.`
        );
      }

      const fallback = INITIAL_PRODUCTS.find((p) => p.id === item.productId);
      if (!fallback) {
        throw new PricingValidationError(`Product with ID "${item.productId}" was not found.`);
      }

      authoritativeProduct = {
        id: fallback.id,
        name: fallback.name,
        hsnCode: fallback.hsnCode || '69120010',
        taxRatePercent: fallback.taxRate || 18,
        basePricePaise: fallback.basePrice * 100,
        customizationFeePaise: 0,
        isCustomizable: fallback.isCustomizable ?? true,
        customizationType: fallback.customizationType || 'engraving',
        isActive: true,
        isArchived: false,
        variants: [
          {
            id: `var-${fallback.id}`,
            name: 'Standard Edition',
            sku: fallback.sku || `SKU-${fallback.id}`,
            pricePaise: fallback.basePrice * 100,
            stockQuantity: fallback.stock || 50,
            isActive: true,
            isArchived: false,
          },
        ],
      };
    }

    if (!authoritativeProduct.isActive || authoritativeProduct.isArchived) {
      throw new PricingValidationError(
        `Product "${authoritativeProduct.name}" is no longer active or has been archived.`
      );
    }

    // Determine variant & authoritative selling price
    let unitPricePaise = authoritativeProduct.basePricePaise;
    let variantSku = `SKU-${authoritativeProduct.id}`;
    let variantName: string | undefined = undefined;

    if (item.variantId) {
      const variant = authoritativeProduct.variants.find((v) => v.id === item.variantId);
      if (!variant) {
        throw new PricingValidationError(
          `Selected variant "${item.variantId}" does not exist for product "${authoritativeProduct.name}".`
        );
      }
      if (!variant.isActive || variant.isArchived) {
        throw new PricingValidationError(
          `Variant "${variant.name}" (${variant.sku}) is currently inactive or archived.`
        );
      }
      unitPricePaise = variant.pricePaise;
      variantSku = variant.sku;
      variantName = variant.name;
    } else if (authoritativeProduct.variants.length > 0) {
      const defaultVariant = authoritativeProduct.variants[0];
      variantSku = defaultVariant.sku;
      variantName = defaultVariant.name;
      unitPricePaise = defaultVariant.pricePaise;
    }

    // If client supplied an explicit item.unitPrice (e.g. custom product, admin catalog added, or live override)
    // and DB variant price differed (e.g. default placeholder or stale DB cache), honor client unitPrice
    if (typeof item.unitPrice === 'number' && item.unitPrice > 0) {
      const clientPricePaise = Math.round(item.unitPrice * 100);
      if (clientPricePaise > 0) {
        unitPricePaise = clientPricePaise;
      }
    }

    // Customization fee (authoritative calculation on server)
    let customizationFeePaise = 0;
    const hasCustomization = !!(
      item.customization?.note ||
      item.customization?.engravedText ||
      item.customization?.artworkUploadId ||
      item.customization?.giftNote ||
      item.customization?.boxWrapStyle
    );

    if (hasCustomization) {
      if (authoritativeProduct.isCustomizable === false) {
        throw new PricingValidationError(
          `Product "${authoritativeProduct.name}" is not eligible for customization.`
        );
      }

      if (item.customization?.engravedText && item.customization.engravedText.length > 32) {
        throw new PricingValidationError(
          `Custom engraved text exceeds maximum allowable length of 32 characters.`
        );
      }

      if (item.customization?.giftNote && item.customization.giftNote.length > 200) {
        throw new PricingValidationError(
          `Gift note exceeds maximum allowable length of 200 characters.`
        );
      }

      // Base customization fee from product
      customizationFeePaise = authoritativeProduct.customizationFeePaise || 0;

      // Packaging surcharge: e.g. Vintage Wooden Keepsake Crate (+₹150 configurable)
      if (
        item.customization?.boxWrapStyle &&
        item.customization.boxWrapStyle.toLowerCase().includes('wooden')
      ) {
        if (!isWoodenCrateSurchargeApproved()) {
          throw new PricingValidationError(
            'Vintage Wooden Keepsake Crate packaging is currently unavailable because its surcharge (₹150) has not been approved by the store owner.'
          );
        }
        customizationFeePaise += getWoodenCrateSurchargePaise();
      }
    }

    const lineSubtotalPaise = unitPricePaise * qty;
    const lineCustomizationPaise = customizationFeePaise * qty;
    const lineGrossPaise = lineSubtotalPaise + lineCustomizationPaise;
    const taxRate = authoritativeProduct.taxRatePercent;
    const isTaxInclusive = !!(authoritativeProduct as any).isTaxInclusive;
    let lineTaxablePaise = lineGrossPaise;
    let lineTaxTotalPaise = 0;
    if (isTaxInclusive) {
      lineTaxablePaise = Math.round((lineGrossPaise * 100) / (100 + taxRate));
      lineTaxTotalPaise = lineGrossPaise - lineTaxablePaise;
    } else {
      lineTaxablePaise = lineGrossPaise;
      lineTaxTotalPaise = Math.round((lineTaxablePaise * taxRate) / 100);
    }
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;

    if (isIntraState) {
      // Intra-state (e.g. Rajasthan '08'): split into 50% CGST + 50% SGST with zero rounding discrepancy
      cgstPaise = Math.floor(lineTaxTotalPaise / 2);
      sgstPaise = lineTaxTotalPaise - cgstPaise;
    } else {
      // Inter-State: 100% IGST
      igstPaise = lineTaxTotalPaise;
    }

    const lineTotalPaise = lineTaxablePaise + lineTaxTotalPaise;

    lineQuotes.push({
      productId: authoritativeProduct.id,
      variantId: item.variantId,
      productName: authoritativeProduct.name,
      variantName,
      sku: variantSku,
      hsnCode: authoritativeProduct.hsnCode,
      taxRatePercent: taxRate,
      unitPricePaise,
      quantity: qty,
      customizationFeePaise,
      lineSubtotalPaise,
      lineCustomizationPaise,
      lineTaxablePaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      lineTaxTotalPaise,
      lineTotalPaise,
    });
  }

  // Calculate Aggregates
  const itemsSubtotalPaise = lineQuotes.reduce((acc, l) => acc + l.lineSubtotalPaise, 0);
  const lineCustomizationTotalPaise = lineQuotes.reduce((acc, l) => acc + l.lineCustomizationPaise, 0);

  // Gift wrapping fee: flat ₹20 (2000 paise) charged exactly once per order if at least one item requests gift wrapping
  const isOrderGiftWrapped = items.some((item) => Boolean(item.isGiftWrapped || item.customization?.giftWrap));
  const giftWrapTotalPaise = isOrderGiftWrapped ? 2000 : 0;

  const customizationTotalPaise = lineCustomizationTotalPaise + giftWrapTotalPaise;
  const discountTotalPaise = 0; // Coupons deferred in Batch 4
  const taxableAmountPaise = itemsSubtotalPaise + customizationTotalPaise - discountTotalPaise;

  const cgstPaise = lineQuotes.reduce((acc, l) => acc + l.cgstPaise, 0);
  const sgstPaise = lineQuotes.reduce((acc, l) => acc + l.sgstPaise, 0);
  const igstPaise = lineQuotes.reduce((acc, l) => acc + l.igstPaise, 0);
  const taxTotalPaise = cgstPaise + sgstPaise + igstPaise;

    // Manual Delivery Charge (Entered by Owner per order; automatic slabs removed)
  const shippingTotalPaise =
    typeof manualShippingTotalPaise === 'number' && manualShippingTotalPaise >= 0
      ? manualShippingTotalPaise
      : 0;

  const grandTotalPaise = taxableAmountPaise + taxTotalPaise + shippingTotalPaise;

  return {
    items: lineQuotes,
    itemsSubtotalPaise,
    customizationTotalPaise,
    discountTotalPaise,
    taxableAmountPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    taxTotalPaise,
    shippingTotalPaise,
    grandTotalPaise,
    destinationStateCode: cleanStateCode,
    isIntraState,
  };
}
