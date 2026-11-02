import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Crown, ShieldCheck, Sparkles, MapPin, Mail, Award, CheckCircle2 } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `About Us | ${BUSINESS_CONFIG.brandName}`,
  description: `Discover ${BUSINESS_CONFIG.brandName} — India's premier luxury online gift studio and corporate bulk gifting house.`,
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] selection:bg-[#D5A34A]/30 selection:text-[#F5BD48] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Navigation back */}
        <div className="flex items-center justify-between border-b border-[#D5A34A]/20 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#D5A34A] hover:text-[#F5BD48] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Storefront</span>
          </Link>
          <span className="text-xs uppercase tracking-widest text-[#94A3B8] font-mono">
            {BUSINESS_CONFIG.brandName} Story
          </span>
        </div>

        {/* Hero Banner */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#17181C] border border-[#D5A34A]/30 text-[#D5A34A] text-xs font-mono uppercase tracking-wider">
            <Crown className="w-3.5 h-3.5 text-[#F5BD48]" />
            <span>Bespoke Gifting Atelier</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Crafting Memories, <br />
            <span className="text-gold-gradient italic font-serif">One Keepsake at a Time</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
            At {BUSINESS_CONFIG.brandName}, we believe that every meaningful relationship deserves celebration. We bring fine artisanal craftsmanship and cutting-edge fiber-laser precision together to transform everyday items into cherished keepsakes.
          </p>
        </div>

        {/* Brand Mission & Philosophy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="w-10 h-10 rounded-2xl bg-[#D5A34A]/15 border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48]">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-serif font-bold text-xl text-white">Artisanal Excellence</h2>
            <p className="text-xs sm:text-sm text-[#CBD5E1]/80 leading-relaxed font-light">
              From 24K gold-rim ceramic drinkware and hand-cast brass lattice lanterns to pure soy scented candles and luxury gift hampers, our curations are designed to inspire joy and wonder upon unboxing.
            </p>
          </div>

          <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="w-10 h-10 rounded-2xl bg-[#D5A34A]/15 border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="font-serif font-bold text-xl text-white">Guaranteed Quality</h2>
            <p className="text-xs sm:text-sm text-[#CBD5E1]/80 leading-relaxed font-light">
              Every personalized piece is reviewed by our master craftsmen and engraved with permanent laser technology for lifetime legibility, backed by discreet gift packaging and 100% insured pan-India courier delivery.
            </p>
          </div>
        </div>

        {/* Official Business & Atelier Information */}
        <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/30 p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="border-b border-[#D5A34A]/20 pb-4">
            <h2 className="font-serif font-bold text-xl text-white">Corporate &amp; Atelier Headquarters</h2>
            <p className="text-xs text-[#94A3B8]">Authoritative registered business location and customer contact channel</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#CBD5E1]">
            <div className="space-y-4">
              <div>
                <div className="text-[11px] text-[#94A3B8] font-mono uppercase tracking-wider">Business Entity</div>
                <div className="text-sm font-semibold text-white mt-0.5">{BUSINESS_CONFIG.brandName}</div>
              </div>

              <div>
                <div className="text-[11px] text-[#94A3B8] font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#D5A34A]" />
                  <span>Headquarters &amp; Dispatch Address</span>
                </div>
                <div className="text-xs sm:text-sm text-[#CBD5E1] mt-1 leading-relaxed bg-[#08090B]/60 p-3.5 rounded-xl border border-[#D5A34A]/15">
                  {BUSINESS_CONFIG.address.formattedMultiLine.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[11px] text-[#94A3B8] font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#D5A34A]" />
                  <span>Official Inquiries &amp; Support Email</span>
                </div>
                <div className="mt-1">
                  <a
                    href={`mailto:${BUSINESS_CONFIG.officialEmail}`}
                    className="text-xs sm:text-sm text-[#F5BD48] hover:text-white underline underline-offset-4 transition-colors font-medium break-all"
                  >
                    {BUSINESS_CONFIG.officialEmail}
                  </a>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-[#94A3B8] font-mono uppercase tracking-wider">Operating Schedule</div>
                <div className="text-xs text-[#CBD5E1] mt-1">{BUSINESS_CONFIG.operatingHours}</div>
              </div>

              <div className="pt-2">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all"
                >
                  <span>Contact Our Concierge</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
