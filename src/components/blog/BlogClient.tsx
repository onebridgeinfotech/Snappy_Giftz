'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Heart, Share2, Send } from 'lucide-react';

/** Records a view, then reports read time + scroll depth when the reader leaves. */
export function BlogTracker({ slug }: { slug: string }) {
  useEffect(() => {
    let viewId: string | null = null;
    let maxDepth = 0;
    const started = Date.now();
    const params = new URLSearchParams(window.location.search);
    const keyword = params.get('q') || params.get('utm_term') || '';

    fetch('/api/blog/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'view', slug, referrer: document.referrer || null, utm: params.get('utm_medium'), keyword }),
      keepalive: true,
    })
      .then((r) => r.json())
      .then((d) => {
        viewId = d?.viewId ?? null;
      })
      .catch(() => undefined);

    const onScroll = () => {
      const h = document.documentElement;
      const depth = Math.round(((h.scrollTop + window.innerHeight) / Math.max(h.scrollHeight, 1)) * 100);
      if (depth > maxDepth) maxDepth = Math.min(100, depth);
    };
    const flush = () => {
      if (!viewId) return;
      const blob = new Blob([JSON.stringify({ event: 'engage', viewId, readSeconds: Math.round((Date.now() - started) / 1000), scrollDepth: maxDepth })], { type: 'application/json' });
      navigator.sendBeacon?.('/api/blog/track', blob);
      viewId = null;
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [slug]);
  return null;
}

export function ShareLikeBar({ slug, title, likes }: { slug: string; title: string; likes: number }) {
  const [count, setCount] = useState(likes);
  const [liked, setLiked] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    try {
      setLiked(localStorage.getItem(`liked:${slug}`) === '1');
    } catch {
      /* storage unavailable */
    }
  }, [slug]);

  const send = (event: 'like' | 'share') =>
    fetch('/api/blog/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, slug }) }).catch(() => undefined);

  const like = () => {
    if (liked) return;
    setLiked(true);
    setCount((c) => c + 1);
    try {
      localStorage.setItem(`liked:${slug}`, '1');
    } catch {
      /* ignore */
    }
    send('like');
  };

  const share = async () => {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNote('Link copied');
        setTimeout(() => setNote(''), 2000);
      }
      send('share');
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={like} aria-pressed={liked} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition ${liked ? 'border-[#F5BD48] text-[#F5BD48]' : 'border-white/15 text-[#CBD5E1] hover:border-[#F5BD48]/60'}`}>
        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} /> {count}
      </button>
      <button type="button" onClick={share} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 text-sm text-[#CBD5E1] hover:border-[#F5BD48]/60 transition">
        <Share2 className="w-4 h-4" /> Share
      </button>
      {note && <span className="text-xs text-emerald-400" role="status">{note}</span>}
    </div>
  );
}

function useSubmit(url: string) {
  const [state, setState] = useState<{ busy: boolean; msg: string; ok: boolean }>({ busy: false, msg: '', ok: false });
  const submit = async (payload: Record<string, unknown>) => {
    setState({ busy: true, msg: '', ok: false });
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      setState({ busy: false, ok: res.ok, msg: data.message || data.error || (res.ok ? 'Done' : 'Something went wrong') });
      return res.ok;
    } catch {
      setState({ busy: false, ok: false, msg: 'Network error. Please try again.' });
      return false;
    }
  };
  return { ...state, submit };
}

const inputCls = 'w-full rounded-xl bg-[#17181C] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F5BD48]';

export function CommentForm({ slug }: { slug: string }) {
  const { busy, msg, ok, submit } = useSubmit('/api/blog/comments');
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (await submit({ slug, name: f.get('name'), email: f.get('email'), body: f.get('body'), website: f.get('website') })) formRef.current?.reset();
      }}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <input name="name" required minLength={2} maxLength={80} placeholder="Your name" aria-label="Your name" className={inputCls} />
        <input name="email" type="email" placeholder="Email (optional, never shown)" aria-label="Email" className={inputCls} />
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <textarea name="body" required minLength={3} maxLength={2000} rows={4} placeholder="Share your thoughts…" aria-label="Comment" className={inputCls} />
      <div className="flex items-center gap-3">
        <button disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#E5A93C] text-[#111215] font-bold text-sm disabled:opacity-60">
          <Send className="w-4 h-4" /> {busy ? 'Sending…' : 'Post comment'}
        </button>
        {msg && <span role="status" className={`text-xs ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</span>}
      </div>
    </form>
  );
}

export function NewsletterForm({ source = 'blog' }: { source?: string }) {
  const { busy, msg, ok, submit } = useSubmit('/api/newsletter');
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await submit({ email: f.get('email'), website: f.get('website'), source });
      }}
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <input name="email" type="email" required placeholder="you@example.com" aria-label="Email address" className={inputCls} />
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button disabled={busy} className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#E5A93C] text-[#111215] font-bold text-sm disabled:opacity-60">
          {busy ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      {msg && <p role="status" className={`text-xs ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}
    </form>
  );
}
