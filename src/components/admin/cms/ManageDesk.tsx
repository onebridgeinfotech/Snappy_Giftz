'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { btnDanger, btnGhost, btnPrimary, cms, inputCls } from './cmsApi';

type Sub = 'taxonomy' | 'authors' | 'pages' | 'seo' | 'redirects' | 'settings';
const SUBS: Array<[Sub, string]> = [['taxonomy', 'Categories & tags'], ['authors', 'Authors'], ['pages', 'Product & service pages'], ['seo', 'Page SEO'], ['redirects', 'Redirects'], ['settings', 'Robots, menu & footer']];

function useList<T = any>(path: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => { setLoading(true); cms<T[]>('GET', path).then(setData).catch(() => setData([])).finally(() => setLoading(false)); }, [path]);
  useEffect(reload, [reload]);
  return { data, loading, reload };
}

function Msg({ m }: { m: { ok: boolean; t: string } | null }) {
  return m ? <p role="status" className={`text-sm ${m.ok ? 'text-emerald-400' : 'text-red-400'}`}>{m.t}</p> : null;
}
const L = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block space-y-1"><span className="text-xs text-[#94A3B8]">{label}</span>{children}</label>;
const csv = (v: any) => (Array.isArray(v) ? v.join(', ') : v || '');
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function run(setMsg: (m: { ok: boolean; t: string } | null) => void, fn: () => Promise<unknown>, ok = 'Saved.') {
  setMsg(null);
  return fn().then(() => { setMsg({ ok: true, t: ok }); return true; }).catch((e: Error) => { setMsg({ ok: false, t: e.message }); return false; });
}

function Taxonomy({ isAdmin }: { isAdmin: boolean }) {
  const cats = useList('categories'); const tags = useList('tags');
  const [f, setF] = useState({ name: '', parentId: '', description: '' });
  const [tag, setTag] = useState('');
  const [msg, setMsg] = useState<any>(null);
  const roots = cats.data.filter((c: any) => !c.parentId);
  const ro = !isAdmin;
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-white">Categories &amp; sub-categories</h3>
        {!ro && (
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" aria-label="Category name" className={inputCls} />
            <select value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })} aria-label="Parent category" className={inputCls}><option value="">Top level</option>{roots.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button type="button" className={btnPrimary} disabled={!f.name.trim()} onClick={async () => { if (await run(setMsg, () => cms('POST', 'categories', f), 'Category added.')) { setF({ name: '', parentId: '', description: '' }); cats.reload(); } }}>Add</button>
          </div>
        )}
        <Msg m={msg} />
        <ul className="rounded-xl border border-white/10 divide-y divide-white/5">
          {roots.map((r: any) => (
            <React.Fragment key={r.id}>
              {[r, ...cats.data.filter((c: any) => c.parentId === r.id)].map((c: any) => (
                <li key={c.id} className={`flex items-center gap-2 p-2.5 text-sm ${c.parentId ? 'pl-8' : ''}`}>
                  <span className="flex-1 text-white">{c.parentId && '↳ '}{c.name} <span className="text-xs text-[#64748B]">/{c.slug} · {c._count.posts} posts</span></span>
                  {!ro && <button type="button" className="text-xs text-red-300 cursor-pointer" onClick={() => window.confirm(`Delete "${c.name}"? Posts are kept uncategorised.`) && run(setMsg, () => cms('DELETE', `categories/${c.id}`), 'Deleted.').then(cats.reload)}>Delete</button>}
                </li>
              ))}
            </React.Fragment>
          ))}
          {!roots.length && <li className="p-4 text-sm text-[#64748B]">No categories yet. Suggested: Business (CRM, HRMS, ERP), Marketing, AI, Healthcare, Education, Manufacturing, Real Estate, Retail.</li>}
        </ul>
        {!ro && !cats.data.length && (
          <button type="button" className={btnGhost} onClick={async () => {
            const tree: Record<string, string[]> = { Business: ['CRM', 'HRMS', 'ERP'], Marketing: ['WhatsApp Marketing', 'Email Marketing', 'Social Media'], AI: ['AI Automation', 'Chatbots', 'LLM', 'Agents'], Healthcare: [], Education: [], Manufacturing: [], 'Real Estate': [], Retail: [], 'Gift Ideas': ['Birthday', 'Wedding', 'Corporate'] };
            for (const [name, kids] of Object.entries(tree)) { const p: any = await cms('POST', 'categories', { name }); for (const k of kids) await cms('POST', 'categories', { name: k, parentId: p.id }); }
            cats.reload();
          }}>Add starter categories</button>
        )}
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-white">Tags</h3>
        <div className="flex gap-2"><input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="New tag" aria-label="New tag" className={inputCls} /><button type="button" className={btnPrimary} disabled={!tag.trim()} onClick={async () => { if (await run(setMsg, () => cms('POST', 'tags', { name: tag }), 'Tag added.')) { setTag(''); tags.reload(); } }}>Add</button></div>
        <div className="flex flex-wrap gap-2">
          {tags.data.map((t: any) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 text-xs text-[#E2E8F0]">#{t.name} <span className="text-[#64748B]">{t._count.posts}</span>
              {!ro && <button type="button" aria-label={`Delete tag ${t.name}`} className="text-red-300 cursor-pointer" onClick={() => run(setMsg, () => cms('DELETE', `tags/${t.id}`), 'Tag deleted.').then(tags.reload)}>×</button>}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function Authors({ isAdmin }: { isAdmin: boolean }) {
  const { data, reload } = useList('authors');
  const blank = { id: '', name: '', title: '', bio: '', avatarUrl: '', email: '', isActive: true };
  const [f, setF] = useState<any>(blank);
  const [msg, setMsg] = useState<any>(null);
  const save = async () => { if (await run(setMsg, () => (f.id ? cms('PATCH', `authors/${f.id}`, f) : cms('POST', 'authors', f)), 'Author saved.')) { setF(blank); reload(); } };
  return (
    <div className="grid lg:grid-cols-[1fr_22rem] gap-6">
      <ul className="rounded-xl border border-white/10 divide-y divide-white/5 self-start">
        {data.map((a: any) => (
          <li key={a.id} className="p-3 flex items-center gap-3 text-sm">
            <span className="flex-1 text-white">{a.name} <span className="text-xs text-[#64748B]">{a.title} · {a._count.posts} posts{!a.isActive && ' · inactive'}</span></span>
            {isAdmin && <><button type="button" className="text-xs text-[#F5BD48] cursor-pointer" onClick={() => setF({ ...blank, ...a, title: a.title || '', bio: a.bio || '', avatarUrl: a.avatarUrl || '', email: a.email || '' })}>Edit</button>
              <button type="button" className="text-xs text-red-300 cursor-pointer" onClick={() => window.confirm(`Delete ${a.name}?`) && run(setMsg, () => cms('DELETE', `authors/${a.id}`), 'Deleted.').then(reload)}>Delete</button></>}
          </li>
        ))}
        {!data.length && <li className="p-4 text-sm text-[#64748B]">No authors yet.</li>}
      </ul>
      {isAdmin ? (
        <div className="space-y-2 rounded-xl border border-white/10 p-4">
          <h3 className="text-sm font-bold text-white">{f.id ? 'Edit author' : 'New author'}</h3>
          <L label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></L>
          <L label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} /></L>
          <L label="Bio"><textarea rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} className={inputCls} /></L>
          <L label="Avatar URL"><input value={f.avatarUrl} onChange={(e) => setF({ ...f, avatarUrl: e.target.value })} className={inputCls} /></L>
          <label className="flex items-center gap-2 text-sm text-[#E2E8F0]"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active</label>
          <div className="flex gap-2"><button type="button" className={btnPrimary} onClick={save} disabled={!f.name.trim()}>Save</button>{f.id && <button type="button" className={btnGhost} onClick={() => setF(blank)}>Cancel</button>}</div>
          <Msg m={msg} />
        </div>
      ) : <p className="text-sm text-[#94A3B8]">Only admins can manage authors.</p>}
    </div>
  );
}

const SECTION_LISTS: Array<{ key: string; label: string; hint: string; example: string }> = [
  { key: 'features', label: 'Key features', hint: 'One per line: Title | description', example: 'Laser engraving | Permanent, scratch-proof' },
  { key: 'benefits', label: 'Benefits', hint: 'Title | description', example: 'Memorable | Made for one person' },
  { key: 'useCases', label: 'Use cases', hint: 'Title | description', example: 'Birthdays | A gift they will keep' },
  { key: 'industries', label: 'Industries / audiences', hint: 'One per line', example: 'IT companies' },
  { key: 'screenshots', label: 'Screenshots / gallery', hint: 'Image URL | caption', example: '/uploads/media/x.jpg | Front view' },
  { key: 'videos', label: 'Videos', hint: 'YouTube/Vimeo/.mp4 URL', example: 'https://www.youtube.com/watch?v=…' },
  { key: 'pricing', label: 'Pricing plans', hint: 'Name | price | description | cta link', example: 'Starter | ₹499 | 1–10 units | /contact' },
  { key: 'faqs', label: 'FAQs', hint: 'Question | answer', example: 'Do you deliver? | Yes, across Hyderabad.' },
  { key: 'testimonials', label: 'Testimonials', hint: 'Quote | author | role', example: 'Loved it! | Priya | Customer' },
  { key: 'caseStudies', label: 'Case studies', hint: 'Title | summary | result | link', example: 'Acme gifting | 500 hampers | Delivered in 3 days | /blog/acme' },
  { key: 'ctas', label: 'CTA sections', hint: 'Title | text | button label | link', example: 'Ready? | Order today | Shop now | /#catalog-section' },
  { key: 'internalLinks', label: 'Internal links', hint: 'Label | /path', example: 'Birthday gifts | /blog/birthday-gifts' },
  { key: 'externalReferences', label: 'External references', hint: 'Label | https://…', example: 'GST guide | https://www.gst.gov.in' },
];

const parseLines = (key: string, text: string): any[] =>
  text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const p = l.split('|').map((x) => x.trim());
    switch (key) {
      case 'industries': return l;
      case 'videos': return { url: p[0] };
      case 'screenshots': return { url: p[0], caption: p[1] };
      case 'pricing': return { name: p[0], price: p[1], description: p[2], ctaHref: p[3], ctaLabel: p[3] ? 'Get started' : undefined };
      case 'faqs': return { question: p[0], answer: p[1] };
      case 'testimonials': return { quote: p[0], author: p[1], role: p[2] };
      case 'caseStudies': return { title: p[0], summary: p[1], result: p[2], href: p[3] };
      case 'ctas': return { title: p[0], text: p[1], label: p[2], href: p[3] };
      case 'internalLinks': case 'externalReferences': return { label: p[0], href: p[1] };
      default: return { title: p[0], description: p[1] };
    }
  }).filter((x) => (typeof x === 'string' ? x : Object.values(x).some(Boolean)));
