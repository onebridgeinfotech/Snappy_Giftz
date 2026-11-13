'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { PostEditor } from './PostEditor';
import { ManageDesk } from './ManageDesk';
import { btnDanger, btnGhost, btnPrimary, cms, fmtDate, inputCls } from './cmsApi';

type View = 'overview' | 'posts' | 'analytics' | 'engagement' | 'media' | 'manage';
const VIEWS: Array<[View, string]> = [['overview', 'Overview'], ['posts', 'Posts'], ['analytics', 'Analytics'], ['engagement', 'Comments & Subscribers'], ['media', 'Media library'], ['manage', 'SEO & Settings']];

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: 'bg-emerald-500/15 text-emerald-300', DRAFT: 'bg-slate-500/20 text-slate-300', SCHEDULED: 'bg-sky-500/15 text-sky-300', ARCHIVED: 'bg-amber-500/15 text-amber-300',
};
const Badge = ({ s }: { s: string }) => <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLE[s] || ''}`}>{s}</span>;
const scoreCls = (n: number) => (n >= 80 ? 'text-emerald-400' : n >= 50 ? 'text-amber-300' : 'text-red-400');

function useLoad<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    cms<T>('GET', path).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(reload, [reload]);
  return { data, err, loading, reload };
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return <div className="rounded-xl border border-white/10 bg-[#0b0c10] p-4"><p className="text-xs text-[#94A3B8]">{label}</p><p className="text-2xl font-bold text-white mt-1">{value}</p>{sub && <p className="text-[11px] text-[#64748B]">{sub}</p>}</div>;
}

function PostMini({ rows, onOpen, empty }: { rows: any[]; onOpen: (id: string) => void; empty: string }) {
  if (!rows?.length) return <p className="text-sm text-[#64748B]">{empty}</p>;
  return (
    <ul className="divide-y divide-white/5">
      {rows.map((p) => (
        <li key={p.id} className="py-2 flex items-center gap-3 text-sm">
          <button type="button" onClick={() => onOpen(p.id)} className="flex-1 text-left text-white hover:text-[#F5BD48] truncate cursor-pointer">{p.title}</button>
          <span className="text-xs text-[#94A3B8] hidden sm:inline">{p.status === 'SCHEDULED' ? fmtDate(p.scheduledAt) : `${p.viewCount} views`}</span>
          <span className={`text-xs font-bold ${scoreCls(p.seoScore)}`}>{p.seoScore}</span>
        </li>
      ))}
    </ul>
  );
}

function Overview({ onOpen, goto }: { onOpen: (id: string) => void; goto: (v: View) => void }) {
  const { data, err, loading } = useLoad<any>('overview');
  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />;
  if (err || !data) return <p className="text-red-400 text-sm">{err || 'Failed to load'}</p>;
  const c = data.counts;
  const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="rounded-xl border border-white/10 p-4 space-y-2"><h3 className="text-sm font-bold text-white">{title}</h3>{children}</section>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Stat label="Published" value={c.published} /><Stat label="Drafts" value={c.drafts} /><Stat label="Scheduled" value={c.scheduled} />
        <Stat label="Avg SEO score" value={<span className={scoreCls(data.avgSeoScore)}>{data.avgSeoScore}</span>} />
        <Stat label="Views (30 days)" value={data.views30d} /><Stat label="Subscribers" value={c.subscribers} sub={c.pendingComments ? `${c.pendingComments} comments to review` : undefined} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Recently edited"><PostMini rows={data.recent} onOpen={onOpen} empty="No posts yet." /></Panel>
        <Panel title="Top performing"><PostMini rows={data.top} onOpen={onOpen} empty="No traffic yet." /></Panel>
        <Panel title="Scheduled"><PostMini rows={data.upcoming} onOpen={onOpen} empty="Nothing scheduled." /></Panel>
        <Panel title="Needs SEO attention (score < 60)"><PostMini rows={data.lowSeo} onOpen={onOpen} empty="All published posts look healthy." /></Panel>
      </div>
      {c.pendingComments > 0 && <button type="button" className={btnGhost} onClick={() => goto('engagement')}>Review {c.pendingComments} pending comment(s)</button>}
    </div>
  );
}

function Posts({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [templates, setTemplates] = useState(false);
  const { data, err, loading } = useLoad<any[]>(`posts?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), ...(templates ? { templates: 'true' } : {}) })}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts…" aria-label="Search posts" className={`${inputCls} max-w-xs`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} max-w-[10rem]`} aria-label="Filter by status"><option value="">All statuses</option>{['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((s) => <option key={s}>{s}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-[#CBD5E1]"><input type="checkbox" checked={templates} onChange={(e) => setTemplates(e.target.checked)} /> Templates</label>
        <button type="button" className={`${btnPrimary} ml-auto`} onClick={onNew}><Plus className="w-4 h-4" /> New post</button>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" /> : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs text-[#94A3B8]"><tr><th className="p-3">Title</th><th>Status</th><th>Author</th><th>Category</th><th>SEO</th><th>Views</th><th>Updated</th></tr></thead>
            <tbody>
              {(data || []).map((p: any) => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="p-3"><button type="button" onClick={() => onOpen(p.id)} className="text-white hover:text-[#F5BD48] text-left cursor-pointer">{p.title}</button><div className="text-[11px] text-[#64748B]">/blog/{p.slug}</div></td>
                  <td><Badge s={p.status} />{p.status === 'SCHEDULED' && <div className="text-[11px] text-[#94A3B8]">{fmtDate(p.scheduledAt)}</div>}</td>
                  <td className="text-[#CBD5E1]">{p.author?.name || '—'}</td><td className="text-[#CBD5E1]">{p.category?.name || '—'}</td>
                  <td className={`font-bold ${scoreCls(p.seoScore)}`}>{p.seoScore}</td><td className="text-[#CBD5E1]">{p.viewCount}</td><td className="text-[#94A3B8] text-xs">{fmtDate(p.updatedAt)}</td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={7} className="p-6 text-center text-[#64748B]">No posts found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Analytics() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const { data, err, loading } = useLoad<any>(`analytics?from=${from}&to=${to}`);
  const preset = (days: number) => { setTo(today); setFrom(new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10)); };
  const max = Math.max(1, ...(data?.daily || []).map((d: any) => d.views));
  const srcMax = Math.max(1, ...(data?.sources || []).map((s: any) => s.views));
  const t = data?.totals;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        {[7, 30, 90].map((d) => <button key={d} type="button" className={btnGhost} onClick={() => preset(d)}>Last {d} days</button>)}
        <label className="text-xs text-[#94A3B8]">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} block`} /></label>
        <label className="text-xs text-[#94A3B8]">To<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className={`${inputCls} block`} /></label>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {loading || !t ? <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <Stat label="Views" value={t.views} /><Stat label="Unique visitors" value={t.uniqueVisitors} /><Stat label="Avg read time" value={`${Math.floor(t.avgReadSeconds / 60)}m ${t.avgReadSeconds % 60}s`} />
            <Stat label="Bounce rate" value={`${t.bounceRate}%`} /><Stat label="Organic views" value={t.organicViews} /><Stat label="Shares" value={t.shares} /><Stat label="Likes" value={t.likes} /><Stat label="Comments" value={t.comments} />
          </div>
          <section className="rounded-xl border border-white/10 p-4">
            <h3 className="text-sm font-bold text-white mb-3">Views per day</h3>
            <svg viewBox={`0 0 ${Math.max(data.daily.length, 1) * 12} 120`} preserveAspectRatio="none" className="w-full h-40" role="img" aria-label="Daily views bar chart">
              {data.daily.map((d: any, i: number) => {
                const h = (d.views / max) * 100;
                return <rect key={d.date} x={i * 12 + 1} y={110 - h} width={10} height={Math.max(h, d.views ? 2 : 0)} rx={2} fill="#F5BD48"><title>{`${d.date}: ${d.views} views, ${d.visitors} visitors`}</title></rect>;
              })}
              <line x1="0" x2="100%" y1="110" y2="110" stroke="rgba(255,255,255,.15)" />
            </svg>
            <div className="flex justify-between text-[11px] text-[#64748B]"><span>{data.daily[0]?.date}</span><span>peak {max}/day</span><span>{data.daily[data.daily.length - 1]?.date}</span></div>
          </section>
          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-white/10 p-4 space-y-2"><h3 className="text-sm font-bold text-white">Traffic sources</h3>
              {data.sources.length ? data.sources.map((s: any) => (
                <div key={s.source} className="text-sm"><div className="flex justify-between text-[#CBD5E1]"><span className="capitalize">{s.source}</span><span>{s.views}</span></div><div className="h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-[#F5BD48]" style={{ width: `${(s.views / srcMax) * 100}%` }} /></div></div>
              )) : <p className="text-sm text-[#64748B]">No data.</p>}
            </section>
            <section className="rounded-xl border border-white/10 p-4 space-y-2"><h3 className="text-sm font-bold text-white">Search keywords</h3>
              <p className="text-[11px] text-[#64748B]">Organic keywords appear only when the referrer or a <code>?q=</code>/<code>utm_term</code> parameter carries them; Google hides most. Connect Search Console for full data.</p>
              {data.keywords.map((k: any) => <div key={k.keyword} className="flex justify-between text-sm text-[#CBD5E1]"><span>{k.keyword}</span><span>{k.views}</span></div>)}
              <h4 className="text-xs text-[#94A3B8] pt-2">On-site searches</h4>
              {data.searches.length ? data.searches.map((k: any) => <div key={k.query} className="flex justify-between text-sm text-[#CBD5E1]"><span>{k.query}{k.avgResults === 0 && <span className="text-red-300 text-[11px]"> · no results</span>}</span><span>{k.count}</span></div>) : <p className="text-sm text-[#64748B]">None yet.</p>}
            </section>
          </div>
          <section className="rounded-xl border border-white/10 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-white/5 text-left text-xs text-[#94A3B8]"><tr><th className="p-3">Top articles</th><th>Views</th><th>Visitors</th><th>Avg read</th><th>Bounce</th><th>SEO</th></tr></thead>
            <tbody>{data.topPosts.map((p: any) => <tr key={p.id} className="border-t border-white/5"><td className="p-3 text-white">{p.title}</td><td>{p.views}</td><td>{p.uniqueVisitors}</td><td>{p.avgReadSeconds}s</td><td>{p.bounceRate}%</td><td className={scoreCls(p.seoScore)}>{p.seoScore}</td></tr>)}
              {!data.topPosts.length && <tr><td colSpan={6} className="p-6 text-center text-[#64748B]">No views in this range.</td></tr>}</tbody></table></section>
        </>
      )}
    </div>
  );
}

function Engagement({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState('PENDING');
  const comments = useLoad<any[]>(`comments?status=${status}`);
  const subs = useLoad<any[]>(canManage ? 'subscribers' : 'comments?status=NONE');
  const act = async (fn: () => Promise<unknown>) => { await fn().catch((e) => window.alert(e.message)); comments.reload(); subs.reload(); };
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-white">Comments</h3>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} max-w-[9rem]`} aria-label="Comment status"><option>PENDING</option><option>APPROVED</option><option>SPAM</option></select></div>
        {comments.data?.length ? comments.data.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/10 p-3 text-sm space-y-2">
            <p className="text-[#94A3B8] text-xs"><b className="text-white">{c.authorName}</b> {c.email && `· ${c.email}`} on <i>{c.post?.title}</i> · {fmtDate(c.createdAt)}</p>
            <p className="text-[#E2E8F0] whitespace-pre-line">{c.body}</p>
            <div className="flex gap-2">
              {c.status !== 'APPROVED' && <button type="button" className={btnPrimary} onClick={() => act(() => cms('PATCH', `comments/${c.id}`, { status: 'APPROVED' }))}>Approve</button>}
              {c.status !== 'SPAM' && <button type="button" className={btnGhost} onClick={() => act(() => cms('PATCH', `comments/${c.id}`, { status: 'SPAM' }))}>Spam</button>}
              <button type="button" className={btnDanger} onClick={() => window.confirm('Delete comment?') && act(() => cms('DELETE', `comments/${c.id}`))}>Delete</button>
            </div>
          </div>
        )) : <p className="text-sm text-[#64748B]">No {status.toLowerCase()} comments.</p>}
      </section>
      {canManage && (
        <section className="space-y-3">
          <div className="flex items-center gap-3"><h3 className="text-sm font-bold text-white">Newsletter subscribers ({subs.data?.length ?? 0})</h3><a className={btnGhost} href="/api/admin/cms/subscribers?format=csv">Export CSV</a></div>
          <div className="max-h-72 overflow-auto rounded-xl border border-white/10"><table className="w-full text-sm"><tbody>
            {(subs.data || []).map((s: any) => <tr key={s.id} className="border-t border-white/5 first:border-0"><td className="p-2.5 text-white">{s.email}</td><td className="text-xs text-[#94A3B8]">{s.status}</td><td className="text-xs text-[#64748B]">{fmtDate(s.createdAt)}</td>
              <td className="text-right pr-2"><button type="button" className="text-xs text-red-300 cursor-pointer" onClick={() => window.confirm(`Remove ${s.email}?`) && act(() => cms('DELETE', `subscribers/${s.id}`))}>Remove</button></td></tr>)}
          </tbody></table></div>
        </section>
      )}
    </div>
  );
}

