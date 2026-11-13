import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogListing } from '@/components/blog/BlogListing';
import { SmartImage } from '@/components/blog/BlogParts';
import { jsonLdScript, personSchema } from '@/lib/cms/jsonld';
import { absoluteUrl } from '@/lib/cms/site';
import { buildMetadata } from '@/lib/cms/seo.service';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const author = await prisma.blogAuthor.findUnique({ where: { slug } }).catch(() => null);
  if (!author || !author.isActive) return { title: 'Author not found', robots: { index: false } };
  const meta = buildMetadata({ path: `/blog/author/${slug}`, title: `${author.name} — Gifting Journal`, description: author.bio?.slice(0, 160) || `Articles by ${author.name}.`, image: author.avatarUrl });
  if (Number(page) > 1) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const author = await prisma.blogAuthor.findUnique({ where: { slug } }).catch(() => null);
  if (!author || !author.isActive) notFound();
  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript({ '@context': 'https://schema.org', ...personSchema(author), mainEntityOfPage: absoluteUrl(`/blog/author/${slug}`) }) }} />
      <div className="flex items-center gap-5 mb-10">
        {author.avatarUrl && (
          <div className="relative w-20 h-20 rounded-full overflow-hidden shrink-0">
            <SmartImage src={author.avatarUrl} alt={author.name} sizes="80px" className="object-cover" />
          </div>
        )}
        <div>
          {author.title && <p className="text-xs uppercase tracking-wider text-[#D5A34A]">{author.title}</p>}
          {author.bio && <p className="text-[#94A3B8] max-w-2xl mt-1">{author.bio}</p>}
        </div>
      </div>
      <BlogListing basePath={`/blog/author/${slug}`} heading={`Articles by ${author.name}`} filters={{ author: slug, q: sp.q, sort: sp.sort, page: sp.page }} />
    </BlogShell>
  );
}
