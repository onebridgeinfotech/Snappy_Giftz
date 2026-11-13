'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Bold, Code2, Columns3, Heading2, ImageIcon, Italic, Link2, List, ListChecks, ListOrdered, Megaphone, Minus, MousePointerClick, Plus, Quote, Rows3, ShoppingBag, StickyNote, Trash2, Type, Video } from 'lucide-react';
import { type Block, type BlockType, emptyBlock, newId, parseBlocks, serializeBlocks } from '@/lib/cms/blocks';
import { renderInline } from '@/lib/cms/markdown';
import { cms, inputCls } from './cmsApi';

const PALETTE: Array<{ type: BlockType; label: string; hint: string; icon: React.ReactNode }> = [
  { type: 'p', label: 'Text', hint: 'A paragraph', icon: <Type className="w-4 h-4" /> },
  { type: 'h', label: 'Heading', hint: 'Section title', icon: <Heading2 className="w-4 h-4" /> },
  { type: 'img', label: 'Image', hint: 'Upload or pick a photo', icon: <ImageIcon className="w-4 h-4" /> },
  { type: 'ul', label: 'Bullet list', hint: '• • •', icon: <List className="w-4 h-4" /> },
  { type: 'ol', label: 'Numbered list', hint: '1 2 3', icon: <ListOrdered className="w-4 h-4" /> },
  { type: 'check', label: 'Checklist', hint: 'Tick boxes', icon: <ListChecks className="w-4 h-4" /> },
  { type: 'quote', label: 'Quote', hint: 'Pull-quote', icon: <Quote className="w-4 h-4" /> },
  { type: 'callout', label: 'Callout', hint: 'Tip / warning box', icon: <StickyNote className="w-4 h-4" /> },
  { type: 'table', label: 'Table', hint: 'Rows and columns', icon: <Columns3 className="w-4 h-4" /> },
  { type: 'video', label: 'Video', hint: 'YouTube / Vimeo', icon: <Video className="w-4 h-4" /> },
  { type: 'button', label: 'Button', hint: 'Link button', icon: <MousePointerClick className="w-4 h-4" /> },
  { type: 'cta', label: 'Call to action', hint: 'Promo panel', icon: <Megaphone className="w-4 h-4" /> },
  { type: 'product', label: 'Product', hint: 'Link a product page', icon: <ShoppingBag className="w-4 h-4" /> },
  { type: 'divider', label: 'Divider', hint: 'Horizontal line', icon: <Minus className="w-4 h-4" /> },
  { type: 'code', label: 'Code', hint: 'Code snippet', icon: <Code2 className="w-4 h-4" /> },
];
const LABEL: Record<string, string> = Object.fromEntries(PALETTE.map((p) => [p.type, p.label]));
LABEL.ol = 'Numbered list';

// ---- inline rich text (bold / italic / link) stored as inline Markdown -------------------------

function htmlToInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/ /g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(htmlToInline).join('');
  switch (el.tagName) {
    case 'BR': return '\n';
    case 'B': case 'STRONG': return inner.trim() ? `**${inner}**` : inner;
    case 'I': case 'EM': return inner.trim() ? `*${inner}*` : inner;
    case 'S': case 'STRIKE': case 'DEL': return inner.trim() ? `~~${inner}~~` : inner;
    case 'CODE': return inner ? `\`${inner}\`` : inner;
    case 'A': { const href = el.getAttribute('href') || ''; return href && inner ? `[${inner}](${href})` : inner; }
    case 'DIV': case 'P': return `\n${inner}`;
    default: return inner;
  }
}
const toMarkdown = (root: HTMLElement) => htmlToInline(root).replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');

