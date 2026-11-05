'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Heart,
  Award,
  Truck,
  SlidersHorizontal,
  Gift,
  Building2,
  ChevronDown,
  Sparkles,
  Menu,
  X,
  MapPin,
  Clock,
  Package,
  User
} from 'lucide-react';
import { UserRole } from '../types';
import { AuthModal } from './AuthModal';

export const Header: React.FC = () => {
  const {
    mode,
    setMode,
    showToast,
    currentRole,
    setCurrentRole,
    cart,
    wishlist,
    setActiveModal,
    searchQuery,
    setSearchQuery,
    currentPincode,
    setActiveCategory,
    activeCategory,
    navigateToCatalog
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  const personaRef = useRef<HTMLDivElement>(null);

  // Close dropdowns and drawers on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (personaRef.current && !personaRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleMenuOpen(false);
        setMobileMenuOpen(false);
        setSearchFocused(false);
      }
    };

    if (roleMenuOpen || mobileMenuOpen || searchFocused) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [roleMenuOpen, mobileMenuOpen, searchFocused]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setAuthenticatedUser(data.user);
        } else {
          setAuthenticatedUser(null);
        }
      })
      .catch(() => setAuthenticatedUser(null));
  }, []);

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const isStaffOrAdmin = Boolean(authenticatedUser && (authenticatedUser.role === 'ADMIN' || authenticatedUser.role === 'STAFF'));

  const handleRoleSelect = (role: UserRole) => {
    if (role === 'admin' || role === 'warehouse_staff') {
      if (!isStaffOrAdmin && process.env.NODE_ENV === 'production') {
        showToast('Administrator authentication required to access Operations.', 'error');
        setRoleMenuOpen(false);
        return;
      }
      setCurrentRole(role);
      setRoleMenuOpen(false);
      setMode('admin');
    } else {
      setCurrentRole(role);
      setRoleMenuOpen(false);
      setMode('b2c');
    }
  };

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
      <div className="bg-[#17181C] border-b border-[#D5A34A]/15 text-xs text-[#CBD5E1] py-1.5 sm:py-2 px-4 sm:px-6 lg:px-8 overflow-visible relative z-30 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 min-w-0">
          
          {/* Left Announcement */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
            <span className="flex items-center gap-2 text-[11.5px] sm:text-xs font-medium text-[#CBD5E1] truncate">
              <Sparkles className="w-3.5 h-3.5 text-[#F5BD48] shrink-0 animate-pulse" />
              <span className="truncate">
                Complimentary <strong className="text-[#D5A34A] font-semibold">24K Gold Personalization</strong> &amp; Hyderabad Insured Express Delivery
              </span>
            </span>
          </div>

          {/* Right Utilities: Delivery PIN, Mode Controls & Persona Selector */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            
            {/* Delivery Pincode */}
            <div className="hidden sm:flex items-center gap-1.5 text-[#CBD5E1] text-[11.5px] font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>
                Deliver to <strong className="text-[#F1F5F9]">{currentPincode}</strong>
              </span>
            </div>

            <span className="hidden md:inline h-3.5 w-px bg-[#D5A34A]/25" />

            {/* Quick Mode Switcher (B2C Store / B2B Portal / Ops HQ) */}
            <div className="flex items-center gap-1 bg-[#24252A] p-0.5 rounded-full border border-[#D5A34A]/25 text-[11px]">
              <button
                type="button"
                onClick={() => setMode('b2c')}
                className={`px-3 py-0.5 rounded-full font-semibold transition-all duration-200 cursor-pointer ${
                  mode === 'b2c'
                    ? 'bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] shadow-xs'
                    : 'text-[#CBD5E1] hover:text-white'
                }`}
                title="B2C Retail Storefront"
              >
                B2C Store
              </button>
              {isStaffOrAdmin && (
                <button
                  type="button"
                  onClick={() => setMode('admin')}
                  className={`px-2.5 py-0.5 rounded-full font-semibold transition-all duration-200 cursor-pointer ${
                    mode === 'admin'
                      ? 'bg-[#EC3E98] text-white shadow-xs'
                      : 'text-[#CBD5E1] hover:text-white'
                  }`}
                  title="Warehouse & Ops Management"
                >
                  Ops
                </button>
              )}
            </div>

            {/* Persona Simulator Dropdown (Accessible, Z-Layer Managed & Unclipped) */}
            <div ref={personaRef} className="relative hidden md:block">
              <button
                type="button"
                id="persona-simulator-button"
                aria-haspopup="menu"
                aria-expanded={roleMenuOpen}
                aria-controls="persona-simulator-dropdown"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-[#D5A34A]/30 bg-[#24252A] text-[#CBD5E1] text-[11px] font-medium hover:border-[#D5A34A] hover:text-[#F5BD48] transition-colors focus-gold cursor-pointer"
                title="Simulate User Persona"
              >
                <SlidersHorizontal className="w-3 h-3 text-[#D5A34A]" />
                <span className="capitalize">{currentRole.replace('_', ' ')}</span>
                <ChevronDown className={`w-3 h-3 text-[#D5A34A]/70 transition-transform duration-200 ${roleMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {roleMenuOpen && (
                <div
                  id="persona-simulator-dropdown"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="persona-simulator-button"
                  className="absolute right-0 mt-2 w-64 rounded-xl bg-[#17181C] shadow-[0_16px_40px_rgba(0,0,0,0.85)] border border-[#D5A34A]/35 p-2 z-50 text-xs backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-2 py-1 text-[9px] font-bold text-[#D5A34A] uppercase tracking-widest border-b border-[#D5A34A]/15 pb-1 mb-1">
                    Simulate Persona
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleRoleSelect('b2c_customer')}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      currentRole === 'b2c_customer'
                        ? 'bg-[#24252A] text-[#F5BD48] font-bold border border-[#D5A34A]/40'
                        : 'text-[#CBD5E1] hover:bg-[#24252A]/60'
                    }`}
                  >
                    <span>Individual Retail Buyer</span>
                    <span className="text-[9px] bg-[#08090B] border border-[#D5A34A]/30 text-[#D5A34A] px-1.5 py-0.5 rounded font-mono">B2C</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleRoleSelect('admin')}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      currentRole === 'admin'
                        ? 'bg-[#24252A] text-[#F5BD48] font-bold border border-[#D5A34A]/40'
                        : 'text-[#CBD5E1] hover:bg-[#24252A]/60'
                    }`}
                  >
                    <span>Super Administrator</span>
                    <span className="text-[9px] bg-[#D5A34A]/20 border border-[#D5A34A]/40 text-[#F5BD48] px-1.5 py-0.5 rounded font-bold">HQ</span>
                  </button>
                </div>
              )}
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
            <button
              type="button"
              onClick={() => { setMode('b2c'); }}
              className="text-left group flex items-center py-0.5 focus:outline-hidden"
              title="Snappy Giftz — Back to Storefront"
              aria-label="Snappy Giftz Home"
            >
              {/* Authentic Trimmed Artwork: Perfectly scaled without padding obstruction */}
              <img
                src="/assets/snappy-gifts.png"
                alt="Snappy Giftz — Turning Moments Into Memories"
                className="h-12 sm:h-14 md:h-15 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </button>
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
              onClick={() => { setMode('b2c'); }}
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
          <div className="flex items-center gap-6 sm:gap-7 text-[#CBD5E1] font-medium whitespace-nowrap text-[12px]">
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Personalized Gifts' })}
              className={`hover:text-[#F5BD48] transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'Personalized Gifts' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>Personalized Keepsakes</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Home Decor' })}
              className={`hover:text-[#F5BD48] transition-colors cursor-pointer ${
                activeCategory === 'Home Decor' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              Home Decor &amp; Lanterns
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Soft Toys' })}
              className={`hover:text-[#F5BD48] transition-colors cursor-pointer ${
                activeCategory === 'Soft Toys' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              Soft Plush Hugs
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Luxury Gifts' })}
              className={`hover:text-[#F5BD48] transition-colors cursor-pointer ${
                activeCategory === 'Luxury Gifts' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              Luxury Accessories
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Gift Hampers' })}
              className={`hover:text-[#F5BD48] transition-colors cursor-pointer ${
                activeCategory === 'Gift Hampers' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              Curated Gift Hampers
            </button>
            <button
              type="button"
              onClick={() => navigateToCatalog({ category: 'Stationery & Desk' })}
              className={`hover:text-[#F5BD48] transition-colors cursor-pointer ${
                activeCategory === 'Stationery & Desk' ? 'text-[#F5BD48] font-bold' : ''
              }`}
            >
              Stationery Essentials
            </button>
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
          
          {/* Quick Mode Switches */}
          <div className="flex items-center justify-between bg-[#24252A] p-1 rounded-xl border border-[#D5A34A]/20 text-xs">
            <button
              type="button"
              onClick={() => { setMode('b2c'); setMobileMenuOpen(false); }}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mode === 'b2c' ? 'bg-[#D5A34A] text-[#08090B]' : 'text-[#CBD5E1]'
              }`}
            >
              Consumer Store
            </button>
            {isStaffOrAdmin && (
              <button
                type="button"
                onClick={() => { setMode('admin'); setMobileMenuOpen(false); }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  mode === 'admin' ? 'bg-[#EC3E98] text-white' : 'text-[#CBD5E1]'
                }`}
              >
                Ops HQ
              </button>
            )}
          </div>

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
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => setAuthenticatedUser(user)}
      />

    </header>
  );
};
