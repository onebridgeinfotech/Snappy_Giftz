import {
  mapAdminRowToStorefront,
  mapPublicProductToStorefront,
  rupeesToPaise,
} from '@/lib/catalog/storefront-product-mapper';
import type { Product } from '@/types';
import { slugify } from '@/lib/catalog/validation';

async function parseJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** Returns the live catalog, or null when the catalog service could not be reached. */
export async function fetchStorefrontCatalog(limit = 200): Promise<Product[] | null> {
  const res = await fetch(`/api/catalog/products?limit=${limit}`);
  const json = await parseJson(res);
  if (!res.ok || !json.success || !Array.isArray(json.data?.products)) {
    return null;
  }
  return json.data.products.map(mapPublicProductToStorefront);
}

export async function fetchAdminCatalog(limit = 200): Promise<Product[]> {
  const res = await fetch(`/api/admin/catalog/products?limit=${limit}`, { credentials: 'include' });
  const json = await parseJson(res);
  if (!res.ok || !json.success || !Array.isArray(json.data?.products)) {
    return [];
  }
  return json.data.products.map(mapAdminRowToStorefront);
}

async function resolveCategoryIdByName(categoryName: string): Promise<string> {
  const res = await fetch('/api/admin/catalog/categories', { credentials: 'include' });
  const json = await parseJson(res);
  if (res.ok && json.success && Array.isArray(json.data)) {
    const match = json.data.find(
      (c: { name: string; id: string }) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
    );
    if (match) return match.id;
  }

  const createRes = await fetch('/api/admin/catalog/categories', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: categoryName.trim() }),
  });
  const createJson = await parseJson(createRes);
  if (!createRes.ok || !createJson.data?.id) {
    throw new Error(createJson.error || 'Could not resolve product category.');
  }
  return createJson.data.id as string;
}

export type AdminProductCreateInput = {
  name: string;
  tagline?: string;
  description: string;
  category: string;
  basePrice: number;
  mrp: number;
  stock: number;
  sku: string;
  images: string[];
  productType: 'REGULAR' | 'CUSTOMIZABLE';
  isCustomizable: boolean;
  customizationType?: string;
  hsnCode?: string;
  taxRate?: number;
  occasions?: string[];
  recipients?: string[];
};

export async function createCatalogProduct(input: AdminProductCreateInput): Promise<Product> {
  const categoryId = await resolveCategoryIdByName(input.category || 'General');
  const basePricePaise = rupeesToPaise(input.basePrice);
  const mrpPaise = rupeesToPaise(Math.max(input.mrp, input.basePrice));
  if (basePricePaise <= 0 || mrpPaise <= 0) {
    throw new Error('Price must be greater than zero (enter amounts in rupees, e.g. 10 for ₹10).');
  }

  const sku = input.sku.trim().toUpperCase();
  const res = await fetch('/api/admin/catalog/products', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name.trim(),
      tagline: input.tagline?.trim() || undefined,
      description: input.description.trim(),
      categoryId,
      occasions: input.occasions || ['Festival'],
      recipients: input.recipients || ['Family'],
      hsnCode: (input.hsnCode || '69120010').trim(),
      taxRatePercent: input.taxRate ?? 18,
      basePricePaise,
      mrpPaise,
      productType: input.productType,
      isCustomizable: input.isCustomizable,
      customizationType: input.customizationType || (input.isCustomizable ? 'engraving' : undefined),
      images: input.images,
      variants: [
        {
          name: 'Standard',
          sku,
          attributes: {},
          pricePaise: basePricePaise,
          stockQuantity: Math.max(0, Math.floor(input.stock)),
        },
      ],
    }),
  });
  const json = await parseJson(res);
  if (!res.ok || !json.data) {
    throw new Error(json.error || json.details?.join?.(', ') || 'Failed to create product in catalog.');
  }
  return mapAdminRowToStorefront(json.data);
}

export type AdminProductUpdateInput = {
  name?: string;
  basePrice?: number;
  mrp?: number;
  stock?: number;
  category?: string;
  badge?: string;
  productType?: 'REGULAR' | 'CUSTOMIZABLE';
  isCustomizable?: boolean;
  images?: string[];
};

export async function updateCatalogProduct(id: string, input: AdminProductUpdateInput): Promise<void> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.basePrice !== undefined) body.basePricePaise = rupeesToPaise(input.basePrice);
  if (input.mrp !== undefined) body.mrpPaise = rupeesToPaise(input.mrp);
  if (input.productType !== undefined) {
    body.productType = input.productType;
    body.isCustomizable = input.productType === 'CUSTOMIZABLE';
  } else if (input.isCustomizable !== undefined) {
    body.isCustomizable = input.isCustomizable;
    body.productType = input.isCustomizable ? 'CUSTOMIZABLE' : 'REGULAR';
  }
  if (input.images !== undefined) body.images = input.images;
  if (input.category) {
    body.categoryId = await resolveCategoryIdByName(input.category);
  }

  const res = await fetch(`/api/admin/catalog/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new Error(json.error || 'Failed to update product.');
  }

  if (input.stock !== undefined && Number.isFinite(input.stock)) {
    const detailRes = await fetch(`/api/admin/catalog/products/${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    const detailJson = await parseJson(detailRes);
    const variantId = detailJson.data?.variants?.[0]?.id;
    if (variantId) {
      await fetch(`/api/admin/catalog/inventory/adjust`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId,
          adjustedQty: Math.floor(input.stock) - (detailJson.data.variants[0].stockQuantity || 0),
          reason: 'MANUAL_CORRECTION',
          notes: 'Adjusted from admin product editor',
        }),
      }).catch(() => undefined);
    }
  }
}

export async function archiveCatalogProduct(id: string): Promise<void> {
  const res = await fetch(`/api/admin/catalog/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new Error(json.error || 'Failed to remove product.');
  }
}

export function catalogProductSlug(name: string): string {
  return slugify(name);
}
