'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Code, Eye, Heading2, Image as ImageIcon, Italic, Link2, List, ListChecks, Loader2, Minus, Quote, Save, Sparkles, Table, Video } from 'lucide-react';
import { renderMarkdown, readingTimeMinutes } from '@/lib/cms/markdown';
import { BlockEditor } from './BlockEditor';
import { scoreSeo } from '@/lib/cms/seo-score';
import { btnDanger, btnGhost, btnPrimary, cms, inputCls, toLocalInput } from './cmsApi';

type Opt = { id: string; name: string };
const STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;

const EMPTY = {
  title: '', slug: '', excerpt: '', content: '', coverImageUrl: '', coverImageAlt: '', status: 'DRAFT', scheduledAt: '',
  isFeatured: false, authorId: '', categoryId: '', tags: '', topics: '', collection: '',
  seoTitle: '', metaDescription: '', focusKeyword: '', keywords: '', canonicalUrl: '', ogImageUrl: '', twitterImageUrl: '',
  robotsIndex: true, robotsFollow: true, includeInSitemap: true, faqs: [] as Array<{ question: string; answer: string }>,
};

function fromPost(p: any) {
  return {
    ...EMPTY,
    ...p,
    excerpt: p.excerpt || '', coverImageUrl: p.coverImageUrl || '', coverImageAlt: p.coverImageAlt || '',
    scheduledAt: toLocalInput(p.scheduledAt), authorId: p.authorId || '', categoryId: p.categoryId || '',
    tags: (p.tags || []).map((t: any) => t.tag?.name).filter(Boolean).join(', '),
    topics: (p.topics || []).join(', '), collection: p.collection || '',
    seoTitle: p.seoTitle || '', metaDescription: p.metaDescription || '', focusKeyword: p.focusKeyword || '',
    keywords: (p.keywords || []).join(', '), canonicalUrl: p.canonicalUrl || '', ogImageUrl: p.ogImageUrl || '', twitterImageUrl: p.twitterImageUrl || '',
    faqs: Array.isArray(p.faqs) ? p.faqs : [],
  };
}

