import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, Eye } from 'lucide-react';
import type { PublicPost } from '@/lib/cms/blog.service';

/** next/image (WebP/AVIF, lazy) for same-site paths; plain lazy <img> for any other host. */
export function SmartImage({ src, alt, sizes, priority, className }: { src: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  if (src.startsWith('/') && !src.startsWith('//')) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" className={`absolute inset-0 w-full h-full ${className || ''}`} />;
}

export function formatDate(d: Date | null | undefined) {
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
}

export function PostCard({ post, priority }: { post: PublicPost; priority?: boolean }) {
  return (
    <article className="group flex flex-col bg-[#17181C] rounded-2xl border border-[#D5A34A]/20 hover:border-[#D5A34A]/70 overflow-hidden transition-colors">
      <Link href={`/blog/${post.slug}`} className="block relative aspect-[16/9] bg-[#0b0c10]" tabIndex={-1} aria-hidden="true">
        {post.coverImageUrl ? (
          <SmartImage src={post.coverImageUrl} alt={post.coverImageAlt || post.title} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" priority={priority} className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#D5A34A]/40 font-serif text-3xl">SG</div>
        )}
      </Link>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#D5A34A]">
          {post.category && <Link href={`/blog/category/${post.category.slug}`} className="hover:underline">{post.category.name}</Link>}
          {post.isFeatured && <span className="px-2 py-0.5 rounded-full bg-[#F5BD48]/15">Featured</span>}
        </div>
        <h3 className="font-serif text-lg font-bold text-white leading-snug">
          <Link href={`/blog/${post.slug}`} className="hover:text-[#F5BD48] transition-colors">{post.title}</Link>
        </h3>
        {post.excerpt && <p className="text-sm text-[#94A3B8] line-clamp-3">{post.excerpt}</p>}
        <div className="mt-auto pt-2 flex items-center gap-4 text-xs text-[#64748B]">
          <span>{formatDate(post.publishedAt)}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readingTimeMinutes} min</span>
          {post.viewCount > 0 && <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {post.viewCount}</span>}
        </div>
      </div>
    </article>
  );
}

export function Pagination({ page, totalPages, basePath, query }: { page: number; totalPages: number; basePath: string; query: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) sp.set(k, v);
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  const cls = 'min-w-9 h-9 px-3 inline-flex items-center justify-center rounded-lg border text-sm';
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2 pt-4">
      {page > 1 && <Link rel="prev" href={href(page - 1)} className={`${cls} border-white/15 text-[#CBD5E1] hover:border-[#F5BD48]`}>Previous</Link>}
      {pages.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && p - pages[i - 1] > 1 && <span className="text-[#64748B]">…</span>}
          <Link href={href(p)} aria-current={p === page ? 'page' : undefined} className={`${cls} ${p === page ? 'bg-[#F5BD48] border-[#F5BD48] text-[#111215] font-bold' : 'border-white/15 text-[#CBD5E1] hover:border-[#F5BD48]'}`}>{p}</Link>
        </React.Fragment>
      ))}
      {page < totalPages && <Link rel="next" href={href(page + 1)} className={`${cls} border-white/15 text-[#CBD5E1] hover:border-[#F5BD48]`}>Next</Link>}
    </nav>
  );
}

