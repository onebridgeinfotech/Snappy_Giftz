'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Mail,
  HardDrive,
  KeyRound,
  RefreshCw,
  Loader2,
  MapPin,
  Plus,
  PauseCircle,
  PlayCircle,
  Pencil,
  Wrench,
  Trash2,
  Clock,
  IndianRupee,
} from 'lucide-react';

/**
 * Operations & Health desk: system health, payment mismatches, delivery PIN codes,
 * and maintenance jobs (release expired holds, clean up unused uploads).
 * Every section loads independently so one failing endpoint (e.g. database offline)
 * never blanks the others.
 */

type LoadState<T> = { data: T | null; loading: boolean; error: string | null };

function useAdminGet<T>(url: string) {
  const [state, setState] = useState<LoadState<T>>({ data: null, loading: true, error: null });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        setState({ data: null, loading: false, error: json.error || `Request failed (${res.status}).` });
        return;
      }
      setState({ data: (json.data ?? null) as T, loading: false, error: null });
    } catch {
      setState({ data: null, loading: false, error: 'Network error. Please try again.' });
    }
  }, [url]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

async function adminPost(url: string, body?: unknown): Promise<{ ok: boolean; json: any; status: number }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.success !== false, json, status: res.status };
  } catch {
    return { ok: false, json: { error: 'Network error. Please try again.' }, status: 0 };
  }
}

function permissionMessage(status: number, fallback: string) {
  if (status === 401 || status === 403) return 'Only the store owner (ADMIN) can do this.';
  return fallback;
}

