import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOptionalUser } from '@/lib/auth/rbac';
import { privateStorageService } from '@/services/storage/private-storage.service';
import { StorageValidationError } from '@/services/storage/local-storage.service';
import { createArtworkUploadRecord } from '@/lib/personalization/personalization.service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser(req);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const cartItemId = (formData.get('cartItemId') as string)?.trim() || null;
    let guestToken = (formData.get('guestToken') as string)?.trim() || req.headers.get('x-guest-token')?.trim() || null;

    if (!user && !guestToken) {
      guestToken = `guest-${Date.now()}-${crypto.randomBytes(12).toString('hex')}`;
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'No file provided in form field "file".', code: 'MISSING_FILE' },
        { status: 400 }
      );
    }

    // Enforce business rule: Maximum 3 images per customized order item
    if (cartItemId) {
      try {
        const existingCount = await prisma.artworkUpload.count({
          where: { cartItemId, status: 'ACTIVE' },
        });
        if (existingCount >= 3) {
          return NextResponse.json(
            {
              error: 'Maximum 3 images allowed per customized item.',
              code: 'MAX_IMAGES_EXCEEDED',
            },
            { status: 400 }
          );
        }
      } catch {
        // Fallback for offline DB
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Enforce size limit: 10 MB (10,485,760 bytes)
    const MAX_ALLOWED = 10 * 1024 * 1024;
    if (buffer.length > MAX_ALLOWED) {
      return NextResponse.json(
        {
          error: `File size exceeds the 10 MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    // Securely validate magic bytes and write to private storage
    const uploadResult = await privateStorageService.storePrivateUpload(
      buffer,
      file.name,
      file.type,
      'customer-artwork'
    );

    // Persist metadata record in database or fallback store
    const record = await createArtworkUploadRecord(uploadResult, {
      userId: user?.id || null,
      guestToken,
      cartItemId: cartItemId || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: record.id,
          originalFilename: record.originalFilename,
          mimeType: record.mimeType,
          sizeBytes: record.sizeBytes,
          cartItemId: record.cartItemId || null,
          guestToken: user ? null : record.guestSessionToken,
          createdAt: record.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process artwork upload.' },
      { status: 500 }
    );
  }
}
