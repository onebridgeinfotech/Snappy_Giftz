import { BlogPostStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toStringArray } from './site';

export const PUBLIC_POST_INCLUDE = {
  author: true,
  category: { include: { parent: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.BlogPostInclude;

export type PublicPost = Prisma.BlogPostGetPayload<{ include: typeof PUBLIC_POST_INCLUDE }>;

export type BlogSort = 'latest' | 'trending' | 'most-viewed' | 'popular' | 'oldest';

export interface ListPostsParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string; // slug (includes sub-categories)
  tag?: string; // slug
  author?: string; // slug
  topic?: string;
  collection?: string;
  featured?: boolean;
  sort?: BlogSort;
}

let lastPromotion = 0;

/**
 * Scheduled publishing: SCHEDULED posts whose time has come become PUBLISHED.
 * Runs lazily (at most once a minute) on public reads, so no cron is required;
 * /api/cms/cron/publish can also be hit by an external scheduler.
 */
export async function promoteScheduledPosts(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastPromotion < 60_000) return 0;
  lastPromotion = now;
  const due = await prisma.blogPost.findMany({
    where: { status: BlogPostStatus.SCHEDULED, scheduledAt: { lte: new Date(now) } },
    select: { id: true, scheduledAt: true },
  });
  for (const post of due) {
    await prisma.blogPost.update({
      where: { id: post.id },
      data: { status: BlogPostStatus.PUBLISHED, publishedAt: post.scheduledAt ?? new Date() },
    });
  }
  return due.length;
}

export function livePostWhere(): Prisma.BlogPostWhereInput {
  return { status: BlogPostStatus.PUBLISHED, isTemplate: false, publishedAt: { lte: new Date() } };
}

async function categoryIdsFor(slug: string): Promise<string[]> {
  const cat = await prisma.blogCategory.findUnique({ where: { slug }, include: { children: { select: { id: true } } } });
  if (!cat) return [];
  return [cat.id, ...cat.children.map((c) => c.id)];
}

async function trendingPostIds(days = 7, take = 50): Promise<string[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.blogPageView.groupBy({
    by: ['postId'],
    where: { createdAt: { gte: since } },
    _count: { postId: true },
    orderBy: { _count: { postId: 'desc' } },
    take,
  });
  return rows.map((r) => r.postId);
}

export async function listPosts(params: ListPostsParams = {}) {
  await promoteScheduledPosts().catch(() => 0);
  const page = Math.max(1, Math.floor(params.page || 1));
  const limit = Math.min(48, Math.max(1, Math.floor(params.limit || 12)));
  const and: Prisma.BlogPostWhereInput[] = [livePostWhere()];

  const q = params.q?.trim().slice(0, 120);
  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { excerpt: { contains: q } },
        { focusKeyword: { contains: q } },
        { content: { contains: q } },
        { tags: { some: { tag: { name: { contains: q } } } } },
      ],
    });
  }
  if (params.category) and.push({ categoryId: { in: await categoryIdsFor(params.category) } });
  if (params.tag) and.push({ tags: { some: { tag: { slug: params.tag } } } });
  if (params.author) and.push({ author: { slug: params.author } });
  if (params.collection) and.push({ collection: params.collection });
  if (params.featured) and.push({ isFeatured: true });
  if (params.topic) and.push({ topics: { array_contains: params.topic } });

  const where: Prisma.BlogPostWhereInput = { AND: and };
  const sort = params.sort || 'latest';

  if (sort === 'trending') {
    const ids = await trendingPostIds();
    const posts = await prisma.blogPost.findMany({ where: { AND: [...and, { id: { in: ids } }] }, include: PUBLIC_POST_INCLUDE });
    const ordered = ids.map((id) => posts.find((p) => p.id === id)).filter((p): p is PublicPost => Boolean(p));
    // Fill with latest when there is not enough recent traffic
    const filler =
      ordered.length < page * limit
        ? await prisma.blogPost.findMany({
            where: { AND: [...and, { id: { notIn: ordered.map((p) => p.id) } }] },
            include: PUBLIC_POST_INCLUDE,
            orderBy: { publishedAt: 'desc' },
            take: page * limit - ordered.length,
          })
        : [];
    const all = [...ordered, ...filler];
    const totalCount = await prisma.blogPost.count({ where });
    return paginate(all.slice((page - 1) * limit, page * limit), page, limit, totalCount);
  }

  const orderBy: Prisma.BlogPostOrderByWithRelationInput[] =
    sort === 'most-viewed'
      ? [{ viewCount: 'desc' }, { publishedAt: 'desc' }]
      : sort === 'popular'
        ? [{ likeCount: 'desc' }, { shareCount: 'desc' }, { viewCount: 'desc' }]
        : sort === 'oldest'
          ? [{ publishedAt: 'asc' }]
          : [{ publishedAt: 'desc' }];

  const [posts, totalCount] = await Promise.all([
    prisma.blogPost.findMany({ where, include: PUBLIC_POST_INCLUDE, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.blogPost.count({ where }),
  ]);

  if (q && page === 1) {
    prisma.blogSearchQuery.create({ data: { query: q.toLowerCase(), resultCount: totalCount } }).catch(() => undefined);
  }

  return paginate(posts, page, limit, totalCount);
}

function paginate(posts: PublicPost[], page: number, limit: number, totalCount: number) {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  return { posts, pagination: { page, limit, totalCount, totalPages, hasMore: page < totalPages } };
}

export async function getLivePostBySlug(slug: string): Promise<PublicPost | null> {
  await promoteScheduledPosts().catch(() => 0);
  return prisma.blogPost.findFirst({ where: { slug, ...livePostWhere() }, include: PUBLIC_POST_INCLUDE });
}

/** Any status — for admin preview only. */
export async function getPostForPreview(id: string): Promise<PublicPost | null> {
  return prisma.blogPost.findUnique({ where: { id }, include: PUBLIC_POST_INCLUDE });
}

export async function getRelatedPosts(post: PublicPost, take = 3): Promise<PublicPost[]> {
  const tagIds = post.tags.map((t) => t.tagId);
  const candidates = await prisma.blogPost.findMany({
    where: {
      AND: [
        livePostWhere(),
        { id: { not: post.id } },
        {
          OR: [
            ...(post.categoryId ? [{ categoryId: post.categoryId }] : []),
            ...(post.category?.parentId ? [{ categoryId: post.category.parentId }] : []),
            ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : []),
          ],
        },
      ],
    },
    include: PUBLIC_POST_INCLUDE,
    orderBy: { publishedAt: 'desc' },
    take: 20,
  });
  const topics = new Set(toStringArray(post.topics));
  const scored = candidates
    .map((c) => {
      let score = 0;
      if (c.categoryId === post.categoryId) score += 3;
      score += c.tags.filter((t) => tagIds.includes(t.tagId)).length * 2;
      score += toStringArray(c.topics).filter((t) => topics.has(t)).length;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, take).map((s) => s.c);
}

export async function getRecommendedPosts(excludeIds: string[], take = 3): Promise<PublicPost[]> {
  return prisma.blogPost.findMany({
    where: { AND: [livePostWhere(), { id: { notIn: excludeIds } }] },
    include: PUBLIC_POST_INCLUDE,
    orderBy: [{ isFeatured: 'desc' }, { viewCount: 'desc' }],
    take,
  });
}

export async function getPrevNextPosts(post: PublicPost) {
  const at = post.publishedAt || post.createdAt;
  const select = { slug: true, title: true } as const;
  const [previous, next] = await Promise.all([
    prisma.blogPost.findFirst({ where: { AND: [livePostWhere(), { publishedAt: { lt: at } }] }, orderBy: { publishedAt: 'desc' }, select }),
    prisma.blogPost.findFirst({ where: { AND: [livePostWhere(), { publishedAt: { gt: at } }] }, orderBy: { publishedAt: 'asc' }, select }),
  ]);
  return { previous, next };
}

export async function getCategoryTree() {
  const categories = await prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { posts: { where: livePostWhere() } } } },
  });
  const roots = categories.filter((c) => !c.parentId);
  return roots.map((root) => ({ ...root, children: categories.filter((c) => c.parentId === root.id) }));
}

export async function getPopularTags(take = 30) {
  const tags = await prisma.blogTag.findMany({
    include: { _count: { select: { posts: { where: { post: livePostWhere() } } } } },
  });
  return tags
    .filter((t) => t._count.posts > 0)
    .sort((a, b) => b._count.posts - a._count.posts)
    .slice(0, take);
}

export function postDescription(post: { metaDescription: string | null; excerpt: string | null; title: string }): string {
  return (post.metaDescription || post.excerpt || post.title).slice(0, 300);
}
