import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Truck, Mail, MapPin } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `Shipping Policy | ${BUSINESS_CONFIG.brandName}`,
  description: `Pan-India shipping rates, timelines, and logistics guidelines for ${BUSINESS_CONFIG.brandName}.`,
};

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] selection:bg-[#D5A34A]/30 selection:text-[#F5BD48] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="flex items-center justify-between border-b border-[#D5A34A]/20 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#D5A34A] hover:text-[#F5BD48] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Storefront</span>
          </Link>
          <span className="text-xs uppercase tracking-widest text-[#94A3B8] font-mono">
            {BUSINESS_CONFIG.brandName} Logistics
          </span>
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#17181C] border border-[#D5A34A]/30 text-[#D5A34A] text-xs font-mono uppercase tracking-wider">
            <Truck className="w-3.5 h-3.5 text-[#F5BD48]" />
            <span>Pan-India Distribution</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Shipping Policy
          </h1>
          <p className="text-xs text-[#94A3B8]">Last updated: November 2026</p>
        </div>

        <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">1. Service Coverage</h2>
            <p>
              <strong>{BUSINESS_CONFIG.brandName}</strong> ships across India to over 24,000 postal PIN codes through premier logistics providers (BlueDart Air Express, Delhivery, and express ground couriers).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">2. Processing &amp; Production Timelines</h2>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#CBD5E1]/90">
              <li><strong>Standard Curations:</strong> Dispatched within 24–48 hours from order confirmation.</li>
              <li><strong>Personalized Laser Keepsakes:</strong> Dispatched within 2–3 business days following artisan proof approval and laser engraving.</li>
              <li><strong>Corporate Bulk Orders:</strong> Dispatched according to agreed procurement timelines and schedules.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">3. Shipping Charges</h2>
            <p>
              Standard courier delivery is ₹99 for orders below ₹999. Orders of ₹999 or above qualify for complimentary standard shipping across India. Optional Air Express priority dispatch is available at checkout for ₹199.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">4. Packaging &amp; Damage Protection</h2>
            <p>
              Fragile gifts (ceramic mugs, glass decors, scented candles) are encased in shock-absorbing honeycomb wrapping and premium rigid keepsake boxes. All parcels are fully insured against transit loss or damage.
            </p>
          </section>

          <section className="space-y-4 pt-4 border-t border-[#D5A34A]/20">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">5. Shipping Inquiries &amp; Tracking Support</h2>
            <p>
              For shipping updates, delayed packages, or address adjustments, please contact:
            </p>
            <div className="bg-[#08090B]/60 p-5 rounded-2xl border border-[#D5A34A]/20 space-y-2.5 text-xs">
              <div className="font-bold text-white text-sm">{BUSINESS_CONFIG.brandName}</div>
              <div className="flex items-start gap-2 text-[#CBD5E1]">
                <MapPin className="w-4 h-4 text-[#D5A34A] shrink-0 mt-0.5" />
                <span>{BUSINESS_CONFIG.address.formattedSingleLine}</span>
              </div>
              <div className="flex items-center gap-2 text-[#CBD5E1]">
                <Mail className="w-4 h-4 text-[#D5A34A] shrink-0" />
                <a
                  href={`mailto:${BUSINESS_CONFIG.officialEmail}`}
                  className="text-[#F5BD48] hover:text-white underline underline-offset-2 transition-colors font-medium"
                >
                  {BUSINESS_CONFIG.officialEmail}
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
