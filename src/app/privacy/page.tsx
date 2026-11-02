import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Mail, MapPin } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `Privacy Policy | ${BUSINESS_CONFIG.brandName}`,
  description: `Privacy Policy and data protection terms for ${BUSINESS_CONFIG.brandName}.`,
};

export default function PrivacyPolicyPage() {
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
            <ShieldCheck className="w-3.5 h-3.5 text-[#F5BD48]" />
            <span>Data Protection &amp; Confidentiality</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="text-xs text-[#94A3B8]">Last updated: November 2026</p>
        </div>

        <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">1. Introduction</h2>
            <p>
              At <strong>{BUSINESS_CONFIG.brandName}</strong>, we respect your privacy and are committed to safeguarding personal information collected during your visit to our website and the fulfillment of your gifting orders.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">2. Information We Collect</h2>
            <p>
              We collect information necessary to fulfill orders and provide bespoke personalization services, including:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#CBD5E1]/90">
              <li>Customer contact details: Full name, delivery address, email address, and recipient contact information.</li>
              <li>Order personalization data: Custom text, engraving messages, and uploaded artwork files (SVG/PNG/PDF).</li>
              <li>Transaction metadata: Razorpay order identifiers, payment status, and tax invoice records.</li>
            </ul>
            <p className="text-xs text-[#94A3B8] italic pt-1">
              Important: We never store card numbers, CVVs, UPI PINs, or net banking passwords on our servers. All financial transactions are securely tokenized through authorized payment gateways.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">3. How We Use Your Information</h2>
            <p>
              Your data is strictly utilized for:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#CBD5E1]/90">
              <li>Laser-engraving, preparing, and packaging your bespoke items.</li>
              <li>Generating valid Indian GST tax invoices and dispatch documentation.</li>
              <li>Communicating dispatch status, tracking links, and order confirmations via email.</li>
              <li>Customer service and concierge inquiry handling.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">4. Data Sharing &amp; Logistics</h2>
            <p>
              We do not sell, rent, or trade your personal data. We only share recipient delivery information with authorized courier partners (e.g. BlueDart, Delhivery) strictly to execute doorstep delivery.
            </p>
          </section>

          <section className="space-y-4 pt-4 border-t border-[#D5A34A]/20">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">5. Contact Our Privacy Desk</h2>
            <p>
              For any questions regarding this Privacy Policy, personal data access, or data deletion requests, please contact our official office:
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