function Media() {
  const { data, reload, err } = useLoad<any[]>('media');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMsg('');
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/admin/cms/media', { method: 'POST', body: fd, credentials: 'same-origin' });
      if (!res.ok) setMsg((await res.json().catch(() => ({}))).error || 'Upload failed');
    }
    setBusy(false); reload();
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><label className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Upload images<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} /></label><span className="text-xs text-[#94A3B8]">JPEG / PNG / WebP, up to 10 MB each</span></div>
      {(msg || err) && <p className="text-red-400 text-sm">{msg || err}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {(data || []).map((m) => (
          <figure key={m.id} className="rounded-xl border border-white/10 overflow-hidden bg-[#0b0c10]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.altText || m.fileName} loading="lazy" className="aspect-square w-full object-cover" />
            <figcaption className="p-2 space-y-1">
              <input defaultValue={m.altText || ''} placeholder="Alt text" aria-label="Alt text" onBlur={(e) => e.target.value !== (m.altText || '') && cms('PATCH', `media/${m.id}`, { altText: e.target.value }).catch(() => undefined)} className={`${inputCls} !py-1 !text-xs`} />
              <div className="flex justify-between text-[11px] text-[#94A3B8]"><button type="button" className="hover:text-[#F5BD48] cursor-pointer" onClick={() => navigator.clipboard?.writeText(m.url)}>Copy URL</button><button type="button" className="text-red-300 cursor-pointer" onClick={() => window.confirm('Remove from library? (file stays on the server)') && cms('DELETE', `media/${m.id}`).then(reload)}>Remove</button></div>
            </figcaption>
          </figure>
        ))}
      </div>
      {!data?.length && <p className="text-sm text-[#64748B]">No media yet.</p>}
    </div>
  );
}

