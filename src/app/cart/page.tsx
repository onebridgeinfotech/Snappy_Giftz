'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Gift,
  Tag,
  ShieldCheck,
  Truck,
  Sparkles,
  Info,
  CheckCircle2,
  X,
  FileText
} from 'lucide-react';

export default function CartPage() {
  const router = useRouter();
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon,
    toggleItemGiftWrap,
  } = useApp();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const isOrderGiftWrapped = cart.some((item) => Boolean(item.isGiftWrapped || item.customization?.giftWrap));
  const giftWrapFee = isOrderGiftWrapped ? 20 : 0;
  const discountTotal = couponDiscount;
  const taxableAmount = Math.max(0, subtotal + giftWrapFee - discountTotal);
  const estimatedGst = Math.round(taxableAmount * 0.18);
  const totalExclDelivery = taxableAmount + estimatedGst;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    if (!couponCode.trim()) return;

    const res = applyCoupon(couponCode.trim());
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponCode('');
    }
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-[#94A3B8]">
          <Link href="/" className="hover:text-[#F5BD48] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#D5A34A] font-medium">Bespoke Shopping Bag</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#24252A] gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F1F5F9] tracking-tight">
              Bespoke Shopping Bag
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
              Carefully review your personalized gifts and add-ons before checkout.
            </p>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear your shopping bag?')) {
                  clearCart();
                }
              }}
              className="text-xs text-[#94A3B8] hover:text-[#EF4444] transition-colors flex items-center gap-1.5 self-start sm:self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Bag
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          /* Empty Bag State */
          <div className="text-center py-20 px-4 max-w-md mx-auto bg-[#17181C] rounded-2xl border border-[#D5A34A]/20 shadow-xl">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#D5A34A]/10 border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48]">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-serif font-bold text-[#F1F5F9] mb-2">
              Your Shopping Bag is Empty
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] mb-6 leading-relaxed">
              Explore our handcrafted collections of personalized keepsakes, custom engravings, and luxury gift hampers.
            </p>
            <Link
              href="/#catalog-section"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] font-bold text-sm hover:brightness-110 shadow-lg shadow-[#D5A34A]/20 transition-all"
            >
              Explore Gift Collection
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Column: Items List */}
            <div className="lg:col-span-8 space-y-4">
              {cart.map((item) => {
                const itemGiftWrapped = Boolean(item.isGiftWrapped || item.customization?.giftWrap);
                const hasPersonalization = Boolean(
                  item.customization?.engravedText ||
                  item.customization?.giftNote ||
                  item.customization?.artworkUploadId ||
                  (item.customization?.artworkUploadIds && item.customization.artworkUploadIds.length > 0)
                );

                return (
                  <div
                    key={item.id}
                    className="bg-[#17181C] rounded-xl border border-[#24252A] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start relative hover:border-[#D5A34A]/40 transition-all shadow-md"
                  >
                    {/* Product Image */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-[#08090B] border border-[#24252A] overflow-hidden flex-shrink-0 relative">
                      <Image
                        src={item.product.images?.[0] || '/assets/snappy-gifts-trimmed.png'}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start pr-6 sm:pr-0">
                        <div>
                          <h3 className="text-base font-serif font-semibold text-[#F1F5F9] line-clamp-1">
                            {item.product.name}
                          </h3>
                          {item.variant && (
                            <p className="text-xs text-[#D5A34A] font-medium mt-0.5">
                              Variant: {item.variant.name} ({item.variant.sku})
                            </p>
                          )}
                          <p className="text-xs text-[#94A3B8] mt-0.5">
                            SKU: {item.product.sku}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-[#F5BD48]">
                            ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-[11px] text-[#94A3B8]">
                              ₹{item.unitPrice.toLocaleString('en-IN')} each
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Customization Details Badge */}
                      {hasPersonalization && (
                        <div className="mt-3 p-2.5 rounded-lg bg-[#08090B]/60 border border-[#D5A34A]/25 text-xs text-[#F1F5F9] space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-[#D5A34A]">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Bespoke Customization Included</span>
                          </div>
                          {item.customization?.engravedText && (
                            <p className="text-xs text-[#E2E8F0]">
                              <span className="text-[#94A3B8]">Engraved Text:</span> &ldquo;{item.customization.engravedText}&rdquo;
                              {item.customization.fontFamily && (
                                <span className="text-[11px] text-[#D5A34A] ml-1">({item.customization.fontFamily})</span>
                              )}
                            </p>
                          )}
                          {item.customization?.giftNote && (
                            <p className="text-xs text-[#E2E8F0]">
                              <span className="text-[#94A3B8]">Gift Note:</span> {item.customization.giftNote}
                            </p>
                          )}
                          {((item.customization?.artworkUploadIds && item.customization.artworkUploadIds.length > 0) || item.customization?.artworkUploadId) && (
                            <p className="text-[11px] text-[#10B981] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Custom Artwork / Photo Attached
                            </p>
                          )}
                        </div>
                      )}

                      {/* Item Gift Wrap Toggle */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#24252A]">
                        <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                          <input
                            type="checkbox"
                            checked={itemGiftWrapped}
                            onChange={() => toggleItemGiftWrap(item.id)}
                            className="rounded border-[#D5A34A]/40 bg-[#08090B] text-[#D5A34A] focus:ring-[#D5A34A]/30 w-4 h-4"
                          />
                          <span className="text-[#F1F5F9] flex items-center gap-1.5 font-medium">
                            <Gift className="w-3.5 h-3.5 text-[#D5A34A]" />
                            Luxury Gift Wrap
                          </span>
                        </label>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-[#24252A] rounded-lg bg-[#08090B] overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.id, Math.max(1, item.quantity - 1))}
                              disabled={item.quantity <= 1}
                              className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#24252A] disabled:opacity-30 transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 py-1 text-xs font-bold text-[#F1F5F9] min-w-[28px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const maxStock = item.variant ? item.variant.stock : item.product.stock;
                                if (item.quantity < maxStock) {
                                  updateCartQuantity(item.id, item.quantity + 1);
                                }
                              }}
                              className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#24252A] transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 text-[#94A3B8] hover:text-[#EF4444] transition-colors rounded-lg hover:bg-[#24252A]"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Gift Wrapping Policy Notice */}
              <div className="p-3.5 rounded-xl bg-[#17181C] border border-[#D5A34A]/20 flex items-start gap-2.5 text-xs text-[#94A3B8]">
                <Info className="w-4 h-4 text-[#D5A34A] flex-shrink-0 mt-0.5" />
                <p>
                  <strong className="text-[#F1F5F9]">Luxury Gift Wrap Policy:</strong> A flat ₹20 fee applies across your entire order when gift wrapping is selected for one or more items. It is never multiplied by item quantity.
                </p>
              </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-4">
              <div className="bg-[#17181C] rounded-xl border border-[#D5A34A]/30 p-5 sm:p-6 sticky top-24 shadow-xl">
                <h2 className="text-lg font-serif font-bold text-[#F1F5F9] pb-4 border-b border-[#24252A]">
                  Order Summary
                </h2>

                {/* Subtotals Breakdown */}
                <div className="space-y-3 py-4 border-b border-[#24252A] text-xs sm:text-sm">
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-[#F1F5F9]">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between text-[#94A3B8]">
                    <span className="flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-[#D5A34A]" />
                      Luxury Gift Wrapping
                    </span>
                    <span className="font-semibold text-[#F1F5F9]">
                      {giftWrapFee > 0 ? `₹${giftWrapFee}` : 'Free / Not Selected'}
                    </span>
                  </div>

                  {discountTotal > 0 && (
                    <div className="flex justify-between text-[#10B981]">
                      <span>Coupon Discount</span>
                      <span className="font-semibold">-₹{discountTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Estimated GST (18%)</span>
                    <span className="font-semibold text-[#F1F5F9]">₹{estimatedGst.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="pt-2 border-t border-[#24252A]/60 flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#D5A34A] font-medium flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" />
                        Delivery Charge
                      </span>
                      <span className="text-[11px] text-[#F5BD48] font-bold px-2 py-0.5 rounded bg-[#D5A34A]/10 border border-[#D5A34A]/30">
                        Owner Assessment
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-tight">
                      Calculated by our studio based on exact distance (~20km from A S Rao Nagar). You will review and approve before paying.
                    </p>
                  </div>
                </div>

                {/* Total */}
                <div className="py-4 border-b border-[#24252A] flex justify-between items-baseline">
                  <div>
                    <span className="text-base font-serif font-bold text-[#F1F5F9]">Estimated Total</span>
                    <p className="text-[10px] text-[#94A3B8]">Excludes final delivery charge</p>
                  </div>
                  <span className="text-xl font-bold text-[#F5BD48]">
                    ₹{totalExclDelivery.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Coupon Code Input */}
                <div className="py-4 border-b border-[#24252A]">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-xs">
                      <div className="flex items-center gap-2 text-[#10B981]">
                        <Tag className="w-3.5 h-3.5" />
                        <span className="font-bold">{appliedCoupon}</span>
                        <span className="text-[#94A3B8]">(-₹{couponDiscount})</span>
                      </div>
                      <button
                        onClick={removeCoupon}
                        className="text-[#94A3B8] hover:text-[#EF4444] transition-colors p-1"
                        aria-label="Remove coupon"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Coupon Code"
                        className="flex-1 bg-[#08090B] border border-[#24252A] rounded-lg px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#D5A34A]"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-lg bg-[#24252A] hover:bg-[#D5A34A] hover:text-[#08090B] text-[#F1F5F9] text-xs font-semibold transition-all"
                      >
                        Apply
                      </button>
                    </form>
                  )}
                  {couponError && (
                    <p className="text-[11px] text-[#EF4444] mt-1.5">{couponError}</p>
                  )}
                </div>

                {/* Proceed to Checkout CTA */}
                <div className="pt-4 space-y-3">
                  <button
                    onClick={() => router.push('/checkout')}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] font-bold text-sm hover:brightness-110 shadow-lg shadow-[#D5A34A]/25 transition-all flex items-center justify-center gap-2"
                  >
                    Proceed to Checkout
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <p className="text-[11px] text-[#94A3B8] text-center flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#D5A34A]" />
                    Safe &amp; Secure Checkout Guaranteed
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

