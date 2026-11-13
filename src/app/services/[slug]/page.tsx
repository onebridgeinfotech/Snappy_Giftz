import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BlogShell } from '@/components/blog/BlogShell';
import { SmartImage } from '@/components/blog/BlogParts';
import { LandingSectionsView } from '@/components/blog/LandingSectionsView';
import { breadcrumbSchema, faqSchema, jsonLdScript, organizationSchema, serviceSchema } from '@/lib/cms/jsonld';
import { parseSections } from '@/lib/cms/landing-sections';
import { buildMetadata } from '@/lib/cms/seo.service';

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

const getService = (slug: string) => prisma.contentPage.findFirst({ where: { kind: 'SERVICE', slug, isPublished: true } }).catch(() => null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getService(slug);
  if (!page) return { title: 'Service not found', robots: { index: false, follow: false } };
  return buildMetadata({
    path: `/services/${slug}`,
    title: page.seoTitle || page.title,
    description: page.heroSubtitle || page.overview?.slice(0, 155) || page.title,
    image: page.heroImageUrl,
    seo: page,
  });
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const page = await getService(slug);
  if (!page) notFound();
  const sections = parseSections(page.sections);
  const schemas = [
    organizationSchema(),
    serviceSchema({ name: page.title, slug, description: page.metaDescription || page.heroSubtitle || page.title, image: page.heroImageUrl, priceFrom: null }),
    breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Services', path: '/services' }, { name: page.title, path: `/services/${slug}` }]),
    faqSchema(sections.faqs || []),
  ].filter(Boolean);

  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />
      <nav aria-label="Breadcrumb" className="text-xs text-[#94A3B8] mb-6 flex items-center gap-1.5">
        <Link href="/" className="hover:text-[#F5BD48]">Home</Link><span aria-hidden="true">/</span>
        <Link href="/services" className="hover:text-[#F5BD48]">Services</Link><span aria-hidden="true">/</span>
        <span className="text-white" aria-current="page">{page.title}</span>
      </nav>
      <section className="grid lg:grid-cols-2 gap-10 items-center mb-16">
        <div className="space-y-5">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-white leading-tight">{page.heroTitle || page.title}</h1>
          {page.heroSubtitle && <p className="text-lg text-[#94A3B8] leading-relaxed">{page.heroSubtitle}</p>}
          <a href="#contact" className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#E5A93C] text-[#111215] font-bold">Get a quote</a>
        </div>
        {page.heroImageUrl && (
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#0b0c10]">
            <SmartImage src={page.heroImageUrl} alt={page.title} sizes="(min-width:1024px) 50vw, 100vw" priority className="object-cover" />
          </div>
        )}
      </section>
      <LandingSectionsView sections={sections} overview={page.overview} pagePath={`/services/${slug}`} />
    </BlogShell>
  );
}

/** Empty list + default dynamicParams = pages are built on first request, then cached (ISR). */
export function generateStaticParams() {
  return [];
}
