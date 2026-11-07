import React, { useState, useEffect } from 'react';
import { Product, CustomizationOption } from '../types';
import { useApp } from '../context/AppContext';
import {
  X,
  Star,
  Sparkles,
  Gift,
  ShoppingBag,
  Building2,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Heart,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  Crown
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onOpenPersonalize: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onOpenPersonalize
}) => {
  const {
    addToCart,
    wishlist,
    toggleWishlist,
    checkPincode,
    currentPincode,
    setCurrentPincode,
    setActiveModal,
    setSelectedProduct
  } = useApp();

  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isGiftWrapped, setIsGiftWrapped] = useState(false);
  const [pinInput, setPinInput] = useState(currentPincode);
  const [pinResult, setPinResult] = useState<{ serviceable: boolean; message: string; city?: string; days?: number } | null>(
    () => checkPincode(currentPincode)
  );
  const [customizationData, setCustomizationData] = useState<CustomizationOption>({
    engravedText: 'Sneha & Rohan',
    fontFamily: 'Dancing Script',
    giftNote: 'Warm wishes on this joyful milestone celebration!',
    ribbonColor: 'Rose Gold Silk',
    boxWrapStyle: 'Blush Pink with Gold Foil'
  });

  const isWishlisted = wishlist.includes(product.id);

  // Calculate current unit price based on tiered bulk pricing
  const currentUnitPrice = (() => {
    if (product.bulkTiers && product.bulkTiers.length > 0) {
      for (const tier of [...product.bulkTiers].reverse()) {
        if (quantity >= tier.minQty) {
          return tier.pricePerUnit;
        }
      }
    }
    return product.basePrice;
  })();

  const subtotal = currentUnitPrice * quantity;

  const handlePinCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const res = checkPincode(pinInput);
    setPinResult(res);
    if (res.serviceable) {
      setCurrentPincode(pinInput);
    }
  };

  const handleAddToCart = (isBuyNow = false) => {
    const customWithWrap = product.isCustomizable
      ? { ...customizationData, giftWrap: isGiftWrapped }
      : (isGiftWrapped ? { giftWrap: true } : undefined);

    addToCart(
      product,
      quantity,
      customWithWrap,
      quantity > 10,
      undefined,
      isGiftWrapped
    );
    if (isBuyNow) {
      onClose();
      setActiveModal('checkout');
    } else {
      onClose();
      setActiveModal('cart');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock body scroll while modal is active
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
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="relative w-full max-w-5xl bg-[#08090B] rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-[#D5A34A]/30 overflow-hidden my-6 text-[#F1F5F9]">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product detail"
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-[#17181C]/90 backdrop-blur-md text-[#CBD5E1] hover:text-[#F5BD48] border border-[#D5A34A]/30 shadow-md flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[85vh] overflow-y-auto">
          
          {/* Left Column: Image Gallery */}
          <div className="lg:col-span-6 p-6 bg-[#121316] flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#D5A34A]/20">
            <div>
              {/* Main Image */}
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#08090B] shadow-md border border-[#D5A34A]/20 mb-4">
                <img
                  src={product.images[activeImgIndex] || product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />

                {/* Floating Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
                  {product.badge && (
                    <span className="bg-[#08090B]/90 backdrop-blur-md text-[#F5BD48] text-xs font-bold px-2.5 py-1 rounded-md shadow-xs uppercase tracking-wider border border-[#D5A34A]/35 flex items-center gap-1 font-mono">
                      <Crown className="w-3 h-3 text-[#F5BD48]" />
                      <span>{product.badge}</span>
                    </span>
                  )}
                  {product.isCustomizable && (
                    <span className="bg-[#D5A34A]/20 backdrop-blur-md text-[#F5BD48] text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs border border-[#D5A34A]/40 flex items-center gap-1 uppercase tracking-wider font-mono">
                      <Sparkles className="w-3.5 h-3.5 text-[#F5BD48]" />
                      Laser Custom Craft
                    </span>
                  )}
                </div>

                {/* Wishlist toggle */}
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`absolute top-3 right-3 w-9 h-9 rounded-full bg-[#08090B]/85 backdrop-blur-md shadow-md flex items-center justify-center transition-all cursor-pointer border ${
                    isWishlisted ? 'border-[#EC3E98]/60 text-[#EC3E98]' : 'border-[#D5A34A]/30 text-[#CBD5E1] hover:text-[#EC3E98]'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-[#EC3E98] text-[#EC3E98]' : ''}`} />
                </button>
              </div>

              {/* Thumbnails */}
              {product.images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImgIndex(idx)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                        activeImgIndex === idx
                          ? 'border-[#D5A34A] shadow-xs scale-105'
                          : 'border-[#D5A34A]/20 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Origin & SKU Tag */}
            <div className="mt-4 pt-4 border-t border-[#D5A34A]/15 flex items-center justify-between text-xs text-[#94A3B8] font-mono">
              <span className="flex items-center gap-1 text-[#CBD5E1]">
                <Layers className="w-3.5 h-3.5 text-[#D5A34A]" />
                SKU: {product.sku}
              </span>
              <span>Hub: {product.warehouseLocation}</span>
            </div>
          </div>

          {/* Right Column: Product Details & Purchase Options */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-[#17181C]">
            <div>
              {/* Category Breadcrumb */}
              <div className="flex items-center gap-2 text-xs text-[#94A3B8] mb-2 font-mono">
                <span className="font-bold text-[#D5A34A] uppercase tracking-wider font-sans">
                  {product.category}
                </span>
                <span>/</span>
                <span>{product.subCategory || 'Curated Keepsake'}</span>
              </div>

              {/* Title & Review Rating */}
              <h1 className="font-serif font-bold text-2xl sm:text-3xl text-white leading-tight">
                {product.name}
              </h1>
              <p className="text-sm text-[#94A3B8] italic mt-1">{product.tagline}</p>

              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1 bg-[#24252A] border border-[#D5A34A]/25 px-2 py-0.5 rounded-md text-[#F5BD48] font-bold text-xs font-mono">
                  <Star className="w-3.5 h-3.5 fill-[#F5BD48] text-[#F5BD48]" />
                  <span>{product.rating}</span>
                </div>
                <span className="text-xs text-[#CBD5E1] underline cursor-pointer">
                  {product.reviewsCount} verified reviews
                </span>
                <span className="text-[#D5A34A]/40">•</span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> In Stock ({product.stock} units available)
                </span>
              </div>

              {/* Pricing Box */}
              <div className="mt-5 p-4 rounded-2xl bg-[#24252A] border border-[#D5A34A]/25 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif font-extrabold text-3xl text-[#F5BD48]">
                      ₹{currentUnitPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm text-[#64748B] line-through">
                      ₹{product.mrp.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                      Save ₹{(product.mrp - currentUnitPrice).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5 font-mono">
                    GST @ {product.taxRate}% included (HSN: {product.hsnCode})
                  </div>
                </div>

                {quantity > 1 && (
                  <div className="text-right">
                    <div className="text-xs text-[#94A3B8]">Total ({quantity} units)</div>
                    <div className="font-serif font-bold text-lg text-white">
                      ₹{subtotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                )}
              </div>

              {/* Personalization Section */}
              {product.isCustomizable && (
                <div className="mt-4 p-3.5 rounded-2xl bg-[#24252A] border border-[#D5A34A]/25 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#F5BD48]" />
                        Laser Engraving &amp; Hot-Foil Monogram
                      </div>
                      <div className="text-[11px] text-[#CBD5E1] mt-0.5">
                        Current Inscription: <strong className="text-[#F5BD48]">"{customizationData.engravedText}"</strong> ({customizationData.fontFamily})
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenPersonalize(product)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] text-xs font-bold flex items-center gap-1 transition-all hover:brightness-105 cursor-pointer shadow-xs"
                    >
                      <span>Customize</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#08090B]" />
                    </button>
                  </div>
                </div>
              )}

              {/* Quantity & PIN Code Checker Grid */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider block mb-1">
                    Select Quantity
                  </label>
                  <div className="flex items-center border border-[#D5A34A]/25 rounded-xl bg-[#24252A] p-1 w-fit">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-9 h-9 rounded-lg bg-[#17181C] hover:bg-[#2E3036] text-[#CBD5E1] hover:text-[#F5BD48] font-bold flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={product.stock}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 text-center font-bold text-sm bg-transparent text-white focus:outline-hidden font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      className="w-9 h-9 rounded-lg bg-[#17181C] hover:bg-[#2E3036] text-[#CBD5E1] hover:text-[#F5BD48] font-bold flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* PIN Code Checker */}
                <div>
                  <label className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-[#D5A34A]" />
                    Delivery PIN Code
                  </label>
                  <form onSubmit={handlePinCheck} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="e.g. 500062"
                      className="flex-1 min-w-[120px] px-3.5 py-2 rounded-xl border border-[#D5A34A]/30 bg-[#24252A] text-sm font-mono font-medium text-white placeholder-white/30 focus:border-[#D5A34A] focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:brightness-110 text-[#08090B] text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm"
                    >
                      Verify
                    </button>
                  </form>
                </div>
              </div>

              {/* Optional Signature Gift Wrapping */}
              <div className="w-full mt-3">
                <label className="p-3 rounded-2xl bg-[#24252A] border border-[#D5A34A]/25 flex items-center justify-between cursor-pointer hover:border-[#D5A34A]/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isGiftWrapped}
                      onChange={(e) => setIsGiftWrapped(e.target.checked)}
                      className="w-4 h-4 rounded text-[#D5A34A] focus:ring-[#D5A34A] accent-[#D5A34A] cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-[#F5BD48]" />
                        Signature Gift Wrapping
                      </div>
                      <div className="text-[11px] text-[#CBD5E1]">Handcrafted luxury decorative gift wrapping with satin ribbon (+₹20)</div>
                    </div>
                  </div>
                  <span className="font-serif font-bold text-xs text-[#F5BD48]">+₹20</span>
                </label>
              </div>

              {/* PIN Code Result */}
              {pinResult && (
                <div className={`mt-2 text-xs p-2.5 rounded-xl border flex items-start gap-2 ${
                  pinResult.serviceable
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{pinResult.message}</div>
                </div>
              )}

              {/* Details & Specs */}
              <div className="mt-5 pt-4 border-t border-[#D5A34A]/20 space-y-2">
                <h4 className="text-xs font-bold text-[#CBD5E1] uppercase tracking-wider">
                  Product Details &amp; Artisan Notes
                </h4>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  {product.description}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#94A3B8] pt-2">
                  {product.dimensions && <div>📐 <strong>Dimensions:</strong> {product.dimensions}</div>}
                  {product.weight && <div>⚖️ <strong>Weight:</strong> {product.weight}</div>}
                  <div>🛡️ <strong>Guarantee:</strong> Transit damage replacement (report within 24h of delivery)</div>
                  <div>🎁 <strong>Packaging:</strong> Premium rigid keepsake box included</div>
                </div>
              </div>
            </div>

            {/* Bottom Buttons */}
            <div className="pt-4 border-t border-[#D5A34A]/20 flex flex-wrap sm:flex-nowrap gap-3">
              <button
                type="button"
                onClick={() => handleAddToCart(false)}
                className="flex-1 py-3.5 px-5 rounded-full border border-[#D5A34A]/50 bg-[#24252A] hover:bg-[#2E3036] text-[#F5BD48] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#D5A34A]" />
                <span>Add to Shopping Bag</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddToCart(true)}
                className="flex-1 py-3.5 px-5 rounded-full bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] hover:brightness-105 text-[#08090B] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_16px_rgba(213,163,74,0.35)] cursor-pointer"
              >
                <span>Instant Royal Checkout</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
