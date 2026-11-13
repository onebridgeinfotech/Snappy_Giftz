import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { livePostWhere } from '@/lib/cms/blog.service';
import { getSiteUrl } from '@/lib/cms/site';

export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: Entry['changeFrequency'] }> = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  { path: '/blog', priority: 0.8, changeFrequency: 'daily' },
  { path: '/services', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/shipping-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const entries: Entry[] = [];

  try {
    const overrides = await prisma.seoEntry.findMany();
    const byPath = new Map(overrides.map((o) => [o.path, o]));
    for (const s of STATIC_PATHS) {
      const o = byPath.get(s.path || '/');
      if (o && (!o.includeInSitemap || !o.robotsIndex)) continue;
      entries.push({
        url: `${base}${s.path}`,
        lastModified: o?.updatedAt ?? new Date(),
        changeFrequency: (o?.changeFrequency as Entry['changeFrequency']) ?? s.changeFrequency,
        priority: o?.sitemapPriority ?? s.priority,
      });
    }
    // Any extra custom paths added in SEO Manager
    for (const o of overrides) {
      if (STATIC_PATHS.some((s) => (s.path || '/') === o.path) || !o.includeInSitemap || !o.robotsIndex) continue;
      entries.push({ url: `${base}${o.path}`, lastModified: o.updatedAt, changeFrequency: o.changeFrequency as Entry['changeFrequency'], priority: o.sitemapPriority });
    }
  } catch {
    entries.push(...STATIC_PATHS.map((s) => ({ url: `${base}${s.path}`, lastModified: new Date(), changeFrequency: s.changeFrequency, priority: s.priority })));
  }

  try {
    const [products, services, posts, categories, tags, authors] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, isArchived: false },
        select: { slug: true, updatedAt: true, contentPage: { select: { includeInSitemap: true, robotsIndex: true, isPublished: true, updatedAt: true } } },
      }),
      prisma.contentPage.findMany({ where: { kind: 'SERVICE', isPublished: true, includeInSitemap: true, robotsIndex: true }, select: { slug: true, updatedAt: true } }),
      prisma.blogPost.findMany({
        where: { ...livePostWhere(), includeInSitemap: true, robotsIndex: true },
        select: { slug: true, updatedAt: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 5000,
      }),
      prisma.blogCategory.findMany({ where: { posts: { some: livePostWhere() } }, select: { slug: true, updatedAt: true } }),
      prisma.blogTag.findMany({ where: { posts: { some: { post: livePostWhere() } } }, select: { slug: true } }),
      prisma.blogAuthor.findMany({ where: { isActive: true, posts: { some: livePostWhere() } }, select: { slug: true, updatedAt: true } }),
    ]);

    for (const p of products) {
      const cp = p.contentPage;
      if (cp && (!cp.includeInSitemap || !cp.robotsIndex || !cp.isPublished)) continue;
      entries.push({ url: `${base}/products/${p.slug}`, lastModified: cp?.updatedAt && cp.updatedAt > p.updatedAt ? cp.updatedAt : p.updatedAt, changeFrequency: 'weekly', priority: 0.8 });
    }
    for (const s of services) entries.push({ url: `${base}/services/${s.slug}`, lastModified: s.updatedAt, changeFrequency: 'monthly', priority: 0.7 });
    for (const p of posts) entries.push({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'monthly', priority: 0.6 });
    for (const c of categories) entries.push({ url: `${base}/blog/category/${c.slug}`, lastModified: c.updatedAt, changeFrequency: 'weekly', priority: 0.5 });
    for (const t of tags) entries.push({ url: `${base}/blog/tag/${t.slug}`, changeFrequency: 'weekly', priority: 0.3 });
    for (const a of authors) entries.push({ url: `${base}/blog/author/${a.slug}`, lastModified: a.updatedAt, changeFrequency: 'monthly', priority: 0.3 });
  } catch (error) {
    console.error('[SITEMAP] dynamic entries skipped:', error);
  }

  return entries;
}
