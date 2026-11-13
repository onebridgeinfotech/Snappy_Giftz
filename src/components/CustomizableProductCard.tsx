'use client';

import React from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { Heart, Star, Sparkles, Clock, Eye, ArrowRight, Wand2 } from 'lucide-react';

interface CustomizableProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  onOpenPersonalize: (product: Product) => void;
  /**
   * 'grid' (default): vertical card on tablet/desktop, compact horizontal card on phones.
   * 'list': horizontal card (photo left, details right) on every screen size.
   */
  layout?: 'grid' | 'list';
}

export const CustomizableProductCard: React.FC<CustomizableProductCardProps> = ({
  product,
  onOpenDetail,
  onOpenPersonalize,
  layout = 'grid',
}) => {
  const { wishlist, toggleWishlist } = useApp();
  const isWishlisted = wishlist.includes(product.id);
  const isList = layout === 'list';

  const discountPercent =
    product.mrp > product.basePrice
      ? Math.round(((product.mrp - product.basePrice) / product.mrp) * 100)
      : 0;
  const hasReviews = (product.reviewsCount || 0) > 0 && (product.rating || 0) > 0;

  // Horizontal on phones in grid mode; horizontal everywhere in list mode.
  const shell = isList ? 'flex-row' : 'flex-row sm:flex-col';
  const media = isList
    ? 'w-[38%] sm:w-56 md:w-64 shrink-0 self-stretch min-h-[170px]'
    : 'w-[38%] sm:w-full shrink-0 self-stretch min-h-[170px] sm:min-h-0 sm:aspect-[4/3]';
  // Styles only used by the large vertical card (written out in full so Tailwind generates them)
  const priceDivider = isList ? 'border-t border-[#D5A34A]/20 pt-3' : 'pt-3 sm:pt-4 sm:mt-4 sm:border-t sm:border-[#D5A34A]/20';
  const extraBadge = isList ? 'hidden' : 'hidden sm:inline-flex';

  return (
    <div
      className={`group relative flex ${shell} rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#17181C] to-[#0E1015] border border-[#D5A34A]/40 hover:border-[#F5BD48]/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_48px_rgba(213,163,74,0.22)] transition-all duration-300 overflow-hidden`}
    >
      {/* Photo */}
      <div className={`relative ${media} overflow-hidden bg-[#0A0B0E] cursor-pointer`} onClick={() => onOpenDetail(product)}>
        <img
          src={product.images[0]}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1015]/70 via-transparent to-black/30 opacity-80 group-hover:opacity-50 transition-opacity" />

        {/* Badge */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 pointer-events-none flex flex-col gap-1.5 items-start">
          <span className="whitespace-nowrap bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-1 rounded-full shadow-lg uppercase tracking-wider flex items-center gap-1">
            <Wand2 className="w-3 h-3 text-[#08090B]" />
            <span className="sm:hidden">Personal</span>
            <span className="hidden sm:inline">Make It Personal</span>
          </span>
          {product.badge && (
            <span className={`${extraBadge} bg-[#08090B]/90 backdrop-blur-md text-[#F5BD48] text-[9px] font-bold px-2 py-0.5 rounded-md border border-[#D5A34A]/40 uppercase tracking-widest`}>
              {product.badge}
            </span>
          )}
        </div>

        {/* Wishlist (on the photo for the vertical card) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className={`hidden ${isList ? '' : 'sm:flex'} absolute top-3 right-3 w-9 h-9 rounded-full bg-[#08090B]/85 hover:bg-[#24252A] backdrop-blur-md items-center justify-center border transition-all z-10 active:scale-90 cursor-pointer ${
            isWishlisted
              ? 'border-[#EC3E98] text-[#EC3E98] shadow-[0_0_12px_rgba(236,62,152,0.4)]'
              : 'border-[#D5A34A]/40 text-[#CBD5E1] hover:text-[#EC3E98] hover:border-[#EC3E98]/60'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#EC3E98] text-[#EC3E98]' : ''}`} />
        </button>
      </div>

      {/* Details */}
      <div className={`relative flex-1 min-w-0 flex flex-col p-3.5 ${isList ? 'sm:p-5' : 'sm:p-5 lg:p-6'}`}>
        {/* Wishlist (top-right of the details for horizontal cards) */}
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className={`${isList ? 'flex' : 'flex sm:hidden'} absolute top-3 right-3 w-8 h-8 rounded-full bg-[#08090B] items-center justify-center border transition-all active:scale-90 cursor-pointer ${
            isWishlisted ? 'border-[#EC3E98] text-[#EC3E98]' : 'border-[#D5A34A]/40 text-[#CBD5E1] hover:text-[#EC3E98]'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-[#EC3E98] text-[#EC3E98]' : ''}`} />
        </button>

        {/* Category + rating */}
        <div className={`flex items-center gap-2 mb-1 ${isList ? 'pr-10' : 'pr-10 sm:pr-0'} justify-between`}>
          <span className="font-bold text-[#D5A34A] text-[10px] sm:text-[10.5px] uppercase tracking-widest truncate">
            {product.category}
          </span>
          {hasReviews ? (
            <span className="flex items-center gap-1 bg-[#1A1D24] border border-[#D5A34A]/30 px-2 py-0.5 rounded-full text-[#F5BD48] font-bold text-[10.5px] shrink-0">
              <Star className="w-3 h-3 fill-[#F5BD48] text-[#F5BD48]" />
              <span>{product.rating}</span>
              <span className="text-[#94A3B8] font-normal">({product.reviewsCount})</span>
            </span>
          ) : (
            <span className="bg-[#1A1D24] border border-[#D5A34A]/30 px-2 py-0.5 rounded-full text-[#F5BD48] font-bold text-[10px] uppercase tracking-wider shrink-0">
              New
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          onClick={() => onOpenDetail(product)}
          className={`font-serif font-bold text-base ${isList ? 'sm:text-xl' : 'sm:text-xl'} text-white hover:text-[#F5BD48] line-clamp-1 cursor-pointer transition-colors leading-snug capitalize`}
          title={product.name}
        >
          {product.slug ? (

            <a

              href={`/products/${product.slug}`}

              onClick={(e) => {

                e.preventDefault();

                onOpenDetail(product);

              }}

            >

              {product.name}

            </a>

          ) : (

            product.name

          )}
        </h3>

        {/* Tagline + dispatch: hidden on the compact phone card */}
        {(product.tagline || product.description) && (
          <p className={`hidden ${isList ? 'sm:block' : 'sm:block'} text-xs sm:text-[13px] text-[#CBD5E1] line-clamp-2 leading-relaxed mt-1.5`}>
            {product.tagline || product.description}
          </p>
        )}
        <div className="hidden sm:flex mt-3 items-center gap-1.5 text-[11px] text-[#94A3B8]">
          <Clock className="w-3 h-3 text-[#D5A34A] shrink-0" />
          <span className="truncate">Handcrafted in Hyderabad • Atelier dispatch in {product.estimatedDispatchDays} days</span>
        </div>

        {/* Price + CTAs */}
        <div className={`mt-auto ${priceDivider} space-y-2.5 sm:space-y-3`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <div className="flex items-baseline gap-2">
              <span className="font-serif font-black text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-[#F5BD48] to-[#D5A34A]">
                ₹{product.basePrice.toLocaleString('en-IN')}
              </span>
              {product.mrp > product.basePrice && (
                <>
                  <span className="text-xs text-[#64748B] line-through">₹{product.mrp.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Save {discountPercent}%
                  </span>
                </>
              )}
            </div>
            <span className="text-[9.5px] sm:text-[10px] text-[#D5A34A] font-semibold uppercase tracking-wider">
              Customization Included
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => onOpenDetail(product)}
              className="py-2 sm:py-2.5 px-2 rounded-full bg-[#1A1D24] hover:bg-[#252830] border border-[#D5A34A]/30 hover:border-[#D5A34A] text-white hover:text-[#F5BD48] text-[11px] sm:text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Eye className="hidden sm:block w-3.5 h-3.5 text-[#D5A34A]" />
              <span>Quick View</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPersonalize(product)}
              className="py-2 sm:py-2.5 px-2 rounded-full bg-gradient-to-r from-[#F5BD48] via-[#E2AC3E] to-[#D5A34A] hover:brightness-110 text-[#08090B] text-[11px] sm:text-xs font-black whitespace-nowrap flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_16px_rgba(213,163,74,0.35)] cursor-pointer"
            >
              <Sparkles className="hidden sm:block w-3.5 h-3.5 text-[#08090B]" />
              <span>Personalize</span>
              <ArrowRight className="hidden sm:block w-3 h-3 text-[#08090B]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
