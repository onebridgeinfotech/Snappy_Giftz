import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { BlogShell } from '@/components/blog/BlogShell';
import { SmartImage } from '@/components/blog/BlogParts';
import { breadcrumbSchema, jsonLdScript } from '@/lib/cms/jsonld';
import { metadataForStaticPath } from '@/lib/cms/seo.service';

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForStaticPath('/services', {
    title: 'Gifting Services — Custom Engraving, Corporate & Bulk Gifts',
    description: 'Custom engraving, photo gifts, corporate gifting and bulk orders from SNAPPY GIFTZ in Hyderabad.',
  });
}

export default async function ServicesPage() {
  const services = await prisma.contentPage.findMany({ where: { kind: 'SERVICE', isPublished: true }, orderBy: { title: 'asc' } }).catch(() => []);
  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Services', path: '/services' }])) }} />
      <h1 className="font-serif text-3xl sm:text-5xl font-bold text-white mb-3">Our Services</h1>
      <p className="text-[#94A3B8] max-w-2xl mb-10">From one-off personalised gifts to full corporate gifting programmes.</p>
      {services.length === 0 ? (
        <p className="text-[#94A3B8]">Services are coming soon. <Link href="/blog" className="text-[#F5BD48] underline">Read our gifting journal</Link> in the meantime.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s) => (
            <Link key={s.id} href={`/services/${s.slug}`} className="group rounded-2xl border border-[#D5A34A]/20 hover:border-[#D5A34A]/70 bg-[#17181C] overflow-hidden transition-colors">
              {s.heroImageUrl && (
                <div className="relative aspect-[16/9] bg-[#0b0c10]">
                  <SmartImage src={s.heroImageUrl} alt={s.title} sizes="(min-width:1024px) 33vw, 100vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="p-5">
                <h2 className="font-serif text-xl font-bold text-white group-hover:text-[#F5BD48]">{s.title}</h2>
                {s.heroSubtitle && <p className="text-sm text-[#94A3B8] mt-2 line-clamp-3">{s.heroSubtitle}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </BlogShell>
  );
}