function RichText({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = renderInline(value).replace(/\n/g, '<br>');
    // Uncontrolled after mount so the caret never jumps while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cmd = (name: 'bold' | 'italic') => { document.execCommand(name); if (ref.current) onChange(toMarkdown(ref.current)); };
  const link = () => {
    const url = window.prompt('Link address (e.g. https://… or /blog/my-post)');
    if (url) { document.execCommand('createLink', false, url.trim()); if (ref.current) onChange(toMarkdown(ref.current)); }
  };
  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the text selection when clicking toolbar buttons
  return (
    <div>
      {focused && (
        <div className="flex gap-1 mb-1" role="toolbar" aria-label="Text formatting">
          <button type="button" onMouseDown={keep} onClick={() => cmd('bold')} aria-label="Bold" className="p-1.5 rounded-md bg-white/10 text-white hover:bg-white/20"><Bold className="w-3.5 h-3.5" /></button>
          <button type="button" onMouseDown={keep} onClick={() => cmd('italic')} aria-label="Italic" className="p-1.5 rounded-md bg-white/10 text-white hover:bg-white/20"><Italic className="w-3.5 h-3.5" /></button>
          <button type="button" onMouseDown={keep} onClick={link} aria-label="Add link" className="p-1.5 rounded-md bg-white/10 text-white hover:bg-white/20"><Link2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={(e) => onChange(toMarkdown(e.currentTarget))}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
        className={`min-h-[2.5rem] rounded-xl bg-[#0b0c10] border border-white/10 focus:border-[#F5BD48] px-3.5 py-2 text-[15px] leading-relaxed text-white outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[#64748B] [&_a]:text-[#F5BD48] [&_a]:underline ${className}`}
      />
    </div>
  );
}

// ---- media picker ---------------------------------------------------------------------------

function MediaPicker({ onPick, onClose }: { onPick: (m: { url: string; altText: string | null; fileName: string }) => void; onClose: () => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { cms<any[]>('GET', 'media').then(setItems).catch(() => setItems([])); }, []);
  return (
    <div className="rounded-xl border border-white/15 bg-[#0b0c10] p-3 space-y-2">
      <div className="flex justify-between text-xs text-[#94A3B8]"><span>Pick from your media library</span><button type="button" onClick={onClose} className="hover:text-white">Close</button></div>
      {items === null ? <p className="text-xs text-[#64748B]">Loading…</p> : items.length === 0 ? <p className="text-xs text-[#64748B]">No images uploaded yet.</p> : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-auto">
          {items.map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m)} title={m.fileName} className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-[#F5BD48]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.altText || m.fileName} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block space-y-1"><span className="text-xs text-[#94A3B8]">{label}</span>{children}</label>;

function ImageBlock({ b, set, upload }: { b: Extract<Block, { type: 'img' }>; set: (p: Partial<Block>) => void; upload: (f: File) => Promise<{ url: string } | null> }) {
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      {b.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.url} alt={b.alt || 'Selected image'} className="max-h-56 rounded-xl border border-white/10" />
      ) : <div className="rounded-xl border border-dashed border-white/20 p-6 text-center text-sm text-[#94A3B8]">No image yet</div>}
      <div className="flex flex-wrap gap-2">
        <label className="px-3 py-1.5 rounded-lg border border-white/15 text-sm text-white hover:border-[#F5BD48] cursor-pointer">{busy ? 'Uploading…' : 'Upload image'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); const r = await upload(f); setBusy(false); if (r) set({ url: r.url, alt: b.alt || f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') } as Partial<Block>); }} />
        </label>
        <button type="button" onClick={() => setPicker(!picker)} className="px-3 py-1.5 rounded-lg border border-white/15 text-sm text-white hover:border-[#F5BD48]">Choose from library</button>
      </div>
      {picker && <MediaPicker onClose={() => setPicker(false)} onPick={(m) => { set({ url: m.url, alt: b.alt || m.altText || '' } as Partial<Block>); setPicker(false); }} />}
      <Field label="Describe the image (helps Google and screen readers)"><input value={b.alt} onChange={(e) => set({ alt: e.target.value } as Partial<Block>)} className={inputCls} placeholder="e.g. Personalised magic mug with photo print" /></Field>
    </div>
  );
}

function ListItems({ items, onChange, ordered }: { items: string[]; onChange: (v: string[]) => void; ordered: boolean }) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="w-5 text-xs text-[#64748B] text-right">{ordered ? `${i + 1}.` : '•'}</span>
          <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onChange([...items.slice(0, i + 1), '', ...items.slice(i + 1)]); } }} className={inputCls} placeholder="Type, then press Enter for the next item" />
          <button type="button" aria-label="Remove item" onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : [''])} className="text-red-300 px-1">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="text-xs text-[#F5BD48] hover:underline">+ Add item</button>
    </div>
  );
}