export function ContentDesk({ role }: { role: string }) {
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const [perms, setPerms] = useState({ canPublish: isAdmin, canManageSettings: isAdmin });
  useEffect(() => {
    cms<any>('GET', 'me').then((m) => setPerms({ canPublish: Boolean(m.canPublish), canManageSettings: Boolean(m.canManageSettings) })).catch(() => undefined);
  }, []);
  const [view, setView] = useState<View>('overview');
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [authors, setAuthors] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    cms<any[]>('GET', 'authors').then(setAuthors).catch(() => undefined);
    cms<any[]>('GET', 'categories').then(setCategories).catch(() => undefined);
  }, [view, editing]);

  if (editing) {
    return <PostEditor key={editing.id ?? 'new'} postId={editing.id} canPublish={perms.canPublish} authors={authors} categories={categories} onClose={() => { setEditing(null); setView('posts'); }} />;
  }
  const open = (id: string) => setEditing({ id });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-bold text-white">Content &amp; SEO</h2>
        <p className="text-sm text-[#94A3B8]">Blog, landing pages, redirects and search settings.{!perms.canPublish && ' You are signed in as an editor: you can write drafts; an admin publishes (or turns on publishing for staff in SEO & Settings).'}</p>
      </div>
      <nav className="flex flex-wrap gap-1.5" aria-label="Content sections">
        {VIEWS.map(([id, label]) => <button key={id} type="button" onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={`px-3.5 py-1.5 rounded-full text-sm cursor-pointer ${view === id ? 'bg-[#F5BD48] text-[#111215] font-bold' : 'border border-white/15 text-[#CBD5E1] hover:border-[#F5BD48]/60'}`}>{label}</button>)}
      </nav>
      {view === 'overview' && <Overview onOpen={open} goto={setView} />}
      {view === 'posts' && <Posts onOpen={open} onNew={() => setEditing({ id: null })} />}
      {view === 'analytics' && <Analytics />}
      {view === 'engagement' && <Engagement canManage={perms.canManageSettings} />}
      {view === 'media' && <Media />}
      {view === 'manage' && <ManageDesk isAdmin={perms.canManageSettings} />}
    </div>
  );
}
