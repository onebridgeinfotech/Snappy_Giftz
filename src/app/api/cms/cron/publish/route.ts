import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { promoteScheduledPosts } from '@/lib/cms/blog.service';
import { revalidateBlog } from '@/lib/cms/revalidate';

/**
 * Optional external scheduler hook (cron-job.org, Vercel Cron, ...).
 * Send `Authorization: Bearer $CRON_SECRET`. Posts are also promoted lazily on public reads.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const ok = Boolean(secret) && given.length === secret!.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const published = await promoteScheduledPosts(true);
  if (published > 0) revalidateBlog();
  return NextResponse.json({ success: true, published });
}
