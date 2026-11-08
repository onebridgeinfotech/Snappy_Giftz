import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { UpdateProductInput, slugify } from '@/lib/catalog/validation';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        productOccasions: {
          include: { occasion: { select: { id: true, name: true, slug: true } } },
        },
        variants: {
          include: {
            inventoryAdjustments: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        galleryImages: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: `Product with ID "${id}" not found` }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireRole([Role.ADMIN], req);
    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `Product with ID "${id}" not found` }, { status: 404 });
    }

    let body: UpdateProductInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.tagline !== undefined) updateData.tagline = body.tagline.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.occasions !== undefined) updateData.occasions = body.occasions;
    if (body.recipients !== undefined) updateData.recipients = body.recipients;
    if (body.hsnCode !== undefined) updateData.hsnCode = body.hsnCode.trim();
    if (body.taxRatePercent !== undefined) updateData.taxRatePercent = body.taxRatePercent;
    if (body.basePricePaise !== undefined) {
      if (!Number.isInteger(body.basePricePaise) || body.basePricePaise <= 0) {
        return NextResponse.json({ error: 'basePricePaise must be a positive integer' }, { status: 400 });
      }
      updateData.basePricePaise = body.basePricePaise;
    }
    if (body.mrpPaise !== undefined) {
      if (!Number.isInteger(body.mrpPaise) || body.mrpPaise <= 0) {
        return NextResponse.json({ error: 'mrpPaise must be a positive integer' }, { status: 400 });
      }
      updateData.mrpPaise = body.mrpPaise;
    }
    if (body.productType !== undefined) {
      updateData.productType = body.productType;
      updateData.isCustomizable = body.productType === 'CUSTOMIZABLE';
    } else if (body.isCustomizable !== undefined) {
      updateData.isCustomizable = !!body.isCustomizable;
      updateData.productType = body.isCustomizable ? 'CUSTOMIZABLE' : 'REGULAR';
    }
    if (body.customizationType !== undefined) updateData.customizationType = body.customizationType;
    if (body.customizationFeePaise !== undefined) updateData.customizationFeePaise = body.customizationFeePaise;
    if (body.minOrderQty !== undefined) updateData.minOrderQty = body.minOrderQty;
    if (body.isActive !== undefined) updateData.isActive = !!body.isActive;
    if (body.isArchived !== undefined) updateData.isArchived = !!body.isArchived;
    if (body.images !== undefined) {
      const sanitizedImages: string[] = Array.isArray(body.images)
        ? body.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0).map((img) => img.trim())
        : typeof body.images === 'string' && (body.images as string).trim().length > 0
          ? [(body.images as string).trim()]
          : [];
      updateData.images = sanitizedImages;
    }

    if (body.slug !== undefined) {
      const newSlug = slugify(body.slug);
      if (newSlug !== existing.slug) {
        const slugExists = await prisma.product.findUnique({ where: { slug: newSlug } });
        if (slugExists) {
          return NextResponse.json({ error: `Slug "${newSlug}" is already in use.` }, { status: 409 });
        }
        updateData.slug = newSlug;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.occasionIds !== undefined) {
        await tx.productOccasion.deleteMany({ where: { productId: id } });
        if (body.occasionIds.length > 0) {
          await tx.productOccasion.createMany({
            data: body.occasionIds.map((occId) => ({ productId: id, occasionId: occId })),
          });
        }
      }

      if (body.images !== undefined) {
        const sanitizedImages: string[] = Array.isArray(body.images)
          ? body.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0).map((img) => img.trim())
          : typeof body.images === 'string' && (body.images as string).trim().length > 0
            ? [(body.images as string).trim()]
            : [];
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (sanitizedImages.length > 0) {
          await tx.productImage.createMany({
            data: sanitizedImages.map((url, idx) => ({
              productId: id,
              url,
              altText: updateData.name || existing.name,
              displayOrder: idx + 1,
              isPrimary: idx === 0,
            })),
          });
        }
      }

      const prod = await tx.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          productOccasions: { include: { occasion: true } },
          variants: true,
          galleryImages: { orderBy: { displayOrder: 'asc' } },
        },
      });

      if (updateData.basePricePaise !== undefined) {
        const activeVariants = await tx.productVariant.findMany({
          where: { productId: id, isArchived: false },
        });
        if (activeVariants.length === 1) {
          await tx.productVariant.update({
            where: { id: activeVariants[0].id },
            data: { pricePaise: updateData.basePricePaise },
          });
        } else if (activeVariants.length > 1) {
          const standard = activeVariants.find(
            (v) => v.name.toLowerCase() === 'standard' || v.sku.endsWith('-STD')
          );
          if (standard) {
            await tx.productVariant.update({
              where: { id: standard.id },
              data: { pricePaise: updateData.basePricePaise },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          userId: operator.id,
          action: 'CATALOG_PRODUCT_UPDATED',
          resource: `Product:${id}`,
          details: {
            changes: updateData,
            previousState: {
              name: existing.name,
              basePricePaise: existing.basePricePaise,
              mrpPaise: existing.mrpPaise,
              isActive: existing.isActive,
            },
          },
        },
      });

      return prod;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireRole([Role.ADMIN], req);
    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `Product with ID "${id}" not found` }, { status: 404 });
    }

    // Soft delete / archive product
    const archived = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.update({
        where: { id },
        data: { isArchived: true, isActive: false },
      });

      await tx.auditLog.create({
        data: {
          userId: operator.id,
          action: 'CATALOG_PRODUCT_ARCHIVED',
          resource: `Product:${id}`,
          details: { name: existing.name, slug: existing.slug },
        },
      });

      return prod;
    });

    return NextResponse.json({
      success: true,
      message: `Product "${existing.name}" archived successfully`,
      data: archived,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
