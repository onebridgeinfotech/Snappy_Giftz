import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Mail, MapPin } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `Refund & Replacement Policy | ${BUSINESS_CONFIG.brandName}`,
  description: `Replacement and refund terms for personalized gifts and curations at ${BUSINESS_CONFIG.brandName}.`,
};

export default function RefundPolicyPage() {
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
            {BUSINESS_CONFIG.brandName} Customer Care
          </span>
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#17181C] border border-[#D5A34A]/30 text-[#D5A34A] text-xs font-mono uppercase tracking-wider">
            <RefreshCw className="w-3.5 h-3.5 text-[#F5BD48]" />
            <span>Customer Satisfaction Pledge</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Refund &amp; Replacement Policy
          </h1>
          <p className="text-xs text-[#94A3B8]">Last updated: November 2026</p>
        </div>

        <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">1. Personalized Products Policy</h2>
            <p>
              Due to the unique nature of custom-made, monogrammed, and laser-engraved items, orders produced according to individual customer specifications cannot be returned or refunded for change of mind once craftsmanship has commenced.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">2. Transit Damage &amp; Defect Guarantee</h2>
            <p>
              We stand 100% behind the condition of our gifts. If an item arrives broken, cracked, or defective, <strong>{BUSINESS_CONFIG.brandName}</strong> provides an immediate complimentary replacement:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#CBD5E1]/90">
              <li>Please notify our team within 7 calendar days of delivery.</li>
              <li>Provide clear photographs or a short video showing the packaging and damaged item.</li>
              <li>Upon swift verification, an expedited replacement will be dispatched at zero additional charge to you.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">3. Refund Processing</h2>
            <p>
              Where an approved refund is issued (e.g. out-of-stock items or delivery cancellations before production), the refund will be credited back to the original source payment method (bank account, UPI, or card) within 5–7 business days via our payment gateway.
            </p>
          </section>

          <section className="space-y-4 pt-4 border-t border-[#D5A34A]/20">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">4. Contact For Claims &amp; Returns</h2>
            <p>
              To initiate a transit replacement or refund claim, reach out to our team:
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
