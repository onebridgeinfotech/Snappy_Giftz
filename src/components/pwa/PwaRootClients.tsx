'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const RegisterServiceWorker = dynamic(
  () =>
    import('@/components/pwa/RegisterServiceWorker').then((m) => ({
      default: m.RegisterServiceWorker,
    })),
  { ssr: false },
);

const InstallPrompt = dynamic(
  () =>
    import('@/components/pwa/InstallPrompt').then((m) => ({
      default: m.InstallPrompt,
    })),
  { ssr: false },
);

/** Deferred PWA registration + install prompt (after load / idle). */
export function PwaRootClients() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => setReady(true), { timeout: 8000 });
      } else {
        window.setTimeout(() => setReady(true), 4000);
      }
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }, []);

  if (!ready) return null;

  return (
    <>
      <RegisterServiceWorker />
      <InstallPrompt />
    </>
  );
}
