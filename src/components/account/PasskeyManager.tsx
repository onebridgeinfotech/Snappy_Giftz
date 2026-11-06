'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { isPasskeySupported, registerPasskey } from '@/lib/auth/passkey-client';

type PasskeyRow = {
  id: string;
  nickname: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = isPasskeySupported();

  const refresh = useCallback(async () => {
    const res = await fetch('/api/auth/passkeys');
    if (!res.ok) {
      setPasskeys([]);
      return;
    }
    const data = await res.json();
    setPasskeys(data.passkeys || []);
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const addPasskey = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await registerPasskey('This phone');
      await refresh();
      setMessage('Face ID / fingerprint sign-in is enabled for this device.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add passkey.');
    } finally {
      setBusy(false);
    }
  };

  const removePasskey = async (id: string) => {
    if (!confirm('Remove this device from Face ID / fingerprint sign-in?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/passkeys/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Remove failed.');
      }
      await refresh();
      setMessage('Passkey removed.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove passkey.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#17181C] p-6 rounded-2xl border border-[#D5A34A]/25 space-y-4 md:col-span-3">
      <h3 className="text-xs font-bold text-[#D5A34A] uppercase tracking-wider flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        <span>Face ID &amp; fingerprint sign-in</span>
      </h3>
      <p className="text-xs text-[#94A3B8] leading-relaxed max-w-2xl">
        Use <strong className="text-[#CBD5E1]">Face ID or Touch ID on iPhone</strong> and{' '}
        <strong className="text-[#CBD5E1]">fingerprint or face unlock on Android</strong> for faster, secure sign-in.
        Works in Safari/Chrome when this site is opened over HTTPS (including the installed app).
      </p>

      {!supported && (
        <p className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-500/30 rounded-xl px-3 py-2">
          This browser does not support biometric sign-in. Try Chrome on Android or Safari on iPhone.
        </p>
      )}

      {message && <p className="text-xs text-emerald-300">{message}</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}

      <button
        type="button"
        disabled={!supported || busy}
        onClick={() => void addPasskey()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] text-xs font-bold disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
        Enable on this device
      </button>

      {loading ? (
        <p className="text-xs text-[#64748B]">Loading devices…</p>
      ) : passkeys.length > 0 ? (
        <ul className="space-y-2">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0B0C0E] px-3 py-2.5 text-xs"
            >
              <div>
                <p className="font-semibold text-[#F1F5F9]">{pk.nickname || 'This device'}</p>
                <p className="text-[#64748B] mt-0.5">
                  {pk.deviceType || 'platform'} · Added {new Date(pk.createdAt).toLocaleDateString()}
                  {pk.lastUsedAt ? ` · Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removePasskey(pk.id)}
                className="p-2 rounded-lg text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                aria-label="Remove passkey"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[#64748B]">No biometric sign-in enabled yet.</p>
      )}
    </div>
  );
}
