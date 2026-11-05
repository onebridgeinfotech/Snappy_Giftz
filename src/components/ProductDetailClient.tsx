'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
  Sparkles,
  ShieldCheck,
  Truck,
  ArrowLeft,
  Crown,
  Star,
  CheckCircle2,
  Gift,
  Upload,
  X,
  AlertCircle,
  Plus,
  Minus,
  ShoppingBag,
  Heart,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';

interface Variant {
  id: string;
  sku: string;
  name: string;
  pricePaise: number;
  stockQuantity: number;
}

interface ProductDetailClientProps {
  product: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string;
    category: { id: string; name: string; slug: string } | string;
    occasions: string[];
    basePricePaise: number;
    mrpPaise: number;
    isCustomizable: boolean;
    customizationType: string | null;
    customizationFeePaise: number;
    images: string[];
    variants?: Variant[];
    rating: number;
    reviewsCount: number;
    badge?: string;
  };
  relatedProducts?: Array<{
    id: string;
    slug: string;
    name: string;
    basePricePaise: number;
    images: string[];
    badge?: string;
  }>;
}

export function ProductDetailClient({ product, relatedProducts = [] }: ProductDetailClientProps) {
  const router = useRouter();
  const { addToCart, showToast, setActiveModal, setSelectedProduct } = useApp();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants && product.variants.length > 0 ? product.variants[0].id : null
  );
  const [quantity, setQuantity] = useState(1);
  const [isGiftWrapped, setIsGiftWrapped] = useState(false);

  // Personalization State
  const [engravedText, setEngravedText] = useState('');
  const [fontFamily, setFontFamily] = useState('Dancing Script');
  const [giftNote, setGiftNote] = useState('');
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; originalFilename: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Validation / Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const categoryName = typeof product.category === 'object' ? product.category.name : product.category;

  // Selected variant or base
  const selectedVariant = product.variants?.find((v) => v.id === selectedVariantId);
  const unitPricePaise = selectedVariant ? selectedVariant.pricePaise : product.basePricePaise;
  const priceRupees = Number((unitPricePaise / 100).toFixed(2));
  const mrpRupees = Number((product.mrpPaise / 100).toFixed(2));
  const discountPercent = mrpRupees > priceRupees ? Math.round(((mrpRupees - priceRupees) / mrpRupees) * 100) : 0;
  const stockQuantity = selectedVariant ? selectedVariant.stockQuantity : 50;
  const isOutOfStock = stockQuantity <= 0;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedImages.length + files.length > 3) {
      setUploadError('Maximum 3 photos allowed per customized item.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`"${file.name}" exceeds the 10 MB limit.`);
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/personalization/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload photo.');
        }

        setUploadedImages((prev) => [
          ...prev,
          { id: data.data.id, originalFilename: data.data.originalFilename },
        ]);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading file.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleAddToCart = (isBuyNow = false) => {
    if (isOutOfStock) {
      setFeedback({ type: 'error', message: 'This item is currently out of stock.' });
      return;
    }

    if (product.isCustomizable && engravedText.length > 32) {
      setFeedback({ type: 'error', message: 'Custom text must be 32 characters or less.' });
      return;
    }

    // Build customization object
    const customizationData = product.isCustomizable
      ? {
          engravedText: engravedText.trim() || undefined,
          fontFamily,
          giftNote: giftNote.trim() || undefined,
          artworkUploadIds: uploadedImages.map((u) => u.id),
          artworkUploadId: uploadedImages[0]?.id || undefined,
          giftWrap: isGiftWrapped,
        }
      : (isGiftWrapped ? { giftWrap: true } : undefined);

    // Adapt to AppContext Product interface
    const adaptedProduct: any = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      tagline: product.tagline || '',
      description: product.description,
      category: categoryName,
      basePrice: priceRupees,
      mrp: mrpRupees,
      images: product.images,
      rating: product.rating,
      reviewsCount: product.reviewsCount,
      isCustomizable: product.isCustomizable,
      customizationType: product.customizationType || undefined,
      badge: product.badge,
    };

    addToCart(
      adaptedProduct,
      quantity,
      customizationData,
      false,
      undefined,
      isGiftWrapped
    );

    setFeedback({ type: 'success', message: `Added ${quantity}x "${product.name}" to your bag.` });

    if (isBuyNow) {
      router.push('/checkout');
    } else {
      setActiveModal('cart');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 bg-[#17181C] rounded-3xl p-6 sm:p-10 border border-[#D5A34A]/25 shadow-2xl">
      
      {/* Left Gallery Section */}
      <div className="lg:col-span-6 space-y-4">
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#08090B] border border-[#D5A34A]/20">
          <img
            src={product.images[activeImageIndex] || product.images[0] || '/assets/categories/personalized.jpg'}
            alt={product.name}
            className="w-full h-full object-cover transition-all duration-300"
          />
          {product.badge && (
            <div className="absolute top-4 left-4 bg-[#08090B]/90 backdrop-blur-md text-[#F5BD48] text-xs font-bold px-3 py-1 rounded-md uppercase tracking-widest border border-[#D5A34A]/30 flex items-center gap-1 font-mono">
              <Crown className="w-3.5 h-3.5 text-[#F5BD48]" />
              <span>{product.badge}</span>
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center">
              <span className="px-4 py-2 rounded-xl bg-red-950/90 border border-red-500/50 text-red-300 font-bold text-sm tracking-wider uppercase">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Thumbnail Row */}
        {product.images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {product.images.map((imgUrl, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-20 h-20 rounded-xl overflow-hidden border shrink-0 transition-all cursor-pointer ${
                  activeImageIndex === idx
                    ? 'border-[#D5A34A] ring-2 ring-[#D5A34A]/30 scale-105'
                    : 'border-[#D5A34A]/20 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={imgUrl} alt={`preview ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Quality Badges */}
        <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] text-[#94A3B8]">
          <div className="p-3 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#F5BD48] shrink-0" />
            <span>Hyderabad Atelier Express</span>
          </div>
          <div className="p-3 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>100% Insured Delivery</span>
          </div>
        </div>
      </div>

      {/* Right Information Section */}
      <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D5A34A] bg-[#D5A34A]/10 px-2.5 py-0.5 rounded-full border border-[#D5A34A]/30">
              {categoryName}
            </span>
            {product.isCustomizable && (
              <span className="text-xs font-bold uppercase tracking-wider text-[#F5BD48] bg-[#F5BD48]/10 px-2.5 py-0.5 rounded-full border border-[#F5BD48]/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#F5BD48]" />
                <span>Bespoke Engraving</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            {product.name}
          </h1>

          {product.tagline && (
            <p className="text-xs sm:text-sm text-[#94A3B8] italic">
              "{product.tagline}"
            </p>
          )}

          {/* Pricing & MRP */}
          <div className="flex items-baseline gap-3 pt-1">
            <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#F5BD48] to-[#D5A34A]">
              ₹{priceRupees.toLocaleString('en-IN')}
            </span>
            {mrpRupees > priceRupees && (
              <>
                <span className="text-sm sm:text-base text-[#64748B] line-through">
                  ₹{mrpRupees.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Save {discountPercent}%
                </span>
              </>
            )}
          </div>
          <div className="text-[11.5px] text-[#94A3B8]">
            Inclusive of all taxes (GST) • Manual delivery fee assigned upon owner review (~20km)
          </div>

          {/* Variants Selector (if any) */}
          {product.variants && product.variants.length > 1 && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-[#CBD5E1] mb-2">
                Select Edition / Variant
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      selectedVariantId === v.id
                        ? 'border-[#D5A34A] bg-[#D5A34A]/20 text-[#F5BD48]'
                        : 'border-[#D5A34A]/20 bg-[#08090B] text-[#CBD5E1] hover:border-[#D5A34A]/40'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span className="ml-1 text-[11px] text-[#94A3B8]">
                      (₹{(v.pricePaise / 100).toFixed(0)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="flex items-center gap-4 pt-2">
            <label className="text-xs font-semibold text-[#CBD5E1]">Quantity:</label>
            <div className="flex items-center rounded-xl bg-[#08090B] border border-[#D5A34A]/30 p-1">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || isOutOfStock}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-[#F5BD48] disabled:opacity-30 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center font-bold text-xs text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(stockQuantity, q + 1))}
                disabled={quantity >= stockQuantity || isOutOfStock}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-[#F5BD48] disabled:opacity-30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[11px] text-[#94A3B8]">
              {isOutOfStock ? (
                <span className="text-red-400 font-bold">Out of stock</span>
              ) : (
                <span className="text-emerald-400">{stockQuantity} units available</span>
              )}
            </span>
          </div>

          {/* Configurable Personalization Section */}
          {product.isCustomizable && (
            <div className="pt-4 border-t border-[#D5A34A]/15 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#F5BD48] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Personalize This Gift (Included)</span>
                </h3>
                <span className="text-[10px] text-[#94A3B8]">Max 32 chars</span>
              </div>

              {/* Text Engraving */}
              <div>
                <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                  Engraving / Custom Name
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={engravedText}
                  onChange={(e) => setEngravedText(e.target.value)}
                  placeholder="e.g. Ananya & Vikram 2026"
                  className="w-full h-9 px-3 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                />
              </div>

              {/* Font Style Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                    Font Style
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white focus:outline-hidden focus:border-[#D5A34A]"
                  >
                    <option value="Dancing Script">Dancing Script (Cursive)</option>
                    <option value="Playfair Display">Playfair Display (Serif)</option>
                    <option value="Cinzel">Cinzel (Royal Roman)</option>
                    <option value="Great Vibes">Great Vibes (Calligraphy)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                    Gift Note
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value)}
                    placeholder="Short message for recipient"
                    className="w-full h-9 px-3 rounded-xl border border-[#D5A34A]/30 bg-[#08090B] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                  />
                </div>
              </div>

              {/* Private Image Upload (Max 3, Max 10MB) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-[#CBD5E1] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#F5BD48]" />
                    <span>Upload Photos / Logos (Max 3, up to 10MB each)</span>
                  </label>
                  <span className="text-[10px] text-[#94A3B8]">{uploadedImages.length}/3 uploaded</span>
                </div>

                {uploadError && (
                  <div className="mb-2 p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {uploadedImages.map((img) => (
                      <div
                        key={img.id}
                        className="px-2.5 py-1 rounded-lg bg-[#08090B] border border-[#D5A34A]/30 text-xs text-[#CBD5E1] flex items-center gap-2"
                      >
                        <span className="truncate max-w-[140px] text-[11px]">{img.originalFilename}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.id)}
                          className="text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadedImages.length < 3 && (
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-[#D5A34A]/40 bg-[#08090B] text-xs text-[#F5BD48] hover:border-[#D5A34A] cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Validating & Uploading...' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isUploading}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Gift-Wrapping Option (Flat ₹20 per order) */}
          <div className="pt-3 border-t border-[#D5A34A]/15">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#08090B] border border-[#D5A34A]/20">
              <input
                type="checkbox"
                id="product-gift-wrap"
                checked={isGiftWrapped}
                onChange={(e) => setIsGiftWrapped(e.target.checked)}
                className="mt-0.5 rounded border-[#D5A34A]/40 bg-[#17181C] text-[#D5A34A] focus:ring-[#D5A34A] cursor-pointer"
              />
              <label htmlFor="product-gift-wrap" className="text-xs cursor-pointer space-y-0.5">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-[#F5BD48]" />
                  <span>Add Luxury Gift Packaging & Silk Ribbon (+₹20)</span>
                </span>
                <p className="text-[10.5px] text-[#94A3B8]">
                  Gift wrapping costs a flat ₹20 per order if at least one item is gift-wrapped (not charged per quantity).
                </p>
              </label>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border border-red-500/40 text-red-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => handleAddToCart(false)}
              className="w-full sm:flex-1 h-12 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer shadow-lg shadow-[#D5A34A]/15"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Shopping Bag</span>
            </button>

            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => handleAddToCart(true)}
              className="w-full sm:flex-1 h-12 rounded-xl border border-[#D5A34A] bg-[#24252A] text-[#F5BD48] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#2e3036] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              <span>Buy Now</span>
            </button>
          </div>

        </div>

        {/* Description & Specifications */}
        <div className="pt-6 border-t border-[#D5A34A]/15 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#D5A34A]">
            Artisan Description & Specifications
          </h2>
          <p className="text-xs text-[#CBD5E1] leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>

      </div>

    </div>
  );
}
