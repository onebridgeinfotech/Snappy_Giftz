/**
 * Block model for the no-code visual editor.
 *
 * Posts are still STORED as the extended Markdown that renderMarkdown() understands, so the public
 * site, RSS, search and the Markdown tab all keep working. The visual editor converts
 * Markdown -> blocks when a post is opened, and blocks -> Markdown on every change.
 */

export type CalloutKind = 'TIP' | 'NOTE' | 'INFO' | 'WARNING' | 'SUCCESS';

export type Block =
  | { id: string; type: 'p'; text: string }
  | { id: string; type: 'h'; level: 2 | 3 | 4; text: string }
  | { id: string; type: 'img'; url: string; alt: string }
  | { id: string; type: 'ul' | 'ol'; items: string[] }
  | { id: string; type: 'check'; items: Array<{ text: string; done: boolean }> }
  | { id: string; type: 'quote'; text: string }
  | { id: string; type: 'callout'; kind: CalloutKind; text: string }
  | { id: string; type: 'table'; rows: string[][] }
  | { id: string; type: 'video'; url: string }
  | { id: string; type: 'button'; label: string; url: string }
  | { id: string; type: 'cta'; title: string; text: string; label: string; url: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'code'; lang: string; code: string }
  | { id: string; type: 'product'; slug: string };

export type BlockType = Block['type'];

let counter = 0;
export const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

const CALLOUTS: CalloutKind[] = ['TIP', 'NOTE', 'INFO', 'WARNING', 'SUCCESS'];
const clean = (s: string) => s.replace(/[\r\n|\]]+/g, ' ').trim(); // fields inside ::cta[...] are |-separated

export function emptyBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'p': return { id, type, text: '' };
    case 'h': return { id, type, level: 2, text: '' };
    case 'img': return { id, type, url: '', alt: '' };
    case 'ul': case 'ol': return { id, type, items: [''] };
    case 'check': return { id, type, items: [{ text: '', done: false }] };
    case 'quote': return { id, type, text: '' };
    case 'callout': return { id, type, kind: 'TIP', text: '' };
    case 'table': return { id, type, rows: [['Column A', 'Column B'], ['', '']] };
    case 'video': return { id, type, url: '' };
    case 'button': return { id, type, label: 'Shop now', url: '/#catalog-section' };
    case 'cta': return { id, type, title: 'Make it personal', text: 'Turn this idea into a one-of-a-kind gift.', label: 'Shop now', url: '/#catalog-section' };
    case 'divider': return { id, type };
    case 'code': return { id, type, lang: '', code: '' };
    case 'product': return { id, type, slug: '' };
  }
}

export function isBlockEmpty(b: Block): boolean {
  switch (b.type) {
    case 'p': case 'quote': case 'callout': case 'h': return !b.text.trim();
    case 'img': return !b.url.trim();
    case 'ul': case 'ol': return b.items.every((i) => !i.trim());
    case 'check': return b.items.every((i) => !i.text.trim());
    case 'table': return b.rows.every((r) => r.every((c) => !c.trim()));
    case 'video': return !b.url.trim();
    case 'button': return !b.label.trim() || !b.url.trim();
    case 'cta': return !b.title.trim() || !b.url.trim();
    case 'code': return !b.code.trim();
    case 'product': return !b.slug.trim();
    case 'divider': return false;
  }
}

