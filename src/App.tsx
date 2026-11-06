'use client';

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { ProductCard } from './components/ProductCard';
import { CustomizableProductCard } from './components/CustomizableProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { PersonalizationStudio } from './components/PersonalizationStudio';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { TaxInvoiceModal } from './components/TaxInvoiceModal';
import { Footer } from './components/Footer';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import {
  Sparkles,
  ChevronDown,
  Gift,
  Building2,
  Star,
  CheckCircle2,
  Clock,
  Heart,
  Crown,
  ShieldCheck,
  Award,
  Layers,
  Search,
  Filter,
  ArrowRight,
  X,
  Home
} from 'lucide-react';

const MainContent: React.FC = () => {
  const {
    mode,
    setMode,
    products,
    selectedProduct,
    setSelectedProduct,
    activeModal,
    setActiveModal,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    activeOccasion,
    setActiveOccasion,
    toast,
    addToCart,
    showToast
  } = useApp();

  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'newest'>('featured');
  const [visibleCount, setVisibleCount] = useState<number>(8);

  // Reset pagination when search or filters change
  React.useEffect(() => {
    setVisibleCount(8);
  }, [searchQuery, activeCategory, activeOccasion, sortBy]);

  // Filter products by category, occasion, and search query
  const filteredProducts = products.filter(p => {
    const matchesSearch = searchQuery === '' || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.occasion && p.occasion.some(o => o.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesOccasion = activeOccasion === 'All' || p.occasion.includes(activeOccasion);

    return matchesSearch && matchesCategory && matchesOccasion;
  });

  // Apply sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price_asc') return a.basePrice - b.basePrice;
    if (sortBy === 'price_desc') return b.basePrice - a.basePrice;
    if (sortBy === 'newest') return b.id.localeCompare(a.id);
    return (b.rating || 0) - (a.rating || 0);
  });

  // Separate sorted products into Customizable and Regular gift collections
  const customizableProducts = sortedProducts.filter(
    (p) => p.productType === 'CUSTOMIZABLE' || p.isCustomizable
  );
  const regularProducts = sortedProducts.filter(
    (p) => p.productType !== 'CUSTOMIZABLE' && !p.isCustomizable
  );

  const displayedProducts = sortedProducts.slice(0, visibleCount);

  const categories = [
    'All',
    'Personalized Gifts',
    'Home Decor',
    'Soft Toys',
    'Luxury Gifts',
    'Gift Hampers',
    'Festive Hampers',
    'Stationery & Desk'
  ];

  const occasions = [
    'All',
    'Birthday',
    'Anniversary',
    'Festival',
    'Diwali',
    'Wedding',
    'Valentine',
    'Farewell'
  ];

  const faqs = [
    {
      q: 'How does the laser engraving and hot-foil personalization process work?',
      a: 'Once you choose a personalized gift, you can type the recipient name or upload a company logo in our Live Personalization Studio. Our artisans in our SNAPPY GIFTZ Craft Studio preview the digital proof and engrave it using fiber-laser precision with zero fading, followed by complimentary gold-foil gift wrapping.'
    },
    {
      q: 'Do you offer guaranteed damage-free packaging in Hyderabad?',
      a: 'Yes! Every fragile keepsake, scented candle, ceramic piece, and lantern is cushioned in custom shock-absorbing materials inside our signature rigid boxes. If any item arrives damaged, report it within 24 hours with an unboxing video for an instant complimentary replacement.'
    },
    {
      q: 'How does personal gift customization and photo engraving work?',
      a: 'Our online Atelier Studio allows you to upload up to 3 high-resolution photos, enter custom names or dates in calligraphy fonts, and preview an authentic digital proof before ordering. Each piece is laser-engraved or artisan-printed in Hyderabad with extreme precision.'
    },
    {
      q: 'What is your Hyderabad delivery policy and shipping timeline?',
      a: 'We deliver directly across Hyderabad serviceable PIN codes with dedicated courier partners. Delivery charges are calculated based on your exact location and confirmed by our team. Handcrafted personalized gifts are dispatched within 24 to 48 hours.'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#08090B] text-[#F1F5F9] selection:bg-[#D5A34A]/30 selection:text-[#F5BD48]">
      
      {/* Toast Notification Banner (Top-Most Stacking Layer z-[100]) */}
      {toast && (
        <div className={`fixed bottom-20 right-4 sm:bottom-22 sm:right-6 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-300 motion-reduce:animate-none ${
          toast.type === 'error'
            ? 'bg-[#2A080C] text-[#FCA5A5] border border-rose-500/50'
            : toast.type === 'info'
            ? 'bg-[#17181C] text-[#CBD5E1] border border-[#D5A34A]/30'
            : 'bg-[#17181C] text-[#F5BD48] border border-[#D5A34A]/50 shadow-[0_10px_30px_rgba(0,0,0,0.6)]'
        }`}>
          <Sparkles className="w-4 h-4 text-[#F5BD48] shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Persistent Global Header */}
      <Header />

      {/* Storefront Main Content */}
      <main className="flex-1">
          {/* Hero Banner matching SNAPPY GIFTZ visual inspiration */}
          <HeroBanner />

          {/* Catalog & Search Section */}
          <section id="catalog-section" className="bg-[#08090B] text-[#F1F5F9] py-14 sm:py-20 border-b border-[#D5A34A]/15 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              
              {/* Catalogue Introduction */}
              <div className="text-center max-w-3xl mx-auto space-y-3 pt-2">
                <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-[#17181C] border border-[#D5A34A]/30 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5BD48] animate-pulse" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#D5A34A] uppercase tracking-[0.25em] font-sans">
                    THE SNAPPY COLLECTION
                  </span>
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                  Find Something <span className="text-gold-gradient italic font-serif">Extraordinary</span>
                </h2>
                <p className="text-sm sm:text-base text-[#CBD5E1] font-light leading-relaxed max-w-2xl mx-auto">
                  Thoughtfully curated gifts for every person, occasion and unforgettable moment.
                </p>
              </div>

              {/* Filter Pills for Categories */}
              <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 pt-1 max-w-full no-scrollbar px-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] font-bold shadow-[0_2px_12px_rgba(213,163,74,0.3)] border border-[#F5BD48]'
                        : 'bg-[#17181C] text-[#CBD5E1] hover:text-white hover:bg-[#24252A] border border-[#D5A34A]/20 hover:border-[#D5A34A]/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Occasion Filter Strip, Sort Control & Active Filters */}
              <div className="bg-[#17181C]/90 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-[#D5A34A]/25 p-3.5 sm:p-5 space-y-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 text-xs">
                  
                  {/* Occasion Filter Strip */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                    <span className="font-bold text-[#D5A34A] shrink-0 uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">
                      <Sparkles className="w-3 h-3 text-[#F5BD48]" />
                      <span>Occasion:</span>
                    </span>
                    {occasions.map((occ) => (
                      <button
                        key={occ}
                        type="button"
                        onClick={() => setActiveOccasion(occ)}
                        className={`px-3 py-1 rounded-full transition-all whitespace-nowrap text-xs font-medium cursor-pointer ${
                          activeOccasion === occ
                            ? 'bg-[#D5A34A] text-[#08090B] font-bold shadow-xs border border-[#F5BD48]'
                            : 'hover:text-[#F5BD48] bg-[#24252A]/80 hover:bg-[#2E3037] border border-[#D5A34A]/15 text-[#CBD5E1]'
                        }`}
                      >
                        {occ}
                      </button>
                    ))}
                  </div>

                  {/* Sort Dropdown & Results Counter */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#D5A34A]/15">
                    <div className="flex items-center gap-2">
                      <label htmlFor="product-sort" className="text-[10px] font-bold text-[#D5A34A] uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <Filter className="w-3 h-3 text-[#D5A34A]" />
                        <span>Sort:</span>
                      </label>
                      <select
                        id="product-sort"
                        aria-label="Sort catalog products"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-3.5 py-1.5 rounded-full border border-[#D5A34A]/30 bg-[#08090B] text-xs font-semibold text-[#F1F5F9] hover:border-[#D5A34A] focus:outline-hidden focus:ring-1 focus:ring-[#D5A34A] cursor-pointer"
                      >
                        <option value="featured" className="bg-[#17181C] text-white">Featured Curations</option>
                        <option value="price_asc" className="bg-[#17181C] text-white">Price: Low to High</option>
                        <option value="price_desc" className="bg-[#17181C] text-white">Price: High to Low</option>
                        <option value="newest" className="bg-[#17181C] text-white">Newest Additions</option>
                      </select>
                    </div>

                    <div className="text-[11px] sm:text-xs text-[#94A3B8] font-medium whitespace-nowrap">
                      Showing <strong className="text-[#F5BD48]">{Math.min(displayedProducts.length, sortedProducts.length)}</strong> of <strong className="text-white">{sortedProducts.length}</strong> gifts
                      {searchQuery && <span> for "<strong className="text-[#F5BD48]">{searchQuery}</strong>"</span>}
                    </div>
                  </div>

                </div>

                {/* Active Filter Indicators Bar */}
                {(activeCategory !== 'All' || activeOccasion !== 'All' || searchQuery !== '') && (
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#D5A34A]/15 flex-wrap text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Active:</span>
                      {activeCategory !== 'All' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D5A34A]/15 border border-[#D5A34A]/40 text-[#F5BD48] text-xs font-medium">
                          <span>Category: <strong>{activeCategory}</strong></span>
                          <button
                            type="button"
                            onClick={() => setActiveCategory('All')}
                            className="hover:text-white transition-colors cursor-pointer"
                            aria-label={`Clear ${activeCategory} category filter`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {activeOccasion !== 'All' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D5A34A]/15 border border-[#D5A34A]/40 text-[#F5BD48] text-xs font-medium">
                          <span>Occasion: <strong>{activeOccasion}</strong></span>
                          <button
                            type="button"
                            onClick={() => setActiveOccasion('All')}
                            className="hover:text-white transition-colors cursor-pointer"
                            aria-label={`Clear ${activeOccasion} occasion filter`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {searchQuery !== '' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EC3E98]/15 border border-[#EC3E98]/40 text-[#EC3E98] text-xs font-medium">
                          <span>Search: "<strong>{searchQuery}</strong>"</span>
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="hover:text-white transition-colors cursor-pointer"
                            aria-label="Clear search filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory('All');
                        setActiveOccasion('All');
                        setSearchQuery('');
                      }}
                      className="text-[11px] text-[#EC3E98] hover:text-[#f472b6] font-semibold underline underline-offset-2 transition-colors cursor-pointer ml-auto"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>

              {/* Products Grid */}
              {sortedProducts.length === 0 ? (
                <div className="text-center py-20 px-4 bg-[#17181C] rounded-3xl border border-[#D5A34A]/25 shadow-xl space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#24252A] text-[#F5BD48] flex items-center justify-center mx-auto border border-[#D5A34A]/30 shadow-inner">
                    <Gift className="w-8 h-8" />
                  </div>
                  <h3 className="font-serif font-bold text-xl sm:text-2xl text-white">
                    No matching gifts found
                  </h3>
                  <p className="text-xs sm:text-sm text-[#CBD5E1] max-w-md mx-auto leading-relaxed">
                    {searchQuery
                      ? `We couldn't find any gifts matching "${searchQuery}". Try browsing all categories or reset your active filters.`
                      : 'No gifts match the selected category and occasion combination. Reset filters to explore our full collection.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('All');
                      setActiveOccasion('All');
                      setSearchQuery('');
                    }}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] text-xs font-bold hover:shadow-[0_2px_16px_rgba(213,163,74,0.35)] transition-all cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <>
                <div className="space-y-16">
                  {/* Section B: Customizable Gifts ("Make It Personal") */}
                  {customizableProducts.length > 0 && (
                    <div id="customizable-gifts-section" className="space-y-6">
                      {/* Section B Header */}
                      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#17181C] via-[#1E2027] to-[#17181C] border border-[#D5A34A]/40 p-6 sm:p-8 md:p-10 shadow-[0_8px_32px_rgba(213,163,74,0.12)]">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5A34A]/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative z-10 max-w-3xl space-y-3">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#08090B] border border-[#D5A34A]/50 text-[#F5BD48] text-[10px] font-bold uppercase tracking-widest font-mono shadow-xs">
                            <Sparkles className="w-3 h-3 text-[#F5BD48] animate-pulse" />
                            <span>BESPOKE ATELIER • HANDCRAFTED CUSTOMIZATION</span>
                          </div>
                          <h3 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                            Make It <span className="text-gold-gradient italic font-serif">Personal</span>
                          </h3>
                          <p className="text-xs sm:text-sm md:text-base text-[#CBD5E1] font-light leading-relaxed">
                            Turn meaningful moments into unforgettable gifts. Add names, messages, photos and personal touches to make every gift uniquely yours.
                          </p>
                        </div>
                      </div>

                      {/* Section B Grid: Larger, Prominent Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {customizableProducts.slice(0, visibleCount).map((product) => (
                          <CustomizableProductCard
                            key={product.id}
                            product={product}
                            onOpenDetail={(prod) => {
                              setSelectedProduct(prod);
                              setActiveModal('product_detail');
                            }}
                            onOpenPersonalize={(prod) => {
                              setSelectedProduct(prod);
                              setActiveModal('personalize');
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section A: Regular Gifts */}
                  {regularProducts.length > 0 && (
                    <div id="regular-gifts-section" className="space-y-6 pt-10 border-t border-[#D5A34A]/20">
                      {/* Section A Header */}
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div>
                          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#D5A34A] uppercase tracking-wider font-mono mb-1">
                            <Gift className="w-3.5 h-3.5 text-[#D5A34A]" />
                            <span>READY-TO-SHIP CURATIONS</span>
                          </div>
                          <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            Regular Gifts &amp; Ready Hampers
                          </h3>
                          <p className="text-xs sm:text-sm text-[#94A3B8] font-light mt-1 max-w-xl">
                            Exquisite ready-to-ship artisanal hampers, luxury timepieces, and gourmet collections delivered without customization delays.
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-[#F5BD48] whitespace-nowrap bg-[#17181C] px-3.5 py-1.5 rounded-full border border-[#D5A34A]/25 self-start sm:self-auto">
                          {regularProducts.length} {regularProducts.length === 1 ? 'Gift' : 'Gifts'} Available
                        </span>
                      </div>

                      {/* Section A Grid: Standard Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
                        {regularProducts.slice(0, visibleCount).map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onOpenDetail={(prod) => {
                              setSelectedProduct(prod);
                              setActiveModal('product_detail');
                            }}
                            onOpenPersonalize={(prod) => {
                              setSelectedProduct(prod);
                              setActiveModal('personalize');
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                  {/* Pagination / Load More Button */}
                  {visibleCount < sortedProducts.length && (
                    <div className="text-center pt-8 sm:pt-10">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 8)}
                        className="px-8 py-3.5 rounded-full bg-[#17181C] hover:bg-[#24252A] border border-[#D5A34A]/40 hover:border-[#D5A34A] text-[#F5BD48] hover:text-white text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_4px_24px_rgba(213,163,74,0.2)] cursor-pointer inline-flex items-center gap-2"
                      >
                        <span>Load More Curated Gifts</span>
                        <span className="text-[#94A3B8] font-normal lowercase">({sortedProducts.length - visibleCount} remaining)</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#D5A34A]" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Artisan & Royal Heritage Featurette */}
          <section id="brand-story-section" className="bg-[#08090B] text-[#F1F5F9] py-16 sm:py-20 lg:py-24 border-y border-[#D5A34A]/20 relative overflow-hidden">
            {/* Ambient Lighting Gradients */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D5A34A]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#EC3E98]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D5A34A]/5 to-transparent animate-shimmer pointer-events-none" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* Left Story Column */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#17181C] border border-[#D5A34A]/30 text-[#D5A34A] text-xs font-mono uppercase tracking-wider shadow-xs">
                    <Crown className="w-3.5 h-3.5 text-[#F5BD48]" />
                    <span>The SNAPPY GIFTZ Artisan Charter</span>
                  </div>
                  
                  <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                    Every Gift Has a Soul, <br />
                    <span className="text-gold-gradient italic font-serif text-3xl sm:text-4xl md:text-5xl font-normal">
                      Every Box Tells a Story.
                    </span>
                  </h2>
                  
                  <p className="text-[#CBD5E1] text-sm sm:text-base leading-relaxed max-w-xl font-light">
                    At SNAPPY GIFTZ, our craft atelier fuses regional metalwork, glassware, and fine ceramic traditions with modern fiber-laser engraving technology. Whether it's a keepsake for your soulmate or a curated celebration hamper for loved ones, our master craftsmen hand-inspect each box before sealing.
                  </p>
                  
                  {/* Business Statistics Grid */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-6 border-t border-[#D5A34A]/20">
                    <div className="bg-[#17181C]/70 border border-[#D5A34A]/15 rounded-2xl p-3 sm:p-4 text-center shadow-xs">
                      <div className="font-serif font-bold text-2xl sm:text-3xl text-[#F5BD48]">50K+</div>
                      <div className="text-[#94A3B8] text-[10.5px] sm:text-xs mt-1 font-medium">Delighted Givers</div>
                    </div>
                    <div className="bg-[#17181C]/70 border border-[#D5A34A]/15 rounded-2xl p-3 sm:p-4 text-center shadow-xs">
                      <div className="font-serif font-bold text-2xl sm:text-3xl text-[#F5BD48]">1000+</div>
                      <div className="text-[#94A3B8] text-[10.5px] sm:text-xs mt-1 font-medium">Curated Designs</div>
                    </div>
                    <div className="bg-[#17181C]/70 border border-[#D5A34A]/15 rounded-2xl p-3 sm:p-4 text-center shadow-xs">
                      <div className="font-serif font-bold text-2xl sm:text-3xl text-[#F5BD48]">24K</div>
                      <div className="text-[#94A3B8] text-[10.5px] sm:text-xs mt-1 font-medium">PIN Codes Served</div>
                    </div>
                  </div>
                </div>

                {/* Right Quality Guarantee Card */}
                <div className="lg:col-span-5 bg-[#17181C]/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-[#D5A34A]/30 space-y-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-3 pb-4 border-b border-[#D5A34A]/20">
                    <div className="w-10 h-10 rounded-2xl bg-[#D5A34A]/15 border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48] shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[#D5A34A] tracking-wider font-mono">Pledge of Excellence</div>
                      <h3 className="font-serif font-bold text-base sm:text-lg text-white">The SNAPPY GIFTZ Quality Guarantee</h3>
                    </div>
                  </div>

                  <ul className="space-y-4 text-xs sm:text-sm text-[#CBD5E1]">
                    <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#D5A34A]/15 border border-[#D5A34A]/30 flex items-center justify-center shrink-0 mt-0.5 text-[#F5BD48]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span><strong className="text-white">Permanent Laser Engraving:</strong> Zero peeling or fading, lifetime readability.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#D5A34A]/15 border border-[#D5A34A]/30 flex items-center justify-center shrink-0 mt-0.5 text-[#F5BD48]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span><strong className="text-white">Confidential Discreet Outer Boxes:</strong> Zero price tags or invoices visible to recipient.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#D5A34A]/15 border border-[#D5A34A]/30 flex items-center justify-center shrink-0 mt-0.5 text-[#F5BD48]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span><strong className="text-white">Complete Transit Replacement:</strong> Instant dispatch if anything gets damaged in transit.</span>
                    </li>
                  </ul>
                  
                  <div className="pt-2 text-[11px] text-[#94A3B8] flex items-center gap-2 italic border-t border-[#D5A34A]/10">
                    <Sparkles className="w-3.5 h-3.5 text-[#D5A34A] shrink-0" />
                    <span>Every piece hand-inspected & sealed with wax proof emblem.</span>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* Customer Reviews & Social Proof */}
          <section id="reviews-section" className="bg-[#08090B] text-[#F1F5F9] py-16 sm:py-20 lg:py-24 border-b border-[#D5A34A]/15 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              {/* Reviews Header */}
              <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3">
                <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-[#17181C] border border-[#D5A34A]/30 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5BD48] animate-pulse" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#D5A34A] uppercase tracking-[0.25em] font-sans">
                    STORIES OF CELEBRATION
                  </span>
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                  Trusted by Over <span className="text-gold-gradient font-serif">50,000 Happy Families</span> Across Hyderabad
                </h2>
                <p className="text-xs sm:text-sm text-[#94A3B8] font-light max-w-xl mx-auto">
                  Authentic impressions from verified patrons across India celebrating cherished milestones.
                </p>
              </div>

              {/* 3 Review Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                
                {/* Review 1 */}
                <div className="p-7 sm:p-8 rounded-3xl bg-[#17181C] hover:bg-[#1E2025] border border-[#D5A34A]/20 hover:border-[#D5A34A]/50 shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_36px_rgba(213,163,74,0.12)] flex flex-col justify-between transition-all duration-500">
                  <div className="space-y-4">
                    <div className="flex gap-1 text-[#F5BD48]">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-[#F5BD48] text-[#F5BD48]" />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-[#CBD5E1] italic leading-relaxed font-light">
                      "Ordered the Royale Gold-rim ceramic mug set with custom engraving for my parents' 30th anniversary. The gold detailing and electric warmer were exquisite! Delivered on time in Jaipur with zero breakage."
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-[#D5A34A]/15 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">Dr. Meenakshi Rathore</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">Verified Gifting Buyer • Jaipur</div>
                    </div>
                    <span className="text-[10px] bg-[#D5A34A]/15 border border-[#D5A34A]/30 text-[#F5BD48] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Verified
                    </span>
                  </div>
                </div>

                {/* Review 2 */}
                <div className="p-7 sm:p-8 rounded-3xl bg-[#17181C] hover:bg-[#1E2025] border border-[#D5A34A]/20 hover:border-[#D5A34A]/50 shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_36px_rgba(213,163,74,0.12)] flex flex-col justify-between transition-all duration-500">
                  <div className="space-y-4">
                    <div className="flex gap-1 text-[#F5BD48]">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-[#F5BD48] text-[#F5BD48]" />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-[#CBD5E1] italic leading-relaxed font-light">
                      "Ordered customized anniversary gifts with personalized family photos and engraved messages. The craftsmanship and ₹20 gift wrap were stunning! Delivered safely right to our doorstep."
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-[#D5A34A]/15 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">Vikramaditya Roy</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">Banjara Hills, Hyderabad</div>
                    </div>
                    <span className="text-[10px] bg-[#D5A34A]/15 border border-[#D5A34A]/30 text-[#F5BD48] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Verified
                    </span>
                  </div>
                </div>

                {/* Review 3 */}
                <div className="p-7 sm:p-8 rounded-3xl bg-[#17181C] hover:bg-[#1E2025] border border-[#D5A34A]/20 hover:border-[#D5A34A]/50 shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_36px_rgba(213,163,74,0.12)] flex flex-col justify-between transition-all duration-500">
                  <div className="space-y-4">
                    <div className="flex gap-1 text-[#F5BD48]">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-[#F5BD48] text-[#F5BD48]" />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-[#CBD5E1] italic leading-relaxed font-light">
                      "The brass lantern and soy candle hamper had the most divine rose aroma! The handwritten wax seal card made my best friend cry tears of joy. Truly India's best bespoke gifting brand."
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-[#D5A34A]/15 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">Sneha Agarwal</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">Pune, Maharashtra</div>
                    </div>
                    <span className="text-[10px] bg-[#D5A34A]/15 border border-[#D5A34A]/30 text-[#F5BD48] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Verified
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* Frequently Asked Questions */}
          <section id="faq-section" className="bg-[#08090B] text-[#F1F5F9] py-16 sm:py-20 lg:py-24 border-b border-[#D5A34A]/15 relative">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              
              {/* FAQ Header */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-[#17181C] border border-[#D5A34A]/30 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5BD48] animate-pulse" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#D5A34A] uppercase tracking-[0.25em] font-sans">
                    CONCIERGE ASSISTANCE
                  </span>
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                  Frequently Asked <span className="text-gold-gradient font-serif">Questions</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#94A3B8] font-light max-w-lg mx-auto">
                  Everything you need to know about our handcrafted engraving, Hyderabad express delivery, and bespoke gift customization.
                </p>
              </div>

              {/* Accordion Panels */}
              <div className="space-y-4">
                {faqs.map((faq, idx) => {
                  const isOpen = activeFaq === idx;
                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${
                        isOpen
                          ? 'border-[#D5A34A]/50 bg-[#1C1E23] shadow-[0_6px_28px_rgba(213,163,74,0.08)]'
                          : 'border-[#D5A34A]/20 bg-[#17181C] hover:border-[#D5A34A]/40 hover:bg-[#1A1C20]'
                      }`}
                    >
                      <button
                        type="button"
                        id={`faq-btn-${idx}`}
                        aria-expanded={isOpen}
                        aria-controls={`faq-answer-${idx}`}
                        onClick={() => setActiveFaq(isOpen ? null : idx)}
                        className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 font-serif font-semibold text-sm sm:text-base text-white hover:text-[#F5BD48] transition-colors cursor-pointer"
                      >
                        <span className="pr-2">{faq.q}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 ${
                          isOpen
                            ? 'bg-[#D5A34A] text-[#08090B] border-[#F5BD48]'
                            : 'bg-[#24252A] text-[#D5A34A] border-[#D5A34A]/30'
                        }`}>
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isOpen && (
                        <div
                          id={`faq-answer-${idx}`}
                          role="region"
                          aria-labelledby={`faq-btn-${idx}`}
                          className="px-5 sm:px-6 pb-5 sm:pb-6 text-xs sm:text-sm text-[#CBD5E1] leading-relaxed border-t border-[#D5A34A]/15 pt-3.5 animate-in fade-in duration-300"
                        >
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </section>

        </main>

      {/* Global Modals Manager */}
      
      {/* 1. Cart Drawer */}
      {activeModal === 'cart' && (
        <CartDrawer
          onClose={() => setActiveModal('none')}
          onProceedToCheckout={() => setActiveModal('checkout')}
        />
      )}

      {/* 2. Checkout Modal */}
      {activeModal === 'checkout' && (
        <CheckoutModal
          onClose={() => setActiveModal('none')}
          onOrderSuccess={(ord) => {
            // Handled inside modal
          }}
        />
      )}

      {/* 3. Product Detail Modal */}
      {activeModal === 'product_detail' && selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setActiveModal('none')}
          onOpenPersonalize={(prod) => {
            setSelectedProduct(prod);
            setActiveModal('personalize');
          }}
        />
      )}

      {/* 4. Live Personalization Studio */}
      {activeModal === 'personalize' && selectedProduct && (
        <PersonalizationStudio
          product={selectedProduct}
          onClose={() => setActiveModal('none')}
          onSave={(customization) => {
            addToCart(selectedProduct, 1, customization);
            setActiveModal('none');
            showToast('Personalized bespoke gift added to your bag! 🎁');
          }}
        />
      )}

      {/* 5. Order Tracking Modal */}
      {activeModal === 'order_track' && (
        <OrderTrackingModal
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* 6. GST Tax Invoice Modal */}
      {activeModal === 'invoice_view' && (
        <TaxInvoiceModal
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Footer */}
      <Footer />

      {/* Floating WhatsApp Quick Contact Button */}
      <WhatsAppFloatingButton />

    </div>
  );
};

export { MainContent };

export default function App() {
  return <MainContent />;
}
