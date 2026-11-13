import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getPrevNextPosts, getRecommendedPosts, getRelatedPosts, type PublicPost } from '@/lib/cms/blog.service';
import { renderMarkdown } from '@/lib/cms/markdown';
import { articleSchema, breadcrumbSchema, faqSchema, jsonLdScript, organizationSchema } from '@/lib/cms/jsonld';
import { toStringArray } from '@/lib/cms/site';
import { BlogTracker, CommentForm, NewsletterForm, ShareLikeBar } from './BlogClient';
import { PostCard, SmartImage, formatDate } from './BlogParts';

export async function ArticleView({ post, preview = false }: { post: PublicPost; preview?: boolean }) {
  const { html, toc } = renderMarkdown(post.content);
  const faqs = (Array.isArray(post.faqs) ? post.faqs : []) as Array<{ question: string; answer: string }>;
  const [related, prevNext, comments] = preview
    ? [[], { previous: null, next: null }, []]
    : await Promise.all([
        getRelatedPosts(post, 3),
        getPrevNextPosts(post),
        prisma.blogComment.findMany({ where: { postId: post.id, status: 'APPROVED' }, orderBy: { createdAt: 'asc' }, take: 100 }),
      ]);
  const recommended = preview ? [] : await getRecommendedPosts([post.id, ...related.map((r) => r.id)], 3);

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    ...(post.category?.parent ? [{ name: post.category.parent.name, path: `/blog/category/${post.category.parent.slug}` }] : []),
    ...(post.category ? [{ name: post.category.name, path: `/blog/category/${post.category.slug}` }] : []),
    { name: post.title, path: `/blog/${post.slug}` },
  ];
  const schemas = [
    organizationSchema(),
    articleSchema({
      title: post.title,
      slug: post.slug,
      description: post.metaDescription || post.excerpt || post.title,
      image: post.ogImageUrl || post.coverImageUrl,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      wordCount: post.wordCount,
      keywords: [...toStringArray(post.keywords), ...post.tags.map((t) => t.tag.name)],
      section: post.category?.name,
      author: post.author,
    }),
    breadcrumbSchema(crumbs),
    faqSchema(faqs),
  ].filter(Boolean);

  return (
    <article className="max-w-3xl mx-auto">
      {!preview && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schemas) }} />}
      {!preview && <BlogTracker slug={post.slug} />}

      <nav aria-label="Breadcrumb" className="text-xs text-[#94A3B8] mb-6 flex flex-wrap items-center gap-1.5">
        {crumbs.slice(0, -1).map((c) => (
          <span key={c.path} className="flex items-center gap-1.5">
            <Link href={c.path} className="hover:text-[#F5BD48]">{c.name}</Link>
            <span aria-hidden="true">/</span>
          </span>
        ))}
        <span className="text-white truncate max-w-[16rem]" aria-current="page">{post.title}</span>
      </nav>

      <header className="space-y-4 mb-8">
        {post.category && <Link href={`/blog/category/${post.category.slug}`} className="text-xs uppercase tracking-wider text-[#D5A34A] hover:underline">{post.category.name}</Link>}
        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-white leading-tight">{post.title}</h1>
        {post.excerpt && <p className="text-lg text-[#94A3B8] leading-relaxed">{post.excerpt}</p>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#94A3B8]">
          {post.author && <Link href={`/blog/author/${post.author.slug}`} className="text-white hover:text-[#F5BD48]">{post.author.name}</Link>}
          <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /><time dateTime={(post.publishedAt || post.createdAt).toISOString()}>{formatDate(post.publishedAt || post.createdAt)}</time></span>
          {post.updatedAt.getTime() - (post.publishedAt || post.createdAt).getTime() > 86_400_000 && <span>Updated {formatDate(post.updatedAt)}</span>}
          <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{post.readingTimeMinutes} min read</span>
        </div>
      </header>

      {post.coverImageUrl && (
        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#0b0c10]">
          <SmartImage src={post.coverImageUrl} alt={post.coverImageAlt || post.title} sizes="(min-width:768px) 768px, 100vw" priority className="object-cover" />
        </div>
      )}

      {toc.length >= 3 && (
        <nav aria-label="Table of contents" className="mb-10 rounded-2xl border border-white/10 bg-[#17181C] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#D5A34A] mb-3">In this article</p>
          <ol className="space-y-1.5 text-sm">
            {toc.map((t) => (
              <li key={t.id} className={t.level === 3 ? 'ml-4' : ''}>
                <a href={`#${t.id}`} className="text-[#CBD5E1] hover:text-[#F5BD48]">{t.text}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="cms-prose" dangerouslySetInnerHTML={{ __html: html }} />

      {faqs.length > 0 && (
        <section className="mt-12 space-y-3" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="font-serif text-2xl font-bold text-white">Frequently asked questions</h2>
          {faqs.map((f, i) => (
            <details key={i} className="group rounded-xl border border-white/10 bg-[#17181C] p-4">
              <summary className="cursor-pointer font-semibold text-white list-none flex justify-between gap-4">{f.question}<span className="text-[#F5BD48] group-open:rotate-45 transition-transform">+</span></summary>
              <p className="mt-3 text-sm text-[#94A3B8] leading-relaxed">{f.answer}</p>
            </details>
          ))}
        </section>
      )}

      {post.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {post.tags.map((t) => <Link key={t.tagId} href={`/blog/tag/${t.tag.slug}`} className="px-2.5 py-1 rounded-full border border-white/15 text-xs text-[#CBD5E1] hover:border-[#F5BD48]/60">#{t.tag.name}</Link>)}
        </div>
      )}

      {!preview && (
        <div className="mt-8 pt-6 border-t border-white/10">
          <ShareLikeBar slug={post.slug} title={post.title} likes={post.likeCount} />
        </div>
      )}

      {post.author && (
        <aside className="mt-10 flex gap-4 rounded-2xl border border-white/10 bg-[#17181C] p-5" aria-label="About the author">
          {post.author.avatarUrl && (
            <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0"><SmartImage src={post.author.avatarUrl} alt={post.author.name} sizes="56px" className="object-cover" /></div>
          )}
          <div>
            <Link href={`/blog/author/${post.author.slug}`} className="font-bold text-white hover:text-[#F5BD48]">{post.author.name}</Link>
            {post.author.title && <p className="text-xs text-[#D5A34A]">{post.author.title}</p>}
            {post.author.bio && <p className="text-sm text-[#94A3B8] mt-1">{post.author.bio}</p>}
          </div>
        </aside>
      )}

      {!preview && (prevNext.previous || prevNext.next) && (
        <nav aria-label="Previous and next articles" className="mt-10 grid sm:grid-cols-2 gap-4">
          {prevNext.previous ? (
            <Link rel="prev" href={`/blog/${prevNext.previous.slug}`} className="rounded-xl border border-white/10 p-4 hover:border-[#F5BD48]/60">
              <span className="text-xs text-[#94A3B8] inline-flex items-center gap-1"><ChevronLeft className="w-3 h-3" /> Previous</span>
              <span className="block text-sm text-white mt-1">{prevNext.previous.title}</span>
            </Link>
          ) : <span />}
          {prevNext.next && (
            <Link rel="next" href={`/blog/${prevNext.next.slug}`} className="rounded-xl border border-white/10 p-4 hover:border-[#F5BD48]/60 sm:text-right">
              <span className="text-xs text-[#94A3B8] inline-flex items-center gap-1 sm:justify-end w-full">Next <ChevronRight className="w-3 h-3" /></span>
              <span className="block text-sm text-white mt-1">{prevNext.next.title}</span>
            </Link>
          )}
        </nav>
      )}

      {!preview && (
        <section className="mt-12 rounded-2xl border border-[#D5A34A]/30 bg-[#17181C] p-6 space-y-3">
          <h2 className="font-serif text-xl font-bold text-white">Get new gift ideas in your inbox</h2>
          <NewsletterForm source={`post:${post.slug}`} />
        </section>
      )}

      {!preview && (
        <section className="mt-12" aria-labelledby="comments-heading">
          <h2 id="comments-heading" className="font-serif text-2xl font-bold text-white mb-5">Comments ({comments.length})</h2>
          <ul className="space-y-4 mb-8">
            {comments.map((c) => (
              <li key={c.id} className="rounded-xl bg-[#17181C] border border-white/10 p-4">
                <p className="text-sm font-bold text-white">{c.authorName} <span className="text-xs font-normal text-[#64748B]">· {formatDate(c.createdAt)}</span></p>
                <p className="text-sm text-[#CBD5E1] mt-1 whitespace-pre-line">{c.body}</p>
              </li>
            ))}
          </ul>
          <CommentForm slug={post.slug} />
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-serif text-2xl font-bold text-white mb-5">Related articles</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:-mx-24">{related.map((p) => <PostCard key={p.id} post={p} />)}</div>
        </section>
      )}
      {recommended.length > 0 && (
        <section className="mt-16" aria-labelledby="rec-heading">
          <h2 id="rec-heading" className="font-serif text-2xl font-bold text-white mb-5">Recommended for you</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:-mx-24">{recommended.map((p) => <PostCard key={p.id} post={p} />)}</div>
        </section>
      )}
    </article>
  );
}
