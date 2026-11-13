import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicProductBySlug, getPublicProducts } from '@/lib/catalog/public-catalog.service';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductDetailClient } from '@/components/ProductDetailClient';
import { BUSINESS_CONFIG } from '@/config/business';
import { ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { buildMetadata } from '@/lib/cms/seo.service';
import { breadcrumbSchema, faqSchema, jsonLdScript, organizationSchema } from '@/lib/cms/jsonld';
import { defaultProductSections, mergeSections, parseSections } from '@/lib/cms/landing-sections';
import { LandingSectionsView } from '@/components/blog/LandingSectionsView';
import { absoluteUrl } from '@/lib/cms/site';

// ISR: product pages are cached and refreshed every 10 minutes (and on admin edits).
export const revalidate = 600;

async function getLanding(productId: string) {
  try {
    return await prisma.contentPage.findUnique({ where: { productId } });
  } catch {
    return null;
  }
}

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  let product;
  try {
    product = await getPublicProductBySlug(slug);
  } catch {
    return {
      title: 'Product Unavailable | Snappy Gifts',
      description: 'The requested gift item is currently unavailable.',
      robots: { index: false, follow: false },
    };
  }

  if (!product) {
    return {
      title: 'Product Not Found | Snappy Gifts',
      description: 'The requested gift item is currently unavailable or has been archived.',
      robots: { index: false, follow: false },
    };
  }

  const categoryName = typeof product.category === 'object' ? product.category.name : product.category;
  const landing = await getLanding(product.id);
  if (landing && !landing.isPublished) {
    return { title: 'Product Unavailable | Snappy Gifts', robots: { index: false, follow: false } };
  }
  return buildMetadata({
    path: `/products/${product.slug}`,
    title: landing?.seoTitle || `${product.name} — Personalised Gift in Hyderabad`,
    description: product.tagline || product.description.slice(0, 155),
    image: product.images[0] ?? null,
    seo: landing,
    keywords: [product.name, categoryName, ...(product.occasions || []), 'Personalized Gifts India', 'Luxury Bespoke Gifting'],
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let product;
  try {
    product = await getPublicProductBySlug(slug);
  } catch {
    notFound();
  }

  if (!product) {
    notFound();
  }

  const categoryName = typeof product.category === 'object' ? product.category.name : product.category;
  const priceRupees = Number((product.basePricePaise / 100).toFixed(2));

  // Fetch related products from same category
  let relatedProducts: any[] = [];
  try {
    const relatedResult = await getPublicProducts({
      category: categoryName,
      limit: 4,
    });
    relatedProducts = relatedResult.products
      .filter((p) => p.id !== product.id)
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        basePricePaise: p.basePricePaise,
        images: p.images,
        badge: p.badge,
      }));
  } catch {
    relatedProducts = [];
  }

  // Structured Data (JSON-LD) for Search Engines
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images,
    description: product.description,
    sku: product.slug,
    brand: {
      '@type': 'Brand',
      name: BUSINESS_CONFIG.brandName,
    },
    offers: {
      '@type': 'Offer',
      price: priceRupees,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: `https://snappygiftz.com/products/${product.slug}`,
      seller: {
        '@type': 'Organization',
        name: BUSINESS_CONFIG.brandName,
      },
    },
  };

  if (product.rating && product.rating > 0 && product.reviewsCount && product.reviewsCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewsCount,
    };
  }
  jsonLd.url = absoluteUrl(`/products/${product.slug}`);
  jsonLd.offers.url = jsonLd.url;
  jsonLd.category = categoryName;

  // CMS landing content: admin-written sections override sensible generated defaults
  const landing = await getLanding(product.id);
  if (landing && !landing.isPublished) notFound();
  const sections = mergeSections(
    defaultProductSections({
      name: product.name,
      isCustomizable: product.isCustomizable,
      customizationType: product.customizationType,
      occasions: product.occasions || [],
      recipients: product.recipients || [],
      minOrderQty: product.minOrderQty,
      categoryName,
    }),
    parseSections(landing?.sections)
  );
  const schemas = [
    jsonLd,
    organizationSchema(),
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: categoryName, path: '/#catalog-section' },
      { name: product.name, path: `/products/${product.slug}` },
    ]),
    faqSchema(sections.faqs || []),
  ].filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-[#08090B] text-[#F1F5F9]">
      {/* JSON-LD: Product, Organization, Breadcrumb, FAQ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }}
      />

      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Link href="/" className="hover:text-[#F5BD48] flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </Link>
          <span>/</span>
          <Link href="/#catalog-section" className="hover:text-[#F5BD48] transition-colors">
            {categoryName}
          </Link>
          <span>/</span>
          <span className="text-white font-medium truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Interactive Client Product Details */}
        <ProductDetailClient product={product as any} relatedProducts={relatedProducts} />

        {/* SEO landing content: overview, features, benefits, FAQs, CTAs, contact form... */}
        <div className="pt-8 border-t border-[#D5A34A]/20">
          <LandingSectionsView sections={sections} overview={landing?.overview} pagePath={`/products/${product.slug}`} />
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="pt-8 border-t border-[#D5A34A]/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F5BD48]" />
                <span>Related Keepsakes in {categoryName}</span>
              </h2>
              <Link
                href="/#catalog-section"
                className="text-xs text-[#F5BD48] hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {relatedProducts.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/products/${rel.slug}`}
                  className="group bg-[#17181C] p-4 rounded-2xl border border-[#D5A34A]/25 hover:border-[#D5A34A] transition-all"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-[#08090B] mb-3">
                    <img
                      src={rel.images[0] || '/assets/categories/personalized.jpg'}
                      alt={rel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="font-bold text-xs text-white group-hover:text-[#F5BD48] transition-colors line-clamp-1">
                    {rel.name}
                  </h3>
                  <div className="mt-1 text-xs text-[#D5A34A] font-black">
                    ₹{(rel.basePricePaise / 100).toFixed(0)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}


/** Every active product gets its own prerendered page (new products are built on first visit, then cached). */
export async function generateStaticParams() {
  try {
    const rows = await prisma.product.findMany({ where: { isActive: true, isArchived: false }, select: { slug: true } });
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}
