'use client';

import React, { useEffect, useState } from 'react';
import { Truck, Plus, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';

type Row = { maxDistanceKm: string; feeRupees: string };

/**
 * Admin > Settings: automatic delivery charges by distance from the studio.
 * Example: up to 10 km ₹200, up to 15 km ₹250, up to 20 km ₹300.
 */
export function AdminDeliveryFeeSlabs({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/delivery/fee-slabs', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setRows(
            json.data.slabs.map((s: any) => ({
              maxDistanceKm: String(s.maxDistanceKm),
              feeRupees: String(Number(s.feePaise) / 100),
            }))
          );
          setIsDefault(Boolean(json.data.isDefault));
          setAutoEnabled(Boolean(json.data.autoEnabled));
        } else {
          setError(json.error || 'Could not load delivery charges.');
        }
      })
      .catch(() => setError('Could not load delivery charges.'))
      .finally(() => setLoading(false));
  }, []);

  const update = (i: number, key: keyof Row, value: string) => {
    setSaved(false);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value.replace(/[^0-9.]/g, '') } : r)));
  };

  const sorted = [...rows]
    .map((r) => ({ km: Number(r.maxDistanceKm), fee: Number(r.feeRupees) }))
    .filter((r) => Number.isFinite(r.km) && r.km > 0)
    .sort((a, b) => a.km - b.km);

  const save = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/delivery/fee-slabs', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slabs: rows.map((r) => ({
            maxDistanceKm: Number(r.maxDistanceKm),
            feePaise: Math.round(Number(r.feeRupees) * 100),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not save.');
      setRows(json.data.slabs.map((s: any) => ({ maxDistanceKm: String(s.maxDistanceKm), feeRupees: String(s.feePaise / 100) })));
      setIsDefault(false);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white border border-[#ECEDF2] shadow-[0_2px_10px_rgba(17,18,21,0.04)] p-5 text-[#111215]">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <Truck className="w-6 h-6 text-[#E5A93C] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold leading-tight">Delivery charges (automatic)</h3>
            <p className="text-sm text-[#4B5563] mt-0.5">
              Charged at checkout from the distance between your A S Rao Nagar studio and the customer&apos;s PIN code.
              Customers pay immediately — no manual approval.
            </p>
          </div>
        </div>
        <span
          className={`self-start shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
            autoEnabled ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#92400E]'
          }`}
        >
          {autoEnabled ? 'Automatic: ON' : 'Manual mode (DELIVERY_FEE_MODE=manual)'}
        </span>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" />
        </div>
      ) : (
        <>
          {isDefault && (
            <p className="mb-3 text-xs text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
              Using the default charges. Save to set your own.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full max-w-xl text-sm">
              <thead>
                <tr className="text-left text-[#374151]">
                  <th className="py-2 pr-3 font-semibold">Distance up to (km)</th>
                  <th className="py-2 pr-3 font-semibold">Delivery charge (₹)</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3">
                      <input
                        inputMode="numeric"
                        value={r.maxDistanceKm}
                        disabled={!canEdit}
                        onChange={(e) => update(i, 'maxDistanceKm', e.target.value)}
                        aria-label={`Slab ${i + 1} distance in km`}
                        className="w-28 px-3 py-2 rounded-lg border border-[#E5E7EB] focus:outline-hidden focus:ring-2 focus:ring-[#F5BD48]/50 disabled:bg-[#F9FAFB]"
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        inputMode="decimal"
                        value={r.feeRupees}
                        disabled={!canEdit}
                        onChange={(e) => update(i, 'feeRupees', e.target.value)}
                        aria-label={`Slab ${i + 1} charge in rupees`}
                        className="w-32 px-3 py-2 rounded-lg border border-[#E5E7EB] focus:outline-hidden focus:ring-2 focus:ring-[#F5BD48]/50 disabled:bg-[#F9FAFB]"
                      />
                    </td>
                    <td className="py-1.5">
                      {canEdit && rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSaved(false);
                            setRows((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          aria-label={`Remove slab ${i + 1}`}
                          className="p-2 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sorted.length > 0 && (
            <p className="mt-3 text-xs text-[#4B5563]">
              Preview:{' '}
              {sorted
                .map((r, i) => `${i === 0 ? '0' : sorted[i - 1].km}–${r.km} km ₹${r.fee || 0}`)
                .join(' • ')}
              {' • '}beyond {sorted[sorted.length - 1].km} km: not delivered
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-[#B91C1C] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          )}

          {canEdit ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSaved(false);
                  const last = sorted[sorted.length - 1];
                  setRows((prev) => [...prev, { maxDistanceKm: String((last?.km || 0) + 5), feeRupees: String((last?.fee || 0) + 50) }]);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E5E7EB] text-sm font-semibold hover:border-[#F5BD48] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add slab
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-[#FBD27A] to-[#F5BD48] text-sm font-bold disabled:opacity-60 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save delivery charges'}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#6B7280]">Only the owner (ADMIN) can change delivery charges.</p>
          )}
        </>
      )}
    </section>
  );
}
