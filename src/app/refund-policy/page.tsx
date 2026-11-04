import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Mail, MapPin, Phone, MessageCircle } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `Refund & Replacement Policy | ${BUSINESS_CONFIG.brandName}`,
  description: `Transit damage reporting, replacement, and refund terms at ${BUSINESS_CONFIG.brandName}.`,
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
            <span>Customer Satisfaction &amp; Quality Pledge</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Refund &amp; Replacement Policy
          </h1>
          <p className="text-xs text-[#94A3B8]">Last updated: November 2026</p>
        </div>

        <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 p-6 sm:p-10 space-y-8 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed shadow-xl">
          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">1. Personalized Products &amp; Change of Mind</h2>
            <p>
              Due to the bespoke nature of personalized and engraved gifting, orders crafted to your individual specifications (names, photos, engraved messages, or custom designs) cannot be returned, cancelled, or refunded for general change of mind once craftsmanship or preparation has begun.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">2. Transit Damage Reporting Window (Within 24 Hours)</h2>
            <p>
              We hand-pack every gift with premium protective cushioning. If your package arrives damaged, broken, or defective in transit:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#CBD5E1]/90">
              <li><strong className="text-white">Time Limit:</strong> You must report the damage within <strong>24 hours of delivery</strong>.</li>
              <li><strong className="text-white">Required Evidence:</strong> Please share clear photographs or an unboxing video showing the shipping label, packaging box, and the damaged item.</li>
              <li><strong className="text-white">Owner Review:</strong> The store owner personally reviews all damage reports. For verified damage, we arrange an immediate priority replacement at zero additional charge, or process an eligible refund.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">3. Eligible Refund Processing</h2>
            <p>
              Where an eligible refund is approved by the owner (such as out-of-stock items, delivery cancellations before preparation, or mutually agreed damage settlements):
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#CBD5E1]/90">
              <li>Refunds are processed back to the original source payment method (UPI, bank account, or card) via Razorpay.</li>
              <li>Processing typically completes within 5 to 7 business days depending on banking channels.</li>
              <li>Cash on Delivery orders eligible for refund will be credited directly to the customer&apos;s verified bank/UPI account upon confirmation.</li>
            </ul>
          </section>

          <section className="space-y-4 pt-4 border-t border-[#D5A34A]/20">
            <h2 className="font-serif font-bold text-base sm:text-lg text-white">4. Direct Contact &amp; Damage Claims</h2>
            <p>
              To report a damaged product within 24 hours or request customization adjustments, reach out directly to the store owner:
            </p>
            <div className="bg-[#08090B]/60 p-5 rounded-2xl border border-[#D5A34A]/20 space-y-3 text-xs">
              <div className="font-bold text-white text-sm">{BUSINESS_CONFIG.brandName}</div>
              <div className="flex items-start gap-2 text-[#CBD5E1]">
                <MapPin className="w-4 h-4 text-[#D5A34A] shrink-0 mt-0.5" />
                <span>{BUSINESS_CONFIG.address.formattedSingleLine}</span>
              </div>
              <div className="flex items-center gap-2 text-[#CBD5E1]">
                <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                <span>Direct WhatsApp: </span>
                <a
                  href={`https://wa.me/91${BUSINESS_CONFIG.whatsappPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F5BD48] hover:text-white underline underline-offset-2 transition-colors font-semibold"
                >
                  +91 {BUSINESS_CONFIG.whatsappPhone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-[#CBD5E1]">
                <Mail className="w-4 h-4 text-[#D5A34A] shrink-0" />
                <span>Customer Care: </span>
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
