'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Percent, Loader2, Check, AlertCircle, Crosshair, ExternalLink } from 'lucide-react';
import { AdminDeliveryFeeSlabs } from './AdminDeliveryFeeSlabs';

const card = 'rounded-2xl bg-white border border-[#ECEDF2] shadow-[0_2px_10px_rgba(17,18,21,0.04)] p-5 text-[#111215]';
const input =
  'w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#F5BD48]/50 disabled:bg-[#F9FAFB]';
const primaryBtn =
  'inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-[#FBD27A] to-[#F5BD48] text-sm font-bold disabled:opacity-60 cursor-pointer';

// ---------------------------------------------------------------------------
// Studio (hub) location + delivery radius
// ---------------------------------------------------------------------------

function StudioLocationCard({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = useState({ hubName: '', hubAddress: '', hubPincode: '', hubLatitude: '', hubLongitude: '', maxRadiusKm: '' });
  const [freeMap, setFreeMap] = useState(true);
  const [pasteValue, setPasteValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/delivery/settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        const d = json.data;
        setForm({
          hubName: d.hubName,
          hubAddress: d.hubAddress,
          hubPincode: d.hubPincode,
          hubLatitude: String(d.hubLatitude),
          hubLongitude: String(d.hubLongitude),
          maxRadiusKm: String(d.maxRadiusKm),
        });
        setFreeMap(d.freeMapEnabled !== false);
      })
      .catch((e) => setError(e?.message || 'Could not load the studio location.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form, v: string) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser cannot share location.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        set('hubLatitude', pos.coords.latitude.toFixed(6));
        set('hubLongitude', pos.coords.longitude.toFixed(6));
      },
      () => {
        setLocating(false);
        setError('Location permission was denied. Enter the latitude and longitude manually.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  /** Accepts "17.4789, 78.5492" or a Google Maps / OpenStreetMap link and fills latitude/longitude. */
  const applyPasted = (raw: string) => {
    setPasteValue(raw);
    const text = decodeURIComponent(raw.trim());
    const patterns = [
      /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, // google.com/maps/@lat,lng,zoom
      /[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=lat,lng
      /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // place links
      /mlat=(-?\d{1,2}\.\d+)&mlon=(-?\d{1,3}\.\d+)/, // openstreetmap.org
      /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/, // plain "lat, lng"
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        set('hubLatitude', Number(m[1]).toFixed(6));
        set('hubLongitude', Number(m[2]).toFixed(6));
        setError(null);
        return;
      }
    }
    if (text.length > 10 && /maps\.app\.goo\.gl|goo\.gl/i.test(text)) {
      setError('Short links can’t be read. Open the link, then copy the full address-bar URL, or copy the "lat, lng" numbers.');
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/delivery/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          hubLatitude: Number(form.hubLatitude),
          hubLongitude: Number(form.hubLongitude),
          maxRadiusKm: Number(form.maxRadiusKm),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not save.');
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const mapUrl =
    form.hubLatitude && form.hubLongitude
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${form.hubLatitude},${form.hubLongitude}`)}`
      : null;

  return (
    <section className={card}>
      <div className="flex items-start gap-3 mb-4">
        <MapPin className="w-6 h-6 text-[#E5A93C] shrink-0 mt-0.5" />
        <div>
          <h3 className="text-lg font-bold leading-tight">Studio location &amp; delivery area</h3>
          <p className="text-sm text-[#4B5563] mt-0.5">
            Delivery distance is measured from here. Customers beyond the delivery radius see &ldquo;Not eligible&rdquo; at checkout.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <label className="space-y-1">
            <span className="font-semibold">Studio name</span>
            <input className={input} value={form.hubName} disabled={!canEdit} onChange={(e) => set('hubName', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="font-semibold">Studio PIN code</span>
            <input className={input} inputMode="numeric" maxLength={6} value={form.hubPincode} disabled={!canEdit} onChange={(e) => set('hubPincode', e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="font-semibold">Studio address</span>
            <input className={input} value={form.hubAddress} disabled={!canEdit} onChange={(e) => set('hubAddress', e.target.value)} />
          </label>
          {canEdit && (
            <label className="space-y-1 md:col-span-2">
              <span className="font-semibold">Paste a map link or &ldquo;lat, lng&rdquo;</span>
              <input
                className={input}
                value={pasteValue}
                placeholder="e.g. https://www.google.com/maps/@17.4789,78.5492,17z  or  17.4789, 78.5492"
                onChange={(e) => applyPasted(e.target.value)}
              />
              <span className="block text-xs text-[#6B7280]">Fills latitude and longitude below. Opening a map link is free; no API key is used.</span>
            </label>
          )}
          <label className="space-y-1">
            <span className="font-semibold">Latitude</span>
            <input className={input} inputMode="decimal" value={form.hubLatitude} disabled={!canEdit} onChange={(e) => set('hubLatitude', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="font-semibold">Longitude</span>
            <input className={input} inputMode="decimal" value={form.hubLongitude} disabled={!canEdit} onChange={(e) => set('hubLongitude', e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="font-semibold">Deliver up to (km)</span>
            <input className={input} inputMode="numeric" value={form.maxRadiusKm} disabled={!canEdit} onChange={(e) => set('maxRadiusKm', e.target.value.replace(/\D/g, ''))} />
          </label>
          <div className="flex items-end gap-2 flex-wrap">
            {canEdit && (
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E5E7EB] text-sm font-semibold hover:border-[#F5BD48] cursor-pointer disabled:opacity-60"
                title="Use this while standing at the studio"
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                Use my current location
              </button>
            )}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#8A5A00] hover:underline">
                Check on map <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="md:col-span-2 text-xs text-[#4B5563] bg-[#F9FAFB] border border-[#ECEDF2] rounded-lg px-3 py-2.5 leading-relaxed">
            <strong>How distance is measured (free, no paid maps):</strong> the customer&rsquo;s current location if they tap
            &ldquo;Use my current location&rdquo;, otherwise their typed address
            {freeMap ? ' located on OpenStreetMap' : ''}, otherwise their PIN code. Straight-line distance &times; 1.3 approximates road
            distance, and it is never charged below the PIN code&rsquo;s distance minus 2 km.
            {!freeMap && <> OpenStreetMap lookups are switched off (NOMINATIM_ENABLED=false).</>}
          </div>

          {error && (
            <p className="md:col-span-2 text-sm text-[#B91C1C] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          {canEdit ? (
            <div className="md:col-span-2">
              <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save studio location'}
              </button>
            </div>
          ) : (
            <p className="md:col-span-2 text-xs text-[#6B7280]">Only the owner (ADMIN) can change the studio location.</p>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// GST per product
// ---------------------------------------------------------------------------

type GstRow = { id: string; name: string; hsnCode: string; taxRatePercent: number; isTaxInclusive: boolean; basePricePaise: number };

function GstSettingsCard({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<GstRow[]>([]);
  const [original, setOriginal] = useState<Record<string, GstRow>>({});
  const [slabs, setSlabs] = useState<number[]>([0, 3, 5, 12, 18, 28]);
  const [bulkRate, setBulkRate] = useState('18');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/catalog/tax-settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setRows(json.data.products);
        setOriginal(Object.fromEntries(json.data.products.map((p: GstRow) => [p.id, p])));
        setSlabs(json.data.gstSlabs);
      })
      .catch((e) => setError(e?.message || 'Could not load GST settings.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const changed = useMemo(
    () =>
      rows.filter((r) => {
        const o = original[r.id];
        return o && (o.taxRatePercent !== r.taxRatePercent || o.hsnCode !== r.hsnCode || o.isTaxInclusive !== r.isTaxInclusive);
      }),
    [rows, original]
  );

  const edit = (id: string, patch: Partial<GstRow>) => {
    setMessage(null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const save = async (list: GstRow[]) => {
    if (list.length === 0) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/catalog/tax-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: list.map((r) => ({ productId: r.id, taxRatePercent: r.taxRatePercent, hsnCode: r.hsnCode, isTaxInclusive: r.isTaxInclusive })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not save GST.');
      setMessage(json.message || 'GST saved.');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const applyToAll = () => {
    const rate = Number(bulkRate);
    if (!window.confirm(`Set GST to ${rate}% for all ${rows.length} products? New orders will use this rate.`)) return;
    const next = rows.map((r) => ({ ...r, taxRatePercent: rate }));
    setRows(next);
    void save(next);
  };

  return (
    <section className={card}>
      <div className="flex items-start gap-3 mb-4">
        <Percent className="w-6 h-6 text-[#E5A93C] shrink-0 mt-0.5" />
        <div>
          <h3 className="text-lg font-bold leading-tight">GST rates</h3>
          <p className="text-sm text-[#4B5563] mt-0.5">
            GST is applied per product at checkout. New orders use these rates; past orders and invoices keep the rate they were placed with.
            Confirm HSN codes and rates with your accountant.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No products yet. Add products first.</p>
      ) : (
        <>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              <span className="font-semibold">Set all products to</span>
              <select value={bulkRate} onChange={(e) => setBulkRate(e.target.value)} className="px-3 py-2 rounded-lg border border-[#E5E7EB]">
                {slabs.map((s) => (
                  <option key={s} value={s}>
                    {s}%
                  </option>
                ))}
              </select>
              <button type="button" onClick={applyToAll} disabled={saving} className="px-4 py-2 rounded-full border border-[#E5E7EB] font-semibold hover:border-[#F5BD48] cursor-pointer disabled:opacity-60">
                Apply to all
              </button>
            </div>
          )}

          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] text-left">
                  <th className="px-3 py-2.5 font-semibold rounded-l-lg">Product</th>
                  <th className="px-3 py-2.5 font-semibold">Price</th>
                  <th className="px-3 py-2.5 font-semibold">HSN code</th>
                  <th className="px-3 py-2.5 font-semibold">GST %</th>
                  <th className="px-3 py-2.5 font-semibold rounded-r-lg">Price includes GST</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="px-3 py-2.5 font-medium capitalize">{r.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">₹{(r.basePricePaise / 100).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5">
                      <input
                        className={`${input} w-28`}
                        inputMode="numeric"
                        maxLength={8}
                        value={r.hsnCode}
                        disabled={!canEdit}
                        onChange={(e) => edit(r.id, { hsnCode: e.target.value.replace(/\D/g, '') })}
                        aria-label={`HSN code for ${r.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={r.taxRatePercent}
                        disabled={!canEdit}
                        onChange={(e) => edit(r.id, { taxRatePercent: Number(e.target.value) })}
                        className="px-3 py-2 rounded-lg border border-[#E5E7EB] disabled:bg-[#F9FAFB]"
                        aria-label={`GST rate for ${r.name}`}
                      >
                        {slabs.map((s) => (
                          <option key={s} value={s}>
                            {s}%
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={r.isTaxInclusive}
                        disabled={!canEdit}
                        onChange={(e) => edit(r.id, { isTaxInclusive: e.target.checked })}
                        className="w-4 h-4 accent-[#E5A93C]"
                        aria-label={`Price includes GST for ${r.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="mt-3 text-sm text-[#B91C1C] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          {message && <p className="mt-3 text-sm text-[#15803D]">{message}</p>}

          {canEdit ? (
            <div className="mt-4">
              <button type="button" onClick={() => save(changed)} disabled={saving || changed.length === 0} className={primaryBtn}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Saving...' : changed.length ? `Save GST changes (${changed.length})` : 'No changes'}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#6B7280]">Only the owner (ADMIN) can change GST.</p>
          )}
        </>
      )}
    </section>
  );
}

/** Admin > Tax & Delivery: everything that decides what the customer pays at checkout. */
export function AdminTaxDeliverySettings({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#111215]">Tax &amp; Delivery</h2>
        <p className="text-sm text-[#4B5563] mt-1">
          Set once: your studio location, delivery charges by distance, and GST. Checkout applies them automatically.
        </p>
      </div>
      <StudioLocationCard canEdit={canEdit} />
      <AdminDeliveryFeeSlabs canEdit={canEdit} />
      <GstSettingsCard canEdit={canEdit} />
    </div>
  );
}
