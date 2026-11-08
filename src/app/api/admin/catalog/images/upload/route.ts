import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { localStorageService, StorageValidationError } from '@/services/storage/local-storage.service';

export async function POST(req: Request) {
  try {
    const operator = await requireRole([Role.ADMIN, Role.STAFF], req);

    const formData = await req.formData();
    const file = formData.get('file');
    const productId = formData.get('productId')?.toString()?.trim();
    const altText = formData.get('altText')?.toString()?.trim();
    const isPrimary = formData.get('isPrimary') === 'true';

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No image file provided in "file" form field' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = (file as any).name || 'upload.jpg';
    const mimeType = file.type || 'image/jpeg';

    // Upload using StorageAdapter contract
    const uploadResult = await localStorageService.uploadFile({
      fileBuffer: buffer,
      fileName,
      mimeType,
      folder: 'proofs', // default folder for catalog assets
    });

    // Optional Google Drive sync if connected
    let googleDriveFileId: string | undefined;
    try {
      const { googleDriveService } = await import('@/services/storage/google-drive.service');
      const gDriveStatus = await googleDriveService.getConnectionStatus();
      if (gDriveStatus.isConnected) {
        const driveUpload = await googleDriveService.uploadFile({
          fileBuffer: buffer,
          fileName,
          mimeType,
          folderType: 'product',
        });
        googleDriveFileId = driveUpload.fileId;
      }
    } catch (gdriveErr) {
      console.warn('[CATALOG_IMAGE_UPLOAD] Google Drive sync skipped/failed:', gdriveErr);
    }

    let productImageRecord = null;

    // If productId provided, attach to Product gallery
    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        return NextResponse.json({ error: `Product with ID "${productId}" not found` }, { status: 404 });
      }

      // Count existing images to assign displayOrder
      const currentImageCount = await prisma.productImage.count({ where: { productId } });

      productImageRecord = await prisma.$transaction(async (tx) => {
        if (isPrimary) {
          // Reset other primary flags
          await tx.productImage.updateMany({
            where: { productId, isPrimary: true },
            data: { isPrimary: false },
          });
        }

        const img = await tx.productImage.create({
          data: {
            productId,
            url: uploadResult.storedUrl,
            altText: altText || product.name,
            displayOrder: currentImageCount + 1,
            isPrimary,
            storageKey: uploadResult.fileKey,
          },
        });

        // Sync into Product.images array (MySQL JSON array safe - do not use Prisma push on MySQL)
        const currentImages = Array.isArray(product.images)
          ? (product.images as string[])
          : typeof product.images === 'string' && (product.images as string).trim().length > 0
            ? [(product.images as string).trim()]
            : [];
        const nextImages = currentImages.includes(uploadResult.storedUrl)
          ? currentImages
          : [...currentImages, uploadResult.storedUrl];

        await tx.product.update({
          where: { id: productId },
          data: {
            images: nextImages,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: operator.id,
            action: 'CATALOG_IMAGE_UPLOADED',
            resource: `Product:${productId}`,
            details: {
              imageId: img.id,
              storedUrl: uploadResult.storedUrl,
              sizeBytes: uploadResult.sizeBytes,
              isPrimary,
            },
          },
        });

        return img;
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Image uploaded successfully',
        data: {
          fileKey: uploadResult.fileKey,
          storedUrl: uploadResult.storedUrl,
          sizeBytes: uploadResult.sizeBytes,
          googleDriveFileId,
          productImage: productImageRecord,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
