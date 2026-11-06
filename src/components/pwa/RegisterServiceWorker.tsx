'use client';

import { useEffect } from 'react';

function shouldAutoReloadForSw(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '/';
  if (path === '/' || path === '') return false;
  const marketing =
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/privacy') ||
    path.startsWith('/terms') ||
    path.startsWith('/contact') ||
    path.startsWith('/about') ||
    path.startsWith('/refund-policy') ||
    path.startsWith('/shipping-policy') ||
    path.startsWith('/shop') ||
    path.startsWith('/catalog') ||
    path.startsWith('/products/');
  if (marketing) return false;
  return true;
}

/** Registers the production service worker once per page load and checks for updates. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          void reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        })
        .catch(() => {
          /* non-fatal */
        });
    };

    const schedule = () => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(register, { timeout: 5000 });
      } else {
        window.setTimeout(register, 3000);
      }
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    const onControllerChange = () => {
      if (!shouldAutoReloadForSw()) return;
      if (sessionStorage.getItem('sg-sw-reloaded') === '1') return;
      sessionStorage.setItem('sg-sw-reloaded', '1');
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
