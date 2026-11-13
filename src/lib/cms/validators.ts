import { slugify } from '@/lib/catalog/validation';
import { bool, HttpError, str } from './api';
import { parseSections } from './landing-sections';
import { normalizePath } from './redirects';
import { toStringArray } from './site';

export function categoryData(body: Record<string, unknown>) {
  const name = str(body.name, 100);
  if (!name || name.length < 2) throw new HttpError(400, 'Category name must be at least 2 characters');
  return {
    name,
    slug: slugify(str(body.slug, 120) || name),
    description: str(body.description, 2000),
    parentId: str(body.parentId, 64),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    seoTitle: str(body.seoTitle, 120),
    metaDescription: str(body.metaDescription, 320),
  };
}

export function authorData(body: Record<string, unknown>) {
  const name = str(body.name, 100);
  if (!name || name.length < 2) throw new HttpError(400, 'Author name must be at least 2 characters');
  const social = body.socialLinks && typeof body.socialLinks === 'object' ? (body.socialLinks as Record<string, unknown>) : {};
  const socialLinks: Record<string, string> = {};
  for (const key of ['website', 'twitter', 'linkedin', 'instagram']) {
    const v = str(social[key], 300);
    if (v && /^https?:\/\//i.test(v)) socialLinks[key] = v;
  }
  return {
    name,
    slug: slugify(str(body.slug, 120) || name),
    title: str(body.title, 120),
    bio: str(body.bio, 3000),
    avatarUrl: str(body.avatarUrl, 1000),
    email: str(body.email, 200),
    userId: str(body.userId, 64),
    socialLinks,
    isActive: bool(body.isActive, true),
  };
}

export function seoFieldsData(body: Record<string, unknown>) {
  return {
    seoTitle: str(body.seoTitle, 120),
    metaDescription: str(body.metaDescription, 320),
    keywords: toStringArray(body.keywords).slice(0, 30),
    canonicalUrl: str(body.canonicalUrl, 1000),
    ogImageUrl: str(body.ogImageUrl, 1000),
    twitterImageUrl: str(body.twitterImageUrl, 1000),
    robotsIndex: bool(body.robotsIndex, true),
    robotsFollow: bool(body.robotsFollow, true),
    includeInSitemap: bool(body.includeInSitemap, true),
  };
}

export function redirectData(body: Record<string, unknown>) {
  const from = str(body.fromPath, 500);
  const to = str(body.toPath, 1000);
  if (!from || !to) throw new HttpError(400, 'Both "from" and "to" paths are required');
  const fromPath = normalizePath(from);
  if (fromPath === '/' || /^\/(api|admin|_next)(\/|$)/.test(fromPath)) throw new HttpError(400, 'That path cannot be redirected');
  if (!/^(\/(?!\/)|https?:\/\/)/i.test(to)) throw new HttpError(400, 'Destination must start with / or https://');
  if (normalizePath(to) === fromPath) throw new HttpError(400, 'A redirect cannot point to itself');
  const code = Number(body.statusCode);
  return {
    fromPath,
    toPath: to,
    statusCode: [301, 302, 307, 308].includes(code) ? code : 301,
    isActive: bool(body.isActive, true),
    note: str(body.note, 300),
  };
}

export function pageData(body: Record<string, unknown>) {
  const title = str(body.title, 200);
  if (!title) throw new HttpError(400, 'Title is required');
  return {
    title,
    heroTitle: str(body.heroTitle, 200),
    heroSubtitle: str(body.heroSubtitle, 1000),
    heroImageUrl: str(body.heroImageUrl, 1000),
    overview: str(body.overview, 10000),
    sections: parseSections(body.sections) as object,
    isPublished: bool(body.isPublished, true),
    ...seoFieldsData(body),
  };
}
