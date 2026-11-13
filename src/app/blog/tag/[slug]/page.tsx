import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogListing } from '@/components/blog/BlogListing';
import { buildMetadata } from '@/lib/cms/seo.service';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const tag = await prisma.blogTag.findUnique({ where: { slug } }).catch(() => null);
  if (!tag) return { title: 'Tag not found', robots: { index: false } };
  const meta = buildMetadata({ path: `/blog/tag/${slug}`, title: `#${tag.name} — Gifting Journal`, description: `Articles tagged ${tag.name} from SNAPPY GIFTZ.` });
  if (Number(page) > 1) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const tag = await prisma.blogTag.findUnique({ where: { slug } }).catch(() => null);
  if (!tag) notFound();
  return (
    <BlogShell>
      <BlogListing basePath={`/blog/tag/${slug}`} heading={`#${tag.name}`} filters={{ tag: slug, q: sp.q, sort: sp.sort, page: sp.page }} />
    </BlogShell>
  );
}

/** Empty list + default dynamicParams = pages are built on first request, then cached (ISR). */
export function generateStaticParams() {
  return [];
}
