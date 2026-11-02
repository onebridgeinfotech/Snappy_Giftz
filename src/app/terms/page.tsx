import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, Mail, MapPin } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `Terms of Service | ${BUSINESS_CONFIG.brandName}`,
  description: `Terms and Conditions of Service for ${BUSINESS_CONFIG.brandName}.`,
};

export default function TermsPage() {
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
            {BUSINESS_CONFIG.brandName} Legal
          </span>
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#17181C] border border-[#D5A34A]/30 text-[#D5A34A] text-xs font-mono uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-[#F5BD48]" />
            <span>Statutory Agreement</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="text-xs text-[#94A3B8]">Last updated: November 2026</p>
        </div>

        <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">1. Agreement to Terms</h2>
            <p>
              By accessing or placing an order through the <strong>{BUSINESS_CONFIG.brandName}</strong> website, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">2. Personalized &amp; Custom Orders</h2>
            <p>
              Many products offered by {BUSINESS_CONFIG.brandName} involve custom laser engraving, monogramming, or hot-foil branding.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#CBD5E1]/90">
              <li>Customers are responsible for reviewing digital previews and spelling of text/names prior to checkout.</li>
              <li>Once production has commenced on personalized orders, cancellations or modifications may not be feasible.</li>
              <li>Goods customized according to customer specifications are non-refundable, except in cases of transit damage or manufacturing defect.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">3. Pricing &amp; Taxes</h2>
            <p>
              All prices are listed in Indian Rupees (INR). Applicable GST is calculated and reflected during checkout and on official tax invoices in compliance with Indian GST regulations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">4. Governing Law &amp; Jurisdiction</h2>
            <p>
              These Terms of Service and any transactional disputes arising out of the use of our platform shall be governed by and construed in accordance with the laws of India, subject to the exclusive jurisdiction of the courts of Hyderabad, Telangana.
            </p>
          </section>

          <section className="space-y-4 pt-4 border-t border-[#D5A34A]/20">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">5. Official Contact Details</h2>
            <p>
              For legal inquiries or notices regarding these Terms, contact us at:
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
