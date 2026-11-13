import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, requireCms } from '@/lib/cms/api';
import { promoteScheduledPosts } from '@/lib/cms/blog.service';

const LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  seoScore: true,
  viewCount: true,
  scheduledAt: true,
  publishedAt: true,
  updatedAt: true,
  lastEditedBy: true,
} as const;

export async function GET(req: Request) {
  try {
    await requireCms(req);
    await promoteScheduledPosts(true).catch(() => 0);
    const notTemplate = { isTemplate: false };
    const [drafts, published, scheduled, archived, comments, subscribers, avgSeo, views30, recent, top, upcoming, lowSeo] = await Promise.all([
      prisma.blogPost.count({ where: { ...notTemplate, status: 'DRAFT' } }),
      prisma.blogPost.count({ where: { ...notTemplate, status: 'PUBLISHED' } }),
      prisma.blogPost.count({ where: { ...notTemplate, status: 'SCHEDULED' } }),
      prisma.blogPost.count({ where: { ...notTemplate, status: 'ARCHIVED' } }),
      prisma.blogComment.count({ where: { status: 'PENDING' } }),
      prisma.newsletterSubscriber.count({ where: { status: 'ACTIVE' } }),
      prisma.blogPost.aggregate({ where: { ...notTemplate, status: 'PUBLISHED' }, _avg: { seoScore: true } }),
      prisma.blogPageView.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      prisma.blogPost.findMany({ where: notTemplate, select: LIST_SELECT, orderBy: { updatedAt: 'desc' }, take: 6 }),
      prisma.blogPost.findMany({ where: { ...notTemplate, status: 'PUBLISHED' }, select: LIST_SELECT, orderBy: { viewCount: 'desc' }, take: 5 }),
      prisma.blogPost.findMany({ where: { status: 'SCHEDULED' }, select: LIST_SELECT, orderBy: { scheduledAt: 'asc' }, take: 5 }),
      prisma.blogPost.findMany({ where: { ...notTemplate, status: 'PUBLISHED', seoScore: { lt: 60 } }, select: LIST_SELECT, orderBy: { seoScore: 'asc' }, take: 5 }),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        counts: { drafts, published, scheduled, archived, pendingComments: comments, subscribers },
        avgSeoScore: Math.round(avgSeo._avg.seoScore ?? 0),
        views30d: views30,
        recent,
        top,
        upcoming,
        lowSeo,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
