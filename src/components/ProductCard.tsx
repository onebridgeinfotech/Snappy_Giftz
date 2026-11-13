import React from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import {
  Heart,
  Star,
  Sparkles,
  ShoppingBag,
  Clock,
  Building2,
  Crown,
  Eye
} from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  onOpenPersonalize: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  onOpenPersonalize
}) => {
  const { wishlist, toggleWishlist, addToCart } = useApp();
  const isWishlisted = wishlist.includes(product.id);

  const discountPercent = product.mrp > product.basePrice
    ? Math.round(((product.mrp - product.basePrice) / product.mrp) * 100)
    : 0;

  return (
    <div className="group relative rounded-2xl sm:rounded-3xl bg-[#17181C] hover:bg-[#1E2025] border border-[#D5A34A]/20 hover:border-[#D5A34A]/60 shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_36px_rgba(213,163,74,0.12)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
      
      {/* 1. Product Image Container */}
      <div 
        className="relative aspect-square w-full overflow-hidden bg-[#0E0F12] cursor-pointer"
        onClick={() => onOpenDetail(product)}
      >
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out motion-reduce:transform-none"
          loading="lazy"
        />

        {/* Subtle Luxury Vignette Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#17181C] via-transparent to-black/30 opacity-70 group-hover:opacity-40 transition-opacity" />

        {/* Restrained Floating Badges */}
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex flex-col gap-1.5 items-start z-10 pointer-events-none">
          {product.badge && (
            <span className="bg-[#08090B]/90 backdrop-blur-md text-[#F5BD48] text-[8.5px] sm:text-[9px] font-bold px-2 py-0.5 rounded-md shadow-md uppercase tracking-wider border border-[#D5A34A]/35 flex items-center gap-1 font-mono">
              <Crown className="w-2.5 h-2.5 text-[#F5BD48]" />
              <span>{product.badge}</span>
            </span>
          )}
          {product.isCustomizable && (
            <span className="bg-[#D5A34A]/15 backdrop-blur-md text-[#F5BD48] text-[8px] sm:text-[8.5px] font-semibold px-2 py-0.5 rounded-md border border-[#D5A34A]/30 shadow-xs flex items-center gap-1 uppercase tracking-wider">
              <Sparkles className="w-2.5 h-2.5 text-[#F5BD48]" />
              <span>Personalizable</span>
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
          className={`absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#08090B]/80 hover:bg-[#24252A] backdrop-blur-md flex items-center justify-center border transition-all z-10 transform active:scale-90 cursor-pointer ${
            isWishlisted
              ? 'border-[#EC3E98]/60 text-[#EC3E98] shadow-[0_0_12px_rgba(236,62,152,0.3)]'
              : 'border-[#D5A34A]/30 text-[#CBD5E1] hover:text-[#EC3E98] hover:border-[#EC3E98]/50'
          }`}
          title={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${
              isWishlisted ? 'fill-[#EC3E98] text-[#EC3E98] scale-110' : ''
            }`}
          />
        </button>

        {/* Hover Quick Action: View & Personalize Overlay (Desktop / Tablet) */}
        <div className="absolute inset-x-2.5 bottom-2.5 sm:inset-x-3 sm:bottom-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 hidden sm:block">
          <div className="bg-[#17181C]/95 backdrop-blur-md rounded-xl p-1.5 shadow-xl border border-[#D5A34A]/30 flex items-center justify-between gap-1 text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(product);
              }}
              className="flex-1 py-1.5 px-2 rounded-lg text-[#F1F5F9] font-medium hover:bg-[#24252A] hover:text-[#F5BD48] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#D5A34A]" />
              <span>Quick View</span>
            </button>
            {product.isCustomizable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPersonalize(product);
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold flex items-center justify-center gap-1 shadow-xs hover:brightness-105 transition-opacity cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#08090B]" />
                <span>Personalize</span>
              </button>
            )}
          </div>
        </div>

        {/* Restrained Pink Discount Tag */}
        {discountPercent > 0 && (
          <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 bg-[#EC3E98]/20 backdrop-blur-xs text-[#EC3E98] border border-[#EC3E98]/35 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs group-hover:opacity-0 transition-opacity pointer-events-none">
            {discountPercent}% OFF
          </div>
        )}
      </div>

      {/* Content Section - Refined Strict Hierarchy */}
      <div className="p-3 sm:p-4 lg:p-5 flex-1 flex flex-col justify-between space-y-2.5">
        <div>
          {/* 2. Category & Rating */}
          <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
            <span className="font-bold text-[#D5A34A] text-[9.5px] sm:text-[10px] uppercase tracking-widest font-sans line-clamp-1">
              {product.category}
            </span>
            <div className="flex items-center gap-1 bg-[#24252A]/90 border border-[#D5A34A]/25 px-1.5 py-0.5 rounded text-[#F5BD48] font-bold text-[10px] sm:text-[10.5px] shrink-0 font-mono">
              <Star className="w-3 h-3 fill-[#F5BD48] text-[#F5BD48]" />
              <span>{product.rating}</span>
              <span className="text-[#94A3B8] font-normal text-[9.5px]">({product.reviewsCount})</span>
            </div>
          </div>

          {/* 3. Product Title - Prominent Serif */}
          <h3
            onClick={() => onOpenDetail(product)}
            className="font-serif font-bold text-base sm:text-lg text-white hover:text-[#F5BD48] line-clamp-1 cursor-pointer transition-colors leading-snug"
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

          {/* 5. Short Description - Line clamped to 2 lines with consistent min-height */}
          <p className="text-[11px] sm:text-xs text-[#94A3B8] line-clamp-2 min-h-[2.5rem] leading-relaxed mt-1">
            {product.description || product.tagline}
          </p>

          {/* 7 & 8. Delivery Information & Bulk Pricing (Uniform Row) */}
          <div className="mt-2.5 pt-2 border-t border-[#D5A34A]/10 flex items-center justify-between text-[10px] sm:text-[10.5px] text-[#94A3B8]">
            <span className="flex items-center gap-1 text-[#CBD5E1]">
              <Clock className="w-2.5 h-2.5 text-[#D5A34A]" />
              <span>Ships in {product.estimatedDispatchDays} {product.estimatedDispatchDays === 1 ? 'day' : 'days'}</span>
            </span>
            {product.bulkTiers && product.bulkTiers.length > 0 && (
              <span className="text-[#F5BD48] font-medium font-mono">
                Bulk: ₹{product.bulkTiers[product.bulkTiers.length - 1].pricePerUnit}/pc
              </span>
            )}
          </div>
        </div>

        {/* 6 & 9. Price & Shopping Actions */}
        <div className="pt-2.5 sm:pt-3 border-t border-[#D5A34A]/15 flex items-center justify-between gap-2 mt-auto">
          <div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-serif font-extrabold text-lg sm:text-xl text-[#F5BD48]">
                ₹{product.basePrice.toLocaleString('en-IN')}
              </span>
              {product.mrp > product.basePrice && (
                <span className="text-[11px] sm:text-xs text-[#64748B] line-through">
                  ₹{product.mrp.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {product.isCustomizable && (
              <button
                type="button"
                onClick={() => onOpenPersonalize(product)}
                aria-label={`Personalize ${product.name}`}
                className="p-2 sm:p-2.5 rounded-full bg-[#24252A] hover:bg-[#2E3036] border border-[#D5A34A]/30 text-[#F5BD48] hover:text-white transition-all transform active:scale-95 flex items-center justify-center cursor-pointer sm:hidden"
                title="Personalize Gift"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => addToCart(product, 1)}
              aria-label={`Add ${product.name} to Shopping Bag`}
              className="p-2 sm:p-2.5 rounded-full bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:brightness-105 text-[#08090B] font-bold shadow-[0_2px_12px_rgba(213,163,74,0.3)] transition-all transform active:scale-90 flex items-center justify-center cursor-pointer"
              title="Add to Shopping Bag"
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#08090B]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
