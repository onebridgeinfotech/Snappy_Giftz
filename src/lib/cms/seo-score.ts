import { countWords, markdownToPlainText, renderMarkdown } from './markdown';

export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  hint?: string;
}

export interface SeoScoreInput {
  title: string;
  slug: string;
  content: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  excerpt?: string | null;
  tagsCount?: number;
  hasCategory?: boolean;
}

/** Rank-Math/Yoast-style on-page SEO checklist. Score is 0–100. */
export function scoreSeo(input: SeoScoreInput): { score: number; checks: SeoCheck[] } {
  const title = (input.seoTitle || input.title || '').trim();
  const description = (input.metaDescription || input.excerpt || '').trim();
  const keyword = (input.focusKeyword || '').trim().toLowerCase();
  const plain = markdownToPlainText(input.content).toLowerCase();
  const words = countWords(input.content);
  const { toc } = renderMarkdown(input.content);
  const firstParagraph = plain.slice(0, 600);
  const keywordHits = keyword ? plain.split(keyword).length - 1 : 0;
  const density = keyword && words ? (keywordHits * keyword.split(/\s+/).length * 100) / words : 0;
  const internalLinks = (input.content.match(/\]\(\/(?!\/)/g) || []).length + (input.content.match(/^::(product|button|cta)\[/gm) || []).length;
  const externalLinks = (input.content.match(/\]\(https?:\/\//g) || []).length;
  const images = (input.content.match(/!\[[^\]]*\]\(/g) || []).length + (input.coverImageUrl ? 1 : 0);

  const checks: SeoCheck[] = [
    { id: 'focus', label: 'Focus keyword set', passed: Boolean(keyword), weight: 10, hint: 'Pick the main phrase this post should rank for.' },
    { id: 'title-length', label: 'SEO title is 30–60 characters', passed: title.length >= 30 && title.length <= 60, weight: 10, hint: `Currently ${title.length} characters.` },
    { id: 'title-keyword', label: 'Focus keyword in SEO title', passed: Boolean(keyword) && title.toLowerCase().includes(keyword), weight: 10 },
    { id: 'desc-length', label: 'Meta description is 120–160 characters', passed: description.length >= 120 && description.length <= 160, weight: 10, hint: `Currently ${description.length} characters.` },
    { id: 'desc-keyword', label: 'Focus keyword in meta description', passed: Boolean(keyword) && description.toLowerCase().includes(keyword), weight: 8 },
    { id: 'slug-keyword', label: 'Focus keyword in URL slug', passed: Boolean(keyword) && input.slug.includes(keyword.replace(/\s+/g, '-')), weight: 6 },
    { id: 'intro-keyword', label: 'Focus keyword in the introduction', passed: Boolean(keyword) && firstParagraph.includes(keyword), weight: 6 },
    { id: 'density', label: 'Keyword density 0.5%–2.5%', passed: density >= 0.5 && density <= 2.5, weight: 6, hint: `Currently ${density.toFixed(1)}%.` },
    { id: 'length', label: 'Content has 600+ words', passed: words >= 600, weight: 10, hint: `Currently ${words} words.` },
    { id: 'headings', label: 'Uses at least two subheadings', passed: toc.length >= 2, weight: 6 },
    { id: 'internal', label: 'Has internal links', passed: internalLinks > 0, weight: 6, hint: 'Link to a product, category or another post.' },
    { id: 'external', label: 'Has an external reference', passed: externalLinks > 0, weight: 3 },
    { id: 'images', label: 'Has a cover image or inline image', passed: images > 0, weight: 5 },
    { id: 'alt', label: 'Cover image has alt text', passed: !input.coverImageUrl || Boolean(input.coverImageAlt?.trim()), weight: 2 },
    { id: 'taxonomy', label: 'Has a category and tags', passed: Boolean(input.hasCategory) && (input.tagsCount || 0) > 0, weight: 2 },
  ];

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  return { score: Math.round((got / total) * 100), checks };
}
