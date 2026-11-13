import { listPosts } from '@/lib/cms/blog.service';
import { BUSINESS_CONFIG } from '@/config/business';
import { absoluteUrl, getSiteUrl } from '@/lib/cms/site';

export const revalidate = 1800;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  const { posts } = await listPosts({ limit: 30 }).catch(() => ({ posts: [] }));
  const base = getSiteUrl();
  const items = posts
    .map((p) => {
      const url = absoluteUrl(`/blog/${p.slug}`);
      return `<item><title>${esc(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${(p.publishedAt || p.createdAt).toUTCString()}</pubDate>${p.category ? `<category>${esc(p.category.name)}</category>` : ''}<description>${esc(p.metaDescription || p.excerpt || '')}</description>${p.coverImageUrl ? `<enclosure url="${esc(absoluteUrl(p.coverImageUrl))}" type="image/jpeg" length="0"/>` : ''}</item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(BUSINESS_CONFIG.brandName)} Gifting Journal</title><link>${base}/blog</link><description>Gift ideas, personalisation guides and corporate gifting tips.</description><language>en-in</language><atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' } });
}
