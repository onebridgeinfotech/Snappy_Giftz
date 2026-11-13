import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, readJson, requireCms, str } from '@/lib/cms/api';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireCms(req);
    const { id } = await params;
    const body = await readJson(req);
    const data = await prisma.mediaAsset.update({ where: { id }, data: { altText: str(body.altText, 200) } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Removes the library entry. The file itself is kept on disk so already-published posts never break. */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'content:delete');
    const { id } = await params;
    const asset = await prisma.mediaAsset.delete({ where: { id } });
    await audit(user.id, 'CMS_MEDIA_REMOVED', `MediaAsset:${id}`, { url: asset.url });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
