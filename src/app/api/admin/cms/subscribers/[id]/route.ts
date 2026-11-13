import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, HttpError, readJson, requireCms } from '@/lib/cms/api';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireCms(req, 'cms:settings');
    const { id } = await params;
    const { status } = await readJson<{ status?: string }>(req);
    if (status !== 'ACTIVE' && status !== 'UNSUBSCRIBED') throw new HttpError(400, 'Invalid status');
    const data = await prisma.newsletterSubscriber.update({ where: { id }, data: { status } });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await requireCms(req, 'cms:settings');
    const { id } = await params;
    await prisma.newsletterSubscriber.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
