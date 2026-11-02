import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, Clock, ArrowLeft, Send, Sparkles, Building2 } from 'lucide-react';
import { BUSINESS_CONFIG } from '@/config/business';

export const metadata: Metadata = {
  title: `Contact Us | ${BUSINESS_CONFIG.brandName}`,
  description: `Get in touch with ${BUSINESS_CONFIG.brandName} for bespoke personalized gifts, corporate bulk gifting, and order concierge support.`,
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] selection:bg-[#D5A34A]/30 selection:text-[#F5BD48] py-12 px-4 sm:px-6 lg:px-8">
      {/* Background ambient glow */}
      <div className="max-w-5xl mx-auto space-y-10 relative">
        <div className="flex items-center justify-between border-b border-[#D5A34A]/20 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#D5A34A] hover:text-[#F5BD48] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Storefront</span>
          </Link>
          <span className="text-xs uppercase tracking-widest text-[#94A3B8] font-mono">
            {BUSINESS_CONFIG.brandName} Concierge
          </span>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#17181C] border border-[#D5A34A]/30 text-[#D5A34A] text-xs font-mono uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#F5BD48]" />
            <span>Client Concierge &amp; Corporate Inquiries</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            We Would Love to <span className="text-gold-gradient italic font-serif">Hear From You</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
            Whether you have a question about bespoke laser engravings, personalized keepsakes, corporate welcome kits, or an existing order, our team is ready to assist you.
          </p>
        </div>

        {/* Contact Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Official Business Information */}
          <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/30 p-6 sm:p-8 space-y-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 pb-4 border-b border-[#D5A34A]/20">
              <div className="w-10 h-10 rounded-2xl bg-[#D5A34A]/15 border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48] shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-lg text-white">Official Business Details</h2>
                <p className="text-xs text-[#94A3B8]">Authoritative registered business address &amp; contact</p>
              </div>
            </div>

            <div className="space-y-5 text-xs text-[#CBD5E1]">
              <div className="space-y-1">
                <div className="text-[#94A3B8] font-mono text-[11px] uppercase tracking-wider">Business Name</div>
                <div className="text-sm font-semibold text-white">{BUSINESS_CONFIG.brandName}</div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[#94A3B8] font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#D5A34A]" />
                  <span>Registered &amp; Operating Address</span>
                </div>
                <div className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed bg-[#08090B]/60 p-3.5 rounded-xl border border-[#D5A34A]/15">
                  {BUSINESS_CONFIG.address.formattedMultiLine.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[#94A3B8] font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#D5A34A]" />
                  <span>Official Business Email</span>
                </div>
                <div>
                  <a
                    href={`mailto:${BUSINESS_CONFIG.officialEmail}`}
                    className="text-xs sm:text-sm text-[#F5BD48] hover:text-white underline underline-offset-4 transition-colors font-medium break-all"
                  >
                    {BUSINESS_CONFIG.officialEmail}
                  </a>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[#94A3B8] font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#D5A34A]" />
                  <span>Operating Hours</span>
                </div>
                <div className="text-xs text-[#CBD5E1]">
                  {BUSINESS_CONFIG.operatingHours}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Message Form */}
          <div className="bg-[#17181C] rounded-3xl border border-[#D5A34A]/30 p-6 sm:p-8 space-y-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="pb-4 border-b border-[#D5A34A]/20">
              <h2 className="font-serif font-bold text-lg text-white">Send Us a Direct Note</h2>
              <p className="text-xs text-[#94A3B8]">Our concierge responds within 24 business hours</p>
            </div>

            <form
              action={`mailto:${BUSINESS_CONFIG.officialEmail}`}
              method="GET"
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-medium text-[#CBD5E1] mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  placeholder="e.g. Priyanshu Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-[#F1F5F9] focus:outline-hidden focus:border-[#D5A34A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#CBD5E1] mb-1.5">
                  Your Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-[#F1F5F9] focus:outline-hidden focus:border-[#D5A34A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#CBD5E1] mb-1.5">
                  Inquiry Message or Order Number
                </label>
                <textarea
                  name="body"
                  rows={4}
                  required
                  placeholder="Share details regarding your bespoke gift request or order inquiry..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-[#F1F5F9] focus:outline-hidden focus:border-[#D5A34A]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Launch Email Client</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