const rupees = (paise: unknown) =>
  `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const card = 'rounded-2xl bg-[#17181C] border border-[#D5A34A]/20 p-5 shadow-md';
const btnGhost =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5A34A]/30 text-[#CBD5E1] hover:text-[#F5BD48] hover:border-[#D5A34A]/60 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnGold =
  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const input =
  'w-full bg-[#0F1014] border border-[#D5A34A]/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#D5A34A]/60';

function SectionHeader({
  icon,
  title,
  subtitle,
  onRefresh,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#D5A34A]/10 border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>
          <p className="text-xs text-[#94A3B8]">{subtitle}</p>
        </div>
      </div>
      {onRefresh && (
        <button type="button" onClick={onRefresh} disabled={loading} className={btnGhost}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs px-3 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  );
}

function Notice({ kind, message }: { kind: 'ok' | 'error'; message: string }) {
  return kind === 'ok' ? (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs px-3 py-2 flex items-start gap-2">
      <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  ) : (
    <ErrorBox message={message} />
  );
}

function StatusPill({ good, label }: { good: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider border ${
        good ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'
      }`}
    >
      {good ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* System health                                                       */
/* ------------------------------------------------------------------ */

interface HealthData {
  database?: { connected?: boolean; status?: string; latencyMs?: number | null; error?: string | null };
  email?: { status?: string; host?: string; sender?: string };
  storage?: { type?: string; status?: string };
  app?: { nodeEnv?: string; serverTime?: string };
  environmentSecurity?: { variables?: Array<{ name: string; configured: boolean }> };
}

function SystemHealthSection() {
  const { data, loading, error, reload } = useAdminGet<HealthData>('/api/admin/system/health');
  const emailOk = Boolean(data?.email?.status && !/fail|error|down|unconfigured/i.test(data.email.status));
  const vars = data?.environmentSecurity?.variables || [];
  const missing = vars.filter((v) => !v.configured);

  return (
    <section className={card}>
      <SectionHeader
        icon={<Activity className="w-4 h-4 text-[#F5BD48]" />}
        title="System health"
        subtitle="Database, email, file storage and required server settings."
        onRefresh={reload}
        loading={loading}
      />
      {error && <ErrorBox message={error} />}
      {loading && !data && <p className="text-xs text-[#94A3B8]">Checking…</p>}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#0F1014] border border-white/5 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Database className="w-4 h-4 text-[#D5A34A]" /> Database
                </span>
                <StatusPill good={Boolean(data.database?.connected)} label={data.database?.connected ? 'Connected' : 'Offline'} />
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                {data.database?.connected
                  ? `Responding in ${data.database?.latencyMs ?? '?'} ms`
                  : data.database?.error || data.database?.status || 'Not reachable'}
              </p>
            </div>
            <div className="rounded-xl bg-[#0F1014] border border-white/5 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Mail className="w-4 h-4 text-[#D5A34A]" /> Email
                </span>
                <StatusPill good={emailOk} label={data.email?.status || 'Unknown'} />
              </div>
              <p className="text-[11px] text-[#94A3B8] break-all">
                {data.email?.host} · from {data.email?.sender}
              </p>
            </div>
            <div className="rounded-xl bg-[#0F1014] border border-white/5 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <HardDrive className="w-4 h-4 text-[#D5A34A]" /> File storage
                </span>
                <StatusPill good={data.storage?.status === 'ACCESSIBLE'} label={data.storage?.status || 'Unknown'} />
              </div>
              <p className="text-[11px] text-[#94A3B8]">{(data.storage?.type || '').replace(/_/g, ' ')}</p>
            </div>
          </div>

          {vars.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                <KeyRound className="w-3.5 h-3.5 text-[#D5A34A]" />
                Server settings {missing.length > 0 ? `(${missing.length} missing)` : '(all set)'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <span
                    key={v.name}
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-mono border ${
                      v.configured
                        ? 'bg-emerald-500/5 text-emerald-300/90 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-300 border-red-500/30'
                    }`}
                  >
                    {v.configured ? '✓' : '✗'} {v.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.app && (
            <p className="text-[11px] text-[#64748B]">
              Mode: {data.app.nodeEnv} · Server time:{' '}
              {data.app.serverTime ? new Date(data.app.serverTime).toLocaleString('en-IN') : '—'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Payment mismatches                                                  */
/* ------------------------------------------------------------------ */

interface Reconciliation {
  id?: string;
  orderNumber: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  expectedAmountPaise: number | string;
  receivedAmountPaise: number | string;
  discrepancyType: string;
  status: string;
  notes?: string;
  createdAt?: string;
}

const DISCREPANCY_LABELS: Record<string, string> = {
  LATE_PAYMENT_EXPIRED_HOLD: 'Paid after the order expired',
  AMOUNT_MISMATCH: 'Wrong amount received',
  UNAUTHORIZED_CURRENCY: 'Wrong currency',
};

function PaymentMismatchesSection() {
  const { data, loading, error, reload } = useAdminGet<Reconciliation[]>('/api/admin/payments/reconciliations?status=OPEN');
  const rows = data || [];

  return (
    <section className={card}>
      <SectionHeader
        icon={<IndianRupee className="w-4 h-4 text-[#F5BD48]" />}
        title="Payment mismatches"
        subtitle="Payments Razorpay took that could not be matched to a confirmed order. Refund or reinstate each one."
        onRefresh={reload}
        loading={loading}
      />
      {error && <ErrorBox message={error} />}
      {!error && !loading && rows.length === 0 && (
        <p className="text-xs text-emerald-300/90 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> No open payment mismatches.
        </p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#94A3B8] border-b border-white/5">
                <th className="py-2 pr-3 font-semibold">Order</th>
                <th className="py-2 pr-3 font-semibold">Problem</th>
                <th className="py-2 pr-3 font-semibold">Expected</th>
                <th className="py-2 pr-3 font-semibold">Received</th>
                <th className="py-2 pr-3 font-semibold">Razorpay payment</th>
                <th className="py-2 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || `${r.orderNumber}-${i}`} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-3 font-mono text-white">{r.orderNumber}</td>
                  <td className="py-2 pr-3 text-amber-300">
                    {DISCREPANCY_LABELS[r.discrepancyType] || r.discrepancyType}
                    {r.notes && <div className="text-[10.5px] text-[#94A3B8] mt-0.5">{r.notes}</div>}
                  </td>
                  <td className="py-2 pr-3 text-white">{rupees(r.expectedAmountPaise)}</td>
                  <td className="py-2 pr-3 text-white">{rupees(r.receivedAmountPaise)}</td>
                  <td className="py-2 pr-3 font-mono text-[#CBD5E1] break-all">{r.gatewayPaymentId || '—'}</td>
                  <td className="py-2 text-[#94A3B8] whitespace-nowrap">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-[#64748B] mt-2">
            These payments were never marked paid on the order, so refund them from the Razorpay dashboard using the
            payment ID shown, or contact the customer to reinstate the order.
          </p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Delivery PIN codes                                                  */
/* ------------------------------------------------------------------ */

interface PincodeRow {
  pincode: string;
  areaName?: string | null;
  isActive: boolean;
  deliveryDays: number;
  notes?: string | null;
}

const EMPTY_PIN_FORM = { pincode: '', areaName: '', deliveryDays: '2', notes: '', isActive: true };

function PincodesSection() {
  const { data, loading, error, reload } = useAdminGet<PincodeRow[]>('/api/admin/delivery/pincodes');
  const [form, setForm] = useState(EMPTY_PIN_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);
  const [filter, setFilter] = useState('');

  const rows = (data || []).filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return r.pincode.includes(q) || (r.areaName || '').toLowerCase().includes(q);
  });

  const save = async (payload: { pincode: string; areaName?: string; isActive: boolean; deliveryDays: number; notes?: string }) => {
    setSaving(true);
    setNotice(null);
    const { ok, json, status } = await adminPost('/api/admin/delivery/pincodes', payload);
    setSaving(false);
    if (!ok) {
      setNotice({ kind: 'error', message: permissionMessage(status, json.error || 'Could not save the PIN code.') });
      return false;
    }
    setNotice({
      kind: 'ok',
      message: `PIN ${payload.pincode} ${payload.isActive ? 'is open for delivery' : 'is paused'}.`,
    });
    reload();
    return true;
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = form.pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setNotice({ kind: 'error', message: 'Enter a valid 6-digit PIN code.' });
      return;
    }
    const days = Math.max(1, Math.min(30, parseInt(form.deliveryDays, 10) || 1));
    const ok = await save({
      pincode: pin,
      areaName: form.areaName.trim() || undefined,
      deliveryDays: days,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    });
    if (ok) {
      setForm(EMPTY_PIN_FORM);
      setEditing(null);
      setShowForm(false);
    }
  };

  const startEdit = (r: PincodeRow) => {
    setEditing(r.pincode);
    setShowForm(true);
    setNotice(null);
    setForm({
      pincode: r.pincode,
      areaName: r.areaName || '',
      deliveryDays: String(r.deliveryDays || 1),
      notes: r.notes || '',
      isActive: r.isActive,
    });
  };

  return (
    <section className={card}>
      <SectionHeader
        icon={<MapPin className="w-4 h-4 text-[#F5BD48]" />}
        title="Delivery PIN codes"
        subtitle="Which PIN codes customers can order to. Pausing a PIN blocks it at checkout immediately."
        onRefresh={reload}
        loading={loading}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          className={`${input} max-w-xs`}
          placeholder="Search PIN or area"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className={btnGold}
          onClick={() => {
            setEditing(null);
            setForm(EMPTY_PIN_FORM);
            setShowForm((v) => !v || editing !== null);
            setNotice(null);
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Add PIN code
        </button>
      </div>

      {notice && (
        <div className="mb-3">
          <Notice kind={notice.kind} message={notice.message} />
        </div>
      )}

      {showForm && (
        <form onSubmit={submitForm} className="rounded-xl bg-[#0F1014] border border-[#D5A34A]/20 p-3.5 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="text-[11px] text-[#94A3B8] space-y-1">
            <span>PIN code</span>
            <input
              className={input}
              value={form.pincode}
              disabled={editing !== null}
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })}
              placeholder="500062"
            />
          </label>
          <label className="text-[11px] text-[#94A3B8] space-y-1 sm:col-span-2">
            <span>Area name</span>
            <input className={input} value={form.areaName} onChange={(e) => setForm({ ...form, areaName: e.target.value })} placeholder="ECIL, Kapra" />
          </label>
          <label className="text-[11px] text-[#94A3B8] space-y-1">
            <span>Delivery days</span>
            <input
              className={input}
              type="number"
              min={1}
              max={30}
              value={form.deliveryDays}
              onChange={(e) => setForm({ ...form, deliveryDays: e.target.value })}
            />
          </label>
          <label className="text-[11px] text-[#94A3B8] space-y-1 sm:col-span-3">
            <span>Notes (optional)</span>
            <input className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-xs text-white sm:pt-5">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Open for delivery
          </label>
          <div className="sm:col-span-4 flex gap-2">
            <button type="submit" disabled={saving} className={btnGold}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Save changes' : 'Add PIN code'}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <ErrorBox message={error} />}
      {loading && !data && <p className="text-xs text-[#94A3B8]">Loading PIN codes…</p>}
      {data && (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#17181C]">
              <tr className="text-left text-[#94A3B8] border-b border-white/5">
                <th className="py-2 pr-3 font-semibold">PIN</th>
                <th className="py-2 pr-3 font-semibold">Area</th>
                <th className="py-2 pr-3 font-semibold">Days</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pincode} className="border-b border-white/5">
                  <td className="py-2 pr-3 font-mono text-white">{r.pincode}</td>
                  <td className="py-2 pr-3 text-[#CBD5E1]">{r.areaName || '—'}</td>
                  <td className="py-2 pr-3 text-[#CBD5E1]">{r.deliveryDays}</td>
                  <td className="py-2 pr-3">
                    <StatusPill good={r.isActive} label={r.isActive ? 'Open' : 'Paused'} />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button type="button" className={`${btnGhost} mr-1.5`} onClick={() => startEdit(r)}>
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={saving}
                      onClick={() =>
                        save({
                          pincode: r.pincode,
                          areaName: r.areaName || undefined,
                          deliveryDays: r.deliveryDays || 1,
                          notes: r.notes || undefined,
                          isActive: !r.isActive,
                        })
                      }
                    >
                      {r.isActive ? <PauseCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                      {r.isActive ? 'Pause' : 'Resume'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-[#94A3B8]">
                    No PIN codes match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-[#64748B] mt-3">
        Delivery charges are still set by hand on each order; this list only controls where customers can order to.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Maintenance                                                         */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function MaintenanceSection() {
  const [releasing, setReleasing] = useState(false);
  const [releaseNotice, setReleaseNotice] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [preview, setPreview] = useState<{ deletedCount: number; freedBytes: number } | null>(null);
  const [cleanupNotice, setCleanupNotice] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const releaseHolds = async () => {
    setReleasing(true);
    setReleaseNotice(null);
    const { ok, json, status } = await adminPost('/api/admin/orders/reservations/release');
    setReleasing(false);
    if (!ok) {
      setReleaseNotice({ kind: 'error', message: permissionMessage(status, json.error || 'Could not release expired holds.') });
      return;
    }
    const count = json.data?.releasedOrdersCount ?? 0;
    const numbers: string[] = json.data?.releasedOrderNumbers || [];
    setReleaseNotice({
      kind: 'ok',
      message:
        count === 0
          ? 'No expired order holds to release.'
          : `Released ${count} expired order${count === 1 ? '' : 's'}: ${numbers.join(', ')}`,
    });
  };

  const runCleanup = async (dryRun: boolean) => {
    setCleanupBusy(true);
    setCleanupNotice(null);
    const { ok, json, status } = await adminPost('/api/admin/personalization/uploads/cleanup', { dryRun });
    setCleanupBusy(false);
    if (!ok) {
      setCleanupNotice({ kind: 'error', message: permissionMessage(status, json.error || 'Cleanup failed.') });
      return;
    }
    const d = json.data || {};
    const errors: string[] = d.errors || [];
    if (dryRun) {
      setPreview({ deletedCount: d.deletedCount || 0, freedBytes: d.freedBytes || 0 });
      if ((d.deletedCount || 0) === 0) {
        setCleanupNotice({ kind: 'ok', message: 'Nothing to clean up: no expired, unused uploads found.' });
      }
    } else {
      setPreview(null);
      setCleanupNotice({
        kind: errors.length ? 'error' : 'ok',
        message: `Deleted ${d.deletedCount || 0} unused upload(s), freed ${formatBytes(d.freedBytes || 0)}.${
          errors.length ? ` ${errors.length} could not be deleted: ${errors.slice(0, 3).join('; ')}` : ''
        }`,
      });
    }
  };

  return (
    <section className={card}>
      <SectionHeader
        icon={<Wrench className="w-4 h-4 text-[#F5BD48]" />}
        title="Maintenance"
        subtitle="Housekeeping jobs. These normally run on a schedule; run them here when needed."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#0F1014] border border-white/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-[#D5A34A] mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Release expired order holds</p>
              <p className="text-[11px] text-[#94A3B8]">Marks unpaid orders whose payment window has passed as expired.</p>
            </div>
          </div>
          <button type="button" onClick={releaseHolds} disabled={releasing} className={btnGold}>
            {releasing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Release expired holds
          </button>
          {releaseNotice && <Notice kind={releaseNotice.kind} message={releaseNotice.message} />}
        </div>

        <div className="rounded-xl bg-[#0F1014] border border-white/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Trash2 className="w-4 h-4 text-[#D5A34A] mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Clean up unused customer uploads</p>
              <p className="text-[11px] text-[#94A3B8]">
                Deletes expired artwork that was never attached to an order. Order artwork and proofs are never touched.
              </p>
            </div>
          </div>
          {!preview ? (
            <button type="button" onClick={() => runCleanup(true)} disabled={cleanupBusy} className={btnGhost}>
              {cleanupBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Check what would be deleted
            </button>
          ) : preview.deletedCount > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-300">
                {preview.deletedCount} unused upload(s), {formatBytes(preview.freedBytes)}, will be permanently deleted.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => runCleanup(false)} disabled={cleanupBusy} className={btnGold}>
                  {cleanupBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Delete {preview.deletedCount} upload(s)
                </button>
                <button type="button" onClick={() => setPreview(null)} className={btnGhost}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setPreview(null)} className={btnGhost}>
              Check again
            </button>
          )}
          {cleanupNotice && <Notice kind={cleanupNotice.kind} message={cleanupNotice.message} />}
        </div>
      </div>
    </section>
  );
}

export const AdminOperationsDesk: React.FC = () => {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-serif font-bold text-white">Operations &amp; Health</h2>
        <p className="text-xs text-[#94A3B8]">Keep the store running: system status, payment problems, delivery areas and housekeeping.</p>
      </div>
      <SystemHealthSection />
      <PaymentMismatchesSection />
      <PincodesSection />
      <MaintenanceSection />
    </div>
  );
};

export default AdminOperationsDesk;
