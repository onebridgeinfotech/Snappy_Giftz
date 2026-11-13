import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, requireCms } from '@/lib/cms/api';
import { revalidateSite } from '@/lib/cms/revalidate';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCms(req, 'cms:settings');
    const { id } = await params;
    const entry = await prisma.seoEntry.delete({ where: { id } });
    await audit(user.id, 'CMS_SEO_ENTRY_DELETED', `SeoEntry:${id}`, { path: entry.path });
    revalidateSite();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
