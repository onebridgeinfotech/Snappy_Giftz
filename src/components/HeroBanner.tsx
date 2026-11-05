import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  Lock,
  RefreshCw,
  Award,
  Crown,
  Gift,
  CheckCircle2,
  Sliders,
  Compass,
  Star,
  Cake,
  Heart,
  Briefcase,
  Users
} from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const { setMode, setActiveCategory, setActiveOccasion, setSearchQuery, navigateToCatalog } = useApp();

  const [conciergeRecipient, setConciergeRecipient] = useState<string>('All');
  const [conciergeOccasion, setConciergeOccasion] = useState<string>('Anniversary');

  const scrollToCatalog = () => {
    navigateToCatalog();
  };

  const handleOccasionClick = (occ: string) => {
    navigateToCatalog({ occasion: occ });
  };

  const handleCategoryClick = (catKey: string) => {
    navigateToCatalog({ category: catKey });
  };

  const handleConciergeSubmit = () => {
    navigateToCatalog({
      occasion: conciergeOccasion !== 'All' ? conciergeOccasion : undefined
    });
  };

  // 6 Curated Categories matching Stage 3 requirement:
  // Personalized Keepsakes, Home Decor & Lanterns, Soft Plush Hugs, Luxury Accessories, Curated Gift Hampers, Stationery Essentials
  const categories = [
    {
      title: 'Personalized Keepsakes',
      subtitle: 'Bespoke 24K Engraved',
      categoryKey: 'Personalized Gifts',
      image: '/assets/categories/personalized.jpg',
      icon: '✨',
    },
    {
      title: 'Home Decor & Lanterns',
      subtitle: 'Warm Ambiance & Brass',
      categoryKey: 'Home Decor',
      image: '/assets/categories/homedecor.jpg',
      icon: '🏮',
    },
    {
      title: 'Soft Plush Hugs',
      subtitle: 'Hypoallergenic Keepsakes',
      categoryKey: 'Soft Toys',
      image: '/assets/categories/softtoys.jpg',
      icon: '🧸',
    },
    {
      title: 'Luxury Accessories',
      subtitle: 'Artisan Heritage Style',
      categoryKey: 'Luxury Gifts',
      image: '/assets/categories/accessories.jpg',
      icon: '👑',
    },
    {
      title: 'Curated Gift Hampers',
      subtitle: 'Festive & Gourmet Baskets',
      categoryKey: 'Gift Hampers',
      image: '/assets/categories/hampers.jpg',
      icon: '🎁',
    },
    {
      title: 'Stationery Essentials',
      subtitle: 'Executive Desk & Journal',
      categoryKey: 'Stationery & Desk',
      image: '/assets/categories/stationery.jpg',
      icon: '✒️',
    }
  ];

  // 8 Occasions matching Stage 2 requirement:
  // Birthday, Anniversary, Wedding, Kids, Baby Shower, Festival, Corporate Gifts, Personalized Gifts
  const occasionItems = [
    {
      name: 'Birthday',
      tagline: 'Milestones & Joy',
      emoji: '🎂',
      filterType: 'occasion' as const,
      filterValue: 'Birthday',
    },
    {
      name: 'Anniversary',
      tagline: 'Love & Togetherness',
      emoji: '💍',
      filterType: 'occasion' as const,
      filterValue: 'Anniversary',
    },
    {
      name: 'Wedding',
      tagline: 'Sacred Beginnings',
      emoji: '💒',
      filterType: 'occasion' as const,
      filterValue: 'Wedding',
    },
    {
      name: 'Kids',
      tagline: 'Plush & Playful Hugs',
      emoji: '🧸',
      filterType: 'category' as const,
      filterValue: 'Soft Toys',
    },
    {
      name: 'Baby Shower',
      tagline: 'Precious Arrivals',
      emoji: '🍼',
      filterType: 'occasion' as const,
      filterValue: 'Baby Shower',
    },
    {
      name: 'Festival',
      tagline: 'Diwali & Celebrations',
      emoji: '🪔',
      filterType: 'occasion' as const,
      filterValue: 'Diwali',
    },
    {
      name: 'Housewarming',
      tagline: 'New Home Blessings',
      emoji: '🏡',
      filterType: 'occasion' as const,
      filterValue: 'Housewarming',
    },
    {
      name: 'Personalized Gifts',
      tagline: '24K Gold Inscribed',
      emoji: '✨',
      filterType: 'category' as const,
      filterValue: 'Personalized Gifts',
    },
  ];

  const handleOccasionSelect = (item: typeof occasionItems[0]) => {
    if (item.filterType === 'category') {
      navigateToCatalog({ category: item.filterValue, occasion: 'All', query: '' });
    } else {
      navigateToCatalog({ category: 'All', occasion: item.filterValue, query: '' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-[#08090B] pt-4 pb-0">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ========================================================= */}
        {/* 1. MAIN HERO BANNER — Cinematic Dark Luxury Experience    */}
        {/* ========================================================= */}
        <div className="relative rounded-3xl overflow-hidden border border-[#D5A34A]/25 bg-[#08090B] shadow-[0_25px_60px_rgba(0,0,0,0.85)] min-h-[540px] lg:min-h-[620px] flex items-center mb-8">
          
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(213,163,74,0.08),transparent_65%)] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#08090B] via-[#08090B]/95 to-transparent z-1 pointer-events-none hidden md:block" />

          {/* Desktop & Tablet Cinematic Background Photography (Right-Anchored) */}
          <div className="hidden md:block absolute right-0 top-0 bottom-0 w-7/12 z-0">
            <img
              src="/assets/hero_dark_luxury_gift.jpg"
              alt="Snappy Giftz Handcrafted Luxury Gift Box"
              className="w-full h-full object-cover object-center transform scale-100 hover:scale-[1.02] transition-transform duration-1000 ease-out"
            />
            {/* Smooth Left Vignette Fade into Midnight Black */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#08090B] via-[#08090B]/75 via-25% to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#08090B]/90 via-transparent to-[#08090B]/40 pointer-events-none" />
          </div>

          {/* Foreground Hero Content Container */}
          <div className="relative z-10 w-full p-5 sm:p-7 md:p-8 lg:p-12">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center">
              
              {/* Left Column: Brand Eyebrow, Editorial Headline & Actions */}
              <div className="md:col-span-7 space-y-4 md:space-y-5 max-w-xl">
                
                {/* Brand Eyebrow */}
                <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-[#17181C]/90 border border-[#D5A34A]/35 text-[#D5A34A] text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] shadow-xs backdrop-blur-xs">
                  <Sparkles className="w-3.5 h-3.5 text-[#F5BD48]" />
                  <span>TURNING MOMENTS INTO MEMORIES</span>
                </div>

                {/* Editorial Headline with Gold Highlight */}
                <h1 className="font-serif font-black text-3xl sm:text-4xl md:text-3xl lg:text-5xl xl:text-6xl text-[#F1F5F9] tracking-tight leading-[1.1] drop-shadow-sm">
                  Thoughtful{' '}
                  <span className="bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#F5BD48] bg-clip-text text-transparent">
                    Gifts
                  </span>{' '}
                  for Every{' '}
                  <span className="italic font-normal font-serif bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] bg-clip-text text-transparent">
                    Moment
                  </span>
                </h1>

                {/* Supporting Description */}
                <p className="text-[#CBD5E1] text-xs sm:text-sm lg:text-base leading-relaxed font-sans max-w-lg">
                  Discover bespoke handcrafted keepsakes, luxury hampers, and laser-engraved treasures curated to celebrate life’s most cherished milestones.
                </p>

                {/* Action CTAs */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
                  
                  {/* Primary CTA: Shop Now */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('All');
                      setActiveOccasion('All');
                      if (setSearchQuery) setSearchQuery('');
                      scrollToCatalog();
                    }}
                    className="group bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] hover:from-[#F5BD48] hover:to-[#D5A34A] text-[#08090B] font-bold px-6 sm:px-8 py-3 sm:py-3.5 lg:py-4 rounded-full shadow-lg shadow-[#D5A34A]/20 flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    <span>Shop Now</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* Secondary CTA: Explore Collections */}
                  <button
                    type="button"
                    onClick={scrollToCatalog}
                    className="px-5 sm:px-7 py-3 sm:py-3.5 lg:py-4 rounded-full bg-[#17181C] hover:bg-[#24252A] border border-[#D5A34A]/30 hover:border-[#D5A34A] text-[#F1F5F9] hover:text-[#F5BD48] font-semibold text-xs sm:text-sm tracking-wide transition-all duration-300 cursor-pointer"
                  >
                    <span>Explore Collections</span>
                  </button>

                </div>

                {/* Trust Indicators below buttons */}
                <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] sm:text-[11.5px] text-[#CBD5E1]">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D5A34A] shrink-0" />
                    <span>Complimentary 24K Gold Inscription</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D5A34A] shrink-0" />
                    <span>Insured Express Nationwide Delivery</span>
                  </div>
                </div>

              </div>

              {/* Mobile Dedicated Gift Box Image (Displayed below headline on phones only) */}
              <div className="block md:hidden w-full">
                <div className="relative rounded-2xl overflow-hidden border border-[#D5A34A]/25 aspect-[16/10] shadow-xl">
                  <img
                    src="/assets/hero_dark_luxury_gift.jpg"
                    alt="Snappy Giftz Handcrafted Luxury Gift Box"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08090B]/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute top-3 left-3 bg-[#08090B]/85 backdrop-blur-md px-3 py-1 rounded-full border border-[#D5A34A]/40 text-[10px] font-bold text-[#F5BD48] flex items-center gap-1.5 shadow-md">
                    <Sparkles className="w-3 h-3 text-[#D5A34A]" />
                    <span>Artisan Bespoke Box</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Floating Occasion Selector Panel */}
              <div className="md:col-span-5 flex justify-center md:justify-end">
                <div className="w-full max-w-sm sm:max-w-md lg:max-w-xs xl:max-w-sm rounded-2xl bg-[#17181C]/95 backdrop-blur-md border border-[#D5A34A]/35 shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden transform hover:-translate-y-1 transition-all duration-300">
                  
                  {/* Floating Panel Header: "Find the Perfect Gift" */}
                  <div className="bg-[#24252A] border-b border-[#D5A34A]/20 py-2.5 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#F5BD48]" />
                      <span className="text-xs font-bold tracking-wider text-[#F1F5F9] uppercase">
                        Find the Perfect Gift
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-[#D5A34A] tracking-wider uppercase">
                      Curated
                    </span>
                  </div>

                  {/* 8 Occasion Items Grid */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-[#17181C]/90">
                    {occasionItems.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleOccasionSelect(item)}
                        aria-label={`Find gifts for ${item.name}`}
                        className="group flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-[#24252A]/60 hover:bg-[#D5A34A]/15 border border-[#D5A34A]/15 hover:border-[#D5A34A]/60 text-left transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[#D5A34A]"
                      >
                        <span className="w-7 h-7 rounded-lg bg-[#17181C] border border-[#D5A34A]/25 flex items-center justify-center text-sm group-hover:scale-110 transition-transform shrink-0">
                          {item.emoji}
                        </span>
                        <div className="leading-tight overflow-hidden">
                          <div className="text-[11.5px] font-semibold text-[#F1F5F9] group-hover:text-[#F5BD48] transition-colors truncate">
                            {item.name}
                          </div>
                          <div className="text-[9.5px] text-[#CBD5E1]/70 truncate">
                            {item.tagline}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Panel Footer Prompt */}
                  <div className="py-2 px-3.5 bg-[#24252A]/50 border-t border-[#D5A34A]/15 flex items-center justify-between text-[10.5px] text-[#CBD5E1]">
                    <span className="flex items-center gap-1.5">
                      <Gift className="w-3 h-3 text-[#D5A34A]" />
                      <span>Ready for dispatch</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory('All');
                        setActiveOccasion('All');
                        if (setSearchQuery) setSearchQuery('');
                        scrollToCatalog();
                      }}
                      className="text-[#D5A34A] hover:text-[#F5BD48] font-bold hover:underline"
                    >
                      View All →
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* 2. 6 CATEGORIES STRIP — Dark Luxury Grid                  */}
        {/* ========================================================= */}
        <div className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {categories.map((cat, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleCategoryClick(cat.categoryKey)}
                aria-label={`Explore ${cat.title} collection`}
                className="group relative flex flex-col items-center text-center p-3 sm:p-3.5 rounded-2xl bg-[#17181C] hover:bg-[#24252A] border border-[#D5A34A]/25 hover:border-[#D5A34A]/70 shadow-[0_8px_25px_rgba(0,0,0,0.5)] hover:shadow-[0_15px_35px_rgba(213,163,74,0.15)] transition-all duration-300 transform hover:-translate-y-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#D5A34A] cursor-pointer"
              >
                {/* Product/Category Photography on Dark Obsidian Backdrop */}
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[#08090B] mb-2.5 border border-[#D5A34A]/15 group-hover:border-[#D5A34A]/40 transition-colors">
                  <img
                    src={cat.image}
                    alt={cat.title}
                    className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08090B]/60 via-transparent to-transparent pointer-events-none group-hover:opacity-75 transition-opacity" />
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#08090B]/85 border border-[#D5A34A]/30 backdrop-blur-xs flex items-center justify-center text-xs opacity-90 group-hover:scale-110 transition-transform">
                    {cat.icon}
                  </span>
                </div>
                
                {/* Category Title in Elegant Gold Typography */}
                <h3 className="font-serif font-bold text-xs sm:text-[12.5px] text-[#F1F5F9] group-hover:text-[#F5BD48] transition-colors uppercase tracking-tight leading-snug">
                  {cat.title}
                </h3>
                
                {/* Category Subtitle in Script / Italic style */}
                <p className="text-[10px] sm:text-[10.5px] text-[#D5A34A]/90 italic font-serif mt-0.5 line-clamp-1 group-hover:text-[#F5BD48]/90 transition-colors">
                  {cat.subtitle}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. 5 TRUST ASSURANCE PILLARS — Dark Luxury Surface        */}
        {/* ========================================================= */}
        <div className="rounded-2xl bg-[#17181C] border border-[#D5A34A]/25 p-4 sm:p-5 lg:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] mb-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-5 divide-y md:divide-y-0 md:divide-x divide-[#D5A34A]/15">
            
            {/* Pillar 1: Premium Quality */}
            <div className="flex items-center gap-3 px-2 pt-2 md:pt-0">
              <div className="w-10 h-10 rounded-full bg-[#24252A] text-[#D5A34A] border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 text-[#F5BD48]" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] sm:text-xs font-black text-[#F1F5F9] uppercase tracking-tight">
                  PREMIUM
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-[#D5A34A] uppercase tracking-wider">
                  QUALITY PRODUCTS
                </div>
              </div>
            </div>

            {/* Pillar 2: Carefully Handpicked */}
            <div className="flex items-center gap-3 px-2 pt-2 md:pt-0">
              <div className="w-10 h-10 rounded-full bg-[#24252A] text-[#D5A34A] border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
                <HeartHandshake className="w-4 h-4 text-[#F5BD48]" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] sm:text-xs font-black text-[#F1F5F9] uppercase tracking-tight">
                  CAREFULLY
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-[#D5A34A] uppercase tracking-wider">
                  HANDPICKED
                </div>
              </div>
            </div>

            {/* Pillar 3: Safe & Secure Payments */}
            <div className="flex items-center gap-3 px-2 pt-2 md:pt-0">
              <div className="w-10 h-10 rounded-full bg-[#24252A] text-[#D5A34A] border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-[#F5BD48]" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] sm:text-xs font-black text-[#F1F5F9] uppercase tracking-tight">
                  SAFE &amp; SECURE
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-[#D5A34A] uppercase tracking-wider">
                  PAYMENTS
                </div>
              </div>
            </div>

            {/* Pillar 4: Easy Returns */}
            <div className="flex items-center gap-3 px-2 pt-2 md:pt-0">
              <div className="w-10 h-10 rounded-full bg-[#24252A] text-[#D5A34A] border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-[#F5BD48]" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] sm:text-xs font-black text-[#F1F5F9] uppercase tracking-tight">
                  EASY RETURNS
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-[#D5A34A] uppercase tracking-wider">
                  HASSLE FREE
                </div>
              </div>
            </div>

            {/* Pillar 5: 100% Customer Satisfaction */}
            <div className="flex items-center gap-3 px-2 pt-2 md:pt-0 col-span-2 md:col-span-1">
              <div className="w-10 h-10 rounded-full bg-[#24252A] text-[#D5A34A] border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#F5BD48]" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] sm:text-xs font-black text-[#F1F5F9] uppercase tracking-tight">
                  100% CUSTOMER
                </div>
                <div className="text-[9.5px] sm:text-[10px] font-semibold text-[#D5A34A] uppercase tracking-wider">
                  SATISFACTION
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 4. PROMOTIONAL TICKER — Refined Continuous Gold Ribbon    */}
      {/* ========================================================= */}
      <div className="w-full bg-[#17181C] border-y border-[#D5A34A]/25 py-2.5 sm:py-3 overflow-hidden shadow-md">
        <div className="animate-marquee-smooth flex items-center gap-8 whitespace-nowrap text-xs font-bold tracking-wider uppercase">
          
          {/* Ticker Sequence A */}
          <div className="flex items-center gap-8 shrink-0 text-[#CBD5E1]">
            <span className="flex items-center gap-2 text-[#F1F5F9]">
              <Gift className="w-3.5 h-3.5 text-[#F5BD48]" />
              <span>GIFT MORE, WORRY LESS</span>
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
            <span className="font-serif tracking-[0.22em] text-sm font-black text-[#D5A34A]">
              SNAPPYGIFTZ.COM
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
            <span className="flex items-center gap-2 text-[#CBD5E1]">
              <Sparkles className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>BECAUSE MEMORIES DESERVE THE BEST</span>
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
            <span className="text-[#F5BD48]">
              COMPLIMENTARY 24K GOLD INSCRIPTION
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
            <span className="text-[#CBD5E1]">
              PAN-INDIA INSURED EXPRESS DISPATCH
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
          </div>

          {/* Ticker Sequence B (Exact duplicate for seamless continuous infinite loop) */}
          <div className="flex items-center gap-8 shrink-0 text-[#CBD5E1]" aria-hidden="true">
            <span className="flex items-center gap-2 text-[#F1F5F9]">
              <Gift className="w-3.5 h-3.5 text-[#F5BD48]" />
              <span>GIFT MORE, WORRY LESS</span>
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
            <span className="font-serif tracking-[0.22em] text-sm font-black text-[#D5A34A]">
              SNAPPYGIFTZ.COM
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
            <span className="flex items-center gap-2 text-[#CBD5E1]">
              <Sparkles className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>BECAUSE MEMORIES DESERVE THE BEST</span>
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
            <span className="text-[#F5BD48]">
              COMPLIMENTARY 24K GOLD INSCRIPTION
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
            <span className="text-[#CBD5E1]">
              PAN-INDIA INSURED EXPRESS DISPATCH
            </span>
            <span className="text-[#D5A34A]/40 font-mono">✦</span>
          </div>

        </div>
      </div>

    </section>
  );
};
