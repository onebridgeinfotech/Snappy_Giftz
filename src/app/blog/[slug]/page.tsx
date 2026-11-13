import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleView } from '@/components/blog/ArticleView';
import { BlogShell } from '@/components/blog/BlogShell';
import { getLivePostBySlug, postDescription } from '@/lib/cms/blog.service';
import { buildMetadata } from '@/lib/cms/seo.service';
import { toStringArray } from '@/lib/cms/site';

// ISR: pages are generated on first request, then refreshed every 5 minutes or on publish/edit.
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getLivePostBySlug(slug).catch(() => null);
  if (!post) return { title: 'Article not found', robots: { index: false, follow: false } };
  return buildMetadata({
    path: `/blog/${post.slug}`,
    title: post.seoTitle || post.title,
    description: postDescription(post),
    image: post.ogImageUrl || post.coverImageUrl,
    type: 'article',
    seo: post,
    keywords: [...(post.focusKeyword ? [post.focusKeyword] : []), ...toStringArray(post.keywords)],
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    authors: post.author ? [post.author.name] : undefined,
    section: post.category?.name,
    tags: post.tags.map((t) => t.tag.name),
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getLivePostBySlug(slug).catch(() => null);
  if (!post) notFound();
  return (
    <BlogShell>
      <ArticleView post={post} />
    </BlogShell>
  );
}

/** Empty list + default dynamicParams = pages are built on first request, then cached (ISR). */
export function generateStaticParams() {
  return [];
}
