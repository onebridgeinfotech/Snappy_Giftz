import Link from 'next/link';
import { Gift } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#08090B] text-[#F1F5F9] p-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#17181C] text-[#F5BD48] flex items-center justify-center mb-4 border border-[#D5A34A]/30 shadow-lg shadow-black/50">
        <Gift className="w-8 h-8" />
      </div>
      <span className="text-[11px] font-bold text-[#D5A34A] uppercase tracking-[0.25em] mb-1">
        404 — PAGE NOT FOUND
      </span>
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#F1F5F9]">
        Treasure Not Found
      </h1>
      <p className="text-xs sm:text-sm text-[#94A3B8] max-w-sm mt-2 mb-6">
        The curated gifting page or product you are looking for may have been moved, archived, or is temporarily unavailable.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:from-[#E5AD38] hover:to-[#C5933A] text-[#08090B] text-xs font-bold transition-all shadow-md shadow-amber-950/20 active:scale-95"
      >
        Return to Snappy Gifts Catalog
      </Link>
    </div>
  );
}
