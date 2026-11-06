import React, { useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Heart, X, ShoppingBag, Eye } from 'lucide-react';

interface WishlistDrawerProps {
  onClose: () => void;
  onViewProduct: (productId: string) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  onClose,
  onViewProduct
}) => {
  const { products, wishlist, toggleWishlist, addToCart } = useApp();

  const savedProducts = useMemo(
    () =>
      wishlist
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined),
    [wishlist, products]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[85] overflow-hidden bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in-0 duration-200"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your saved gifts wishlist"
        className="w-full max-w-md bg-[#17181C] h-full shadow-2xl flex flex-col border-l border-[#D5A34A]/25 text-[#F1F5F9] animate-in slide-in-from-right duration-300"
      >
        <div className="p-4 sm:p-5 border-b border-[#D5A34A]/20 flex items-center justify-between bg-[#08090B]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#24252A] text-[#EC3E98] flex items-center justify-center font-bold shadow-xs border border-[#EC3E98]/35">
              <Heart className="w-4 h-4 text-[#EC3E98] fill-[#EC3E98]/30" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">Saved for later</h2>
              <p className="text-xs text-[#CBD5E1]">
                {wishlist.length} {wishlist.length === 1 ? 'gift' : 'gifts'} in your wishlist
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close wishlist drawer"
            className="p-2 rounded-full text-[#CBD5E1] hover:text-[#F5BD48] hover:bg-[#24252A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {savedProducts.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-16 h-16 rounded-full bg-[#24252A] text-[#EC3E98] flex items-center justify-center mx-auto mb-4 border border-[#EC3E98]/30 shadow-inner">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="font-serif font-bold text-lg text-white mb-1">Nothing saved yet</h3>
              <p className="text-xs text-[#94A3B8] max-w-xs mx-auto">
                Tap the heart on any product to save it here. Your picks sync on this device.
              </p>
            </div>
          ) : (
            savedProducts.map((product) => (
              <div
                key={product.id}
                className="p-3.5 rounded-2xl bg-[#24252A] border border-[#D5A34A]/20 shadow-xs flex gap-3"
              >
                <button
                  type="button"
                  onClick={() => onViewProduct(product.id)}
                  className="shrink-0 rounded-xl overflow-hidden border border-[#D5A34A]/25 bg-[#0E0F12] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#D5A34A]/50"
                  aria-label={`View details for ${product.name}`}
                >
                  <img
                    src={product.images[0]}
                    alt=""
                    className="w-20 h-20 object-cover"
                  />
                </button>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h4 className="font-serif font-bold text-xs sm:text-sm text-white line-clamp-2">
                      {product.name}
                    </h4>
                    <p className="font-serif font-bold text-sm text-[#F5BD48] mt-1">
                      ₹{product.basePrice.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => onViewProduct(product.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#17181C] border border-[#D5A34A]/30 text-[10.5px] font-semibold text-[#F5BD48] hover:bg-[#2E3036] cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      Quick view
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(product, 1);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] text-[10.5px] font-bold hover:brightness-105 cursor-pointer"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      Add to bag
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(product.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#EC3E98]/40 text-[10.5px] font-semibold text-[#EC3E98] hover:bg-[#EC3E98]/10 cursor-pointer"
                    >
                      <Heart className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