const toLines = (key: string, arr: any[] = []) => arr.map((x) => {
  if (typeof x === 'string') return x;
  switch (key) {
    case 'videos': return x.url;
    case 'screenshots': return [x.url, x.caption].filter(Boolean).join(' | ');
    case 'pricing': return [x.name, x.price, x.description || '', x.ctaHref || ''].join(' | ');
    case 'faqs': return `${x.question} | ${x.answer}`;
    case 'testimonials': return [x.quote, x.author, x.role].filter(Boolean).join(' | ');
    case 'caseStudies': return [x.title, x.summary, x.result || '', x.href || ''].join(' | ');
    case 'ctas': return [x.title, x.text || '', x.label, x.href].join(' | ');
    case 'internalLinks': case 'externalReferences': return `${x.label} | ${x.href}`;
    default: return [x.title, x.description].filter(Boolean).join(' | ');
  }
}).join('\n');

function SeoFields({ f, set }: { f: any; set: (p: any) => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <L label="SEO title"><input value={f.seoTitle || ''} onChange={(e) => set({ seoTitle: e.target.value })} className={inputCls} /></L>
      <L label="Keywords (comma separated)"><input value={csv(f.keywords)} onChange={(e) => set({ keywords: e.target.value })} className={inputCls} /></L>
      <div className="sm:col-span-2"><L label={`Meta description (${(f.metaDescription || '').length}/160)`}><textarea rows={2} value={f.metaDescription || ''} onChange={(e) => set({ metaDescription: e.target.value })} className={inputCls} /></L></div>
      <L label="Canonical URL"><input value={f.canonicalUrl || ''} onChange={(e) => set({ canonicalUrl: e.target.value })} className={inputCls} /></L>
      <L label="Open Graph image"><input value={f.ogImageUrl || ''} onChange={(e) => set({ ogImageUrl: e.target.value })} className={inputCls} /></L>
      <L label="Twitter image"><input value={f.twitterImageUrl || ''} onChange={(e) => set({ twitterImageUrl: e.target.value })} className={inputCls} /></L>
      <div className="flex flex-wrap items-center gap-4 text-sm text-[#E2E8F0]">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.robotsIndex !== false} onChange={(e) => set({ robotsIndex: e.target.checked })} /> Index</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.robotsFollow !== false} onChange={(e) => set({ robotsFollow: e.target.checked })} /> Follow</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.includeInSitemap !== false} onChange={(e) => set({ includeInSitemap: e.target.checked })} /> In sitemap</label>
      </div>
    </div>
  );
}

