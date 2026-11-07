import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { validateProductInput, slugify, CreateProductInput } from '@/lib/catalog/validation';

export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = searchParams.get('search')?.trim();
    const categoryId = searchParams.get('categoryId')?.trim();
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const where: any = {};
    if (!includeArchived) {
      where.isArchived = false;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          productOccasions: {
            include: { occasion: { select: { id: true, name: true, slug: true } } },
          },
          variants: {
            select: {
              id: true,
              sku: true,
              name: true,
              pricePaise: true,
              stockQuantity: true,
              attributes: true,
            },
          },
          galleryImages: {
            orderBy: { displayOrder: 'asc' },
            select: { id: true, url: true, altText: true, displayOrder: true, isPrimary: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const operator = await requireRole([Role.ADMIN], req);

    let body: CreateProductInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const validation = validateProductInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
    }

    // Generate or format slug
    const targetSlug = body.slug ? slugify(body.slug) : slugify(body.name);

    // Check slug uniqueness
    const existingSlug = await prisma.product.findUnique({ where: { slug: targetSlug } });
    if (existingSlug) {
      return NextResponse.json(
        { error: `Product with slug "${targetSlug}" already exists. Please provide a distinct name or slug.` },
        { status: 409 }
      );
    }

    // Check category exists
    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) {
      return NextResponse.json({ error: `Category with ID "${body.categoryId}" not found` }, { status: 404 });
    }

    // Check SKU uniqueness in database
    if (body.variants && body.variants.length > 0) {
      const skus = body.variants.map((v) => v.sku.trim().toUpperCase());
      const conflictingVariant = await prisma.productVariant.findFirst({
        where: { sku: { in: skus } },
      });
      if (conflictingVariant) {
        return NextResponse.json(
          { error: `A variant with SKU "${conflictingVariant.sku}" already exists in the catalog.` },
          { status: 409 }
        );
      }
    }

    // Transactional creation of product, variants, occasion associations, and audit log
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: body.name.trim(),
          slug: targetSlug,
          tagline: body.tagline?.trim() || null,
          description: body.description.trim(),
          categoryId: body.categoryId,
          occasions: body.occasions || [],
          recipients: body.recipients || [],
          hsnCode: body.hsnCode.trim(),
          taxRatePercent: body.taxRatePercent !== undefined ? body.taxRatePercent : 18,
          basePricePaise: body.basePricePaise,
          mrpPaise: body.mrpPaise,
          productType: body.productType || (body.isCustomizable ? 'CUSTOMIZABLE' : 'REGULAR'),
          isCustomizable: body.productType === 'CUSTOMIZABLE' ? true : (body.isCustomizable !== undefined ? !!body.isCustomizable : false),
          customizationType: body.customizationType || null,
          customizationFeePaise: body.customizationFeePaise || 0,
          isB2BRecommended: !!body.isB2BRecommended,
          minOrderQty: body.minOrderQty || 1,
          images: body.images || [],
          productOccasions: body.occasionIds && body.occasionIds.length > 0
            ? {
                create: body.occasionIds.map((occId) => ({ occasionId: occId })),
              }
            : undefined,
          variants:
            body.variants && body.variants.length > 0
              ? {
                  create: body.variants.map((v) => ({
                    name: v.name.trim(),
                    sku: v.sku.trim().toUpperCase(),
                    attributes: v.attributes,
                    pricePaise: v.pricePaise,
                    stockQuantity: v.stockQuantity || 0,
                  })),
                }
              : {
                  create: [
                    {
                      name: 'Standard',
                      sku: `${targetSlug.toUpperCase().replace(/-/g, '').slice(0, 12)}-STD`,
                      attributes: {},
                      pricePaise: body.basePricePaise,
                      stockQuantity: body.minOrderQty && body.minOrderQty > 0 ? 100 : 100,
                    },
                  ],
                },
        },
        include: {
          variants: true,
          category: { select: { id: true, name: true } },
          productOccasions: { include: { occasion: { select: { id: true, name: true } } } },
        },
      });

      // Audit log entry
      await tx.auditLog.create({
        data: {
          userId: operator.id,
          action: 'CATALOG_PRODUCT_CREATED',
          resource: `Product:${product.id}`,
          details: {
            name: product.name,
            slug: product.slug,
            basePricePaise: product.basePricePaise,
            variantsCount: product.variants.length,
          },
        },
      });

      return product;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
