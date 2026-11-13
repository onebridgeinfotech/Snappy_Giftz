'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';

const inputCls = 'w-full rounded-xl bg-[#0b0c10] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F5BD48]';

export function EnquiryForm({ page }: { page: string }) {
  const [state, setState] = useState({ busy: false, ok: false, msg: '' });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setState({ busy: true, ok: false, msg: '' });
        try {
          const res = await fetch('/api/cms/enquiry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: f.get('name'), email: f.get('email'), phone: f.get('phone'), message: f.get('message'), website: f.get('website'), page }),
          });
          const data = await res.json().catch(() => ({}));
          setState({ busy: false, ok: res.ok, msg: data.message || data.error || 'Something went wrong' });
          if (res.ok) (e.target as HTMLFormElement).reset();
        } catch {
          setState({ busy: false, ok: false, msg: 'Network error. Please try again.' });
        }
      }}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <input name="name" required minLength={2} placeholder="Your name" aria-label="Your name" className={inputCls} />
        <input name="phone" type="tel" placeholder="Phone / WhatsApp" aria-label="Phone" className={inputCls} />
      </div>
      <input name="email" type="email" placeholder="Email" aria-label="Email" className={inputCls} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <textarea name="message" required minLength={5} rows={4} placeholder="Tell us what you need (quantity, occasion, date)…" aria-label="Message" className={inputCls} />
      <div className="flex items-center gap-3">
        <button disabled={state.busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#E5A93C] text-[#111215] font-bold text-sm disabled:opacity-60">
          <Send className="w-4 h-4" /> {state.busy ? 'Sending…' : 'Send enquiry'}
        </button>
        {state.msg && <span role="status" className={`text-xs ${state.ok ? 'text-emerald-400' : 'text-red-400'}`}>{state.msg}</span>}
      </div>
    </form>
  );
}
