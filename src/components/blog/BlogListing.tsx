import Link from 'next/link';
import { Search } from 'lucide-react';
import { getCategoryTree, getPopularTags, listPosts, type BlogSort } from '@/lib/cms/blog.service';
import { NewsletterForm } from './BlogClient';
import { PostCard, Pagination } from './BlogParts';

const SORTS: Array<{ id: BlogSort; label: string }> = [
  { id: 'latest', label: 'Latest' },
  { id: 'trending', label: 'Trending' },
  { id: 'most-viewed', label: 'Most viewed' },
  { id: 'popular', label: 'Popular' },
];

export interface ListingFilters {
  q?: string;
  category?: string;
  tag?: string;
  author?: string;
  topic?: string;
  collection?: string;
  featured?: boolean;
  sort?: string;
  page?: string;
}

export async function BlogListing({ basePath, filters, heading, intro }: { basePath: string; filters: ListingFilters; heading: string; intro?: string }) {
  const sort = SORTS.some((s) => s.id === filters.sort) ? (filters.sort as BlogSort) : 'latest';
  const page = Math.max(1, Number(filters.page) || 1);
  const [{ posts, pagination }, tree, tags] = await Promise.all([
    listPosts({ ...filters, sort, page, limit: 12 }),
    getCategoryTree().catch(() => []),
    getPopularTags(20).catch(() => []),
  ]);
  const query = { q: filters.q, sort: sort === 'latest' ? undefined : sort, featured: filters.featured ? '1' : undefined, topic: filters.topic, collection: filters.collection };
  const sortHref = (s: BlogSort) => {
    const sp = new URLSearchParams();
    if (filters.q) sp.set('q', filters.q);
    if (s !== 'latest') sp.set('sort', s);
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3 max-w-3xl">
        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-white">{heading}</h1>
        {intro && <p className="text-[#94A3B8] leading-relaxed">{intro}</p>}
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <form action="/blog" method="get" role="search" className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" aria-hidden="true" />
          <input name="q" defaultValue={filters.q} placeholder="Search articles…" aria-label="Search articles" className="w-full rounded-xl bg-[#17181C] border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F5BD48]" />
        </form>
        <nav aria-label="Sort articles" className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <Link key={s.id} href={sortHref(s.id)} aria-current={sort === s.id ? 'true' : undefined} className={`px-3.5 py-1.5 rounded-full text-xs border ${sort === s.id ? 'bg-[#F5BD48] border-[#F5BD48] text-[#111215] font-bold' : 'border-white/15 text-[#CBD5E1] hover:border-[#F5BD48]/60'}`}>
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid lg:grid-cols-[1fr_18rem] gap-10">
        <div className="space-y-8">
          {filters.q && <p className="text-sm text-[#94A3B8]">{pagination.totalCount} result{pagination.totalCount === 1 ? '' : 's'} for “{filters.q}”</p>}
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 p-10 text-center text-[#94A3B8]">No articles found. Try a different search or <Link href="/blog" className="text-[#F5BD48] underline">browse everything</Link>.</div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {posts.map((p, i) => <PostCard key={p.id} post={p} priority={i < 2} />)}
            </div>
          )}
          <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath={basePath} query={query} />
        </div>

        <aside className="space-y-8" aria-label="Blog sidebar">
          {tree.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-[0.18em] text-[#D5A34A] mb-3">Categories</h2>
              <ul className="space-y-1.5 text-sm">
                {tree.map((c) => (
                  <li key={c.id}>
                    <Link href={`/blog/category/${c.slug}`} className="text-[#E2E8F0] hover:text-[#F5BD48]">{c.name}</Link>
                    {c.children.length > 0 && (
                      <ul className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                        {c.children.map((ch) => <li key={ch.id}><Link href={`/blog/category/${ch.slug}`} className="text-[#94A3B8] hover:text-[#F5BD48]">{ch.name}</Link></li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tags.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-[0.18em] text-[#D5A34A] mb-3">Popular tags</h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => <Link key={t.id} href={`/blog/tag/${t.slug}`} className="px-2.5 py-1 rounded-full border border-white/15 text-xs text-[#CBD5E1] hover:border-[#F5BD48]/60">#{t.name}</Link>)}
              </div>
            </section>
          )}
          <section className="rounded-2xl border border-[#D5A34A]/30 bg-[#17181C] p-5 space-y-3">
            <h2 className="font-serif text-lg font-bold text-white">Gifting ideas, monthly</h2>
            <p className="text-xs text-[#94A3B8]">New guides and offers. No spam.</p>
            <NewsletterForm source="blog-sidebar" />
          </section>
        </aside>
      </div>
    </div>
  );
}
