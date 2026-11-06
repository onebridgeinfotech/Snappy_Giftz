'use client';

import React from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import {
  Heart,
  Star,
  Sparkles,
  ShoppingBag,
  Clock,
  Crown,
  Eye,
  ArrowRight,
  CheckCircle2,
  Wand2,
} from 'lucide-react';

interface CustomizableProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  onOpenPersonalize: (product: Product) => void;
}

export const CustomizableProductCard: React.FC<CustomizableProductCardProps> = ({
  product,
  onOpenDetail,
  onOpenPersonalize,
}) => {
  const { wishlist, toggleWishlist, addToCart } = useApp();
  const isWishlisted = wishlist.includes(product.id);

  const discountPercent =
    product.mrp > product.basePrice
      ? Math.round(((product.mrp - product.basePrice) / product.mrp) * 100)
      : 0;

  return (
    <div className="group relative rounded-3xl bg-gradient-to-b from-[#17181C] to-[#0E1015] hover:from-[#1D1F25] hover:to-[#12141A] border-2 border-[#D5A34A]/30 hover:border-[#F5BD48]/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_48px_rgba(213,163,74,0.22)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
      
      {/* 1. Large Luxury Image Container */}
      <div
        className="relative aspect-4/3 w-full overflow-hidden bg-[#0A0B0E] cursor-pointer"
        onClick={() => onOpenDetail(product)}
      >
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />

        {/* Ambient Dark/Gold Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1015] via-transparent to-black/40 opacity-80 group-hover:opacity-50 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex flex-col gap-1.5 items-start">
            <span className="bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Sparkles className="w-3 h-3 text-[#08090B]" />
              <span>Make It Personal</span>
            </span>
            {product.badge && (
              <span className="bg-[#08090B]/90 backdrop-blur-md text-[#F5BD48] text-[9px] font-bold px-2 py-0.5 rounded-md border border-[#D5A34A]/40 uppercase tracking-widest font-mono">
                {product.badge}
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className={`w-9 h-9 rounded-full bg-[#08090B]/85 hover:bg-[#24252A] backdrop-blur-md flex items-center justify-center border transition-all z-10 transform active:scale-90 pointer-events-auto cursor-pointer ${
              isWishlisted
                ? 'border-[#EC3E98] text-[#EC3E98] shadow-[0_0_12px_rgba(236,62,152,0.4)]'
                : 'border-[#D5A34A]/40 text-[#CBD5E1] hover:text-[#EC3E98] hover:border-[#EC3E98]/60'
            }`}
          >
            <Heart
              className={`w-4 h-4 transition-transform ${
                isWishlisted ? 'fill-[#EC3E98] text-[#EC3E98] scale-110' : ''
              }`}
            />
          </button>
        </div>

        {/* Bottom Feature Tags Overlay */}
        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#08090B]/90 backdrop-blur-md border border-[#D5A34A]/35 text-[10px] font-medium text-[#F5BD48]">
            <Wand2 className="w-3 h-3 text-[#D5A34A]" />
            <span>Engraving • Names • Photos • Notes</span>
          </div>
        </div>
      </div>

      {/* 2. Card Content Area */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Category & Rating */}
          <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
            <span className="font-bold text-[#D5A34A] text-[10.5px] uppercase tracking-widest font-sans">
              {product.category}
            </span>
            <div className="flex items-center gap-1 bg-[#1A1D24] border border-[#D5A34A]/30 px-2 py-0.5 rounded-full text-[#F5BD48] font-bold text-[11px] shrink-0 font-mono">
              <Star className="w-3 h-3 fill-[#F5BD48] text-[#F5BD48]" />
              <span>{product.rating}</span>
              <span className="text-[#94A3B8] font-normal text-[10px]">({product.reviewsCount})</span>
            </div>
          </div>

          {/* Product Title */}
          <h3
            onClick={() => onOpenDetail(product)}
            className="font-serif font-bold text-lg sm:text-xl text-white hover:text-[#F5BD48] line-clamp-1 cursor-pointer transition-colors leading-snug"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Tagline / Subtitle */}
          <p className="text-xs text-[#CBD5E1] line-clamp-2 leading-relaxed mt-1.5 min-h-[2.25rem]">
            {product.tagline || product.description}
          </p>

          {/* Dispatch indicator */}
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
            <Clock className="w-3 h-3 text-[#D5A34A]" />
            <span>Handcrafted in Hyderabad • Atelier dispatch in {product.estimatedDispatchDays} days</span>
          </div>
        </div>

        {/* Pricing & CTA Controls */}
        <div className="pt-4 border-t border-[#D5A34A]/20 space-y-3 mt-auto">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-serif font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-[#F5BD48] to-[#D5A34A]">
                ₹{product.basePrice.toLocaleString('en-IN')}
              </span>
              {product.mrp > product.basePrice && (
                <>
                  <span className="text-xs text-[#64748B] line-through">
                    ₹{product.mrp.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    Save {discountPercent}%
                  </span>
                </>
              )}
            </div>
            <span className="text-[10px] text-[#D5A34A] font-semibold uppercase tracking-wider">
              Customization Included
            </span>
          </div>

          {/* Action Buttons: Personalize Your Gift (Primary) + Quick View */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenDetail(product)}
              className="py-2.5 px-3 rounded-xl bg-[#1A1D24] hover:bg-[#252830] border border-[#D5A34A]/30 hover:border-[#D5A34A] text-white hover:text-[#F5BD48] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>Quick View</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenPersonalize(product)}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#E2AC3E] to-[#D5A34A] hover:brightness-110 text-[#08090B] text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_16px_rgba(213,163,74,0.35)] cursor-pointer tracking-wide"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#08090B]" />
              <span>Personalize</span>
              <ArrowRight className="w-3 h-3 text-[#08090B]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

