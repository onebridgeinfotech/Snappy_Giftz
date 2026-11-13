import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, HttpError, requireCms } from '@/lib/cms/api';
import { localStorageService, StorageValidationError } from '@/services/storage/local-storage.service';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const q = new URL(req.url).searchParams.get('q')?.trim();
    const data = await prisma.mediaAsset.findMany({
      where: q ? { OR: [{ fileName: { contains: q } }, { altText: { contains: q } }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Upload an image to the media library (JPEG/PNG/WebP, magic-byte checked, 10 MB max). */
export async function POST(req: Request) {
  try {
    const user = await requireCms(req);
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof Blob)) throw new HttpError(400, 'No image file provided in "file" form field');
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = (file as File).name || 'upload.jpg';
    const upload = await localStorageService.uploadFile({ fileBuffer: buffer, fileName, mimeType: file.type || 'image/jpeg', folder: 'media' });
    const asset = await prisma.mediaAsset.create({
      data: {
        url: upload.storedUrl,
        fileKey: upload.fileKey,
        fileName: fileName.slice(0, 190),
        mimeType: file.type || 'image/jpeg',
        sizeBytes: upload.sizeBytes,
        altText: form.get('altText')?.toString().trim().slice(0, 200) || null,
        uploadedBy: user.id,
      },
    });
    await audit(user.id, 'CMS_MEDIA_UPLOADED', `MediaAsset:${asset.id}`, { fileName: asset.fileName, sizeBytes: asset.sizeBytes });
    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error) {
    if (error instanceof StorageValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    return handleApiError(error);
  }
}
