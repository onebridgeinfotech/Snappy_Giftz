import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Role } from '@prisma/client';
import { ArticleView } from '@/components/blog/ArticleView';
import { BlogShell } from '@/components/blog/BlogShell';
import { getPostForPreview } from '@/lib/cms/blog.service';
import { getOptionalUser, hasRole } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Preview', robots: { index: false, follow: false } };

/** Draft/scheduled preview. Only signed-in staff/admin can see it; everyone else gets a 404. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOptionalUser();
  if (!user || !hasRole(user.role, [Role.ADMIN, Role.STAFF])) notFound();
  const post = await getPostForPreview(id);
  if (!post) notFound();
  return (
    <BlogShell>
      <div className="max-w-3xl mx-auto mb-6 rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm text-amber-200" role="status">
        Preview — status: <strong>{post.status}</strong>. This page is not public or indexed.
      </div>
      <ArticleView post={post} preview />
    </BlogShell>
  );
}
