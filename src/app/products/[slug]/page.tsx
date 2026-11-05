import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicProductBySlug } from '@/lib/catalog/public-catalog.service';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BUSINESS_CONFIG } from '@/config/business';
import {
  Sparkles,
  ShieldCheck,
  Truck,
  ArrowLeft,
  Crown,
  Star,
  CheckCircle2,
  Gift
} from 'lucide-react';

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
  const title = `${product.name} | Snappy Gifts`;
  const description = product.tagline || product.description.slice(0, 160);
  const canonicalUrl = `/products/${product.slug}`;
  const ogImages = product.images.length > 0 ? [product.images[0]] : [];

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      images: ogImages.map((url) => ({ url, alt: product.name })),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages,
    },
    keywords: [
      product.name,
      categoryName,
      ...(product.occasions || []),
      'Personalized Gifts India',
      'Luxury Bespoke Gifting',
    ],
  };
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
  const mrpRupees = Number((product.mrpPaise / 100).toFixed(2));
  const discountPercent = mrpRupees > priceRupees ? Math.round(((mrpRupees - priceRupees) / mrpRupees) * 100) : 0;

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

  // Only include aggregateRating if supported by genuine, verified reviews data
  if (product.rating && product.rating > 0 && product.reviewsCount && product.reviewsCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewsCount,
    };
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FCF9F6] text-slate-800">
      {/* JSON-LD Script for SEO Rich Results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-[#D1395E] flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </Link>
          <span>/</span>
          <span className="text-slate-600">{categoryName}</span>
          <span>/</span>
          <span className="text-slate-900 font-semibold truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Product Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 bg-white rounded-3xl p-6 sm:p-10 border border-[#EADBCE] shadow-xs">
          
          {/* Left Gallery Section */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#FAF5F2] border border-[#EADBCE]">
              <img
                src={product.images[0] || '/assets/categories/personalized.jpg'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.badge && (
                <div className="absolute top-4 left-4 bg-[#2F0B10]/95 backdrop-blur-md text-amber-200 text-xs font-bold px-3 py-1 rounded-md uppercase tracking-widest border border-amber-400/30 flex items-center gap-1 font-mono">
                  <Crown className="w-3.5 h-3.5 text-amber-300" />
                  <span>{product.badge}</span>
                </div>
              )}
            </div>

            {/* Thumbnail Row */}
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="w-20 h-20 rounded-xl overflow-hidden border border-[#EADBCE] bg-[#FAF5F2] shrink-0"
                  >
                    <img src={imgUrl} alt={`${product.name} preview ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Information Section */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#A21D32] bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  {categoryName}
                </span>
                {product.isCustomizable && (
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Personalizable</span>
                  </span>
                )}
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2F0B10] leading-tight">
                {product.name}
              </h1>

              {product.tagline && (
                <p className="text-sm font-medium text-slate-600 italic">
                  "{product.tagline}"
                </p>
              )}

              {/* Price & Discount Display */}
              <div className="flex items-baseline gap-3 pt-2">
                <span className="font-serif text-3xl sm:text-4xl font-bold text-[#2F0B10]">
                  ₹{priceRupees.toLocaleString('en-IN')}
                </span>
                {mrpRupees > priceRupees && (
                  <>
                    <span className="text-base text-slate-400 line-through">
                      ₹{mrpRupees.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Save {discountPercent}%
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                Inclusive of all Indian taxes (GST) • Free insured delivery above ₹999
              </div>

              {/* Description */}
              <div className="pt-4 border-t border-[#EADBCE]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Artisan Description & Specifications
                </h2>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>

              {/* Occasions Tags */}
              {product.occasions && product.occasions.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Recommended Occasions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {product.occasions.map((occ, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-full bg-[#FAF5F2] border border-[#EADBCE] text-slate-700 font-medium"
                      >
                        {occ}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions & Storefront Link */}
            <div className="pt-6 border-t border-[#EADBCE] space-y-3">
              <Link
                href={`/?product=${product.id}#catalog-section`}
                className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#D1395E] to-[#B31D45] text-white font-semibold text-sm hover:shadow-lg transition-all text-center flex items-center justify-center gap-2 shadow-md"
              >
                <Gift className="w-4 h-4" />
                <span>Personalize & Order on Storefront</span>
              </Link>
              <div className="grid grid-cols-2 gap-3 text-center text-[11px] text-slate-600 pt-1">
                <div className="flex items-center justify-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-rose-700" />
                  <span>Ships in 24 Hours</span>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>100% Damage-Proof Guarantee</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
