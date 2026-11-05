'use client';

import { useEffect } from 'react';

/** Legacy /shop URLs (welcome emails, bookmarks) → home catalog. */
export default function ShopPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.replace('/#catalog-section');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08090B] text-[#94A3B8] text-sm">
      Opening the catalog…
    </div>
  );
}
