import { BlogPostStatus, Prisma, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/catalog/validation';
import { can, HttpError, bool, str } from './api';
import { autoExcerpt, countWords, readingTimeMinutes } from './markdown';
import { scoreSeo } from './seo-score';
import { toStringArray } from './site';

export const ADMIN_POST_INCLUDE = {
  author: true,
  category: true,
  tags: { include: { tag: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.BlogPostInclude;

const STATUSES = Object.values(BlogPostStatus) as string[];

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base).slice(0, 180) || 'post';
  let candidate = root;
  for (let n = 2; n < 200; n++) {
    const clash = await prisma.blogPost.findFirst({ where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return candidate;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

async function resolveTagIds(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names.slice(0, 25)) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await prisma.blogTag.upsert({ where: { slug }, create: { name: name.trim().slice(0, 60), slug }, update: {} });
    ids.push(tag.id);
  }
  return [...new Set(ids)];
}

function faqList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((f) => ({ question: String((f as any)?.question || '').trim(), answer: String((f as any)?.answer || '').trim() }))
    .filter((f) => f.question && f.answer)
    .slice(0, 20);
}

/**
 * Create or update a post. Enforces the CMS permission model: editors (STAFF)
 * may only save DRAFTs; publishing, scheduling and archiving need ADMIN.
 */
export async function savePost(input: Record<string, unknown>, user: User, id?: string) {
  const existing = id ? await prisma.blogPost.findUnique({ where: { id }, include: { tags: true } }) : null;
  if (id && !existing) throw new HttpError(404, 'Post not found', 'NOT_FOUND');

  const title = str(input.title, 200) ?? existing?.title;
  if (!title || title.length < 3) throw new HttpError(400, 'Title must be at least 3 characters');
  const content = typeof input.content === 'string' ? input.content.slice(0, 500_000) : existing?.content ?? '';

  let status = (typeof input.status === 'string' && STATUSES.includes(input.status) ? input.status : existing?.status ?? 'DRAFT') as BlogPostStatus;
  const statusChanged = !existing || existing.status !== status;
  if (status !== BlogPostStatus.DRAFT && statusChanged && !can(user, 'content:publish')) {
    throw new HttpError(403, 'Only admins can publish, schedule or archive posts. Save as draft instead.', 'FORBIDDEN');
  }
  if (existing && existing.status === BlogPostStatus.PUBLISHED && !can(user, 'content:publish')) {
    throw new HttpError(403, 'Only admins can edit published posts.', 'FORBIDDEN');
  }

  const scheduledAt = input.scheduledAt ? new Date(String(input.scheduledAt)) : existing?.scheduledAt ?? null;
  if (status === BlogPostStatus.SCHEDULED) {
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) throw new HttpError(400, 'Choose a publish date and time for scheduling');
    if (scheduledAt.getTime() <= Date.now()) status = BlogPostStatus.PUBLISHED;
  }
  let publishedAt = existing?.publishedAt ?? null;
  if (status === BlogPostStatus.PUBLISHED && !publishedAt) publishedAt = scheduledAt && scheduledAt.getTime() <= Date.now() ? scheduledAt : new Date();
  if (input.publishedAt && can(user, 'content:publish')) {
    const d = new Date(String(input.publishedAt));
    if (!Number.isNaN(d.getTime())) publishedAt = d;
  }

  const slugSource = str(input.slug, 200) || existing?.slug || title;
  const slug = await uniqueSlug(slugSource, existing?.id);
  const tagNames = input.tags !== undefined ? toStringArray(input.tags) : null;
  const tagIds = tagNames ? await resolveTagIds(tagNames) : existing?.tags.map((t) => t.tagId) ?? [];

  const pick = <T>(key: string, parse: (v: unknown) => T, current: T): T => (key in input ? parse(input[key]) : current);
  const excerpt = pick('excerpt', (v) => str(v, 600), existing?.excerpt ?? null) || autoExcerpt(content, 200) || null;
  const categoryId = pick('categoryId', (v) => str(v, 64), existing?.categoryId ?? null);
  const seoTitle = pick('seoTitle', (v) => str(v, 120), existing?.seoTitle ?? null);
  const metaDescription = pick('metaDescription', (v) => str(v, 320), existing?.metaDescription ?? null);
  const focusKeyword = pick('focusKeyword', (v) => str(v, 80), existing?.focusKeyword ?? null);
  const coverImageUrl = pick('coverImageUrl', (v) => str(v, 1000), existing?.coverImageUrl ?? null);
  const coverImageAlt = pick('coverImageAlt', (v) => str(v, 200), existing?.coverImageAlt ?? null);

  const { score } = scoreSeo({ title, slug, content, seoTitle, metaDescription, focusKeyword, coverImageUrl, coverImageAlt, excerpt, tagsCount: tagIds.length, hasCategory: Boolean(categoryId) });

  const data = {
    title,
    slug,
    content,
    excerpt,
    coverImageUrl,
    coverImageAlt,
    status,
    publishedAt,
    scheduledAt: status === BlogPostStatus.SCHEDULED ? scheduledAt : existing?.scheduledAt ?? null,
    isFeatured: pick('isFeatured', (v) => bool(v, false), existing?.isFeatured ?? false),
    isTemplate: pick('isTemplate', (v) => bool(v, false), existing?.isTemplate ?? false),
    templateName: pick('templateName', (v) => str(v, 120), existing?.templateName ?? null),
    authorId: pick('authorId', (v) => str(v, 64), existing?.authorId ?? null),
    categoryId,
    topics: pick('topics', (v) => toStringArray(v).slice(0, 20), toStringArray(existing?.topics)),
    collection: pick('collection', (v) => str(v, 120), existing?.collection ?? null),
    seoTitle,
    metaDescription,
    focusKeyword,
    keywords: pick('keywords', (v) => toStringArray(v).slice(0, 30), toStringArray(existing?.keywords)),
    canonicalUrl: pick('canonicalUrl', (v) => str(v, 1000), existing?.canonicalUrl ?? null),
    ogImageUrl: pick('ogImageUrl', (v) => str(v, 1000), existing?.ogImageUrl ?? null),
    twitterImageUrl: pick('twitterImageUrl', (v) => str(v, 1000), existing?.twitterImageUrl ?? null),
    robotsIndex: pick('robotsIndex', (v) => bool(v, true), existing?.robotsIndex ?? true),
    robotsFollow: pick('robotsFollow', (v) => bool(v, true), existing?.robotsFollow ?? true),
    includeInSitemap: pick('includeInSitemap', (v) => bool(v, true), existing?.includeInSitemap ?? true),
    faqs: pick('faqs', faqList, faqList(existing?.faqs)),
    readingTimeMinutes: readingTimeMinutes(content),
    wordCount: countWords(content),
    seoScore: score,
    lastEditedBy: user.name || user.email,
  };

  return prisma.$transaction(async (tx) => {
    const post = existing
      ? await tx.blogPost.update({ where: { id: existing.id }, data })
      : await tx.blogPost.create({ data });
    await tx.blogPostTag.deleteMany({ where: { postId: post.id } });
    if (tagIds.length) await tx.blogPostTag.createMany({ data: tagIds.map((tagId) => ({ postId: post.id, tagId })) });
    return tx.blogPost.findUniqueOrThrow({ where: { id: post.id }, include: ADMIN_POST_INCLUDE });
  });
}

/** Duplicate a post (or create a post from a template) as a new DRAFT. */
export async function duplicatePost(id: string, user: User, opts: { asTemplate?: boolean; templateName?: string } = {}) {
  const src = await prisma.blogPost.findUnique({ where: { id }, include: { tags: true } });
  if (!src) throw new HttpError(404, 'Post not found', 'NOT_FOUND');
  const fromTemplate = src.isTemplate && !opts.asTemplate;
  const title = opts.asTemplate ? `${opts.templateName || src.title} (template)` : fromTemplate ? src.title.replace(/\s*\(template\)$/i, '') : `${src.title} (copy)`;
  const slug = await uniqueSlug(title);
  const { id: _id, createdAt: _c, updatedAt: _u, tags, viewCount: _v, likeCount: _l, shareCount: _s, publishedAt: _p, scheduledAt: _sa, ...rest } = src;
  return prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.create({
      data: {
        ...rest,
        topics: rest.topics ?? Prisma.JsonNull,
        keywords: rest.keywords ?? Prisma.JsonNull,
        faqs: rest.faqs ?? Prisma.JsonNull,
        title,
        slug,
        status: BlogPostStatus.DRAFT,
        isFeatured: false,
        isTemplate: Boolean(opts.asTemplate),
        templateName: opts.asTemplate ? opts.templateName || src.title : null,
        lastEditedBy: user.name || user.email,
      },
    });
    if (tags.length) await tx.blogPostTag.createMany({ data: tags.map((t) => ({ postId: post.id, tagId: t.tagId })) });
    return tx.blogPost.findUniqueOrThrow({ where: { id: post.id }, include: ADMIN_POST_INCLUDE });
  });
}
