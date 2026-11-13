'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext';
import {
  Search,
  Heart,
  Award,
  Truck,
  Gift,
  Sparkles,
  Menu,
  X,
  MapPin,
  Clock,
  Package,
  User,
  Home,
  ShieldCheck
} from 'lucide-react';
import { AuthModal } from './AuthModal';
import { notifyStorefrontAuthChanged } from '@/lib/auth/storefront-auth-events';

export const Header: React.FC = () => {
  const {
    mode,
    setMode,
    cart,
    wishlist,
    setActiveModal,
    searchQuery,
    setSearchQuery,
    currentPincode,
    setActiveCategory,
    activeCategory,
    setActiveOccasion,
    navigateToCatalog
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  const refreshAuthenticatedUser = useCallback(() => {
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setAuthenticatedUser(data.authenticated && data.user ? data.user : null);
      })
      .catch(() => setAuthenticatedUser(null));
  }, []);

  useEffect(() => {
    refreshAuthenticatedUser();
  }, [refreshAuthenticatedUser]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshAuthenticatedUser();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refreshAuthenticatedUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setSearchFocused(false);
      }
    };

    if (mobileMenuOpen || searchFocused) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, searchFocused]);

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Server-verified administrator roles (ADMIN or SUPER_ADMIN or STAFF)
  const isAdminUser = Boolean(
    authenticatedUser &&
      (authenticatedUser.role === 'ADMIN' ||
       authenticatedUser.role === 'SUPER_ADMIN' ||
       authenticatedUser.role === 'STAFF')
  );
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const el = document.getElementById('catalog-section');
    el?.scrollIntoView({ behavior: 'smooth' });
    setSearchFocused(false);
  };

  const trendingSearches = [
    'Personalized Gold Rim Mug',
    'Antique Brass Lantern',
    'Luxury Gift Hamper',
    'Soft Huggable Teddy Bear',
    'Designer Handbag & Watch',
    'Stationery & Planner Set'
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#08090B]/98 backdrop-blur-md border-b border-[#D5A34A]/25 shadow-[0_10px_35px_rgba(0,0,0,0.65)] transition-all">
      
      {/* ========================================================================= */}
      {/* 1. TOP ANNOUNCEMENT BAR — Refined Dark Luxury Surface                      */}
      {/* ========================================================================= */}
      <div className="bg-[#121316] border-b border-[#D5A34A]/20 text-xs text-[#CBD5E1] py-1.5 sm:py-2 px-4 sm:px-6 lg:px-8 overflow-visible relative z-30 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 min-w-0">
          
          {/* Left Announcement */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
            <span className="flex items-center gap-2 text-[11px] sm:text-xs font-medium text-[#CBD5E1] truncate">
              <Gift className="w-3.5 h-3.5 text-[#F5BD48] shrink-0" />
              <span className="truncate">
                Complimentary <strong className="text-[#F5BD48] font-semibold">24K Gold Personalization</strong> &amp; Hyderabad Insured Express Delivery
              </span>
            </span>
          </div>

          {/* Center Social Proof Badge */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-[#CBD5E1]/90 font-medium">
            <span className="text-[#F5BD48]">★</span>
            <span className="text-[#F1F5F9] font-semibold">4.9/5</span>
            <span className="text-[#CBD5E1]/80">(12K+ Happy Customers)</span>
          </div>

          {/* Right Utilities: Delivery PIN */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1.5 text-[#CBD5E1] text-[11px] sm:text-xs font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>
                Deliver to <strong className="text-[#F1F5F9]">{currentPincode || '500062'}</strong>
              </span>
              <span className="text-[10px] text-[#D5A34A]">▼</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN NAVIGATION CONTAINER — Spacious, Balanced & Aligned               */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 relative z-20">
        <div className="flex items-center justify-between gap-4 sm:gap-6 lg:gap-8">
          
          {/* Left: Original SNAPPY GIFTZ Logo Artwork (Visually Prominent) */}
          <div className="flex items-center shrink-0">
            <Link
              href="/"
              id="nav-home-logo"
              data-testid="nav-home-logo"
              onClick={() => {
                setMode('b2c');
                setActiveCategory('All');
                setActiveOccasion('All');
                setSearchQuery('');
              }}
              className="text-left group flex items-center py-0.5 focus:outline-hidden cursor-pointer"
              title="Snappy Giftz — Back to Storefront Home"
              aria-label="Snappy Giftz Home"
            >
              {/* Authentic Trimmed Artwork: Perfectly scaled without padding obstruction */}
              <img
                src="/assets/snappy-gifts.png"
                alt="Snappy Giftz — Turning Moments Into Memories"
                className="h-12 sm:h-14 md:h-15 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>
          </div>

          {/* Center: Refined Pill Search Bar with Trending Suggestions */}
          <div className="hidden md:flex flex-1 max-w-md lg:max-w-lg xl:max-w-xl relative">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder="Search personalized gifts, keepsakes, hampers..."
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 250)}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 sm:h-12 pl-5 pr-12 rounded-full border border-[#D5A34A]/30 bg-[#17181C] hover:bg-[#24252A]/70 focus:bg-[#17181C] text-xs sm:text-sm text-[#F1F5F9] placeholder-[#94A3B8] transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-[#D5A34A]/40 focus:border-[#D5A34A] shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-11 top-3 text-[#CBD5E1]/60 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#24252A] border border-[#D5A34A]/30 text-[#D5A34A] hover:bg-[#D5A34A] hover:text-[#08090B] flex items-center justify-center transition-all duration-200"
                aria-label="Submit search"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            {/* Trending Suggestions Popover */}
            {searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#17181C] rounded-2xl shadow-2xl border border-[#D5A34A]/35 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-[10px] font-bold text-[#D5A34A] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F5BD48]" />
                  <span>Trending Bespoke Curations</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {trendingSearches.map((term, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => {
                        setSearchQuery(term);
                        setSearchFocused(false);
                        const el = document.getElementById('catalog-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-xs px-3 py-1 rounded-full bg-[#24252A] hover:bg-[#D5A34A]/20 text-[#CBD5E1] hover:text-[#F5BD48] border border-[#D5A34A]/20 hover:border-[#D5A34A]/50 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Trust Badges & Action Buttons */}
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5">
            
            {/* Desktop Trust Pillars (Restrained & High-End) */}
            <div className="hidden xl:flex items-center gap-4 text-left border-r border-[#D5A34A]/20 pr-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#17181C] text-[#D5A34A] border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[10.5px] font-extrabold text-[#F1F5F9] uppercase tracking-tight">PREMIUM</div>
                  <div className="text-[9.5px] font-semibold text-[#D5A34A]">QUALITY</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#17181C] text-[#D5A34A] border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[10.5px] font-extrabold text-[#F1F5F9] uppercase tracking-tight">FAST &amp; SAFE</div>
                  <div className="text-[9.5px] font-semibold text-[#D5A34A]">DISPATCH</div>
                </div>
              </div>
            </div>

            {/* Direct Home Navigation Button */}
            <Link
              href="/"
              id="nav-home-desktop"
              data-testid="nav-home-desktop"
              onClick={() => {
                setMode('b2c');
                setActiveCategory('All');
                setActiveOccasion('All');
                setSearchQuery('');
              }}
              className="flex items-center gap-1.5 h-9 sm:h-10 px-4 rounded-full bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs transition-all shadow-md shadow-[#D5A34A]/20 hover:brightness-105 cursor-pointer group"
              title="Return to Starting Page / Storefront Home"
              aria-label="Return to Storefront Home"
            >
              <Home className="w-3.5 h-3.5 text-[#08090B]" />
              <span>Home</span>
            </Link>

            {/* Role-Based Admin Portal Navigation (ADMIN & SUPER_ADMIN) */}
            {isAdminUser && (
              <Link
                href="/admin"
                id="nav-admin-portal-desktop"
                data-testid="nav-admin-portal-desktop"
                className="flex items-center gap-1.5 h-10 sm:h-11 px-3.5 sm:px-4 rounded-full border border-[#D5A34A] bg-gradient-to-r from-[#D5A34A]/25 via-[#F5BD48]/20 to-[#D5A34A]/25 hover:bg-[#D5A34A]/35 text-[#F5BD48] hover:text-white text-xs font-bold transition-all shadow-md cursor-pointer group animate-in fade-in duration-200"
                title="Open Admin Operations Portal"
                aria-label="Admin Portal"
              >
                <ShieldCheck className="w-4 h-4 text-[#F5BD48] group-hover:scale-110 transition-transform" />
                <span>Admin Portal</span>
              </Link>
            )}

            {/* Track Order Direct Action */}
            <button
              type="button"
              onClick={() => setActiveModal('order_track')}
              className="hidden sm:flex items-center gap-1.5 h-10 sm:h-11 px-3.5 rounded-full border border-[#D5A34A]/35 bg-[#17181C] hover:bg-[#24252A] hover:border-[#D5A34A] text-[#CBD5E1] hover:text-[#F5BD48] text-xs font-semibold transition-all shadow-xs"
              title="Track Active Shipment"
              aria-label="Track Active Order"
            >
              <Package className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>Track Order</span>
            </button>

            {/* Wishlist Button */}
            <button
              type="button"
              onClick={() => {
                setMode('b2c');
                setActiveModal('wishlist');
              }}
              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-[#D5A34A]/25 bg-[#17181C] hover:border-[#D5A34A] hover:bg-[#24252A] flex items-center justify-center text-[#CBD5E1] hover:text-[#F5BD48] transition-all focus-gold"
              title="Saved Gifts Wishlist"
              aria-label={`View wishlist (${wishlist.length} saved gifts)`}
            >
              <Heart className="w-4 h-4" />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EC3E98] text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                  {wishlist.length}
                </span>
              )}
            </button>

            {/* Shopping Bag / Cart Trigger */}
            <button
              type="button"
              onClick={() => setActiveModal('cart')}
              className="flex items-center gap-2.5 h-10 sm:h-11 px-3 sm:px-3.5 rounded-full border border-[#D5A34A]/40 bg-[#17181C] hover:bg-[#24252A] hover:border-[#D5A34A] transition-all group focus:outline-hidden"
              title="View Shopping Bag"
              aria-label={`View shopping bag (${totalCartCount} items)`}
            >
              <div className="relative text-[#D5A34A] flex items-center justify-center">
                <Gift className="w-4 h-4 text-[#D5A34A] group-hover:scale-110 transition-transform" />
                {totalCartCount > 0 && (
                  <span className="absolute -top-2 -right-2.5 w-4 h-4 bg-[#EC3E98] text-white text-[9.5px] font-black rounded-full flex items-center justify-center shadow-md">
                    {totalCartCount}
                  </span>
                )}
              </div>
              <div className="text-left leading-tight hidden lg:block">
                <div className="text-[10.5px] font-extrabold text-[#D5A34A] uppercase tracking-tight group-hover:text-[#F5BD48]">
                  SHOPPING BAG
                </div>
                <div className="text-[9.5px] font-semibold text-[#CBD5E1]/80">
                  {totalCartCount} {totalCartCount === 1 ? 'Item' : 'Items'}
                </div>
              </div>
            </button>

            {/* User Account / Sign In Trigger */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              aria-label="Manage user account and active session"
              className="flex items-center gap-1.5 h-10 sm:h-11 px-3.5 sm:px-4 rounded-full border border-[#D5A34A]/40 bg-gradient-to-r from-[#24252A] to-[#17181C] hover:border-[#D5A34A] text-[#F1F5F9] hover:text-[#F5BD48] text-xs font-semibold transition-all shadow-xs"
              title="Account & Authentication"
            >
              <User className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span className="hidden sm:inline">
                {authenticatedUser ? authenticatedUser.name.split(' ')[0] : 'Sign In'}
              </span>
            </button>

            {/* Mobile Hamburger Drawer Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#CBD5E1] hover:text-[#F5BD48] focus:outline-hidden"
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-[#F5BD48]" /> : <Menu className="w-6 h-6" />}
            </button>

          </div>

        </div>

        {/* Mobile Search Bar Row (Clean, responsive) */}
        <div className="md:hidden mt-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              placeholder="Search bespoke gifts, hampers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-4 pr-10 rounded-full border border-[#D5A34A]/30 bg-[#17181C] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#D5A34A]"
            />
            <button
              type="submit"
              className="absolute right-3.5 top-2.5 text-[#D5A34A]"
              aria-label="Submit search"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. QUICK CATEGORY NAVIGATION STRIP — Distinct Level 3                      */}
      {/* ========================================================================= */}
      <div className="bg-[#17181C]/95 border-t border-[#D5A34A]/15 text-xs px-4 sm:px-6 lg:px-8 py-2.5 shadow-inner overflow-hidden w-full relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-4 no-scrollbar">
          
          {/* Category Quick Links */}
          <div className="flex items-center gap-3 sm:gap-5 text-[#CBD5E1] font-medium whitespace-nowrap text-[12px]">
            <Link
              href="/"
              id="nav-home-strip"
              data-testid="nav-home-strip"
              onClick={() => {
                setMode('b2c');
                setActiveCategory('All');
                setActiveOccasion('All');
                setSearchQuery('');
              }}
              className={`transition-all flex items-center gap-1.5 px-3.5 py-1 rounded-full border cursor-pointer font-bold ${
                activeCategory === 'All' && mode === 'b2c'
                  ? 'bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] border-[#F5BD48] shadow-xs'
                  : 'bg-[#24252A] text-white/90 border-[#D5A34A]/30 hover:border-[#D5A34A] hover:text-[#F5BD48]'
              }`}
              title="Return to Starting Page / Storefront Home"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
            <Link
              href="/blog"
              data-testid="nav-blog-strip"
              className="hover:text-[#F5BD48] transition-colors font-semibold cursor-pointer"
              title="Gift ideas, guides and stories"
            >
              Blog
            </Link>
            {isAdminUser && (
              <Link
                href="/admin"
                id="nav-admin-portal-strip"
                data-testid="nav-admin-portal-strip"
                className="transition-all flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#D5A34A] bg-[#D5A34A]/20 text-[#F5BD48] hover:bg-[#D5A34A]/30 text-[12px] font-bold shadow-xs cursor-pointer"
                title="Open Admin Operations Portal"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#F5BD48]" />
                <span>Admin Portal</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Personalized Gifts' })}
              className={`hover:text-[#F5BD48] transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'Personalized Gifts' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              <span className="text-[13px]">🖼️</span>
              <span>Personalized Keepsakes</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Home Decor' })}
              className={`hover:text-[#F5BD48] transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'Home Decor' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              <span className="text-[13px]">🏮</span>
              <span>Home Decor &amp; Lanterns</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Soft Toys' })}
              className={`hover:text-[#F5BD48] transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'Soft Toys' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              <span className="text-[13px]">🧸</span>
              <span>Soft Plush Hugs</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Luxury Gifts' })}
              className={`hover:text-[#F5BD48] transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'Luxury Gifts' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              <span className="text-[13px]">💎</span>
              <span>Luxury Accessories</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Gift Hampers' })}
              className={`hover:text-[#F5BD48] transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'Gift Hampers' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              <span className="text-[13px]">🎁</span>
              <span>Curated Gift Hampers</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Stationery & Desk' })}
              className={`hover:text-[#F5BD48] transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'Stationery & Desk' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              <span className="text-[13px]">✒️</span>
              <span>Stationery Essentials</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Personalized Gifts' })}
              className="hover:text-[#F5BD48] transition-colors flex items-center gap-1.5 cursor-pointer text-[#CBD5E1]"
            >
              <span className="text-[13px]">🌟</span>
              <span>Laser Engraved &amp; Dispatches</span>
            </button>
            <span className="text-[#CBD5E1]/60 px-1 cursor-pointer hover:text-[#F5BD48]">•••</span>
          </div>

          {/* Right Status Indicator */}
          <div className="hidden sm:flex items-center gap-3.5 whitespace-nowrap text-[11.5px] text-[#CBD5E1]/90 font-medium">
            <span className="flex items-center gap-1.5 text-[#CBD5E1]">
              <Clock className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>Laser Engraved &amp; Dispatched Nationwide</span>
            </span>
            <span className="text-[#D5A34A]/30">•</span>
            <button 
              type="button"
              onClick={() => setActiveModal('order_track')}
              className="text-[#D5A34A] font-bold hover:text-[#F5BD48] hover:underline flex items-center gap-1"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Track Parcel</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MOBILE NAVIGATION DRAWER (ACCESSIBLE, TOUCH-FRIENDLY & CLEAN)           */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div 
          role="region" 
          aria-label="Mobile Navigation" 
          className="md:hidden bg-[#17181C] border-b border-[#D5A34A]/25 p-4 space-y-4 animate-in slide-in-from-top-3 duration-200 relative z-35"
        >
          
          {/* Mobile Home Storefront Link */}
          <Link
            href="/"
            id="nav-home-mobile"
            data-testid="nav-home-mobile"
            onClick={() => {
              setMode('b2c');
              setActiveCategory('All');
              setActiveOccasion('All');
              setSearchQuery('');
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#08090B] bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] flex items-center justify-between shadow-sm cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              <span>Return to Storefront Home</span>
            </span>
            <span>→</span>
          </Link>

          <Link
            href="/blog"
            data-testid="nav-blog-mobile"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold text-white border border-[#D5A34A]/30 hover:border-[#D5A34A] flex items-center justify-between cursor-pointer"
          >
            <span>Blog &amp; Gift Guides</span>
            <span>→</span>
          </Link>

          {/* Mobile Admin Portal Link (ADMIN & SUPER_ADMIN) */}
          {isAdminUser && (
            <Link
              href="/admin"
              id="nav-admin-portal-mobile"
              data-testid="nav-admin-portal-mobile"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#854d0e] via-[#a16207] to-[#854d0e] border border-[#D5A34A] flex items-center justify-between shadow-md cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#F5BD48]" />
                <span>Admin Operations Portal</span>
              </span>
              <span className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded text-[#F5BD48] border border-[#D5A34A]/40 uppercase tracking-wider">
                ADMIN
              </span>
            </Link>
          )}

          {/* Quick Category List */}
          <div className="space-y-1">
            <div className="text-[10.5px] font-bold text-[#D5A34A] uppercase tracking-wider px-2 py-1">
              Curated Collections
            </div>
            {[
              { name: 'Personalized Keepsakes', key: 'Personalized Gifts' },
              { name: 'Home Decor & Lanterns', key: 'Home Decor' },
              { name: 'Soft Plush Hugs', key: 'Soft Toys' },
              { name: 'Luxury Accessories', key: 'Luxury Gifts' },
              { name: 'Curated Gift Hampers', key: 'Gift Hampers' },
              { name: 'Stationery Essentials', key: 'Stationery & Desk' }
            ].map((cat, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigateToCatalog({ category: cat.key });
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-[#24252A] text-[#F5BD48] border border-[#D5A34A]/30'
                    : 'text-[#CBD5E1] hover:text-[#F5BD48] hover:bg-[#24252A]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Mobile Utility Actions */}
          <div className="pt-2 border-t border-[#D5A34A]/15 flex items-center justify-between text-xs text-[#CBD5E1]">
            <button
              type="button"
              onClick={() => { setActiveModal('order_track'); setMobileMenuOpen(false); }}
              className="flex items-center gap-1.5 text-[#D5A34A] font-semibold"
            >
              <Package className="w-4 h-4" />
              <span>Track Parcel</span>
            </button>

            <button
              type="button"
              onClick={() => { setAuthModalOpen(true); setMobileMenuOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#24252A] border border-[#D5A34A]/35 text-[#F1F5F9] font-semibold"
            >
              <User className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>{authenticatedUser ? authenticatedUser.name.split(' ')[0] : 'Sign In'}</span>
            </button>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SECURE AUTH & PERSONA MODAL                                            */}
      {/* ========================================================================= */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => {
            setAuthModalOpen(false);
            refreshAuthenticatedUser();
          }}
          onAuthSuccess={(user) => {
            setAuthenticatedUser(user);
            notifyStorefrontAuthChanged(user ?? null);
            if (!user) refreshAuthenticatedUser();
          }}
        />
      )}

    </header>
  );
};