export function PostEditor({ postId, onClose, canPublish, authors, categories }: { postId: string | null; onClose: () => void; canPublish: boolean; authors: Opt[]; categories: Opt[] }) {
  const [form, setForm] = useState<any>(EMPTY);
  const [id, setId] = useState<string | null>(postId);
  const [loading, setLoading] = useState(Boolean(postId));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<'visual' | 'write' | 'preview'>('visual');
  const [version, setVersion] = useState(0); // bump to rebuild the visual editor after content changes from outside it
  const [panel, setPanel] = useState<'seo' | 'ai' | 'media'>('seo');
  const [aiBusy, setAiBusy] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [media, setMedia] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const set = (patch: Record<string, unknown>) => setForm((f: any) => ({ ...f, ...patch }));

  useEffect(() => {
    if (postId) cms('GET', `posts/${postId}`).then((p) => setForm(fromPost(p))).catch((e) => setMsg({ ok: false, text: e.message })).finally(() => setLoading(false));
    else cms('GET', 'posts?templates=true').then(setTemplates).catch(() => undefined);
  }, [postId]);

  useEffect(() => {
    if (panel === 'media') cms('GET', 'media').then(setMedia).catch(() => undefined);
  }, [panel]);

  const preview = useMemo(() => renderMarkdown(form.content).html, [form.content]);
  const seo = useMemo(
    () => scoreSeo({ title: form.title, slug: form.slug || form.title.toLowerCase().replace(/\s+/g, '-'), content: form.content, seoTitle: form.seoTitle, metaDescription: form.metaDescription, focusKeyword: form.focusKeyword, coverImageUrl: form.coverImageUrl, coverImageAlt: form.coverImageAlt, excerpt: form.excerpt, tagsCount: form.tags.split(',').filter((t: string) => t.trim()).length, hasCategory: Boolean(form.categoryId) }),
    [form]
  );

  const payload = (status?: string) => ({
    ...form,
    status: status ?? form.status,
    scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
    tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
    topics: form.topics.split(',').map((t: string) => t.trim()).filter(Boolean),
    keywords: form.keywords.split(',').map((t: string) => t.trim()).filter(Boolean),
    authorId: form.authorId || null,
    categoryId: form.categoryId || null,
  });

  const save = async (status?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const saved = id ? await cms('PATCH', `posts/${id}`, payload(status)) : await cms('POST', 'posts', payload(status));
      setId(saved.id);
      setForm(fromPost(saved));
      setMsg({ ok: true, text: `Saved as ${saved.status.toLowerCase()}.` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const wrap = useCallback((before: string, after = before, placeholder = 'text') => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    set({ content: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }, []);
  const insert = (text: string) => {
    const el = area.current;
    const pos = el ? el.selectionStart : form.content.length;
    set({ content: form.content.slice(0, pos) + (pos && form.content[pos - 1] !== '\n' ? '\n' : '') + text + '\n' + form.content.slice(pos) });
  };

  const upload = async (file: File, asCover = false) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/cms/media', { method: 'POST', body: fd, credentials: 'same-origin' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: json.error || 'Upload failed' }); return; }
    const asset = json.data;
    setMedia((m) => [asset, ...m]);
    if (asCover) set({ coverImageUrl: asset.url, coverImageAlt: form.coverImageAlt || form.title });
    else insert(`![${asset.fileName.replace(/\.[^.]+$/, '')}](${asset.url})`);
  };

  const ai = async (action: string, apply: (r: any) => void, extra: Record<string, unknown> = {}) => {
    setAiBusy(action);
    setMsg(null);
    try {
      const el = area.current;
      const selected = el && el.selectionEnd > el.selectionStart ? form.content.slice(el.selectionStart, el.selectionEnd) : '';
      const out = await fetch('/api/admin/cms/ai', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text: selected || form.content, title: form.title, focusKeyword: form.focusKeyword, ...extra }),
      }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'AI request failed'); return j; });
      apply({ result: out.result, selected, start: el?.selectionStart ?? 0, end: el?.selectionEnd ?? 0 });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setAiBusy('');
    }
  };
  const replaceSelection = ({ result, selected, start, end }: any) => {
    set({ content: selected ? form.content.slice(0, start) + result + form.content.slice(end) : String(result) });
    setVersion((v) => v + 1);
  };

  /** Upload for the visual editor: store in the media library and hand back the URL. */
  const uploadOnly = async (file: File): Promise<{ url: string } | null> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/cms/media', { method: 'POST', body: fd, credentials: 'same-origin' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: json.error || 'Upload failed' }); return null; }
    setMedia((m) => [json.data, ...m]);
    return { url: json.data.url };
  };

  const field = (label: string, el: React.ReactNode, hint?: string) => (
    <label className="block space-y-1"><span className="text-xs text-[#94A3B8]">{label}</span>{el}{hint && <span className="block text-[11px] text-[#64748B]">{hint}</span>}</label>
  );
  const tool = (icon: React.ReactNode, label: string, fn: () => void) => (
    <button type="button" title={label} aria-label={label} onClick={fn} className="p-1.5 rounded-lg text-[#CBD5E1] hover:bg-white/10 cursor-pointer">{icon}</button>
  );

  if (loading) return <div className="p-10 text-center text-[#94A3B8]"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading…</div>;
  const scoreColor = seo.score >= 80 ? 'text-emerald-400' : seo.score >= 50 ? 'text-amber-300' : 'text-red-400';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <button type="button" onClick={onClose} className={btnGhost}>← All posts</button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#94A3B8]">{readingTimeMinutes(form.content)} min read · SEO <b className={scoreColor}>{seo.score}</b>/100</span>
          {id && <a className={btnGhost} href={`/blog/preview/${id}`} target="_blank" rel="noreferrer"><Eye className="w-4 h-4" /> Preview</a>}
          <button type="button" disabled={busy} onClick={() => save('DRAFT')} className={btnGhost}><Save className="w-4 h-4" /> Save draft</button>
          {canPublish ? (
            <>
              {form.scheduledAt && <button type="button" disabled={busy} onClick={() => save('SCHEDULED')} className={btnGhost}>Schedule</button>}
              <button type="button" disabled={busy} onClick={() => save('PUBLISHED')} className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Publish</button>
            </>
          ) : <span className="text-xs text-[#94A3B8]">Publishing needs an admin.</span>}
        </div>
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}

      <div className="grid xl:grid-cols-[1fr_22rem] gap-5">
        <div className="space-y-3">
          {!id && templates.length > 0 && !form.content && (
            <div className="rounded-xl border border-white/10 p-3 text-sm flex flex-wrap items-center gap-2">
              <span className="text-[#94A3B8]">Start from a template:</span>
              {templates.map((t) => (
                <button key={t.id} type="button" className={btnGhost} onClick={async () => { const c = await cms('POST', `posts/${t.id}/duplicate`, {}); setId(c.id); setForm(fromPost(c)); setVersion((v) => v + 1); }}>{t.templateName || t.title}</button>
              ))}
            </div>
          )}
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Post title" aria-label="Post title" className={`${inputCls} !text-xl !font-serif !py-3`} />
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm w-fit" role="tablist" aria-label="Editor mode">
            {(['visual', 'write', 'preview'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { if (t === 'visual') setVersion((v) => v + 1); setTab(t); }} className={`px-4 py-1.5 cursor-pointer ${tab === t ? 'bg-[#F5BD48] text-[#111215] font-bold' : 'text-[#CBD5E1]'}`}>
                {t === 'visual' ? 'Visual editor' : t === 'write' ? 'Advanced (Markdown)' : 'Preview'}
              </button>
            ))}
          </div>
          {tab === 'write' && (
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#0b0c10] p-1.5">
            {tool(<Bold className="w-4 h-4" />, 'Bold', () => wrap('**'))}
            {tool(<Italic className="w-4 h-4" />, 'Italic', () => wrap('*'))}
            {tool(<Heading2 className="w-4 h-4" />, 'Heading', () => insert('## Heading'))}
            {tool(<Link2 className="w-4 h-4" />, 'Link', () => wrap('[', '](https://)', 'link text'))}
            {tool(<List className="w-4 h-4" />, 'Bullet list', () => insert('- Item one\n- Item two'))}
            {tool(<ListChecks className="w-4 h-4" />, 'Checklist', () => insert('- [ ] To do\n- [x] Done'))}
            {tool(<Quote className="w-4 h-4" />, 'Quote', () => insert('> Quote text'))}
            {tool(<Code className="w-4 h-4" />, 'Code block', () => insert('```\ncode\n```'))}
            {tool(<Table className="w-4 h-4" />, 'Table', () => insert('| Column A | Column B |\n|---|---|\n| One | Two |'))}
            {tool(<Minus className="w-4 h-4" />, 'Divider', () => insert('---'))}
            {tool(<Video className="w-4 h-4" />, 'Video embed', () => insert('::video[https://www.youtube.com/watch?v=VIDEO_ID]'))}
            <label title="Upload and insert image" className="p-1.5 rounded-lg text-[#CBD5E1] hover:bg-white/10 cursor-pointer">
              <ImageIcon className="w-4 h-4" /><span className="sr-only">Upload image</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            </label>
            <select aria-label="Insert block" className="bg-transparent text-xs text-[#CBD5E1] px-1 cursor-pointer" value="" onChange={(e) => {
              const v = e.target.value;
              if (v === 'callout') insert('> [!TIP] Helpful tip goes here.');
              if (v === 'button') insert('::button[Shop gifts](/#catalog-section)');
              if (v === 'cta') insert('::cta[Make it personal|Turn this idea into a one-of-a-kind gift.|Shop now|/#catalog-section]');
              if (v === 'product') insert('::product[product-slug]');
            }}>
              <option value="">+ Block</option><option value="callout">Callout</option><option value="button">Button</option><option value="cta">CTA panel</option><option value="product">Product card</option>
            </select>
          </div>
          )}
          {tab === 'visual' ? (
            <BlockEditor key={`v${version}`} value={form.content} onChange={(md) => set({ content: md })} upload={uploadOnly} />
          ) : tab === 'write' ? (
            <textarea ref={area} value={form.content} onChange={(e) => set({ content: e.target.value })} rows={26} spellCheck aria-label="Post content (Markdown)" placeholder="Write in Markdown. Use the toolbar for tables, callouts, videos, CTAs…" className={`${inputCls} font-mono !leading-relaxed`} />
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#08090B] p-6 min-h-[30rem]"><div className="cms-prose" dangerouslySetInnerHTML={{ __html: preview || '<p>Nothing to preview yet.</p>' }} /></div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 p-4 space-y-3">
            {field('Status', <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={inputCls} disabled={!canPublish}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>)}
            {field('Publish at (for Scheduled)', <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} className={inputCls} disabled={!canPublish} />)}
            {field('Author', <select value={form.authorId} onChange={(e) => set({ authorId: e.target.value })} className={inputCls}><option value="">— none —</option>{authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>)}
            {field('Category', <select value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={inputCls}><option value="">— none —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
            {field('Tags', <input value={form.tags} onChange={(e) => set({ tags: e.target.value })} className={inputCls} placeholder="birthday, mugs, corporate" />, 'Comma separated')}
            {field('Topics', <input value={form.topics} onChange={(e) => set({ topics: e.target.value })} className={inputCls} />)}
            {field('Collection', <input value={form.collection} onChange={(e) => set({ collection: e.target.value })} className={inputCls} placeholder="e.g. Diwali 2026 guide" />)}
            <label className="flex items-center gap-2 text-sm text-[#E2E8F0]"><input type="checkbox" checked={form.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} /> Featured post</label>
            {field('Excerpt', <textarea value={form.excerpt} onChange={(e) => set({ excerpt: e.target.value })} rows={3} className={inputCls} />, 'Auto-generated from content if left blank')}
            {field('Cover image URL', <input value={form.coverImageUrl} onChange={(e) => set({ coverImageUrl: e.target.value })} className={inputCls} />)}
            <label className="text-xs text-[#F5BD48] cursor-pointer hover:underline">Upload cover<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, true); e.target.value = ''; }} /></label>
            {field('Cover alt text', <input value={form.coverImageAlt} onChange={(e) => set({ coverImageAlt: e.target.value })} className={inputCls} />)}
          </div>

          <div className="flex rounded-xl overflow-hidden border border-white/10 text-sm">
            {(['seo', 'ai', 'media'] as const).map((p) => <button key={p} type="button" onClick={() => setPanel(p)} className={`flex-1 py-2 cursor-pointer ${panel === p ? 'bg-[#F5BD48] text-[#111215] font-bold' : 'text-[#CBD5E1]'}`}>{p === 'ai' ? 'AI' : p === 'seo' ? 'SEO' : 'Media'}</button>)}
          </div>

          {panel === 'seo' && (
            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              {field('Focus keyword', <input value={form.focusKeyword} onChange={(e) => set({ focusKeyword: e.target.value })} className={inputCls} />)}
              {field(`SEO title (${(form.seoTitle || form.title).length}/60)`, <input value={form.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} className={inputCls} />)}
              {field(`Meta description (${form.metaDescription.length}/160)`, <textarea value={form.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} rows={3} className={inputCls} />)}
              {field('URL slug', <input value={form.slug} onChange={(e) => set({ slug: e.target.value })} className={inputCls} placeholder="auto from title" />, 'Changing a published slug auto-creates a 301 redirect')}
              {field('Keywords', <input value={form.keywords} onChange={(e) => set({ keywords: e.target.value })} className={inputCls} />)}
              {field('Canonical URL', <input value={form.canonicalUrl} onChange={(e) => set({ canonicalUrl: e.target.value })} className={inputCls} placeholder="leave blank for self" />)}
              {field('Open Graph image', <input value={form.ogImageUrl} onChange={(e) => set({ ogImageUrl: e.target.value })} className={inputCls} />)}
              {field('Twitter image', <input value={form.twitterImageUrl} onChange={(e) => set({ twitterImageUrl: e.target.value })} className={inputCls} />)}
              <div className="space-y-1.5 text-sm text-[#E2E8F0]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.robotsIndex} onChange={(e) => set({ robotsIndex: e.target.checked })} /> Allow indexing</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.robotsFollow} onChange={(e) => set({ robotsFollow: e.target.checked })} /> Follow links</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.includeInSitemap} onChange={(e) => set({ includeInSitemap: e.target.checked })} /> Include in sitemap</label>
              </div>
              <div className="rounded-lg border border-white/10 bg-white p-3 text-left" aria-label="Google preview">
                <p className="text-[#1a0dab] text-base leading-snug truncate">{form.seoTitle || form.title || 'Post title'}</p>
                <p className="text-[#006621] text-xs">snappygiftz.com › blog › {form.slug || '…'}</p>
                <p className="text-[#545454] text-xs line-clamp-2">{form.metaDescription || form.excerpt || 'Meta description appears here.'}</p>
              </div>
              <ul className="space-y-1 text-xs">
                {seo.checks.map((c) => <li key={c.id} className={c.passed ? 'text-emerald-400' : 'text-[#94A3B8]'}>{c.passed ? '✓' : '○'} {c.label}{!c.passed && c.hint ? ` — ${c.hint}` : ''}</li>)}
              </ul>
              <div className="space-y-2 pt-2 border-t border-white/10">
                <p className="text-xs text-[#94A3B8]">FAQs (adds FAQ schema)</p>
                {form.faqs.map((f: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <input value={f.question} onChange={(e) => set({ faqs: form.faqs.map((x: any, j: number) => j === i ? { ...x, question: e.target.value } : x) })} placeholder="Question" className={inputCls} />
                    <textarea value={f.answer} onChange={(e) => set({ faqs: form.faqs.map((x: any, j: number) => j === i ? { ...x, answer: e.target.value } : x) })} rows={2} placeholder="Answer" className={inputCls} />
                    <button type="button" className="text-xs text-red-300" onClick={() => set({ faqs: form.faqs.filter((_: any, j: number) => j !== i) })}>Remove</button>
                  </div>
                ))}
                <button type="button" className={btnGhost} onClick={() => set({ faqs: [...form.faqs, { question: '', answer: '' }] })}>+ Add FAQ</button>
              </div>
            </div>
          )}

          {panel === 'ai' && (
            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              <p className="text-xs text-[#94A3B8]">Select text in the editor to rewrite/expand only that part; otherwise the whole post is used.</p>
              <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Topic for a new article" className={inputCls} />
              <button type="button" disabled={!!aiBusy || !(aiTopic || form.title)} className={btnPrimary} onClick={() => ai('generate', (r) => { set({ content: String(r.result), title: form.title || aiTopic }); setVersion((v) => v + 1); }, { topic: aiTopic || form.title })}>
                {aiBusy === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate blog
              </button>
              <div className="grid grid-cols-2 gap-2">
                {[['rewrite', 'Rewrite'], ['expand', 'Expand'], ['grammar', 'Fix grammar']].map(([a, l]) => (
                  <button key={a} type="button" disabled={!!aiBusy} className={btnGhost} onClick={() => ai(a, replaceSelection)}>{aiBusy === a ? '…' : l}</button>
                ))}
                <button type="button" disabled={!!aiBusy} className={btnGhost} onClick={() => ai('summarize', (r) => set({ excerpt: String(r.result) }))}>{aiBusy === 'summarize' ? '…' : 'Summarise → excerpt'}</button>
                <button type="button" disabled={!!aiBusy} className={btnGhost} onClick={() => ai('meta', (r) => set({ metaDescription: String(r.result).slice(0, 320) }))}>{aiBusy === 'meta' ? '…' : 'Meta description'}</button>
                <button type="button" disabled={!!aiBusy} className={btnGhost} onClick={() => ai('keywords', (r) => set({ keywords: (Array.isArray(r.result) ? r.result : []).join(', ') }))}>{aiBusy === 'keywords' ? '…' : 'Keywords'}</button>
                <button type="button" disabled={!!aiBusy} className={btnGhost} onClick={() => ai('slug', (r) => set({ slug: String(r.result) }))}>{aiBusy === 'slug' ? '…' : 'Slug'}</button>
                <button type="button" disabled={!!aiBusy} className={btnGhost} onClick={() => ai('faqs', (r) => set({ faqs: Array.isArray(r.result) ? r.result : form.faqs }))}>{aiBusy === 'faqs' ? '…' : 'FAQs'}</button>
                <button type="button" disabled={!!aiBusy} className={btnGhost} onClick={() => ai('cta', (r) => set({ content: `${form.content}\n\n${String(r.result)}\n` }))}>{aiBusy === 'cta' ? '…' : 'CTA block'}</button>
                <button type="button" disabled={!!aiBusy} className={btnGhost} onClick={() => ai('seo', (r) => { const o = r.result || {}; set({ seoTitle: o.seoTitle || form.seoTitle, metaDescription: o.metaDescription || form.metaDescription, keywords: Array.isArray(o.keywords) ? o.keywords.join(', ') : form.keywords }); setMsg({ ok: true, text: (o.improvements || []).join(' • ') || 'SEO fields updated.' }); })}>{aiBusy === 'seo' ? '…' : 'Improve SEO'}</button>
              </div>
            </div>
          )}

          {panel === 'media' && (
            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              <label className={btnGhost}><ImageIcon className="w-4 h-4" /> Upload image<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} /></label>
              <div className="grid grid-cols-3 gap-2 max-h-72 overflow-auto">
                {media.map((m) => (
                  <button key={m.id} type="button" title={m.fileName} onClick={() => insert(`![${m.altText || m.fileName.replace(/\.[^.]+$/, '')}](${m.url})`)} className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-[#F5BD48] cursor-pointer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.altText || m.fileName} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {id && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} onClick={async () => { const c = await cms('POST', `posts/${id}/duplicate`, {}); setId(c.id); setForm(fromPost(c)); setVersion((v) => v + 1); setMsg({ ok: true, text: 'Duplicated as a new draft.' }); }}>Duplicate</button>
              <button type="button" className={btnGhost} onClick={async () => { const name = window.prompt('Template name', form.title); if (name) { await cms('POST', `posts/${id}/duplicate`, { asTemplate: true, templateName: name }); setMsg({ ok: true, text: 'Saved as template.' }); } }}>Save as template</button>
              {canPublish && form.status !== 'ARCHIVED' && <button type="button" className={btnGhost} onClick={() => save('ARCHIVED')}>Archive</button>}
              {canPublish && <button type="button" className={btnDanger} onClick={async () => { if (window.confirm('Delete this post permanently?')) { await cms('DELETE', `posts/${id}`); onClose(); } }}>Delete</button>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
