import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, requireCms } from '@/lib/cms/api';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const url = new URL(req.url);
    const to = url.searchParams.get('to') ? new Date(`${url.searchParams.get('to')}T23:59:59.999Z`) : new Date();
    const from = url.searchParams.get('from')
      ? new Date(`${url.searchParams.get('from')}T00:00:00.000Z`)
      : new Date(to.getTime() - 29 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }
    const postId = url.searchParams.get('postId') || undefined;
    const range = { gte: from, lte: to };
    const where = { createdAt: range, ...(postId ? { postId } : {}) };

    const [views, sources, keywords, searches, shares, comments, likes] = await Promise.all([
      prisma.blogPageView.findMany({
        where,
        select: { postId: true, visitorHash: true, source: true, readSeconds: true, bounced: true, createdAt: true },
        take: 100_000,
      }),
      prisma.blogPageView.groupBy({ by: ['source'], where, _count: { _all: true } }),
      prisma.blogPageView.groupBy({
        by: ['searchKeyword'],
        where: { ...where, searchKeyword: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { searchKeyword: 'desc' } },
        take: 15,
      }),
      prisma.blogSearchQuery.groupBy({
        by: ['query'],
        where: { createdAt: range },
        _count: { _all: true },
        _avg: { resultCount: true },
        orderBy: { _count: { query: 'desc' } },
        take: 15,
      }),
      prisma.blogPost.aggregate({ _sum: { shareCount: true } }),
      prisma.blogComment.count({ where: { createdAt: range, ...(postId ? { postId } : {}) } }),
      prisma.blogPost.aggregate({ _sum: { likeCount: true } }),
    ]);

    // Daily series
    const byDay = new Map<string, { views: number; visitors: Set<string> }>();
    for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) byDay.set(new Date(t).toISOString().slice(0, 10), { views: 0, visitors: new Set() });
    const perPost = new Map<string, { views: number; visitors: Set<string>; seconds: number; bounces: number }>();
    let seconds = 0;
    let bounces = 0;
    const visitors = new Set<string>();
    for (const v of views) {
      const day = byDay.get(v.createdAt.toISOString().slice(0, 10));
      if (day) {
        day.views++;
        day.visitors.add(v.visitorHash);
      }
      visitors.add(v.visitorHash);
      seconds += v.readSeconds;
      if (v.bounced) bounces++;
      const p = perPost.get(v.postId) ?? { views: 0, visitors: new Set<string>(), seconds: 0, bounces: 0 };
      p.views++;
      p.visitors.add(v.visitorHash);
      p.seconds += v.readSeconds;
      if (v.bounced) p.bounces++;
      perPost.set(v.postId, p);
    }

    const topIds = [...perPost.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 10);
    const posts = await prisma.blogPost.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, title: true, slug: true, seoScore: true } });
    const topPosts = topIds.map(([id, s]) => ({
      ...(posts.find((p) => p.id === id) ?? { id, title: '(deleted)', slug: '', seoScore: 0 }),
      views: s.views,
      uniqueVisitors: s.visitors.size,
      avgReadSeconds: s.views ? Math.round(s.seconds / s.views) : 0,
      bounceRate: s.views ? Math.round((s.bounces / s.views) * 100) : 0,
    }));

    const organic = sources.find((s) => s.source === 'organic')?._count._all ?? 0;
    return NextResponse.json({
      success: true,
      data: {
        range: { from: from.toISOString(), to: to.toISOString() },
        totals: {
          views: views.length,
          uniqueVisitors: visitors.size,
          avgReadSeconds: views.length ? Math.round(seconds / views.length) : 0,
          bounceRate: views.length ? Math.round((bounces / views.length) * 100) : 0,
          organicViews: organic,
          shares: shares._sum.shareCount ?? 0,
          likes: likes._sum.likeCount ?? 0,
          comments,
        },
        daily: [...byDay.entries()].map(([date, d]) => ({ date, views: d.views, visitors: d.visitors.size })),
        sources: sources.map((s) => ({ source: s.source, views: s._count._all })).sort((a, b) => b.views - a.views),
        keywords: keywords.map((k) => ({ keyword: k.searchKeyword, views: k._count._all })),
        searches: searches.map((s) => ({ query: s.query, count: s._count._all, avgResults: Math.round(s._avg.resultCount ?? 0) })),
        topPosts,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
