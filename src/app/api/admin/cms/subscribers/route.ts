import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, requireCms } from '@/lib/cms/api';

export async function GET(req: Request) {
  try {
    await requireCms(req, 'cms:settings');
    const url = new URL(req.url);
    const data = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 });
    if (url.searchParams.get('format') === 'csv') {
      const esc = (v: string | null) => `"${(v || '').replace(/"/g, '""')}"`;
      const csv = ['email,name,status,source,subscribed_at', ...data.map((s) => [esc(s.email), esc(s.name), s.status, esc(s.source), s.createdAt.toISOString()].join(','))].join('\n');
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"' },
      });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}
