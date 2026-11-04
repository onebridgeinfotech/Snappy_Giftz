'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Heart,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Send,
  Sparkles,
  Crown
} from 'lucide-react';

import { BUSINESS_CONFIG } from '@/config/business';

export const Footer: React.FC = () => {
  const { setMode, showToast, navigateToCatalog } = useApp();
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      showToast('Welcome to the Snappy Royal Circle! Your ₹100 welcome gift code is WELCOME100 🎉');
      setEmail('');
    }
  };

  return (
    <footer className="bg-[#08090B] border-t border-[#D5A34A]/20 text-[#CBD5E1] text-xs relative overflow-hidden">
      {/* Subtle Luxury Ambient Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl h-24 bg-gradient-to-b from-[#D5A34A]/10 to-transparent blur-3xl pointer-events-none" />

      {/* Upper Main Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          
          {/* Col 1: Brand Identity & Atelier Heritage */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/assets/snappy-gifts.png"
                alt={BUSINESS_CONFIG.brandName}
                className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_2px_12px_rgba(213,163,74,0.18)]"
              />
            </div>

            <p className="text-xs text-[#CBD5E1]/80 leading-relaxed max-w-sm">
              India&apos;s premier luxury online gift studio. We craft 24K gold-rim ceramic drinkware, laser-etched keepsakes, scented candles, brass lattice lanterns, and festive hampers with insured express logistics across Hyderabad and beyond.
            </p>

            <div className="space-y-2.5 text-xs text-[#CBD5E1]/80 pt-1">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#D5A34A] shrink-0 mt-0.5" />
                <span className="leading-relaxed text-xs text-[#CBD5E1]/90 max-w-sm sm:max-w-md">
                  {BUSINESS_CONFIG.address.formattedSingleLine}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#D5A34A] shrink-0" />
                <a
                  href={`mailto:${BUSINESS_CONFIG.officialEmail}`}
                  className="hover:text-[#F5BD48] text-[#CBD5E1] transition-colors underline-offset-2 hover:underline font-medium"
                >
                  {BUSINESS_CONFIG.officialEmail}
                </a>
              </div>
              <div className="text-[11px] text-[#94A3B8] pl-6.5">
                Hours: {BUSINESS_CONFIG.operatingHours}
              </div>
            </div>
          </div>

          {/* Col 2: Bespoke Occasions */}
          <div className="space-y-3.5">
            <h4 className="font-serif font-bold text-sm text-[#F5BD48] tracking-wider uppercase">
              Bespoke Occasions
            </h4>
            <ul className="space-y-2.5 text-xs text-[#CBD5E1]/80">
              <li><button onClick={() => navigateToCatalog({ occasion: 'Birthday' })} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48] cursor-pointer">Birthday Gifts &amp; Decors</button></li>
              <li><button onClick={() => navigateToCatalog({ occasion: 'Anniversary' })} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48] cursor-pointer">Anniversary &amp; Love Keepsakes</button></li>
              <li><button onClick={() => navigateToCatalog({ occasion: 'Wedding' })} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48] cursor-pointer">Wedding &amp; Engagement Hampers</button></li>
              <li><button onClick={() => navigateToCatalog({ occasion: 'Diwali' })} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48] cursor-pointer">Diwali &amp; Festive Baskets</button></li>
              <li><button onClick={() => navigateToCatalog({ category: 'Home Decor' })} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48] cursor-pointer">Housewarming &amp; Pooja Diya Sets</button></li>
              <li><button onClick={() => navigateToCatalog({ occasion: 'Festival' })} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48] cursor-pointer">Festivals &amp; Milestones</button></li>
            </ul>
          </div>

          {/* Col 3: Corporate Solutions */}
          <div className="space-y-3.5">
            <h4 className="font-serif font-bold text-sm text-[#F5BD48] tracking-wider uppercase">
              Corporate Solutions
            </h4>
            <ul className="space-y-2.5 text-xs text-[#CBD5E1]/80">
              <li><button onClick={() => setMode('b2b')} className="hover:text-[#F5BD48] text-[#D5A34A] font-semibold transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Day-One Welcome Kits</button></li>
              <li><button onClick={() => setMode('b2b')} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Custom Logo Merchandise</button></li>
              <li><button onClick={() => setMode('b2b')} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Multi-Address Split Dispatch (CSV)</button></li>
              <li><button onClick={() => setMode('b2b')} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Corporate Quotation (RFQ)</button></li>
              <li><button onClick={() => setMode('b2b')} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48]">GST Input Tax Credit (ITC)</button></li>
              <li><button onClick={() => setMode('b2b')} className="hover:text-[#F5BD48] transition-colors text-left focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Approved Net-30 Corporate Credit</button></li>
            </ul>
          </div>

          {/* Col 4: The Royal Circle Newsletter */}
          <div className="space-y-3.5">
            <h4 className="font-serif font-bold text-sm text-[#F5BD48] tracking-wider uppercase">
              The Royal Circle
            </h4>
            <p className="text-xs text-[#CBD5E1]/80 leading-relaxed">
              Join our private list for early access to Diwali catalogues, artisan releases, and an immediate ₹100 welcome voucher.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2 pt-1">
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/30 text-xs bg-[#17181C] text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:outline-hidden focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] pr-11 transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] hover:brightness-110 text-[#08090B] font-bold transition-all shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[#F5BD48]"
                  title="Subscribe"
                  aria-label="Subscribe to VIP atelier circle"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

          </div>

        </div>
      </div>

      {/* Signature Obsidian & Gold Luxury Ribbon */}
      <div className="bg-[#121316] border-y border-[#D5A34A]/25 text-[#CBD5E1] text-xs sm:text-sm py-3 px-4 font-semibold shadow-inner overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center">
          <div className="flex items-center gap-2 text-[11px] sm:text-sm tracking-widest uppercase font-medium text-[#D5A34A]">
            <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F5BD48] shrink-0" />
            <span>GIFT MORE, WORRY LESS</span>
            <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#EC3E98] text-[#EC3E98] shrink-0" />
          </div>

          <div className="font-serif font-black tracking-[0.2em] text-sm sm:text-base text-[#F5BD48] drop-shadow-xs">
            SNAPPYGIFTZ.COM
          </div>

          <div className="flex items-center gap-2 text-[11px] sm:text-sm tracking-widest uppercase font-medium text-[#D5A34A]">
            <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#EC3E98] text-[#EC3E98] shrink-0" />
            <span>BECAUSE MEMORIES DESERVE THE BEST</span>
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F5BD48] shrink-0" />
          </div>
        </div>
      </div>

      {/* Copyright, Trust Reassurance & Legal row */}
      <div className="bg-[#0B0C0E] py-5 px-4 text-center text-[11.5px] text-[#94A3B8] border-t border-white/5 space-y-3.5 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Trust & Payment badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10.5px] sm:text-[11px] text-[#CBD5E1]/70">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#D5A34A] shrink-0" /> 256-Bit SSL Encrypted</span>
            <span className="text-[#D5A34A]/40">•</span>
            <span>100% Insured Delivery</span>
            <span className="text-[#D5A34A]/40">•</span>
            <span>UPI • Visa • MasterCard • RuPay</span>
          </div>

          {/* Legal & Business Links */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[10.5px] sm:text-[11px] text-[#CBD5E1]/80">
            <a href="/privacy" className="hover:text-[#F5BD48] transition-colors focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Privacy Policy</a>
            <span className="text-[#D5A34A]/40">•</span>
            <a href="/terms" className="hover:text-[#F5BD48] transition-colors focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Terms of Service</a>
            <span className="text-[#D5A34A]/40">•</span>
            <a href="/shipping-policy" className="hover:text-[#F5BD48] transition-colors focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Shipping Policy</a>
            <span className="text-[#D5A34A]/40">•</span>
            <a href="/refund-policy" className="hover:text-[#F5BD48] transition-colors focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Refund Policy</a>
            <span className="text-[#D5A34A]/40">•</span>
            <a href="/contact" className="hover:text-[#F5BD48] transition-colors focus-visible:outline-hidden focus-visible:text-[#F5BD48]">Contact Us</a>
            <span className="text-[#D5A34A]/40">•</span>
            <a href="/about" className="hover:text-[#F5BD48] transition-colors focus-visible:outline-hidden focus-visible:text-[#F5BD48]">About Us</a>
            <span className="text-[#D5A34A]/40">•</span>
            <a href="https://wa.me/918309600721" target="_blank" rel="noopener noreferrer" className="hover:text-[#F5BD48] transition-colors focus-visible:outline-hidden focus-visible:text-[#F5BD48]">WhatsApp: 8309600721</a>
          </div>
        </div>

        <div className="text-[11px] text-[#94A3B8]/80 pt-2 border-t border-white/5">
          © 2026 {BUSINESS_CONFIG.brandName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
