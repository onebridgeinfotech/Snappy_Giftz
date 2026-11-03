import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { localStorageService } from '@/services/storage/local-storage.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);
    const { id, imageId } = await params;

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });

    if (!image) {
      return NextResponse.json({ error: `Image with ID "${imageId}" not found for product "${id}"` }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: image });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const operator = await requireRole([Role.ADMIN], req);
    const { id, imageId } = await params;

    const existing = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: `Image with ID "${imageId}" not found for product "${id}"` }, { status: 404 });
    }

    let body: { altText?: string; displayOrder?: number; isPrimary?: boolean };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.isPrimary === true) {
        // Reset existing primary images for this product
        await tx.productImage.updateMany({
          where: { productId: id, isPrimary: true },
          data: { isPrimary: false },
        });

        // Ensure this image URL becomes first in product.images
        const product = await tx.product.findUnique({ where: { id } });
        if (product) {
          const existingImages = Array.isArray(product.images) ? (product.images as string[]) : [];
          const reorderedUrls = [
            existing.url,
            ...existingImages.filter((u) => u !== existing.url),
          ];
          await tx.product.update({
            where: { id },
            data: { images: reorderedUrls },
          });
        }
      }

      const img = await tx.productImage.update({
        where: { id: imageId },
        data: {
          altText: body.altText !== undefined ? body.altText.trim() : undefined,
          displayOrder: body.displayOrder !== undefined ? body.displayOrder : undefined,
          isPrimary: body.isPrimary !== undefined ? !!body.isPrimary : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: operator.id,
          action: 'CATALOG_IMAGE_UPDATED',
          resource: `ProductImage:${imageId}`,
          details: { productId: id, changes: body },
        },
      });

      return img;
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
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const operator = await requireRole([Role.ADMIN], req);
    const { id, imageId } = await params;

    const existing = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: `Image with ID "${imageId}" not found for product "${id}"` }, { status: 404 });
    }

    // 1. Delete physical file from storage adapter if storageKey exists
    if (existing.storageKey) {
      await localStorageService.deleteFile(existing.storageKey);
    }

    // 2. Transactionally remove database record and promote next image if primary
    await prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });

      const product = await tx.product.findUnique({ where: { id } });
      if (product) {
        const existingImages = Array.isArray(product.images) ? (product.images as string[]) : [];
        const remainingUrls = existingImages.filter((u) => u !== existing.url);
        await tx.product.update({
          where: { id },
          data: { images: remainingUrls },
        });
      }

      if (existing.isPrimary) {
        // Promote first remaining image to primary
        const nextImage = await tx.productImage.findFirst({
          where: { productId: id },
          orderBy: { displayOrder: 'asc' },
        });
        if (nextImage) {
          await tx.productImage.update({
            where: { id: nextImage.id },
            data: { isPrimary: true },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: operator.id,
          action: 'CATALOG_IMAGE_DELETED',
          resource: `ProductImage:${imageId}`,
          details: { productId: id, deletedUrl: existing.url, wasPrimary: existing.isPrimary },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Product image successfully deleted and removed from gallery.',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
