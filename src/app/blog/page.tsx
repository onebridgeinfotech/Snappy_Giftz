import type { Metadata } from 'next';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogListing } from '@/components/blog/BlogListing';
import { breadcrumbSchema, jsonLdScript, organizationSchema } from '@/lib/cms/jsonld';
import { buildMetadata, getSeoEntry } from '@/lib/cms/seo.service';

export const revalidate = 300;

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const entry = await getSeoEntry('/blog');
  const meta = buildMetadata({
    path: '/blog',
    title: 'Gifting Journal — Gift Ideas & Personalisation Guides',
    description: 'Gift ideas, personalisation guides and corporate gifting tips from the SNAPPY GIFTZ studio in Hyderabad.',
    seo: entry,
    keywords: ['gift ideas', 'personalised gifts', 'corporate gifting', 'Hyderabad gifts'],
  });
  // Search results / deep pagination are thin duplicates: keep them out of the index
  if (one(sp.q) || one(sp.sort) || Number(one(sp.page)) > 1) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function BlogIndexPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript([organizationSchema(), breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }])]) }} />
      <BlogListing
        basePath="/blog"
        heading="The Gifting Journal"
        intro="Ideas, guides and stories on personalised gifting — from birthdays and weddings to corporate hampers."
        filters={{ q: one(sp.q), sort: one(sp.sort), page: one(sp.page), topic: one(sp.topic), collection: one(sp.collection), featured: one(sp.featured) === '1' }}
      />
    </BlogShell>
  );
}
