import { prisma } from '@/lib/prisma';
import { INITIAL_PRODUCTS } from '@/data/initialData';
import { slugify } from './validation';
import { Product } from '@/types';

export interface GetPublicProductsParams {
  search?: string;
  category?: string;
  occasion?: string;
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
}

export interface PublicVariant {
  id: string;
  sku: string;
  name: string;
  pricePaise: number;
  stockQuantity: number;
  attributes: Record<string, any>;
}

export interface PublicImage {
  id: string;
  url: string;
  altText: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  category: { id: string; name: string; slug: string } | string;
  occasions: string[];
  recipients: string[];
  basePricePaise: number;
  mrpPaise: number;
  isCustomizable: boolean;
  customizationType: string | null;
  customizationFeePaise: number;
  isB2BRecommended: boolean;
  minOrderQty: number;
  images: string[];
  galleryImages?: PublicImage[];
  variants?: PublicVariant[];
  rating: number;
  reviewsCount: number;
  badge?: string;
}

export interface PublicProductsResult {
  products: PublicProduct[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}

export interface PublicOccasion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}

export class CatalogDatabaseError extends Error {
  constructor(message = 'Catalog service is temporarily unavailable') {
    super(message);
    this.name = 'CatalogDatabaseError';
  }
}

/**
 * Explicit environment-aware fallback policy:
 * - In production: fallback to demo/fixture data is strictly prohibited to prevent masking outages or serving demo items.
 * - In development / testing: fallback is enabled when PostgreSQL is offline.
 * - Can be explicitly overridden with ALLOW_DEMO_FALLBACK=true for staging demo sandboxes.
 */
export function isStorefrontFallbackAllowed(): boolean {
  if (process.env.ALLOW_DEMO_FALLBACK === 'true') {
    return true;
  }
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return true;
}

export const DEFAULT_CATEGORIES: string[] = [
  'Personalized Gifts',
  'Home Decor',
  'Soft Toys',
  'Luxury Gifts',
  'Gift Hampers',
  'Corporate Kits',
  'Stationery & Desk',
];

export const DEFAULT_OCCASIONS: string[] = [
  'Birthday',
  'Anniversary',
  'Corporate',
  'Diwali',
  'Wedding',
  'Valentine',
  'Farewell',
];

/**
 * Sanitize and validate public product queries.
 */
export function sanitizePublicQuery(params: GetPublicProductsParams) {
  const page = Math.max(1, Number.isInteger(params.page) ? (params.page as number) : 1);
  const limit = Math.min(50, Math.max(1, Number.isInteger(params.limit) ? (params.limit as number) : 12));
  const search = params.search ? params.search.trim().slice(0, 100) : undefined;
  const category = params.category && params.category !== 'All' ? params.category.trim() : undefined;
  const occasion = params.occasion && params.occasion !== 'All' ? params.occasion.trim() : undefined;
  
  const validSorts = ['featured', 'price_asc', 'price_desc', 'newest'];
  const sort = params.sort && validSorts.includes(params.sort) ? params.sort : 'featured';

  return { page, limit, search, category, occasion, sort };
}

/**
 * Fetch public catalog products with filtering, search, sorting, and pagination.
 * Excludes archived, inactive, and draft products.
 * Uses Prisma database when available; falls back gracefully to curated initial products if DB is offline.
 */
