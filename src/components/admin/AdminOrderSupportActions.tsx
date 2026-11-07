'use client';

import React, { useState } from 'react';
import { Mail, Loader2, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Support actions shown inside the admin order detail view:
 * - Resend order emails (staff and owner)
 * - Refund a paid online order through Razorpay (owner only, with a confirm step)
 */
interface AdminOrderSupportActionsProps {
  order: {
    id: string;
    orderNumber: string;
    paymentStatus?: string;
    paymentMethod?: string;
    grandTotalPaise?: number | string;
  };
  isOwner: boolean;
  onChanged?: () => void;
}

type Notice = { kind: 'ok' | 'error'; message: string } | null;

const btnGhost =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#181A22] text-[#CBD5E1] border border-[#D5A34A]/30 hover:text-[#F5BD48] hover:bg-[#20232D] font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const input =
  'w-full bg-[#0F1014] border border-[#D5A34A]/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#D5A34A]/60';

function NoticeLine({ notice }: { notice: NonNullable<Notice> }) {
  return (
    <div
      className={`rounded-xl border text-xs px-3 py-2 flex items-start gap-2 ${
        notice.kind === 'ok'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/30 bg-red-500/10 text-red-300'
      }`}
    >
      {notice.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />}
      <span>{notice.message}</span>
    </div>
  );
}

export const AdminOrderSupportActions: React.FC<AdminOrderSupportActionsProps> = ({ order, isOwner, onChanged }) => {
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<Notice>(null);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundNotice, setRefundNotice] = useState<Notice>(null);
  // One key per refund attempt so a double-click or retry can't refund twice.
  const [refundKey, setRefundKey] = useState<string>('');

  const totalRupees = Number(order.grandTotalPaise || 0) / 100;
  const canRefund = isOwner && order.paymentStatus === 'CAPTURED';

  const resendEmails = async () => {
    setResending(true);
    setResendNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/resend-emails`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      setResendNotice(
        res.ok && json.success !== false
          ? { kind: 'ok', message: json.message || 'Order emails queued.' }
          : { kind: 'error', message: json.error || `Could not resend emails (${res.status}).` }
      );
    } catch {
      setResendNotice({ kind: 'error', message: 'Network error while resending emails.' });
    } finally {
      setResending(false);
    }
  };

  const parsedAmountPaise = (): number | undefined | null => {
    const raw = refundAmount.trim();
    if (!raw) return undefined; // full remaining amount
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value > totalRupees) return null;
    return Math.round(value * 100);
  };

  const reviewRefund = (e: React.FormEvent) => {
    e.preventDefault();
    setRefundNotice(null);
    if (parsedAmountPaise() === null) {
      setRefundNotice({ kind: 'error', message: `Enter an amount between ₹1 and ₹${totalRupees.toFixed(2)}, or leave it empty for a full refund.` });
      return;
    }
    if (refundReason.trim().length < 5) {
      setRefundNotice({ kind: 'error', message: 'Write a reason of at least 5 characters.' });
      return;
    }
    if (!refundKey) setRefundKey(crypto.randomUUID());
    setConfirming(true);
  };

  const submitRefund = async () => {
    const amountPaise = parsedAmountPaise();
    if (amountPaise === null) return;
    setRefunding(true);
    setRefundNotice(null);
    try {
      const res = await fetch('/api/admin/payments/refund', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          amountPaise,
          reason: refundReason.trim(),
          idempotencyKey: refundKey || crypto.randomUUID(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        setRefundNotice({ kind: 'ok', message: json.message || 'Refund processed.' });
        setConfirming(false);
        setRefundOpen(false);
        setRefundAmount('');
        setRefundReason('');
        setRefundKey('');
        onChanged?.();
      } else {
        setRefundNotice({
          kind: 'error',
          message:
            res.status === 401 || res.status === 403
              ? 'Only the store owner (ADMIN) can refund.'
              : json.error || `Refund failed (${res.status}).`,
        });
        setConfirming(false);
      }
    } catch {
      setRefundNotice({ kind: 'error', message: 'Network error during refund. Check the order before retrying.' });
      setConfirming(false);
    } finally {
      setRefunding(false);
    }
  };

  const amountLabel = (() => {
    const p = parsedAmountPaise();
    return typeof p === 'number' ? `₹${(p / 100).toFixed(2)}` : `the full remaining amount (up to ₹${totalRupees.toFixed(2)})`;
  })();

  return (
    <div className="space-y-3 pt-3 border-t border-white/10">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[#D5A34A]">Customer support</h4>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={resendEmails} disabled={resending} className={btnGhost}>
          {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
          Resend order emails
        </button>
        {canRefund && (
          <button
            type="button"
            onClick={() => {
              setRefundOpen((v) => !v);
              setConfirming(false);
              setRefundNotice(null);
            }}
            className={btnGhost}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refund
          </button>
        )}
      </div>
      {!canRefund && isOwner && order.paymentStatus !== 'CAPTURED' && (
        <p className="text-[11px] text-white/40">Refund is available once an online payment is captured.</p>
      )}
      {resendNotice && <NoticeLine notice={resendNotice} />}

      {refundOpen && canRefund && (
        <form onSubmit={reviewRefund} className="rounded-xl bg-[#0F1014] border border-[#D5A34A]/20 p-3.5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-[11px] text-[#94A3B8] space-y-1">
              <span>Amount in ₹ (empty = full)</span>
              <input
                className={input}
                inputMode="decimal"
                value={refundAmount}
                disabled={confirming}
                onChange={(e) => setRefundAmount(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder={totalRupees.toFixed(2)}
              />
            </label>
            <label className="text-[11px] text-[#94A3B8] space-y-1 sm:col-span-2">
              <span>Reason (shown in records)</span>
              <input
                className={input}
                value={refundReason}
                disabled={confirming}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Item damaged in transit"
              />
            </label>
          </div>
          {!confirming ? (
            <button type="submit" className={btnGhost}>
              Review refund
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-amber-300">
                Refund {amountLabel} for order #{order.orderNumber} to the customer&apos;s original payment method? This
                can&apos;t be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitRefund}
                  disabled={refunding}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/90 hover:bg-red-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {refunding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm refund
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={refunding} className={btnGhost}>
                  Back
                </button>
              </div>
            </div>
          )}
        </form>
      )}
      {refundNotice && <NoticeLine notice={refundNotice} />}
    </div>
  );
};

export default AdminOrderSupportActions;
