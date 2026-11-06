'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, ExternalLink, X } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

const DISMISS_KEY = 'sg-pwa-install-dismissed-v2';
const DISMISS_UNTIL_KEY = 'sg-pwa-install-until';
const VISIT_KEY = 'sg-pwa-visit-count';

const CTA =
  'inline-flex items-center gap-2 rounded-full bg-[#F5BD48] px-3 py-2 text-xs font-bold text-[#08090B] hover:bg-[#D5A34A] disabled:opacity-60';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallMode = 'hidden' | 'bip' | 'guide';
type PhoneKind = 'android' | 'ios' | 'other';

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const deferredListeners = new Set<() => void>();

function setDeferredInstallPrompt(event: BeforeInstallPromptEvent | null) {
  deferredInstallPrompt = event;
  deferredListeners.forEach((fn) => fn());
}

export function hasPwaInstallPrompt(): boolean {
  return Boolean(deferredInstallPrompt);
}

export function subscribePwaInstallPrompt(listener: () => void): () => void {
  deferredListeners.add(listener);
  return () => deferredListeners.delete(listener);
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const deferred = deferredInstallPrompt;
  if (!deferred) return 'unavailable';
  try {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferredInstallPrompt(null);
    return choice.outcome;
  } catch {
    return 'dismissed';
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function phoneKind(): PhoneKind {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const uaPlatform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    '';
  if (/android/i.test(ua) || /android/i.test(uaPlatform)) return 'android';
  if (/iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  return 'other';
}

function isSamsungBrowser(): boolean {
  if (typeof navigator === 'undefined' || phoneKind() !== 'android') return false;
  return /SamsungBrowser/i.test(navigator.userAgent);
}

function installUrl(): string {
  if (typeof window === 'undefined') return BUSINESS_CONFIG.website;
  return `${window.location.origin}/`;
}

function safariOpenHref(): string {
  const u = installUrl().replace(/^https:\/\//i, '');
  return `x-safari-https://${u}`;
}

function recordVisit(): number {
  try {
    const marked = sessionStorage.getItem('sg-pwa-visit-marked');
    let count = Number(localStorage.getItem(VISIT_KEY) || '0');
    if (!marked) {
      count += 1;
      localStorage.setItem(VISIT_KEY, String(count));
      sessionStorage.setItem('sg-pwa-visit-marked', '1');
    }
    return count;
  } catch {
    return 2;
  }
}

function InstallGuides({
  kind,
  samsung,
  showInstall,
  busy,
  copied,
  safariStep,
  onSafariStep,
  onInstall,
  onCopy,
  onDismiss,
  safariHref,
}: {
  kind: PhoneKind;
  samsung: boolean;
  showInstall: boolean;
  busy: boolean;
  copied: boolean;
  safariStep: number;
  onSafariStep: (step: number) => void;
  onInstall: () => void;
  onCopy: () => void;
  onDismiss: () => void;
  safariHref: string;
}) {
  const androidFirst = kind !== 'ios';
  const android = (
    <section className="rounded-lg border border-white/10 bg-[#0B0C0E] p-3" key="android">
      <p className="text-xs font-semibold text-[#F1F5F9]">
        Android{kind === 'android' ? ' — this phone' : ''}
      </p>
      <ol className="mt-2 space-y-2 text-xs text-[#94A3B8]">
        <li>
          <span className="font-semibold text-[#CBD5E1]">1. </span>
          Open this site in {samsung ? 'Samsung Internet' : 'Chrome'}.
        </li>
        <li>
          <span className="font-semibold text-[#CBD5E1]">2. </span>
          {samsung ? (
            <>
              Tap the menu, then <span className="text-[#F5BD48]">Add page to</span>, then{' '}
              <span className="text-[#F5BD48]">Home screen</span>.
            </>
          ) : (
            <>
              Tap <span className="text-[#F5BD48]">⋮</span>, then <span className="text-[#F5BD48]">Install app</span>.
              If missing, use <span className="text-[#F5BD48]">Add to Home screen</span>.
            </>
          )}
        </li>
        <li>
          <span className="font-semibold text-[#CBD5E1]">3. </span>
          Tap <span className="text-[#F5BD48]">Install</span> or <span className="text-[#F5BD48]">Add</span>.
        </li>
      </ol>
    </section>
  );
  const iphone = (
    <section className="rounded-lg border border-white/10 bg-[#0B0C0E] p-3" key="ios">
      <p className="text-xs font-semibold text-[#F1F5F9]">
        iPhone{kind === 'ios' ? ' — this phone' : ''} — Safari only
      </p>
      <ol className="mt-2 space-y-2 text-xs text-[#94A3B8]">
        <li className={safariStep === 1 ? 'rounded-md bg-white/5 px-2 py-1' : undefined}>
          <span className="font-semibold text-[#CBD5E1]">1. </span>
          Open in <span className="text-[#F5BD48]">Safari</span>, not Chrome.
        </li>
        <li className={safariStep === 2 ? 'rounded-md bg-white/5 px-2 py-1' : undefined}>
          <span className="font-semibold text-[#CBD5E1]">2. </span>
          Tap <span className="text-[#F5BD48]">Share</span>, then{' '}
          <span className="text-[#F5BD48]">Add to Home Screen</span>.
        </li>
        <li className={safariStep === 3 ? 'rounded-md bg-white/5 px-2 py-1' : undefined}>
          <span className="font-semibold text-[#CBD5E1]">3. </span>
          Tap <span className="text-[#F5BD48]">Add</span>.
        </li>
      </ol>
      {kind === 'ios' ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {safariStep < 3 ? (
            <button type="button" onClick={() => onSafariStep(Math.min(3, safariStep + 1))} className={CTA}>
              Next step
            </button>
          ) : null}
          <a href={safariHref} className={CTA}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open in Safari
          </a>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:bg-white/5"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="mt-3 space-y-3">
      {androidFirst ? android : iphone}
      {androidFirst ? iphone : android}
      <div className="flex flex-wrap gap-2">
        {showInstall ? (
          <button type="button" disabled={busy} onClick={onInstall} className={CTA}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            {busy ? 'Opening…' : 'Install app'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-[#94A3B8] hover:bg-white/5"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode>('hidden');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [safariStep, setSafariStep] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (pathname?.startsWith('/admin')) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      const until = Number(localStorage.getItem(DISMISS_UNTIL_KEY) || '0');
      if (until > Date.now()) return;
      if (recordVisit() < 2) return;
    } catch {
      /* ignore */
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      setDeferredInstallPrompt(ev);
      setDeferred(ev);
      setMode('bip');
    };
    window.addEventListener('beforeinstallprompt', onBip);

    const reveal = window.setTimeout(() => {
      const kind = phoneKind();
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      if (kind === 'android' || kind === 'ios' || coarse) {
        setMode((m) => (m === 'bip' ? m : 'guide'));
      }
    }, 1800);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.clearTimeout(reveal);
    };
  }, [pathname]);

  const dismiss = useCallback(() => {
    setMode('hidden');
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    setBusy(true);
    try {
      const outcome = await promptPwaInstall();
      if (outcome === 'unavailable' && deferred) {
        await deferred.prompt();
        await deferred.userChoice;
      }
    } catch {
      /* cancelled */
    } finally {
      setBusy(false);
      setDeferred(null);
      setDeferredInstallPrompt(null);
      setMode('hidden');
    }
  }, [deferred]);

  const copyLink = useCallback(async () => {
    const url = installUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link, open it in Chrome, then paste:', url);
    }
  }, []);

  if (mode === 'hidden') return null;

  return (
    <div
      role="region"
      aria-label="Install app"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 lg:justify-end"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-[#D5A34A]/25 bg-[#08090B]/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl border border-[#D5A34A]/30 object-contain bg-[#0B0C0E]"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F1F5F9]">Install {BUSINESS_CONFIG.brandName}</p>
              <p className="mt-0.5 text-xs text-[#94A3B8]">Shop gifts faster from your home screen.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-[#94A3B8] hover:bg-white/10 hover:text-[#F1F5F9]"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <InstallGuides
          kind={phoneKind()}
          samsung={isSamsungBrowser()}
          showInstall={mode === 'bip'}
          busy={busy}
          copied={copied}
          safariStep={safariStep}
          onSafariStep={setSafariStep}
          onInstall={() => void install()}
          onCopy={() => void copyLink()}
          onDismiss={dismiss}
          safariHref={safariOpenHref()}
        />
      </div>
    </div>
  );
}

export function resetPwaInstallDismiss() {
  try {
    localStorage.removeItem(DISMISS_KEY);
    localStorage.removeItem('sg-pwa-install-dismissed');
  } catch {
    /* ignore */
  }
}
