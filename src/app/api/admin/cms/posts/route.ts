import { NextResponse } from 'next/server';
import { BlogPostStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, readJson, requireCms } from '@/lib/cms/api';
import { ADMIN_POST_INCLUDE, savePost } from '@/lib/cms/post-admin.service';
import { revalidateBlog } from '@/lib/cms/revalidate';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q')?.trim();
    const templates = url.searchParams.get('templates') === 'true';
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));

    const where: Prisma.BlogPostWhereInput = {
      isTemplate: templates,
      ...(status && (Object.values(BlogPostStatus) as string[]).includes(status) ? { status: status as BlogPostStatus } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }, { focusKeyword: { contains: q } }] } : {}),
    };
    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        include: ADMIN_POST_INCLUDE,
        omit: { content: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ]);
    return NextResponse.json({ success: true, data: posts, pagination: { page, limit, total } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCms(req);
    const body = await readJson(req);
    const post = await savePost(body, user);
    await audit(user.id, 'CMS_POST_CREATED', `BlogPost:${post.id}`, { title: post.title, status: post.status });
    revalidateBlog(post.slug);
    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
