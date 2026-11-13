import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/security/client-ip';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { getSiteUrl } from '@/lib/cms/site';

const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia)\./i;
const SOCIAL_HOSTS = /(facebook|instagram|twitter|x\.com|t\.co|linkedin|pinterest|youtube|whatsapp|reddit)/i;

function classify(referrer: string | null, utm: string | null) {
  if (utm === 'email' || utm === 'newsletter') return { source: 'email', host: null };
  if (!referrer) return { source: 'direct', host: null };
  try {
    const host = new URL(referrer).hostname;
    if (host === new URL(getSiteUrl()).hostname) return { source: 'direct', host: null };
    if (SEARCH_HOSTS.test(host)) return { source: 'organic', host };
    if (SOCIAL_HOSTS.test(host)) return { source: 'social', host };
    return { source: 'referral', host };
  } catch {
    return { source: 'direct', host: null };
  }
}

/**
 * Privacy-friendly analytics. Visitors are identified by a daily-rotating hash of IP + user agent;
 * no raw IP or cookie is stored.
 *   POST {postId|slug, event: 'view'}               -> creates a view row, returns viewId
 *   POST {viewId, event: 'engage', readSeconds, scrollDepth} -> updates it (sent via sendBeacon)
 *   POST {slug, event: 'share'|'like'}              -> bumps counters
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    if (!body) return NextResponse.json({ ok: false }, { status: 400 });
    const ip = getClientIp(req);
    const limit = await enforceRateLimit('BLOG_TRACK', ip, { limit: 120, windowSeconds: 60 });
    if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });

    const event = String(body.event || 'view');

    if (event === 'engage' && typeof body.viewId === 'string') {
      const seconds = Math.min(3600, Math.max(0, Math.round(Number(body.readSeconds) || 0)));
      const depth = Math.min(100, Math.max(0, Math.round(Number(body.scrollDepth) || 0)));
      await prisma.blogPageView.updateMany({
        where: { id: body.viewId },
        data: { readSeconds: seconds, scrollDepth: depth, bounced: seconds < 15 && depth < 25 },
      });
      return NextResponse.json({ ok: true });
    }

    const slug = typeof body.slug === 'string' ? body.slug.slice(0, 200) : '';
    const post = await prisma.blogPost.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { id: true } });
    if (!post) return NextResponse.json({ ok: false }, { status: 404 });

    if (event === 'share' || event === 'like') {
      await prisma.blogPost.update({ where: { id: post.id }, data: event === 'share' ? { shareCount: { increment: 1 } } : { likeCount: { increment: 1 } } });
      return NextResponse.json({ ok: true });
    }

    const day = new Date().toISOString().slice(0, 10);
    const visitorHash = crypto.createHash('sha256').update(`${ip}|${req.headers.get('user-agent') || ''}|${day}`).digest('hex').slice(0, 32);
    const { source, host } = classify(typeof body.referrer === 'string' ? body.referrer : null, typeof body.utm === 'string' ? body.utm : null);
    const keyword = typeof body.keyword === 'string' && body.keyword.trim() ? body.keyword.trim().toLowerCase().slice(0, 120) : null;

    const [view] = await prisma.$transaction([
      prisma.blogPageView.create({ data: { postId: post.id, visitorHash, source, referrerHost: host, searchKeyword: source === 'organic' ? keyword : null } }),
      prisma.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }),
    ]);
    return NextResponse.json({ ok: true, viewId: view.id });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
