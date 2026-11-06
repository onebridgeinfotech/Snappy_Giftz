'use client';

import { useEffect } from 'react';

/** Deep link /wishlist → home with wishlist drawer open (avoids 404 on bookmarks). */
export default function WishlistPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.replace('/?wishlist=1');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08090B] text-[#94A3B8] text-sm">
      Opening your wishlist…
    </div>
  );
}
