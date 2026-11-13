import { BUSINESS_CONFIG } from '@/config/business';
import { absoluteUrl, getSiteUrl, SITE_NAME } from './site';

type JsonLd = Record<string, unknown>;

export function organizationSchema(): JsonLd {
  const a = BUSINESS_CONFIG.address;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${getSiteUrl()}/#organization`,
    name: SITE_NAME,
    url: getSiteUrl(),
    logo: absoluteUrl('/assets/snappy-gifts-trimmed.png'),
    email: BUSINESS_CONFIG.officialEmail,
    telephone: BUSINESS_CONFIG.whatsappFormatted,
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${a.line1}, ${a.line2}`,
      addressLocality: a.city,
      addressRegion: a.state,
      postalCode: a.pincode,
      addressCountry: 'IN',
    },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(faqs: Array<{ question: string; answer: string }>): JsonLd | null {
  const valid = faqs.filter((f) => f.question?.trim() && f.answer?.trim());
  if (valid.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function personSchema(author: { name: string; slug: string; title?: string | null; avatarUrl?: string | null; socialLinks?: unknown }): JsonLd {
  const links = author.socialLinks && typeof author.socialLinks === 'object' ? Object.values(author.socialLinks as Record<string, string>).filter(Boolean) : [];
  return {
    '@type': 'Person',
    name: author.name,
    url: absoluteUrl(`/blog/author/${author.slug}`),
    ...(author.title ? { jobTitle: author.title } : {}),
    ...(author.avatarUrl ? { image: absoluteUrl(author.avatarUrl) } : {}),
    ...(links.length ? { sameAs: links } : {}),
  };
}

export function articleSchema(post: {
  title: string;
  slug: string;
  description: string;
  image?: string | null;
  publishedAt?: Date | null;
  updatedAt: Date;
  wordCount: number;
  keywords: string[];
  section?: string | null;
  author?: { name: string; slug: string; title?: string | null; avatarUrl?: string | null; socialLinks?: unknown } | null;
}): JsonLd {
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title.slice(0, 110),
    description: post.description,
    image: post.image ? [absoluteUrl(post.image)] : undefined,
    datePublished: (post.publishedAt || post.updatedAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    wordCount: post.wordCount,
    keywords: post.keywords.join(', ') || undefined,
    articleSection: post.section || undefined,
    author: post.author ? personSchema(post.author) : { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@id': `${getSiteUrl()}/#organization`, '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: absoluteUrl('/assets/snappy-gifts-trimmed.png') } },
  };
}

export function serviceSchema(service: { name: string; slug: string; description: string; image?: string | null; priceFrom?: number | null }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    url: absoluteUrl(`/services/${service.slug}`),
    image: service.image ? absoluteUrl(service.image) : undefined,
    provider: { '@id': `${getSiteUrl()}/#organization`, '@type': 'Organization', name: SITE_NAME },
    areaServed: { '@type': 'City', name: BUSINESS_CONFIG.address.city },
    ...(service.priceFrom
      ? { offers: { '@type': 'Offer', priceCurrency: 'INR', price: service.priceFrom, availability: 'https://schema.org/InStock' } }
      : {}),
  };
}

/** Serialize for a <script type="application/ld+json"> tag; escapes `<` so content can't close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