function Pages() {
  const { data, loading, reload } = useList<any>('pages');
  const payload: any = data as any;
  const products: any[] = (payload as any)?.products ?? [];
  const services: any[] = (payload as any)?.services ?? [];
  const [sel, setSel] = useState<any>(null);
  const [f, setF] = useState<any>(null);
  const [lines, setLines] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<any>(null);

  const open = (kind: 'PRODUCT' | 'SERVICE', item: any, page: any) => {
    const p = page || { title: item?.name || '', isPublished: true, sections: {} };
    setSel({ kind, item, page });
    setF({ ...p, keywords: csv(p.keywords), heroTitle: p.heroTitle || '', heroSubtitle: p.heroSubtitle || '', heroImageUrl: p.heroImageUrl || '', overview: p.overview || '', slug: p.slug || '' });
    setLines(Object.fromEntries(SECTION_LISTS.map((s) => [s.key, toLines(s.key, p.sections?.[s.key])])));
    setMsg(null);
  };
  const save = async () => {
    const sections: any = Object.fromEntries(SECTION_LISTS.map((s) => [s.key, parseLines(s.key, lines[s.key] || '')]));
    sections.showContactForm = f.showContactForm !== false;
    const body = { ...f, keywords: list(csv(f.keywords)), sections, productId: sel.kind === 'PRODUCT' ? sel.item.id : undefined };
    const ok = await run(setMsg, async () => { const saved: any = f.id ? await cms('PATCH', `pages/${f.id}`, body) : await cms('POST', 'pages', body); setF((x: any) => ({ ...x, id: saved.id, slug: saved.slug })); }, 'Page saved and republished.');
    if (ok) reload();
  };

  if (loading && !sel) return <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />;
  if (sel && f) {
    return (
      <div className="space-y-4">
        <button type="button" className={btnGhost} onClick={() => { setSel(null); setF(null); }}>← Back</button>
        <h3 className="text-lg font-bold text-white">{sel.kind === 'PRODUCT' ? `Product page: ${sel.item.name}` : f.id ? `Service: ${f.title}` : 'New service page'}</h3>
        <p className="text-xs text-[#94A3B8]">{sel.kind === 'PRODUCT' ? 'Anything you leave empty falls back to auto-generated content. ' : ''}One item per line; use “|” between fields.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <L label="Page title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} /></L>
          {sel.kind === 'SERVICE' && <L label="URL slug (/services/…)"><input value={f.slug} disabled={Boolean(f.id)} onChange={(e) => setF({ ...f, slug: e.target.value })} className={inputCls} /></L>}
          <L label="Hero title"><input value={f.heroTitle} onChange={(e) => setF({ ...f, heroTitle: e.target.value })} className={inputCls} /></L>
          <L label="Hero image URL"><input value={f.heroImageUrl} onChange={(e) => setF({ ...f, heroImageUrl: e.target.value })} className={inputCls} /></L>
          <div className="sm:col-span-2"><L label="Hero subtitle"><textarea rows={2} value={f.heroSubtitle} onChange={(e) => setF({ ...f, heroSubtitle: e.target.value })} className={inputCls} /></L></div>
          <div className="sm:col-span-2"><L label="Overview (Markdown)"><textarea rows={5} value={f.overview} onChange={(e) => setF({ ...f, overview: e.target.value })} className={inputCls} /></L></div>
        </div>
        <div className="grid lg:grid-cols-2 gap-3">
          {SECTION_LISTS.map((s) => (
            <L key={s.key} label={`${s.label} — ${s.hint}`}><textarea rows={4} value={lines[s.key] || ''} placeholder={s.example} onChange={(e) => setLines({ ...lines, [s.key]: e.target.value })} className={`${inputCls} font-mono !text-xs`} /></L>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-[#E2E8F0]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.showContactForm !== false} onChange={(e) => setF({ ...f, showContactForm: e.target.checked })} /> Show contact form</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.isPublished !== false} onChange={(e) => setF({ ...f, isPublished: e.target.checked })} /> Published</label>
        </div>
        <h4 className="text-sm font-bold text-white pt-2">SEO</h4>
        <SeoFields f={f} set={(p) => setF({ ...f, ...p })} />
        <div className="flex items-center gap-3"><button type="button" className={btnPrimary} onClick={save} disabled={!f.title?.trim()}>Save &amp; publish</button>{f.id && sel.kind === 'SERVICE' && <button type="button" className={btnDanger} onClick={() => window.confirm('Delete this service page?') && run(setMsg, () => cms('DELETE', `pages/${f.id}`), 'Deleted.').then(() => { reload(); setSel(null); })}>Delete</button>}<Msg m={msg} /></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-white">Service pages (/services/…)</h3><button type="button" className={btnPrimary} onClick={() => open('SERVICE', null, null)}>+ New service</button></div>
        <ul className="rounded-xl border border-white/10 divide-y divide-white/5">{services.map((s: any) => <li key={s.id} className="p-2.5 text-sm flex justify-between"><span className="text-white">{s.title} <span className="text-xs text-[#64748B]">/services/{s.slug}{!s.isPublished && ' · unpublished'}</span></span><button type="button" className="text-xs text-[#F5BD48] cursor-pointer" onClick={() => open('SERVICE', null, s)}>Edit</button></li>)}{!services.length && <li className="p-3 text-sm text-[#64748B]">None yet.</li>}</ul>
      </section>
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">Product pages (/products/…)</h3><button type="button" className={btnGhost} onClick={() => window.confirm("Create a dedicated page for every product that does not have one? Existing pages are not changed.") && run(setMsg, async () => { const r: any = await cms("POST", "pages/generate"); setMsg({ ok: true, t: `Created ${r.created} page(s); ${r.skipped} already existed.` }); reload(); }, "Done.")}>Generate pages for all products</button></div><Msg m={msg} />
        <ul className="rounded-xl border border-white/10 divide-y divide-white/5 max-h-96 overflow-auto">{products.map((p: any) => <li key={p.id} className="p-2.5 text-sm flex justify-between"><span className="text-white">{p.name} <span className="text-xs text-[#64748B]">{p.contentPage ? 'custom content' : 'auto-generated'}</span></span><button type="button" className="text-xs text-[#F5BD48] cursor-pointer" onClick={() => open('PRODUCT', p, p.contentPage)}>Edit SEO page</button></li>)}</ul>
      </section>
    </div>
  );
}

function PageSeo({ isAdmin }: { isAdmin: boolean }) {
  const { data, reload } = useList('seo');
  const blank = { path: '/', changeFrequency: 'weekly', sitemapPriority: 0.5, robotsIndex: true, robotsFollow: true, includeInSitemap: true, keywords: '' };
  const [f, setF] = useState<any>(blank);
  const [msg, setMsg] = useState<any>(null);
  if (!isAdmin) return <p className="text-sm text-[#94A3B8]">Only admins can change page-level SEO.</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-[#94A3B8]">Override title, description, canonical, robots and sitemap for any path (e.g. <code>/</code>, <code>/about</code>, <code>/blog</code>). Pages that read overrides: home blog index, services index, and any page using the SEO service.</p>
      <ul className="rounded-xl border border-white/10 divide-y divide-white/5">
        {data.map((e: any) => <li key={e.id} className="p-2.5 text-sm flex justify-between gap-3"><span className="text-white">{e.path} <span className="text-xs text-[#64748B]">{e.seoTitle}{!e.robotsIndex && ' · noindex'}{!e.includeInSitemap && ' · not in sitemap'}</span></span><span className="flex gap-3"><button type="button" className="text-xs text-[#F5BD48] cursor-pointer" onClick={() => setF({ ...blank, ...e, keywords: csv(e.keywords) })}>Edit</button><button type="button" className="text-xs text-red-300 cursor-pointer" onClick={() => run(setMsg, () => cms('DELETE', `seo/${e.id}`), 'Deleted.').then(reload)}>Delete</button></span></li>)}
        {!data.length && <li className="p-3 text-sm text-[#64748B]">No overrides.</li>}
      </ul>
      <div className="rounded-xl border border-white/10 p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <L label="Path"><input value={f.path} onChange={(e) => setF({ ...f, path: e.target.value })} className={inputCls} /></L>
          <L label="Sitemap priority (0–1)"><input type="number" step="0.1" min="0" max="1" value={f.sitemapPriority} onChange={(e) => setF({ ...f, sitemapPriority: e.target.value })} className={inputCls} /></L>
          <L label="Change frequency"><select value={f.changeFrequency} onChange={(e) => setF({ ...f, changeFrequency: e.target.value })} className={inputCls}>{['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].map((x) => <option key={x}>{x}</option>)}</select></L>
        </div>
        <SeoFields f={f} set={(p) => setF({ ...f, ...p })} />
        <div className="flex items-center gap-3"><button type="button" className={btnPrimary} onClick={async () => { if (await run(setMsg, () => cms('POST', 'seo', { ...f, keywords: list(csv(f.keywords)) }), 'Saved.')) reload(); }}>Save override</button><Msg m={msg} /></div>
      </div>
    </div>
  );
}

function Redirects({ isAdmin }: { isAdmin: boolean }) {
  const { data, reload } = useList('redirects');
  const [f, setF] = useState({ fromPath: '', toPath: '', statusCode: 301, note: '' });
  const [msg, setMsg] = useState<any>(null);
  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="grid sm:grid-cols-[1fr_1fr_6rem_auto] gap-2 items-end">
          <L label="From path"><input value={f.fromPath} onChange={(e) => setF({ ...f, fromPath: e.target.value })} placeholder="/old-page" className={inputCls} /></L>
          <L label="To (path or URL)"><input value={f.toPath} onChange={(e) => setF({ ...f, toPath: e.target.value })} placeholder="/new-page" className={inputCls} /></L>
          <L label="Code"><select value={f.statusCode} onChange={(e) => setF({ ...f, statusCode: Number(e.target.value) })} className={inputCls}>{[301, 302, 307, 308].map((c) => <option key={c}>{c}</option>)}</select></L>
          <button type="button" className={btnPrimary} disabled={!f.fromPath || !f.toPath} onClick={async () => { if (await run(setMsg, () => cms('POST', 'redirects', f), 'Redirect saved (live within a minute).')) { setF({ fromPath: '', toPath: '', statusCode: 301, note: '' }); reload(); } }}>Add</button>
        </div>
      )}
      <Msg m={msg} />
      <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-sm"><thead className="bg-white/5 text-left text-xs text-[#94A3B8]"><tr><th className="p-3">From</th><th>To</th><th>Code</th><th>Hits</th><th>Active</th><th /></tr></thead><tbody>
        {data.map((r: any) => <tr key={r.id} className="border-t border-white/5"><td className="p-3 text-white">{r.fromPath}</td><td className="text-[#CBD5E1] max-w-xs truncate">{r.toPath}</td><td>{r.statusCode}</td><td>{r.hitCount}</td>
          <td>{isAdmin ? <input type="checkbox" aria-label="Active" checked={r.isActive} onChange={(e) => run(setMsg, () => cms('PATCH', `redirects/${r.id}`, { ...r, isActive: e.target.checked }), 'Updated.').then(reload)} /> : r.isActive ? 'Yes' : 'No'}</td>
          <td className="text-right pr-3">{isAdmin && <button type="button" className="text-xs text-red-300 cursor-pointer" onClick={() => run(setMsg, () => cms('DELETE', `redirects/${r.id}`), 'Deleted.').then(reload)}>Delete</button>}</td></tr>)}
        {!data.length && <tr><td colSpan={6} className="p-5 text-center text-[#64748B]">No redirects. Changing a published post&apos;s slug adds one automatically.</td></tr>}
      </tbody></table></div>
    </div>
  );
}

function LinksEditor({ title, value, onChange }: { title: string; value: any[]; onChange: (v: any[]) => void }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-bold text-white">{title}</h4>
      {value.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
          <input value={l.label} aria-label="Label" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={inputCls} />
          <input value={l.href} aria-label="Link" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} className={inputCls} />
          <button type="button" aria-label="Remove link" className="text-red-300 px-2 cursor-pointer" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className={btnGhost} onClick={() => onChange([...value, { label: '', href: '/' }])}>+ Add link</button>
    </div>
  );
}

function Settings({ isAdmin }: { isAdmin: boolean }) {
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState<any>(null);
  useEffect(() => { cms('GET', 'settings').then(setS).catch(() => undefined); }, []);
  if (!isAdmin) return <p className="text-sm text-[#94A3B8]">Only admins can change site settings.</p>;
  if (!s) return <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />;
  const put = (key: string, value: any) => run(setMsg, () => cms('PUT', 'settings', { key, value }), `${key} saved.`);
  const r = s.robots;
  return (
    <div className="space-y-8">
      <Msg m={msg} />
      <section className="space-y-3 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-bold text-white">Who can publish blog posts</h3>
        <label className="flex items-start gap-3 text-sm text-[#E2E8F0]">
          <input type="checkbox" className="mt-1" checked={Boolean(s.permissions?.staffCanPublish)} onChange={(e) => { const v = { staffCanPublish: e.target.checked }; setS({ ...s, permissions: v }); put('permissions', v); }} />
          <span>Let staff accounts (your digital marketing team) publish, schedule, archive and delete posts. Admins can always do this. Staff can always write drafts, upload images and review comments.</span>
        </label>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-white">robots.txt</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <L label="Allow (one path per line)"><textarea rows={4} value={(r.allow || []).join('\n')} onChange={(e) => setS({ ...s, robots: { ...r, allow: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) } })} className={`${inputCls} font-mono !text-xs`} /></L>
          <L label="Disallow (one path per line)"><textarea rows={4} value={(r.disallow || []).join('\n')} onChange={(e) => setS({ ...s, robots: { ...r, disallow: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) } })} className={`${inputCls} font-mono !text-xs`} /></L>
        </div>
        <div className="flex items-center gap-3"><button type="button" className={btnPrimary} onClick={() => put('robots', r)}>Save robots</button><a className="text-xs text-[#F5BD48] underline" href="/robots.txt" target="_blank" rel="noreferrer">View live robots.txt</a><a className="text-xs text-[#F5BD48] underline" href="/sitemap.xml" target="_blank" rel="noreferrer">View sitemap.xml</a></div>
      </section>
      <section className="space-y-3"><LinksEditor title="Navigation menu" value={s.navigation} onChange={(v) => setS({ ...s, navigation: v })} /><button type="button" className={btnPrimary} onClick={() => put('navigation', s.navigation)}>Save menu</button></section>
      <section className="space-y-3"><LinksEditor title="Footer links" value={s.footerLinks} onChange={(v) => setS({ ...s, footerLinks: v })} /><button type="button" className={btnPrimary} onClick={() => put('footerLinks', s.footerLinks)}>Save footer links</button></section>
      <p className="text-xs text-[#64748B]">The menu and footer lists are stored here and available to the storefront; the existing header and footer do not read them yet.</p>
    </div>
  );
}

export function ManageDesk({ isAdmin }: { isAdmin: boolean }) {
  const [sub, setSub] = useState<Sub>('taxonomy');
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3" aria-label="SEO and settings">
        {SUBS.map(([id, label]) => <button key={id} type="button" onClick={() => setSub(id)} aria-current={sub === id ? 'page' : undefined} className={`px-3 py-1 rounded-lg text-sm cursor-pointer ${sub === id ? 'bg-white/15 text-white font-bold' : 'text-[#94A3B8] hover:text-white'}`}>{label}</button>)}
      </nav>
      {sub === 'taxonomy' && <Taxonomy isAdmin={isAdmin} />}
      {sub === 'authors' && <Authors isAdmin={isAdmin} />}
      {sub === 'pages' && <Pages />}
      {sub === 'seo' && <PageSeo isAdmin={isAdmin} />}
      {sub === 'redirects' && <Redirects isAdmin={isAdmin} />}
      {sub === 'settings' && <Settings isAdmin={isAdmin} />}
    </div>
  );
}
