import type { PublicProduct } from '@/lib/catalog/public-catalog.service';
import type { Product } from '@/types';

/** Admin list row from GET /api/admin/catalog/products */
export type AdminCatalogProductRow = {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  description: string;
  basePricePaise: number;
  mrpPaise: number;
  productType?: string;
  isCustomizable?: boolean;
  customizationType?: string | null;
  hsnCode?: string;
  taxRatePercent?: number;
  minOrderQty?: number;
  images?: string[] | unknown;
  occasions?: string[] | unknown;
  recipients?: string[] | unknown;
  category?: { id: string; name: string; slug: string } | null;
  variants?: Array<{
    id: string;
    sku: string;
    name: string;
    pricePaise: number;
    stockQuantity: number;
  }>;
};

function categoryName(
  category: PublicProduct['category'] | AdminCatalogProductRow['category']
): string {
  if (!category) return 'General';
  if (typeof category === 'string') return category;
  return category.name;
}

function pickDefaultVariant(variants?: AdminCatalogProductRow['variants']) {
  if (!variants?.length) return undefined;
  return variants[0];
}

export function mapPublicProductToStorefront(p: PublicProduct): Product {
  const v = p.variants?.[0];
  const pType =
    p.productType === 'CUSTOMIZABLE' || p.productType === 'REGULAR'
      ? p.productType
      : p.isCustomizable
        ? 'CUSTOMIZABLE'
        : 'REGULAR';

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline || '',
    description: p.description,
    category: categoryName(p.category),
    productType: pType,
    occasion: p.occasions?.length ? p.occasions : ['Festival'],
    recipient: p.recipients?.length ? p.recipients : ['Family'],
    basePrice: Math.round(p.basePricePaise / 100),
    mrp: Math.round(p.mrpPaise / 100),
    hsnCode: '69120010',
    taxRate: 18,
    rating: p.rating ?? 4.9,
    reviewsCount: p.reviewsCount ?? 0,
    images: Array.isArray(p.images) && p.images.length > 0 ? p.images : ['/placeholder-product.jpg'],
    isCustomizable: pType === 'CUSTOMIZABLE',
    customizationType:
      p.customizationType === 'engraving' ||
      p.customizationType === 'photo' ||
      p.customizationType === 'logo' ||
      p.customizationType === 'combo'
        ? p.customizationType
        : pType === 'CUSTOMIZABLE'
          ? 'engraving'
          : undefined,
    isB2BRecommended: Boolean(p.isB2BRecommended),
    minOrderQty: p.minOrderQty ?? 1,
    stock: v?.stockQuantity ?? 100,
    sku: v?.sku || `SG-${p.id.slice(0, 8)}`,
    warehouseLocation: 'Hyderabad Central Hub',
    estimatedDispatchDays: 2,
    badge: p.badge,
  };
}

export function mapAdminRowToStorefront(row: AdminCatalogProductRow): Product {
  const v = pickDefaultVariant(row.variants);
  const pType =
    row.productType === 'CUSTOMIZABLE' || row.productType === 'REGULAR'
      ? row.productType
      : row.isCustomizable
        ? 'CUSTOMIZABLE'
        : 'REGULAR';

  const images = Array.isArray(row.images) ? (row.images as string[]) : [];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || '',
    description: row.description,
    category: categoryName(row.category),
    productType: pType,
    occasion: Array.isArray(row.occasions) && row.occasions.length ? (row.occasions as string[]) : ['Festival'],
    recipient: Array.isArray(row.recipients) && row.recipients.length ? (row.recipients as string[]) : ['Family'],
    basePrice: Math.round(row.basePricePaise / 100),
    mrp: Math.round(row.mrpPaise / 100),
    hsnCode: row.hsnCode || '69120010',
    taxRate: row.taxRatePercent ?? 18,
    rating: 5,
    reviewsCount: 0,
    images: images.length > 0 ? images : ['/placeholder-product.jpg'],
    isCustomizable: pType === 'CUSTOMIZABLE',
    customizationType:
      row.customizationType === 'engraving' ||
      row.customizationType === 'photo' ||
      row.customizationType === 'logo' ||
      row.customizationType === 'combo'
        ? row.customizationType
        : pType === 'CUSTOMIZABLE'
          ? 'engraving'
          : undefined,
    minOrderQty: row.minOrderQty ?? 1,
    stock: v?.stockQuantity ?? 0,
    sku: v?.sku || `SG-${row.id.slice(0, 8)}`,
    warehouseLocation: 'Hyderabad Central Hub',
    estimatedDispatchDays: 2,
  };
}

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees <= 0) return 0;
  return Math.round(rupees * 100);
}
