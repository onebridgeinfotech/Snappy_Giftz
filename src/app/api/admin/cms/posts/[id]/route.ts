import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit, handleApiError, HttpError, readJson, requireCms } from '@/lib/cms/api';
import { ADMIN_POST_INCLUDE, savePost } from '@/lib/cms/post-admin.service';
import { revalidateBlog } from '@/lib/cms/revalidate';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireCms(req);
    const { id } = await params;
    const post = await prisma.blogPost.findUnique({ where: { id }, include: ADMIN_POST_INCLUDE });
    if (!post) throw new HttpError(404, 'Post not found', 'NOT_FOUND');
    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req);
    const { id } = await params;
    const before = await prisma.blogPost.findUnique({ where: { id }, select: { slug: true, status: true } });
    const post = await savePost(await readJson(req), user, id);
    await audit(user.id, 'CMS_POST_UPDATED', `BlogPost:${post.id}`, { status: post.status, previousStatus: before?.status });
    // Keep old URLs alive when a published post's slug changes
    if (before && before.slug !== post.slug && before.status === 'PUBLISHED') {
      await prisma.redirect
        .upsert({
          where: { fromPath: `/blog/${before.slug}` },
          create: { fromPath: `/blog/${before.slug}`, toPath: `/blog/${post.slug}`, statusCode: 301, note: 'Auto: post slug changed' },
          update: { toPath: `/blog/${post.slug}`, isActive: true },
        })
        .catch(() => undefined);
      const { invalidateRedirectCache } = await import('@/lib/cms/redirects');
      invalidateRedirectCache();
      revalidateBlog(before.slug);
    }
    revalidateBlog(post.slug);
    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const user = await requireCms(req, 'content:delete');
    const { id } = await params;
    const post = await prisma.blogPost.delete({ where: { id } });
    await audit(user.id, 'CMS_POST_DELETED', `BlogPost:${id}`, { title: post.title, slug: post.slug });
    revalidateBlog(post.slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
