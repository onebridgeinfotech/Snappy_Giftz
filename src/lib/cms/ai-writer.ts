import { slugify } from '@/lib/catalog/validation';
import { BUSINESS_CONFIG } from '@/config/business';
import { autoExcerpt, markdownToPlainText } from './markdown';
import { HttpError } from './api';

/**
 * AI writing assistant for the CMS.
 *
 * Uses the Claude Messages API when ANTHROPIC_API_KEY is set (model from
 * CMS_AI_MODEL, default claude-sonnet-5-5). Without a key, the deterministic
 * actions (slug, keywords, meta description, CTA, FAQ skeleton) still work
 * from local heuristics; the generative actions return a clear 503.
 */

export const AI_ACTIONS = ['generate', 'rewrite', 'expand', 'summarize', 'grammar', 'seo', 'faqs', 'meta', 'keywords', 'slug', 'cta'] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export interface AiRequest {
  action: AiAction;
  text?: string; // selected text or full article body
  title?: string;
  topic?: string;
  focusKeyword?: string;
  tone?: string;
  length?: 'short' | 'medium' | 'long';
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const BRAND_CONTEXT = `You write for ${BUSINESS_CONFIG.brandName}, a personalised luxury gifting studio in Hyderabad, India (custom engraving, photo gifts, hampers, corporate gifting, express local delivery). Audience: Indian gift shoppers and corporate buyers. Use Indian English, INR prices if any, and never invent statistics, awards or customer names.`;

const STOP_WORDS = new Set(
  'a an and are as at be but by for from has have how i in is it its of on or our so that the this to was we were what when where which who why will with you your can do does not more most into than then them they their there these those also just about over very'.split(' ')
);

function heuristicKeywords(text: string, focus?: string, max = 10): string[] {
  const words = markdownToPlainText(text).toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
  const counts = new Map<string, number>();
  words.forEach((w, i) => {
    if (STOP_WORDS.has(w)) return;
    counts.set(w, (counts.get(w) || 0) + 1);
    const next = words[i + 1];
    if (next && !STOP_WORDS.has(next)) {
      const bigram = `${w} ${next}`;
      counts.set(bigram, (counts.get(bigram) || 0) + 1.5);
    }
  });
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
  return [...new Set([...(focus ? [focus.toLowerCase()] : []), ...ranked])].slice(0, max);
}

function heuristicMeta(title: string, text: string, focus?: string): string {
  const base = autoExcerpt(text, 150) || title;
  if (focus && !base.toLowerCase().includes(focus.toLowerCase())) {
    return autoExcerpt(`${focus.charAt(0).toUpperCase()}${focus.slice(1)}: ${base}`, 158);
  }
  return base.slice(0, 160);
}

function localResult(req: AiRequest): unknown | undefined {
  const text = req.text || '';
  const title = req.title || req.topic || '';
  switch (req.action) {
    case 'slug':
      return slugify(req.focusKeyword || title || text.slice(0, 80)).split('-').slice(0, 8).join('-');
    case 'keywords':
      return heuristicKeywords(`${title}\n${text}`, req.focusKeyword);
    case 'meta':
      return heuristicMeta(title, text, req.focusKeyword);
    case 'cta':
      return `::cta[Make it personal|Turn this idea into a one-of-a-kind gift, delivered across Hyderabad.|Shop personalised gifts|/#catalog-section]`;
    case 'faqs':
      return [
        { question: `What is the best ${req.focusKeyword || 'personalised gift'}?`, answer: 'Edit this answer with your recommendation.' },
        { question: 'How long does delivery take in Hyderabad?', answer: 'Most orders are prepared within 2 working days, then delivered locally.' },
        { question: 'Can I approve the design before it is made?', answer: 'Yes — personalised orders include a digital proof for approval.' },
      ];
    default:
      return undefined;
  }
}

function buildPrompt(req: AiRequest): { prompt: string; json: boolean; maxTokens: number } {
  const kw = req.focusKeyword ? ` Focus keyword: "${req.focusKeyword}" — use it naturally in the title, first paragraph and at least one subheading.` : '';
  const tone = req.tone ? ` Tone: ${req.tone}.` : ' Tone: warm, expert, helpful.';
  const md =
    'Format as Markdown. Use ## and ### subheadings, short paragraphs, bullet lists where useful. You may use these extra blocks: "> [!TIP] text" callouts, "- [ ] item" checklists, tables, and a final line "::cta[Title|Short text|Button label|/#catalog-section]". Do not include the article title as a heading.';
  const text = (req.text || '').slice(0, 30_000);
  switch (req.action) {
    case 'generate': {
      const words = req.length === 'short' ? 600 : req.length === 'long' ? 1800 : 1100;
      return { prompt: `Write a complete, SEO-optimised blog article of about ${words} words on: "${req.topic || req.title}".${kw}${tone} ${md} End with a short FAQ section (### questions).`, json: false, maxTokens: 6000 };
    }
    case 'rewrite':
      return { prompt: `Rewrite the following text to be clearer and more engaging, keeping the meaning, facts and Markdown formatting.${tone}${kw} Return only the rewritten text.\n\n${text}`, json: false, maxTokens: 4000 };
    case 'expand':
      return { prompt: `Expand the following text with more depth, examples and practical detail (roughly double the length), keeping Markdown formatting.${tone}${kw} Return only the expanded text.\n\n${text}`, json: false, maxTokens: 5000 };
    case 'summarize':
      return { prompt: `Summarise the following article in 2–3 sentences suitable as an excerpt. Return only the summary.\n\n${text}`, json: false, maxTokens: 600 };
    case 'grammar':
      return { prompt: `Fix grammar, spelling and punctuation in the following text. Keep wording and Markdown as close to the original as possible. Return only the corrected text.\n\n${text}`, json: false, maxTokens: 5000 };
    case 'seo':
      return {
        prompt: `Audit this blog post for SEO.${kw} Title: "${req.title || ''}". Return JSON: {"seoTitle": string (50-60 chars), "metaDescription": string (140-158 chars), "keywords": string[] (6-10), "improvements": string[] (3-6 concrete, specific edits)}.\n\n${text}`,
        json: true,
        maxTokens: 1500,
      };
    case 'faqs':
      return { prompt: `Write 5 FAQs a reader would search for about this article.${kw} Return JSON: [{"question": string, "answer": string (1-3 sentences)}].\n\nTitle: ${req.title || ''}\n\n${text}`, json: true, maxTokens: 1500 };
    case 'meta':
      return { prompt: `Write one meta description (140-158 characters, includes the focus keyword if given, ends with a soft call to action).${kw} Return only the description.\n\nTitle: ${req.title || ''}\n\n${text.slice(0, 6000)}`, json: false, maxTokens: 300 };
    case 'keywords':
      return { prompt: `Suggest 8-12 search keywords and long-tail phrases Indian searchers would use for this article.${kw} Return JSON: string[].\n\nTitle: ${req.title || ''}\n\n${text.slice(0, 8000)}`, json: true, maxTokens: 500 };
    case 'slug':
      return { prompt: `Suggest one short SEO URL slug (3-6 words, lowercase, hyphens) for this article.${kw} Return only the slug.\n\nTitle: ${req.title || ''}`, json: false, maxTokens: 60 };
    case 'cta':
      return { prompt: `Write a call-to-action for the end of this article, as one line in exactly this format: ::cta[Title|One sentence|Button label|/#catalog-section]. Return only that line.\n\nTitle: ${req.title || ''}\n\n${text.slice(0, 4000)}`, json: false, maxTokens: 200 };
  }
}

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.CMS_AI_MODEL || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      system: BRAND_CONTEXT,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[CMS_AI] provider error', res.status, detail.slice(0, 500));
    throw new HttpError(502, `AI provider returned ${res.status}. Try again in a moment.`, 'AI_PROVIDER_ERROR');
  }
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (body.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('')
    .trim();
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]);
    throw new HttpError(502, 'AI response could not be parsed. Try again.', 'AI_PARSE_ERROR');
  }
}

export async function runAiAction(req: AiRequest): Promise<{ result: unknown; source: 'ai' | 'heuristic' }> {
  if (!AI_ACTIONS.includes(req.action)) throw new HttpError(400, 'Unknown AI action');
  if (!isAiConfigured()) {
    const local = localResult(req);
    if (local !== undefined) return { result: local, source: 'heuristic' };
    throw new HttpError(503, 'AI writing is not configured. Set ANTHROPIC_API_KEY on the server to enable generate, rewrite, expand, summarise and grammar.', 'AI_NOT_CONFIGURED');
  }
  const { prompt, json, maxTokens } = buildPrompt(req);
  const text = await callClaude(prompt, maxTokens);
  let result: unknown = json ? parseJsonLoose(text) : text;
  if (req.action === 'slug' && typeof result === 'string') result = slugify(result);
  return { result, source: 'ai' };
}
