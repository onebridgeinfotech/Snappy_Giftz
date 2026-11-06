import { InventoryAdjustmentReason } from '@prisma/client';

export interface CreateProductInput {
  name: string;
  slug?: string;
  tagline?: string;
  description: string;
  categoryId: string;
  occasions?: string[];
  occasionIds?: string[];
  recipients?: string[];
  hsnCode: string;
  taxRatePercent?: number;
  basePricePaise: number;
  mrpPaise: number;
  productType?: 'REGULAR' | 'CUSTOMIZABLE';
  isCustomizable?: boolean;
  customizationType?: 'engraving' | 'photo' | 'logo' | 'combo';
  customizationFeePaise?: number;
  isB2BRecommended?: boolean;
  minOrderQty?: number;
  images?: string[];
  variants?: CreateVariantInput[];
}

export interface UpdateProductInput {
  name?: string;
  slug?: string;
  tagline?: string;
  description?: string;
  categoryId?: string;
  occasions?: string[];
  occasionIds?: string[];
  recipients?: string[];
  hsnCode?: string;
  taxRatePercent?: number;
  basePricePaise?: number;
  mrpPaise?: number;
  productType?: 'REGULAR' | 'CUSTOMIZABLE';
  isCustomizable?: boolean;
  customizationType?: 'engraving' | 'photo' | 'logo' | 'combo';
  customizationFeePaise?: number;
  isB2BRecommended?: boolean;
  minOrderQty?: number;
  isActive?: boolean;
  isArchived?: boolean;
  images?: string[];
}

export interface CreateVariantInput {
  name: string;
  sku: string;
  attributes: Record<string, string>;
  pricePaise: number;
  stockQuantity?: number;
}

export interface AdjustStockInput {
  variantId: string;
  adjustedQty: number; // Positive (increment) or negative (decrement)
  reason: InventoryAdjustmentReason;
  referenceId?: string;
  notes?: string;
}

const ALLOWED_TAX_RATES = [0, 5, 12, 18, 28];
const SKU_REGEX = /^[A-Za-z0-9_-]{3,50}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateProductInput(input: CreateProductInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 3) {
    errors.push('Product name must be at least 3 characters long.');
  }

  if (input.slug && (!SLUG_REGEX.test(input.slug) || input.slug.length < 3)) {
    errors.push('Slug must be lowercase alphanumeric with hyphens (e.g. personalized-ceramic-mug).');
  }

  if (!input.description || typeof input.description !== 'string' || input.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters long.');
  }

  if (!input.categoryId || typeof input.categoryId !== 'string') {
    errors.push('Valid category ID is required.');
  }

  if (!input.hsnCode || typeof input.hsnCode !== 'string' || !/^\d{4,8}$/.test(input.hsnCode.trim())) {
    errors.push('HSN code must be 4 to 8 digits (e.g. 69120010).');
  }

  const taxRate = input.taxRatePercent !== undefined ? input.taxRatePercent : 18;
  if (!Number.isInteger(taxRate) || taxRate < 0 || taxRate > 28) {
    errors.push('Tax rate must be a valid integer percentage between 0% and 28% (standard GST slabs: 0, 5, 12, 18, 28).');
  }

  if (
    input.basePricePaise === undefined ||
    !Number.isInteger(input.basePricePaise) ||
    input.basePricePaise <= 0
  ) {
    errors.push('Base price in paise must be a positive integer (e.g. 129900 for ₹1,299.00).');
  }

  if (
    input.mrpPaise === undefined ||
    !Number.isInteger(input.mrpPaise) ||
    input.mrpPaise <= 0
  ) {
    errors.push('MRP in paise must be a positive integer.');
  }

  if (input.basePricePaise && input.mrpPaise && input.mrpPaise < input.basePricePaise) {
    errors.push('Retail MRP cannot be lower than the selling base price.');
  }

  if (input.minOrderQty !== undefined && (!Number.isInteger(input.minOrderQty) || input.minOrderQty < 1)) {
    errors.push('Minimum order quantity must be an integer >= 1.');
  }

  if (
    input.customizationFeePaise !== undefined &&
    (!Number.isInteger(input.customizationFeePaise) || input.customizationFeePaise < 0)
  ) {
    errors.push('Customization fee in paise must be a non-negative integer.');
  }

  if (input.productType !== undefined && !['REGULAR', 'CUSTOMIZABLE'].includes(input.productType)) {
    errors.push('Product type must be either "REGULAR" or "CUSTOMIZABLE".');
  }

  if (input.variants && Array.isArray(input.variants)) {
    const seenSkus = new Set<string>();
    input.variants.forEach((v, idx) => {
      const vResult = validateVariantInput(v);
      if (!vResult.valid) {
        errors.push(...vResult.errors.map((e) => `Variant [${idx}]: ${e}`));
      }
      const normalizedSku = v.sku?.trim().toUpperCase();
      if (normalizedSku) {
        if (seenSkus.has(normalizedSku)) {
          errors.push(`Duplicate SKU "${normalizedSku}" found in request payload.`);
        }
        seenSkus.add(normalizedSku);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function validateVariantInput(input: CreateVariantInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 2) {
    errors.push('Variant name must be at least 2 characters.');
  }

  const normalizedSku = input.sku?.trim().toUpperCase();
  if (!normalizedSku || !SKU_REGEX.test(normalizedSku)) {
    errors.push('SKU must be 3-50 characters containing letters, numbers, hyphens or underscores.');
  }

  if (
    input.pricePaise === undefined ||
    !Number.isInteger(input.pricePaise) ||
    input.pricePaise <= 0
  ) {
    errors.push('Variant price in paise must be a positive integer.');
  }

  if (
    input.stockQuantity !== undefined &&
    (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0)
  ) {
    errors.push('Stock quantity must be a non-negative integer.');
  }

  if (!input.attributes || typeof input.attributes !== 'object' || Array.isArray(input.attributes)) {
    errors.push('Variant attributes must be an object map (e.g. { "color": "Rose Gold" }).');
  }

  return { valid: errors.length === 0, errors };
}

export function validateStockAdjustmentInput(input: AdjustStockInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.variantId || typeof input.variantId !== 'string') {
    errors.push('Valid variant ID is required.');
  }

  if (input.adjustedQty === undefined || !Number.isInteger(input.adjustedQty) || input.adjustedQty === 0) {
    errors.push('Adjusted quantity must be a non-zero integer (positive to add, negative to deduct).');
  }

  if (!input.reason || !Object.values(InventoryAdjustmentReason).includes(input.reason)) {
    errors.push(
      `Reason must be one of: ${Object.values(InventoryAdjustmentReason).join(', ')}`
    );
  }

  return { valid: errors.length === 0, errors };
}
