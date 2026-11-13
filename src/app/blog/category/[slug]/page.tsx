import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogListing } from '@/components/blog/BlogListing';
import { breadcrumbSchema, jsonLdScript } from '@/lib/cms/jsonld';
import { buildMetadata } from '@/lib/cms/seo.service';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const cat = await prisma.blogCategory.findUnique({ where: { slug } }).catch(() => null);
  if (!cat) return { title: 'Category not found', robots: { index: false } };
  const meta = buildMetadata({
    path: `/blog/category/${slug}`,
    title: cat.seoTitle || `${cat.name} — Gifting Journal`,
    description: cat.metaDescription || cat.description || `Articles about ${cat.name} from SNAPPY GIFTZ.`,
  });
  if (Number(page) > 1) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const cat = await prisma.blogCategory.findUnique({ where: { slug }, include: { parent: true } }).catch(() => null);
  if (!cat) notFound();
  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Blog', path: '/blog' },
              ...(cat.parent ? [{ name: cat.parent.name, path: `/blog/category/${cat.parent.slug}` }] : []),
              { name: cat.name, path: `/blog/category/${slug}` },
            ])
          ),
        }}
      />
      <BlogListing basePath={`/blog/category/${slug}`} heading={cat.name} intro={cat.description || undefined} filters={{ category: slug, q: sp.q, sort: sp.sort, page: sp.page }} />
    </BlogShell>
  );
}

/** Empty list + default dynamicParams = pages are built on first request, then cached (ISR). */
export function generateStaticParams() {
  return [];
}
