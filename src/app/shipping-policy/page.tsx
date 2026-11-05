import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Truck, Mail, MapPin } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `Shipping Policy | ${BUSINESS_CONFIG.brandName}`,
  description: `Hyderabad express shipping rates, timelines, and logistics guidelines for ${BUSINESS_CONFIG.brandName}.`,
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
            <span>Hyderabad Express Delivery</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Shipping Policy
          </h1>
          <p className="text-xs text-[#94A3B8]">Last updated: November 2026</p>
        </div>

        <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">1. Service Coverage &amp; Delivery Area</h2>
            <p>
              <strong>{BUSINESS_CONFIG.brandName}</strong> exclusively operates within verified Hyderabad express logistics hubs covering approximately a 20 km delivery radius from our registered store origin in <strong>A S Rao Nagar / ECIL / Kapra (PIN 500062)</strong>.
            </p>
            <p className="text-xs text-[#94A3B8]">
              Serviceable locations include ECIL, Sainikpuri, Malkajgiri, Secunderabad, Tarnaka, Begumpet, Banjara Hills, Jubilee Hills, Madhapur, Hitech City, Kondapur, Gachibowli, and surrounding verified Hyderabad postal codes. PIN code eligibility is authoritatively verified prior to order checkout.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">2. Preparation &amp; Production Timelines</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#CBD5E1]/90">
              <li><strong>Minimum Preparation Time:</strong> Handcrafted and personalized items require a minimum of <strong>2 business days</strong> for laser engraving, proof verification, and artisan packaging prior to courier handover.</li>
              <li><strong>Standard Delivery:</strong> Dispatched and delivered directly to your doorstep via dedicated local courier and express delivery partners once prepared.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">3. Delivery Charges</h2>
            <p>
              Delivery charges are not based on automated slabs; they are manually entered and confirmed by the store owner for each individual order based on exact distance and delivery requirements. Customers approve the final authoritative amount before completing payment.
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
              For delivery updates, address adjustments, or order coordination, please contact:
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