function TableBlock({ rows, onChange }: { rows: string[][]; onChange: (r: string[][]) => void }) {
  const cols = Math.max(...rows.map((r) => r.length), 1);
  const cell = (r: number, c: number, v: string) => onChange(rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, k) => (k === c ? v : row[k] ?? '')) : row)));
  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="text-sm"><tbody>
        {rows.map((row, r) => (
          <tr key={r}>{Array.from({ length: cols }, (_, c) => (
            <td key={c} className="p-0.5"><input value={row[c] ?? ''} onChange={(e) => cell(r, c, e.target.value)} aria-label={`Row ${r + 1} column ${c + 1}`} className={`${inputCls} !py-1.5 min-w-[7rem] ${r === 0 ? '!font-bold !bg-[#F5BD48]/10' : ''}`} placeholder={r === 0 ? 'Heading' : ''} /></td>
          ))}<td><button type="button" aria-label="Remove row" disabled={rows.length < 2} onClick={() => onChange(rows.filter((_, i) => i !== r))} className="px-1 text-red-300 disabled:opacity-30">×</button></td></tr>
        ))}
      </tbody></table>
      <div className="flex gap-3 text-xs text-[#F5BD48]">
        <button type="button" onClick={() => onChange([...rows, Array(cols).fill('')])}>+ Row</button>
        <button type="button" onClick={() => onChange(rows.map((r) => [...Array.from({ length: cols }, (_, k) => r[k] ?? ''), '']))}>+ Column</button>
        {cols > 1 && <button type="button" className="text-red-300" onClick={() => onChange(rows.map((r) => r.slice(0, cols - 1)))}>− Column</button>}
      </div>
    </div>
  );
}

