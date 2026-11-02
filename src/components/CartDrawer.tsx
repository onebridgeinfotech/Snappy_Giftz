import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Trash2,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Users,
  Gift,
  Crown
} from 'lucide-react';

interface CartDrawerProps {
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  onClose,
  onProceedToCheckout
}) => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon
  } = useApp();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const isFreeShipping = subtotal >= 999 || subtotal === 0;
  const shippingCost = isFreeShipping ? 0 : 99;
  const finalDiscount = couponDiscount;
  
  // 18% GST calculation
  const taxableAmount = Math.max(0, subtotal - finalDiscount);
  const estimatedGst = taxableAmount * 0.18;
  const grandTotal = taxableAmount + estimatedGst + shippingCost;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const res = applyCoupon(couponInput);
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponError('');
      setCouponInput('');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock body scroll while drawer is open
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
      className="fixed inset-0 z-[80] overflow-hidden bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in-0 duration-200"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your Bespoke Gifting Bag"
        className="w-full max-w-md bg-[#17181C] h-full shadow-2xl flex flex-col justify-between border-l border-[#D5A34A]/25 text-[#F1F5F9] animate-in slide-in-from-right duration-300"
      >
        
        {/* Drawer Header - Dark Luxury */}
        <div className="p-4 sm:p-5 border-b border-[#D5A34A]/20 flex items-center justify-between bg-[#08090B]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#24252A] text-[#F5BD48] flex items-center justify-center font-bold shadow-xs border border-[#D5A34A]/30">
              <ShoppingBag className="w-4 h-4 text-[#D5A34A]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-serif font-bold text-lg text-white">Your Gifting Bag</h2>
                <Crown className="w-3.5 h-3.5 text-[#F5BD48]" />
              </div>
              <p className="text-xs text-[#CBD5E1]">
                {cart.length} {cart.length === 1 ? 'bespoke gift' : 'bespoke gifts'} selected
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close cart drawer"
            className="p-2 rounded-full text-[#CBD5E1] hover:text-[#F5BD48] hover:bg-[#24252A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Indicator */}
        <div className="bg-[#24252A] px-4 py-2.5 text-xs border-b border-[#D5A34A]/20 flex items-center justify-between">
          {subtotal >= 999 ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Complimentary <strong>Pan-India Insured Express Shipping</strong> Unlocked!</span>
            </span>
          ) : (
            <span className="text-[#CBD5E1] font-medium">
              Add <strong className="text-[#F5BD48]">₹{(999 - subtotal).toLocaleString('en-IN')}</strong> more for complimentary delivery!
            </span>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {cart.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-16 h-16 rounded-full bg-[#24252A] text-[#F5BD48] flex items-center justify-center mx-auto mb-4 border border-[#D5A34A]/30 shadow-inner">
                <Gift className="w-8 h-8" />
              </div>
              <h3 className="font-serif font-bold text-lg text-white mb-1">
                Your gifting bag is empty
              </h3>
              <p className="text-xs text-[#94A3B8] max-w-xs mx-auto mb-6">
                Explore our 24K gold-rim mugs, handcrafted brass lanterns, or bespoke corporate hampers.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] text-xs font-bold hover:brightness-105 transition-all shadow-[0_2px_12px_rgba(213,163,74,0.3)] cursor-pointer"
              >
                Browse Curated Collections
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-[#24252A] border border-[#D5A34A]/20 shadow-xs flex gap-3 relative group"
              >
                {/* Item Thumbnail */}
                <img
                  src={item.product.images[0]}
                  alt={item.product.name}
                  className="w-20 h-20 rounded-xl object-cover border border-[#D5A34A]/25 shrink-0 bg-[#0E0F12]"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-serif font-bold text-xs sm:text-sm text-white truncate">
                      {item.product.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="text-[#94A3B8] hover:text-[#EC3E98] p-1 transition-colors cursor-pointer"
                      title="Remove item"
                      aria-label={`Remove ${item.product.name} from bag`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Customization Details */}
                  {item.customization?.engravedText && (
                    <div className="mt-1 flex items-center gap-1 text-[10.5px] text-[#F5BD48] bg-[#D5A34A]/10 border border-[#D5A34A]/25 px-2 py-0.5 rounded-md font-mono">
                      <Sparkles className="w-3 h-3 text-[#F5BD48] shrink-0" />
                      <span className="truncate">"{item.customization.engravedText}"</span>
                    </div>
                  )}

                  {/* Multi-recipient badge if bulk */}
                  {item.recipientList && item.recipientList.length > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[#CBD5E1] bg-[#17181C] border border-[#D5A34A]/20 px-2 py-0.5 rounded-md font-semibold">
                      <Users className="w-3 h-3 text-[#D5A34A]" />
                      <span>{item.recipientList.length} Split Recipient Dispatches</span>
                    </div>
                  )}

                  {/* Price and Quantity modifier */}
                  <div className="mt-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-serif font-bold text-sm text-[#F5BD48]">
                        ₹{item.unitPrice.toLocaleString('en-IN')}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-[10px] text-[#94A3B8] ml-1">
                          x {item.quantity} = ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center border border-[#D5A34A]/25 rounded-lg bg-[#17181C]">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center text-[#CBD5E1] hover:text-[#F5BD48] font-bold hover:bg-[#24252A] text-xs rounded-l-lg transition-colors cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-white font-mono">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center text-[#CBD5E1] hover:text-[#F5BD48] font-bold hover:bg-[#24252A] text-xs rounded-r-lg transition-colors cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer: Pricing & Checkout */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-[#D5A34A]/20 bg-[#08090B] space-y-3">
            
            {/* Coupon Code Section */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Tag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Coupon <strong>{appliedCoupon}</strong> (-₹{couponDiscount})</span>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-emerald-300 hover:text-emerald-200 text-xs font-bold underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Promo code (FESTIVE15, WELCOME100)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] uppercase font-mono tracking-wider focus:outline-hidden focus:border-[#D5A34A]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#24252A] hover:bg-[#2E3036] border border-[#D5A34A]/30 text-[#F5BD48] text-xs font-bold transition-all cursor-pointer"
                >
                  Apply
                </button>
              </form>
            )}

            {couponError && (
              <p className="text-[11px] text-rose-400 pl-1">{couponError}</p>
            )}

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs text-[#CBD5E1] pt-1">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-white font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              {finalDiscount > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Royal Privilege Discount</span>
                  <span>-₹{finalDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Insured Express Delivery</span>
                <span>
                  {shippingCost === 0 ? (
                    <span className="text-emerald-400 font-semibold uppercase text-[11px]">Free</span>
                  ) : (
                    `₹${shippingCost}`
                  )}
                </span>
              </div>

              <div className="flex justify-between text-[#94A3B8] text-[11px]">
                <span>Estimated GST (18% HSN calculated)</span>
                <span className="font-mono">₹{Math.round(estimatedGst).toLocaleString('en-IN')}</span>
              </div>

              <div className="pt-2 border-t border-[#D5A34A]/20 flex justify-between items-baseline font-bold">
                <span className="text-white text-sm">Grand Total (All Taxes Included)</span>
                <span className="font-serif text-xl text-[#F5BD48]">
                  ₹{Math.round(grandTotal).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Checkout Action */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onProceedToCheckout();
              }}
              className="w-full py-3.5 px-5 rounded-full bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] hover:brightness-105 text-[#08090B] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(213,163,74,0.35)] transition-all transform active:scale-98 uppercase tracking-wider cursor-pointer"
            >
              <span>Proceed to Royal Checkout</span>
              <ArrowRight className="w-4 h-4 text-[#08090B]" />
            </button>

            <div className="flex items-center justify-center gap-4 text-[10px] text-[#94A3B8] pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> 256-bit SSL Protected
              </span>
              <span>•</span>
              <span>Complimentary Gift Packaging</span>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
