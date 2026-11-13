export async function cms<T = any>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin/cms/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return (json.data ?? json) as T;
}

export const inputCls = 'w-full rounded-xl bg-[#0b0c10] border border-white/10 px-3.5 py-2 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#F5BD48]';
export const btnPrimary = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#E5A93C] text-[#111215] font-bold text-sm disabled:opacity-50 cursor-pointer';
export const btnGhost = 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/15 text-[#E2E8F0] text-sm hover:border-[#F5BD48]/60 disabled:opacity-50 cursor-pointer';
export const btnDanger = 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-red-500/40 text-red-300 text-sm hover:bg-red-500/10 cursor-pointer';

export function fmtDate(v?: string | Date | null) {
  return v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

/** <input type="datetime-local"> expects local time without a zone. */
export function toLocalInput(v?: string | null) {
  if (!v) return '';
  const d = new Date(v);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
