/**
 * Extended-Markdown renderer for the blog CMS.
 *
 * Safe by construction: every piece of author text is HTML-escaped before any
 * markup is produced, and raw HTML in the source is never passed through.
 * Runs on both server (article pages) and client (editor live preview).
 *
 * Supported blocks:
 *   # .. ####          headings (h1 is demoted to h2 — the post title is the page h1)
 *   ```lang            fenced code blocks
 *   > text             quotes
 *   > [!TIP] text      callouts: NOTE | TIP | INFO | WARNING | SUCCESS
 *   - / * / 1.         bullet + numbered lists
 *   - [ ] / - [x]      checklists
 *   | a | b |          tables (second row must be the |---| separator)
 *   ---                divider
 *   ![alt](src)        images (lazy loaded)
 *   ::video[url]                         YouTube / Vimeo / .mp4 embed
 *   ::button[Label](url)                 call-to-action button
 *   ::cta[Title|Text|Button label|url]   CTA panel
 *   ::product[slug]                      product card link (custom component)
 * Inline: **bold**, *italic*, ~~strike~~, `code`, [link](url)
 */

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export interface RenderResult {
  html: string;
  toc: TocEntry[];
}

const CALLOUT_TYPES = ['NOTE', 'TIP', 'INFO', 'WARNING', 'SUCCESS'] as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Only allow safe URL schemes. Input and output are HTML-escaped strings. */
function safeUrl(escapedUrl: string): string | null {
  const raw = unescapeHtml(escapedUrl).trim();
  if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(raw)) return escapeHtml(raw);
  return null;
}

function isExternal(escapedUrl: string): boolean {
  return /^https?:\/\//i.test(unescapeHtml(escapedUrl));
}

export function headingSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z#0-9]+;/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

export function renderInline(text: string): string {
  const codeSpans: string[] = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_m, code) => {
    codeSpans.push(`<code>${code}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  // Images
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => {
    const url = safeUrl(src);
    if (!url) return alt;
    return `<img src="${url}" alt="${alt}" loading="lazy" decoding="async" />`;
  });
  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const url = safeUrl(href);
    if (!url) return label;
    const ext = isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${url}"${ext}>${label}</a>`;
  });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*)_(?=[^\w]|$)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return out.replace(/\u0000(\d+)\u0000/g, (_m, i) => codeSpans[Number(i)]);
}

function videoEmbed(rawUrl: string): string {
  const url = rawUrl.trim();
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) {
    return `<div class="cms-video"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(yt[1])}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) {
    return `<div class="cms-video"><iframe src="https://player.vimeo.com/video/${vimeo[1]}" title="Video" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  const safe = safeUrl(escapeHtml(url));
  if (safe && /\.(mp4|webm)(\?|$)/i.test(url)) {
    return `<div class="cms-video"><video src="${safe}" controls preload="metadata"></video></div>`;
  }
  return '';
}

function renderTable(lines: string[]): string {
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  const head = cells(lines[0]);
  const body = lines.slice(2).map(cells);
  return (
    '<div class="cms-table"><table><thead><tr>' +
    head.map((h) => `<th>${renderInline(h)}</th>`).join('') +
    '</tr></thead><tbody>' +
    body.map((r) => '<tr>' + r.map((c) => `<td>${renderInline(c)}</td>`).join('') + '</tr>').join('') +
    '</tbody></table></div>'
  );
}