function ProductBlock({ slug, onChange }: { slug: string; onChange: (s: string) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => { cms<any>('GET', 'pages').then((d) => setProducts(d.products || [])).catch(() => undefined); }, []);
  return (
    <Field label="Choose a product to link to">
      <select value={slug} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">— select —</option>
        {products.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
      </select>
    </Field>
  );
}

// ---- main editor ----------------------------------------------------------------------------

export function BlockEditor({ value, onChange, upload }: { value: string; onChange: (md: string) => void; upload: (f: File) => Promise<{ url: string } | null> }) {
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const parsed = parseBlocks(value);
    return parsed.length ? parsed : [emptyBlock('p')];
  });
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const last = useRef(value);

  const commit = (next: Block[]) => {
    setBlocks(next);
    const md = serializeBlocks(next);
    last.current = md;
    onChange(md);
  };
  const patch = (id: string, p: Partial<Block>) => commit(blocks.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b)));
  const move = (i: number, d: -1 | 1) => { const n = [...blocks]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; commit(n); };
  const insert = (type: BlockType, at: number) => { const n = [...blocks]; n.splice(at, 0, emptyBlock(type)); setBlocks(n); setMenuAt(null); };
  const remove = (id: string) => { const n = blocks.filter((b) => b.id !== id); commit(n.length ? n : [emptyBlock('p')]); };

  const Palette = ({ at }: { at: number }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3 rounded-xl border border-[#F5BD48]/40 bg-[#0b0c10]" role="menu" aria-label="Add a block">
      {PALETTE.map((p) => (
        <button key={p.type} type="button" role="menuitem" onClick={() => insert(p.type, at)} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-white/10 text-left hover:border-[#F5BD48] hover:bg-white/5">
          <span className="text-[#F5BD48]">{p.icon}</span><span><span className="block text-sm text-white">{p.label}</span><span className="block text-[10px] text-[#64748B]">{p.hint}</span></span>
        </button>
      ))}
    </div>
  );

  const body = (b: Block) => {
    switch (b.type) {
      case 'p': return <RichText value={b.text} onChange={(v) => patch(b.id, { text: v } as Partial<Block>)} placeholder="Write your paragraph… select text to make it bold, italic or a link" />;
      case 'h': return (
        <div className="space-y-2">
          <div className="flex gap-1">{([2, 3, 4] as const).map((l) => <button key={l} type="button" onClick={() => patch(b.id, { level: l } as Partial<Block>)} className={`px-2.5 py-1 rounded-md text-xs ${b.level === l ? 'bg-[#F5BD48] text-[#111215] font-bold' : 'border border-white/15 text-white'}`}>{l === 2 ? 'Big' : l === 3 ? 'Medium' : 'Small'}</button>)}</div>
          <input value={b.text} onChange={(e) => patch(b.id, { text: e.target.value } as Partial<Block>)} placeholder="Heading text" aria-label="Heading text" className={`${inputCls} !font-serif ${b.level === 2 ? '!text-xl' : b.level === 3 ? '!text-lg' : ''}`} />
        </div>
      );
      case 'img': return <ImageBlock b={b} set={(p) => patch(b.id, p)} upload={upload} />;
      case 'ul': case 'ol': return <ListItems items={b.items} ordered={b.type === 'ol'} onChange={(items) => patch(b.id, { items } as Partial<Block>)} />;
      case 'check': return (
        <div className="space-y-1.5">
          {b.items.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="checkbox" aria-label="Ticked" checked={it.done} onChange={(e) => patch(b.id, { items: b.items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) } as Partial<Block>)} />
              <input value={it.text} onChange={(e) => patch(b.id, { items: b.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) } as Partial<Block>)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); patch(b.id, { items: [...b.items.slice(0, i + 1), { text: '', done: false }, ...b.items.slice(i + 1)] } as Partial<Block>); } }} className={inputCls} placeholder="Checklist item" />
              <button type="button" aria-label="Remove item" onClick={() => patch(b.id, { items: b.items.length > 1 ? b.items.filter((_, j) => j !== i) : [{ text: '', done: false }] } as Partial<Block>)} className="text-red-300 px-1">×</button>
            </div>
          ))}
          <button type="button" onClick={() => patch(b.id, { items: [...b.items, { text: '', done: false }] } as Partial<Block>)} className="text-xs text-[#F5BD48] hover:underline">+ Add item</button>
        </div>
      );
      case 'quote': return <textarea rows={2} value={b.text} onChange={(e) => patch(b.id, { text: e.target.value } as Partial<Block>)} placeholder="Quote text" aria-label="Quote" className={`${inputCls} italic`} />;
      case 'callout': return (
        <div className="space-y-2">
          <select value={b.kind} onChange={(e) => patch(b.id, { kind: e.target.value } as Partial<Block>)} aria-label="Callout style" className={`${inputCls} max-w-[12rem]`}>
            {['TIP', 'NOTE', 'INFO', 'WARNING', 'SUCCESS'].map((k) => <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase()}</option>)}
          </select>
          <textarea rows={2} value={b.text} onChange={(e) => patch(b.id, { text: e.target.value } as Partial<Block>)} placeholder="Callout message" aria-label="Callout message" className={inputCls} />
        </div>
      );
      case 'table': return <TableBlock rows={b.rows} onChange={(rows) => patch(b.id, { rows } as Partial<Block>)} />;
      case 'video': return <Field label="Paste a YouTube or Vimeo link"><input value={b.url} onChange={(e) => patch(b.id, { url: e.target.value } as Partial<Block>)} placeholder="https://www.youtube.com/watch?v=…" className={inputCls} /></Field>;
      case 'button': return (
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Button text"><input value={b.label} onChange={(e) => patch(b.id, { label: e.target.value } as Partial<Block>)} className={inputCls} /></Field>
          <Field label="Opens (page or link)"><input value={b.url} onChange={(e) => patch(b.id, { url: e.target.value } as Partial<Block>)} className={inputCls} placeholder="/products/normal-mug-with-print" /></Field>
        </div>
      );
      case 'cta': return (
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Headline"><input value={b.title} onChange={(e) => patch(b.id, { title: e.target.value } as Partial<Block>)} className={inputCls} /></Field>
          <Field label="Button text"><input value={b.label} onChange={(e) => patch(b.id, { label: e.target.value } as Partial<Block>)} className={inputCls} /></Field>
          <div className="sm:col-span-2"><Field label="Supporting line"><input value={b.text} onChange={(e) => patch(b.id, { text: e.target.value } as Partial<Block>)} className={inputCls} /></Field></div>
          <div className="sm:col-span-2"><Field label="Button opens"><input value={b.url} onChange={(e) => patch(b.id, { url: e.target.value } as Partial<Block>)} className={inputCls} /></Field></div>
        </div>
      );
      case 'product': return <ProductBlock slug={b.slug} onChange={(slug) => patch(b.id, { slug } as Partial<Block>)} />;
      case 'divider': return <hr className="border-[#D5A34A]/40" />;
      case 'code': return (
        <div className="space-y-2">
          <input value={b.lang} onChange={(e) => patch(b.id, { lang: e.target.value } as Partial<Block>)} placeholder="Language (optional)" aria-label="Language" className={`${inputCls} max-w-[12rem]`} />
          <textarea rows={5} value={b.code} onChange={(e) => patch(b.id, { code: e.target.value } as Partial<Block>)} spellCheck={false} aria-label="Code" className={`${inputCls} font-mono !text-xs`} />
        </div>
      );
    }
  };

  const count = useMemo(() => blocks.filter((b) => b.type !== 'divider').length, [blocks]);
  return (
    <div className="space-y-3" data-testid="block-editor">
      {blocks.map((b, i) => (
        <React.Fragment key={b.id}>
          <section className="group rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2" aria-label={`${LABEL[b.type] || 'Block'} block`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.16em] text-[#D5A34A]">{LABEL[b.type] || b.type}</span>
              <span className="flex gap-1">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 rounded text-[#94A3B8] hover:text-white disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="p-1 rounded text-[#94A3B8] hover:text-white disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" aria-label="Delete block" onClick={() => remove(b.id)} className="p-1 rounded text-red-300 hover:text-red-200"><Trash2 className="w-4 h-4" /></button>
              </span>
            </div>
            {body(b)}
          </section>
          {menuAt === i + 1 ? <Palette at={i + 1} /> : (
            <button type="button" onClick={() => setMenuAt(i + 1)} aria-label="Add a block here" className="mx-auto flex items-center gap-1 text-xs text-[#64748B] hover:text-[#F5BD48] py-0.5"><Plus className="w-3.5 h-3.5" /> Add block</button>
          )}
        </React.Fragment>
      ))}
      {menuAt === null && (
        <button type="button" onClick={() => setMenuAt(blocks.length)} className="w-full py-3 rounded-xl border border-dashed border-[#F5BD48]/50 text-[#F5BD48] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#F5BD48]/5"><Rows3 className="w-4 h-4" /> Add a block (text, image, button, table…)</button>
      )}
      <p className="text-[11px] text-[#64748B]">{count} block{count === 1 ? '' : 's'} · changes save to the post automatically; press “Save draft” or “Publish” when you are ready.</p>
    </div>
  );
}

export { newId };