export async function getPublicProducts(
  rawParams: GetPublicProductsParams
): Promise<PublicProductsResult> {
  const { page, limit, search, category, occasion, sort } = sanitizePublicQuery(rawParams);

  try {
    // 1. Attempt database query with strict public filters
    const where: any = {
      isActive: true,
      isArchived: false,
    };

    if (category) {
      where.OR = [
        { category: { slug: slugify(category) } },
        { category: { name: { equals: category, mode: 'insensitive' } } },
      ];
    }

    if (occasion) {
      where.OR = [
        ...(where.OR || []),
        { occasions: { has: occasion } },
        { productOccasions: { some: { occasion: { slug: slugify(occasion) } } } },
        { productOccasions: { some: { occasion: { name: { equals: occasion, mode: 'insensitive' } } } } },
      ];
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { tagline: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { occasions: { hasSome: [search] } },
          ],
        },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'price_asc') orderBy = { basePricePaise: 'asc' };
    if (sort === 'price_desc') orderBy = { basePricePaise: 'desc' };
    if (sort === 'newest') orderBy = { createdAt: 'desc' };

    const [dbProducts, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          description: true,
          basePricePaise: true,
          mrpPaise: true,
          isCustomizable: true,
          customizationType: true,
          customizationFeePaise: true,
          minOrderQty: true,
          images: true,
          occasions: true,
          recipients: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
          galleryImages: {
            where: {},
            orderBy: { displayOrder: 'asc' },
            select: {
              id: true,
              url: true,
              altText: true,
              displayOrder: true,
              isPrimary: true,
            },
          },
          variants: {
            where: { isActive: true, isArchived: false },
            select: {
              id: true,
              sku: true,
              name: true,
              pricePaise: true,
              stockQuantity: true,
              attributes: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Query succeeded against real database!
    const sanitized: PublicProduct[] = dbProducts.map((p) => ({
      ...p,
      isB2BRecommended: false,
      occasions: Array.isArray(p.occasions) ? (p.occasions as string[]) : [],
      recipients: Array.isArray(p.recipients) ? (p.recipients as string[]) : [],
      images: Array.isArray(p.images) ? (p.images as string[]) : [],
      rating: 0,
      reviewsCount: 0,
      variants: p.variants.map((v) => ({
        ...v,
        attributes: (v.attributes as Record<string, any>) || {},
      })),
    }));

    const totalPages = Math.ceil(totalCount / limit);
    return {
      products: sanitized,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  } catch (err: any) {
    if (!isStorefrontFallbackAllowed()) {
      // In production, never mask database outage or empty catalog with demo fixtures
      throw new CatalogDatabaseError('Public catalog service is temporarily unavailable.');
    }
  }

  // 2. Curated Storefront Fallback (Only in development/test environments when DB is offline)
  return getFallbackPublicProducts({ page, limit, search, category, occasion, sort });
}

/**
 * Filter and sort initial curated products in-memory when database is unavailable.
 */
function getFallbackPublicProducts(params: {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  occasion?: string;
  sort: string;
}): PublicProductsResult {
  const { page, limit, search, category, occasion, sort } = params;

  let filtered = INITIAL_PRODUCTS.filter((p) => {
    // Search match
    if (search) {
      const q = search.toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(q);
      const tagMatch = p.tagline?.toLowerCase().includes(q);
      const catMatch = p.category.toLowerCase().includes(q);
      const occMatch = p.occasion?.some((o) => o.toLowerCase().includes(q));
      if (!nameMatch && !tagMatch && !catMatch && !occMatch) return false;
    }

    // Category match
    if (category) {
      if (p.category.toLowerCase() !== category.toLowerCase()) return false;
    }

    // Occasion match
    if (occasion) {
      if (!p.occasion || !p.occasion.some((o) => o.toLowerCase() === occasion.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Sort
  if (sort === 'price_asc') {
    filtered.sort((a, b) => a.basePrice - b.basePrice);
  } else if (sort === 'price_desc') {
    filtered.sort((a, b) => b.basePrice - a.basePrice);
  } else if (sort === 'newest') {
    // Keep standard reverse
    filtered.reverse();
  }

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / limit);
  const offset = (page - 1) * limit;
  const paginated = filtered.slice(offset, offset + limit);

  const mapped: PublicProduct[] = paginated.map((p) => ({
    id: p.id,
    slug: p.slug || slugify(p.name),
    name: p.name,
    tagline: p.tagline || null,
    description: p.description,
    category: p.category,
    occasions: p.occasion || [],
    recipients: p.recipient || [],
    basePricePaise: p.basePrice * 100,
    mrpPaise: p.mrp * 100,
    isCustomizable: p.isCustomizable,
    customizationType: p.customizationType || null,
    customizationFeePaise: 0,
    isB2BRecommended: false,
    minOrderQty: p.minOrderQty || 1,
    images: p.images,
    rating: p.rating || 4.9,
    reviewsCount: p.reviewsCount || 100,
    badge: p.badge,
  }));

  return {
    products: mapped,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/**
 * Fetch a single public product by its slug or ID.
 * Returns null if not found or if the product is marked inactive or archived.
 */
export async function getPublicProductBySlug(slugOrId: string): Promise<PublicProduct | null> {
  const cleanKey = slugOrId.trim();
  if (!cleanKey) return null;

  try {
    const p = await prisma.product.findFirst({
      where: {
        AND: [
          { isActive: true },
          { isArchived: false },
          { OR: [{ slug: cleanKey }, { id: cleanKey }] },
        ],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        basePricePaise: true,
        mrpPaise: true,
        isCustomizable: true,
        customizationType: true,
        customizationFeePaise: true,
        minOrderQty: true,
        images: true,
        occasions: true,
        recipients: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        galleryImages: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            url: true,
            altText: true,
            displayOrder: true,
            isPrimary: true,
          },
        },
        variants: {
          where: { isActive: true, isArchived: false },
          select: {
            id: true,
            sku: true,
            name: true,
            pricePaise: true,
            stockQuantity: true,
            attributes: true,
          },
        },
      },
    });

    if (p) {
      return {
        ...p,
        isB2BRecommended: false,
        occasions: Array.isArray(p.occasions) ? (p.occasions as string[]) : [],
        recipients: Array.isArray(p.recipients) ? (p.recipients as string[]) : [],
        images: Array.isArray(p.images) ? (p.images as string[]) : [],
        rating: 0,
        reviewsCount: 0,
        variants: p.variants.map((v) => ({
          ...v,
          attributes: (v.attributes as Record<string, any>) || {},
        })),
      };
    }

    // Database queried successfully and product was not found or is inactive/archived
    return null;
  } catch (err: any) {
    if (!isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Public catalog service is temporarily unavailable.');
    }
  }

  // Fallback search in development / test environments when DB is offline
  const fallback = INITIAL_PRODUCTS.find(
    (p) => (p.slug && p.slug === cleanKey) || slugify(p.name) === cleanKey || p.id === cleanKey
  );

  if (!fallback) return null;

  return {
    id: fallback.id,
    slug: fallback.slug || slugify(fallback.name),
    name: fallback.name,
    tagline: fallback.tagline || null,
    description: fallback.description,
    category: fallback.category,
    occasions: fallback.occasion || [],
    recipients: fallback.recipient || [],
    basePricePaise: fallback.basePrice * 100,
    mrpPaise: fallback.mrp * 100,
    isCustomizable: fallback.isCustomizable,
    customizationType: fallback.customizationType || null,
    customizationFeePaise: 0,
    isB2BRecommended: !!fallback.isB2BRecommended,
    minOrderQty: fallback.minOrderQty || 1,
    images: fallback.images,
    rating: fallback.rating || 0,
    reviewsCount: fallback.reviewsCount || 0,
    badge: fallback.badge,
  };
}

/**
 * Fetch public active categories.
 * Excludes inactive categories and internal timestamps.
 */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  try {
    const dbCategories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, description: true, imageUrl: true },
    });

    return dbCategories;
  } catch (err: any) {
    if (!isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Categories service is temporarily unavailable.');
    }
  }

  return DEFAULT_CATEGORIES.map((cat, idx) => ({
    id: `cat-${idx + 1}`,
    name: cat,
    slug: cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: `Curated collection of ${cat}`,
    imageUrl: null,
  }));
}

/**
 * Fetch public active occasions.
 * Excludes inactive occasions.
 */
export async function getPublicOccasions(): Promise<PublicOccasion[]> {
  try {
    const dbOccasions = await prisma.occasion.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, description: true, imageUrl: true },
    });

    return dbOccasions;
  } catch (err: any) {
    if (!isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Occasions service is temporarily unavailable.');
    }
  }

  return DEFAULT_OCCASIONS.map((occ, idx) => ({
    id: `occ-${idx + 1}`,
    name: occ,
    slug: occ.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: `Bespoke gifts handcrafted for ${occ} celebrations`,
    imageUrl: null,
  }));
}