export function renderMarkdown(source: string): RenderResult {
  const lines = (source || '').replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  const toc: TocEntry[] = [];
  const usedIds = new Map<string, number>();
  let i = 0;

  const uniqueId = (text: string) => {
    const base = headingSlug(text);
    const n = usedIds.get(base) || 0;
    usedIds.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  const isBlockStart = (line: string) =>
    /^(#{1,6})\s/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*([-*+]|\d+\.)\s/.test(line) ||
    /^\s*(---|\*\*\*|___)\s*$/.test(line) ||
    /^::(video|button|cta|product)\[/.test(line) ||
    /^\|/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const lang = fence[1];
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      html.push(
        `<pre class="cms-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${escapeHtml(code.join('\n'))}</code></pre>`
      );
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(Math.max(heading[1].length, 2), 4);
      const text = heading[2].replace(/#+\s*$/, '').trim();
      const id = uniqueId(text);
      if (level <= 3) toc.push({ id, text: text.replace(/[*_`~]/g, ''), level });
      html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      i++;
      continue;
    }

    // Divider
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      html.push('<hr />');
      i++;
      continue;
    }

    // Custom components
    const video = line.match(/^::video\[([^\]]+)\]\s*$/);
    if (video) {
      html.push(videoEmbed(video[1]));
      i++;
      continue;
    }
    const button = line.match(/^::button\[([^\]]+)\]\(([^)\s]+)\)\s*$/);
    if (button) {
      const url = safeUrl(escapeHtml(button[2]));
      if (url) html.push(`<p class="cms-button-row"><a class="cms-button" href="${url}">${renderInline(button[1])}</a></p>`);
      i++;
      continue;
    }
    const cta = line.match(/^::cta\[([^\]]+)\]\s*$/);
    if (cta) {
      const [title = '', text = '', label = 'Learn more', href = '/'] = cta[1].split('|').map((s) => s.trim());
      const url = safeUrl(escapeHtml(href)) || '/';
      html.push(
        `<aside class="cms-cta"><p class="cms-cta-title">${renderInline(title)}</p>${text ? `<p>${renderInline(text)}</p>` : ''}<a class="cms-button" href="${url}">${renderInline(label)}</a></aside>`
      );
      i++;
      continue;
    }
    const product = line.match(/^::product\[([\w-]+)\]\s*$/);
    if (product) {
      const slug = escapeHtml(product[1]);
      html.push(`<a class="cms-product-card" href="/products/${slug}" data-product-slug="${slug}">View this gift &rarr;</a>`);
      i++;
      continue;
    }

    // Table
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const rows: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      html.push(renderTable(rows));
      continue;
    }

    // Quote / callout
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      const callout = quote[0]?.match(/^\[!(\w+)\]\s*(.*)$/);
      if (callout && (CALLOUT_TYPES as readonly string[]).includes(callout[1].toUpperCase())) {
        const type = callout[1].toLowerCase();
        const body = [callout[2], ...quote.slice(1)].filter(Boolean).map(renderInline).join('<br />');
        html.push(`<aside class="cms-callout cms-callout-${type}" role="note"><strong class="cms-callout-label">${type}</strong><div>${body}</div></aside>`);
      } else {
        html.push(`<blockquote>${quote.map(renderInline).join('<br />')}</blockquote>`);
      }
      continue;
    }

    // Lists / checklists
    if (/^\s*([-*+]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\.\s/.test(line);
      const items: string[] = [];
      let checklist = false;
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        const check = itemText.match(/^\[( |x|X)\]\s+(.*)$/);
        if (check) {
          checklist = true;
          const done = check[1].toLowerCase() === 'x';
          items.push(
            `<li class="cms-check${done ? ' is-done' : ''}"><span aria-hidden="true">${done ? '&#10003;' : ''}</span><span>${renderInline(check[2])}</span></li>`
          );
        } else {
          items.push(`<li>${renderInline(itemText)}</li>`);
        }
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}${checklist ? ' class="cms-checklist"' : ''}>${items.join('')}</${tag}>`);
      continue;
    }

    // Paragraph
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !isBlockStart(lines[i]))) {
      para.push(lines[i++]);
    }
    const inner = para.map(renderInline).join('<br />');
    // A paragraph containing only an image becomes a figure
    if (/^<img [^>]+\/>$/.test(inner)) {
      const alt = inner.match(/alt="([^"]*)"/)?.[1] || '';
      html.push(`<figure>${inner}${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`);
    } else {
      html.push(`<p>${inner}</p>`);
    }
  }

  return { html: html.join('\n'), toc };
}

/** Strip Markdown syntax to plain text (for search, excerpts, word counts). */
export function markdownToPlainText(source: string): string {
  return (source || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^::(video|product)\[[^\]]*\]\s*$/gm, ' ')
    .replace(/^::button\[([^\]]+)\]\([^)]*\)/gm, '$1')
    .replace(/^::cta\[([^\]]+)\]/gm, (_m, inner: string) => inner.split('|').slice(0, 3).join(' '))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?\[!\w+\]/gm, '')
    .replace(/^[#>\-*+|\s]+|[*_`~|]/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(source: string): number {
  const text = markdownToPlainText(source);
  return text ? text.split(/\s+/).length : 0;
}

export function readingTimeMinutes(source: string, wordsPerMinute = 220): number {
  return Math.max(1, Math.round(countWords(source) / wordsPerMinute));
}

export function autoExcerpt(source: string, maxLength = 160): string {
  const text = markdownToPlainText(source);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  return cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : maxLength).trim() + '…';
}
