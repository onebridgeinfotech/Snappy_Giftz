'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Package, Phone, MapPin, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Banknote } from 'lucide-react';

type Ctx = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  itemsCount: number;
  isCod: boolean;
  amountToCollectPaise: number;
  deliveryPerson: string | null;
  expiresAt: string;
};

/** Page the delivery person opens from their email/WhatsApp link to confirm delivery with the customer's OTP. */
export default function DeliveryConfirmPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || '');
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [method, setMethod] = useState<'CASH' | 'UPI_ON_DELIVERY'>('CASH');
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/delivery/confirm/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j.error || 'This link is not valid.');
        setCtx(j.data);
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx) return;
    setError(null);
    if (otp.length !== 6) return setError("Enter the customer's 6-digit OTP.");
    if (ctx.isCod && !cashConfirmed) return setError('Confirm that you collected the payment.');
    setSubmitting(true);
    try {
      const r = await fetch(`/api/delivery/confirm/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp, collectionMethod: method }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Could not confirm delivery.');
      setDone(j.message || 'Delivered.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const amount = ctx ? `₹${(ctx.amountToCollectPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '';

  return (
    <main className="min-h-screen bg-[#F6F7FB] text-[#111215] flex justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-2">
          <img src="/assets/snappy-gifts.png" alt="SNAPPY GIFTZ" className="h-10 w-auto" />
        </div>

        {!ctx && !loadError && (
          <div className="rounded-2xl bg-white border border-[#ECEDF2] p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
          </div>
        )}

        {loadError && (
          <div className="rounded-2xl bg-white border border-[#FECACA] p-6 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
            <h1 className="text-lg font-bold">Link closed</h1>
            <p className="text-sm text-[#4B5563]">{loadError}</p>
          </div>
        )}

        {done && (
          <div className="rounded-2xl bg-white border border-[#BBF7D0] p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#16A34A] mx-auto" />
            <h1 className="text-xl font-bold">Delivery confirmed</h1>
            <p className="text-sm text-[#4B5563]">{done} The customer has been notified. This link is now closed.</p>
          </div>
        )}

        {ctx && !done && (
          <>
            <section className="rounded-2xl bg-white border border-[#ECEDF2] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold">Order #{ctx.orderNumber}</h1>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EDE9FE] text-[#6D28D9]">Out for delivery</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <Package className="w-4 h-4 mt-0.5 text-[#C48A1B]" />
                <span>
                  {ctx.customerName} • {ctx.itemsCount} {ctx.itemsCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <a href={`tel:${ctx.customerPhone}`} className="flex items-center gap-2.5 text-sm text-[#1D4ED8] font-semibold">
                <Phone className="w-4 h-4" />
                {ctx.customerPhone}
              </a>
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 text-[#C48A1B] shrink-0" />
                <span>{ctx.address}</span>
              </div>
              {ctx.isCod && (
                <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-4 py-3 text-sm flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-[#B45309]" />
                  Collect <strong className="text-[#92400E]">{amount}</strong> (cash or UPI)
                </div>
              )}
            </section>

            <form onSubmit={submit} className="rounded-2xl bg-white border border-[#ECEDF2] p-5 space-y-4">
              <div className="flex items-center gap-2 font-bold">
                <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
                Confirm with the customer&apos;s OTP
              </div>
              <p className="text-sm text-[#4B5563]">
                After handing over the parcel, ask the customer for the 6-digit delivery OTP from their order email.
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                aria-label="Customer OTP"
                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-center text-2xl font-mono tracking-[0.5em] focus:outline-hidden focus:ring-2 focus:ring-[#F5BD48]/60"
              />

              {ctx.isCod && (
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    {(['CASH', 'UPI_ON_DELIVERY'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        aria-pressed={method === m}
                        className={`flex-1 py-2 rounded-xl border font-semibold ${
                          method === m ? 'bg-[#FFF3D6] border-[#F5BD48]' : 'border-[#E5E7EB]'
                        }`}
                      >
                        {m === 'CASH' ? 'Cash' : 'UPI'}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={cashConfirmed} onChange={(e) => setCashConfirmed(e.target.checked)} className="mt-1" />
                    <span>I collected {amount} from the customer.</span>
                  </label>
                </div>
              )}

              {error && (
                <p className="text-sm text-[#B91C1C] flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="w-full py-3 rounded-full bg-gradient-to-r from-[#FBD27A] to-[#F5BD48] font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Delivered
              </button>
              <p className="text-[11px] text-[#6B7280] text-center">
                Link valid until {new Date(ctx.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} or until this order is delivered.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