export function serializeBlocks(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (isBlockEmpty(b)) continue;
    switch (b.type) {
      case 'p': out.push(b.text.trim()); break;
      case 'h': out.push(`${'#'.repeat(b.level)} ${b.text.replace(/\s+/g, ' ').trim()}`); break;
      case 'img': out.push(`![${b.alt.replace(/[\]\n]/g, ' ').trim()}](${b.url.trim()})`); break;
      case 'ul': out.push(b.items.filter((i) => i.trim()).map((i) => `- ${i.replace(/\n/g, ' ').trim()}`).join('\n')); break;
      case 'ol': out.push(b.items.filter((i) => i.trim()).map((i, n) => `${n + 1}. ${i.replace(/\n/g, ' ').trim()}`).join('\n')); break;
      case 'check': out.push(b.items.filter((i) => i.text.trim()).map((i) => `- [${i.done ? 'x' : ' '}] ${i.text.replace(/\n/g, ' ').trim()}`).join('\n')); break;
      case 'quote': out.push(b.text.trim().split('\n').map((l) => `> ${l}`).join('\n')); break;
      case 'callout': {
        const [first, ...rest] = b.text.trim().split('\n');
        out.push([`> [!${b.kind}] ${first}`, ...rest.map((l) => `> ${l}`)].join('\n'));
        break;
      }
      case 'table': {
        const width = Math.max(...b.rows.map((r) => r.length), 1);
        const row = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => (r[i] ?? '').replace(/[|\n]/g, ' ').trim()).join(' | ')} |`;
        out.push([row(b.rows[0]), `|${Array(width).fill('---').join('|')}|`, ...b.rows.slice(1).map(row)].join('\n'));
        break;
      }
      case 'video': out.push(`::video[${b.url.trim().replace(/\]/g, '')}]`); break;
      case 'button': out.push(`::button[${clean(b.label)}](${b.url.trim().replace(/\s/g, '')})`); break;
      case 'cta': out.push(`::cta[${[b.title, b.text, b.label, b.url].map(clean).join('|')}]`); break;
      case 'divider': out.push('---'); break;
      case 'code': out.push('```' + b.lang.trim() + '\n' + b.code.replace(/\n+$/, '') + '\n```'); break;
      case 'product': out.push(`::product[${b.slug.trim()}]`); break;
    }
  }
  return out.join('\n\n') + (out.length ? '\n' : '');
}

const LIST_RE = /^\s*([-*+]|\d+\.)\s/;

export function parseBlocks(markdown: string): Block[] {
  const lines = (markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const isStart = (l: string) => /^(#{1,6})\s/.test(l) || /^```/.test(l) || /^>\s?/.test(l) || LIST_RE.test(l) || /^\s*(---|\*\*\*|___)\s*$/.test(l) || /^::(video|button|cta|product)\[/.test(l) || /^\|/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const id = newId();

    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push({ id, type: 'code', lang: fence[1], code: code.join('\n') });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ id, type: 'h', level: Math.min(Math.max(heading[1].length, 2), 4) as 2 | 3 | 4, text: heading[2].replace(/#+\s*$/, '').trim() });
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { blocks.push({ id, type: 'divider' }); i++; continue; }

    const video = line.match(/^::video\[([^\]]+)\]\s*$/);
    if (video) { blocks.push({ id, type: 'video', url: video[1] }); i++; continue; }
    const button = line.match(/^::button\[([^\]]+)\]\(([^)\s]+)\)\s*$/);
    if (button) { blocks.push({ id, type: 'button', label: button[1], url: button[2] }); i++; continue; }
    const cta = line.match(/^::cta\[([^\]]+)\]\s*$/);
    if (cta) {
      const [title = '', text = '', label = '', url = '/'] = cta[1].split('|').map((s) => s.trim());
      blocks.push({ id, type: 'cta', title, text, label, url });
      i++;
      continue;
    }
    const product = line.match(/^::product\[([\w-]+)\]\s*$/);
    if (product) { blocks.push({ id, type: 'product', slug: product[1] }); i++; continue; }

    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const rows: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      blocks.push({ id, type: 'table', rows: [cells(rows[0]), ...rows.slice(2).map(cells)] });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      const callout = q[0]?.match(/^\[!(\w+)\]\s*(.*)$/);
      if (callout && CALLOUTS.includes(callout[1].toUpperCase() as CalloutKind)) {
        blocks.push({ id, type: 'callout', kind: callout[1].toUpperCase() as CalloutKind, text: [callout[2], ...q.slice(1)].join('\n').trim() });
      } else {
        blocks.push({ id, type: 'quote', text: q.join('\n') });
      }
      continue;
    }

    if (LIST_RE.test(line)) {
      const ordered = /^\s*\d+\.\s/.test(line);
      const items: string[] = [];
      const checks: Array<{ text: string; done: boolean }> = [];
      while (i < lines.length && LIST_RE.test(lines[i])) {
        const t = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        const c = t.match(/^\[( |x|X)\]\s+(.*)$/);
        if (c) checks.push({ text: c[2], done: c[1].toLowerCase() === 'x' });
        else items.push(t);
        i++;
      }
      if (checks.length && !items.length) blocks.push({ id, type: 'check', items: checks });
      else blocks.push({ id, type: ordered ? 'ol' : 'ul', items: [...items, ...checks.map((c) => `[${c.done ? 'x' : ' '}] ${c.text}`)] });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !isStart(lines[i]))) para.push(lines[i++]);
    const text = para.join('\n');
    const img = text.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    blocks.push(img ? { id, type: 'img', alt: img[1], url: img[2] } : { id, type: 'p', text });
  }
  return blocks;
}
