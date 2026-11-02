import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Order, Address } from '../types';
import confetti from 'canvas-confetti';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Building2,
  Truck,
  ArrowRight,
  QrCode,
  FileText,
  Lock,
  Sparkles,
  Smartphone,
  AlertCircle
} from 'lucide-react';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface CheckoutModalProps {
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  onClose,
  onOrderSuccess
}) => {
  const {
    cart,
    mode,
    organization,
    currentRole,
    appliedCoupon,
    couponDiscount,
    currentPincode,
    checkPincode,
    setSelectedOrder,
    setActiveModal
  } = useApp();

  const [step, setStep] = useState<'address' | 'payment' | 'success'>('address');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Address State
  const [customerName, setCustomerName] = useState(
    mode === 'b2b' ? organization.contactPerson : 'Aarav Malhotra'
  );
  const [customerEmail, setCustomerEmail] = useState(
    mode === 'b2b' ? organization.businessEmail : 'aarav.malhotra@example.com'
  );
  const [customerPhone, setCustomerPhone] = useState(
    mode === 'b2b' ? organization.phone : '+91 98290 12345'
  );
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState(currentPincode || '');
  const [gstin, setGstin] = useState(mode === 'b2b' ? organization.gstin : '');
  const [companyName, setCompanyName] = useState(mode === 'b2b' ? organization.companyName : '');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Razorpay' | 'CreditCard' | 'CorporateCredit' | 'COD'>(
    mode === 'b2b' ? 'CorporateCredit' : 'UPI'
  );
  const [upiId, setUpiId] = useState('aarav@okhdfcbank');
  const [isProcessing, setIsProcessing] = useState(false);

  // Totals
  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const isFreeShipping = subtotal >= 999;
  const shippingTotal = isFreeShipping ? 0 : 99;
  const discountTotal = couponDiscount;
  const taxableAmount = Math.max(0, subtotal - discountTotal);
  const taxTotal = Math.round(taxableAmount * 0.18);
  const grandTotal = taxableAmount + taxTotal + shippingTotal;

  // Handle address submit
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincode || pincode.length !== 6) {
      alert('Please enter a valid 6-digit Indian PIN Code');
      return;
    }
    setStep('payment');
  };

  // Handle final order payment confirmation
  const handleConfirmOrder = async () => {
    setIsProcessing(true);

    const shippingAddress: Address = {
      id: `addr-${Date.now()}`,
      name: customerName,
      company: companyName || undefined,
      street,
      city,
      state,
      pincode,
      phone: customerPhone
    };

    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const response = await fetch('/api/checkout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          gstin: gstin || undefined,
          shippingAddress: {
            name: customerName,
            company: companyName || undefined,
            street,
            city,
            state,
            pincode,
            phone: customerPhone,
          },
          items: cart.map((i) => ({
            productId: i.productId,
            variantId: i.variant?.id,
            quantity: i.quantity,
            customization: i.customization ? {
              note: i.customization.engravedText || i.customization.specialInstructions || i.customization.giftNote || undefined,
            } : undefined,
          })),
          paymentMethod,
          idempotencyKey,
        }),
      });

      const json = await response.json();
      if (response.ok && json.success && json.data) {
        const serverOrder = json.data;
        const newOrder: Order = {
          id: serverOrder.id,
          orderNumber: serverOrder.orderNumber,
          date: new Date(serverOrder.createdAt).toISOString().split('T')[0],
          customerName: serverOrder.customerName,
          customerEmail: serverOrder.customerEmail,
          customerPhone: serverOrder.customerPhone,
          type: mode === 'b2b' ? 'B2B' : 'B2C',
          organizationName: companyName || undefined,
          gstin: gstin || undefined,
          items: cart,
          shippingAddress,
          subtotal: Math.round(serverOrder.itemsSubtotalPaise / 100),
          discountTotal: 0,
          couponApplied: undefined,
          taxTotal: Math.round(serverOrder.taxTotalPaise / 100),
          shippingTotal: Math.round(serverOrder.shippingTotalPaise / 100),
          grandTotal: Math.round(serverOrder.grandTotalPaise / 100),
          paymentMethod: serverOrder.paymentMethod,
          paymentStatus: 'Pending Verification',
          orderStatus: 'Order Placed',
          estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          awbNumber: `BD-AIR-${serverOrder.orderNumber.replace(/[^0-9]/g, '').slice(-6) || '8812'}`,
          courierPartner: 'BlueDart Air Express',
        };

        // Initiate Gateway Payment Order on Server
        try {
          const pmtResponse = await fetch('/api/payments/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderNumber: serverOrder.orderNumber,
              guestToken: serverOrder.guestLookupToken,
            }),
          });

          const pmtJson = await pmtResponse.json();
          if (!pmtResponse.ok || !pmtJson.success || !pmtJson.data) {
            setCheckoutError(pmtJson?.error || 'Failed to initiate payment gateway order.');
            setIsProcessing(false);
            return;
          }

          const pmtConfig = pmtJson.data;

          // If Razorpay SDK is loaded or can be loaded dynamically
          const isScriptReady = await loadRazorpayScript();
          if (isScriptReady && (window as any).Razorpay) {
            const rzp = new (window as any).Razorpay({
              key: pmtConfig.gatewayKeyId,
              amount: pmtConfig.amountPaise,
              currency: pmtConfig.currency || 'INR',
              name: 'Snappy Gifts',
              description: `Order ${serverOrder.orderNumber}`,
              order_id: pmtConfig.gatewayOrderId,
              prefill: {
                name: serverOrder.customerName,
                email: serverOrder.customerEmail,
                contact: serverOrder.customerPhone,
              },
              theme: { color: '#881337' },
              handler: async function (rzpResp: any) {
                setIsProcessing(true);
                try {
                  const verifyRes = await fetch('/api/payments/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      orderNumber: serverOrder.orderNumber,
                      gatewayOrderId: rzpResp.razorpay_order_id,
                      gatewayPaymentId: rzpResp.razorpay_payment_id,
                      gatewaySignature: rzpResp.razorpay_signature,
                      guestToken: serverOrder.guestLookupToken,
                    }),
                  });

                  const verifyJson = await verifyRes.json();
                  if (verifyRes.ok && verifyJson.success) {
                    const isCaptured = Boolean(verifyJson.data?.isCaptured);
                    newOrder.paymentStatus = isCaptured ? 'Paid' : 'Pending Verification';
                    newOrder.orderStatus = 'Order Placed';
                    setCreatedOrder(newOrder);
                    setIsProcessing(false);
                    setStep('success');

                    if (isCaptured) {
                      try {
                        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
                      } catch {}
                    }

                    onOrderSuccess(newOrder);
                  } else {
                    setCheckoutError(verifyJson?.error || 'Payment signature verification failed.');
                    setIsProcessing(false);
                  }
                } catch {
                  setCheckoutError('Connection failure during payment verification.');
                  setIsProcessing(false);
                }
              },
              modal: {
                ondismiss: function () {
                  setCheckoutError('Payment cancelled. Your 15-minute stock hold remains active; click Pay to retry.');
                  setIsProcessing(false);
                },
              },
            });

            rzp.open();
            return;
          }

          // Test Mode / Mock Payment Driver fallback when browser popup is not loaded
          if (pmtConfig.gatewayKeyId?.startsWith('rzp_mock')) {
            setCreatedOrder(newOrder);
            setIsProcessing(false);
            setStep('success');
            try {
              confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
            } catch {}
            onOrderSuccess(newOrder);
            return;
          }

          setCheckoutError('Unable to load payment gateway window. Please check your network or adblocker.');
          setIsProcessing(false);
          return;
        } catch {
          setCheckoutError('Payment gateway communication error.');
          setIsProcessing(false);
          return;
        }
      } else {
        const errorMsg = json?.error || 'Unable to place order. Please review your cart and details.';
        setCheckoutError(errorMsg);
        setIsProcessing(false);
      }
    } catch {
      setCheckoutError('Connection failure: Unable to communicate with the checkout server. Please verify your connection and try again.');
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'success') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, step]);

  // Lock body scroll while checkout modal is active
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
        if (step !== 'success' && e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="relative w-full max-w-3xl bg-[#08090B] rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-[#D5A34A]/30 overflow-hidden my-6 text-[#F1F5F9]">
        
        {/* Top Header - Dark Luxury */}
        <div className="bg-[#17181C] text-white px-6 py-4 flex items-center justify-between border-b border-[#D5A34A]/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#24252A] border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48]">
              <ShieldCheck className="w-5 h-5 text-[#D5A34A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="checkout-modal-title" className="font-serif font-bold text-lg text-white">
                  {step === 'success' ? 'Order Confirmed!' : 'Snappy Gifts Express Checkout'}
                </h3>
                <Sparkles className="w-3.5 h-3.5 text-[#F5BD48]" />
              </div>
              <p className="text-xs text-[#CBD5E1]">
                GST Compliant Invoicing &amp; Safe Pan-India Logistics
              </p>
            </div>
          </div>

          {step !== 'success' && (
            <button
              onClick={onClose}
              aria-label="Close checkout modal"
              className="p-1.5 rounded-full text-[#CBD5E1] hover:text-[#F5BD48] hover:bg-[#24252A] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6">
          
          {/* STEP 1: Address Details */}
          {step === 'address' && (
            <form onSubmit={handleProceedToPayment} className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#D5A34A]/20 pb-3">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  <span>Shipping Address &amp; Invoicing Details</span>
                </div>
                <span className="text-xs text-[#94A3B8]">Step 1 of 2</span>
              </div>

              {/* B2B / GST Banner */}
              {mode === 'b2b' && (
                <div className="p-3 bg-[#17181C] rounded-xl border border-[#D5A34A]/30 text-xs text-[#CBD5E1] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#F5BD48] shrink-0" />
                  <span>
                    Corporate GST invoicing activated. Input Tax Credit (ITC) will be credited to <strong className="text-[#F5BD48]">{organization.gstin}</strong>.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm text-[#F1F5F9] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Contact Phone (for delivery SMS &amp; OTP) *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm text-[#F1F5F9] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm text-[#F1F5F9] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Company Name (Optional / B2B)
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corp India"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Street Address / Flat / Building *
                  </label>
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm text-[#F1F5F9] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm text-[#F1F5F9] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm text-[#F1F5F9] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    6-Digit PIN Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm font-mono text-[#F1F5F9] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    GSTIN (For B2B Tax Credit)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 08AAACA1234A1Z5"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm font-mono uppercase text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>
              </div>

              {/* Order summary small row */}
              <div className="p-3 rounded-xl bg-[#17181C] border border-[#D5A34A]/20 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#94A3B8]">Total Payable: </span>
                  <strong className="text-[#F5BD48] text-sm font-serif">₹{grandTotal.toLocaleString('en-IN')}</strong>
                  <span className="text-[#94A3B8] text-[11px] ml-1">({cart.length} items)</span>
                </div>
                <span className="text-emerald-400 font-semibold text-[11px]">Free Insurance Included</span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:bg-[#24252A] rounded-xl transition-colors cursor-pointer"
                >
                  Return to Cart
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] hover:brightness-105 text-[#08090B] text-xs sm:text-sm font-bold flex items-center gap-2 shadow-[0_2px_14px_rgba(213,163,74,0.3)] transition-all cursor-pointer"
                >
                  <span>Continue to Payment</span>
                  <ArrowRight className="w-4 h-4 text-[#08090B]" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Payment Gateways */}
          {step === 'payment' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#D5A34A]/20 pb-3">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>Select Payment Gateway</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('address')}
                  className="text-xs text-[#D5A34A] font-semibold hover:text-[#F5BD48] hover:underline cursor-pointer"
                >
                  Edit Address
                </button>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* UPI */}
                <label
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    paymentMethod === 'UPI'
                      ? 'border-[#D5A34A] bg-[#D5A34A]/10 ring-1 ring-[#D5A34A]'
                      : 'border-[#D5A34A]/20 bg-[#17181C] hover:border-[#D5A34A]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === 'UPI'}
                    onChange={() => setPaymentMethod('UPI')}
                    className="mt-1 text-[#D5A34A] accent-[#D5A34A]"
                  />
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      Instant UPI (GPay / PhonePe / Paytm)
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      Zero convenience fee, instant verification
                    </div>
                  </div>
                </label>

                {/* Razorpay / Cards */}
                <label
                  onClick={() => setPaymentMethod('Razorpay')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    paymentMethod === 'Razorpay'
                      ? 'border-[#D5A34A] bg-[#D5A34A]/10 ring-1 ring-[#D5A34A]'
                      : 'border-[#D5A34A]/20 bg-[#17181C] hover:border-[#D5A34A]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === 'Razorpay'}
                    onChange={() => setPaymentMethod('Razorpay')}
                    className="mt-1 text-[#D5A34A] accent-[#D5A34A]"
                  />
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-[#F5BD48]" />
                      Cards &amp; NetBanking (Razorpay)
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      Visa, Mastercard, RuPay, Corporate Amex
                    </div>
                  </div>
                </label>

                {/* Corporate Credit / Net 30 */}
                {mode === 'b2b' && (
                  <label
                    onClick={() => setPaymentMethod('CorporateCredit')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 col-span-1 sm:col-span-2 ${
                      paymentMethod === 'CorporateCredit'
                        ? 'border-[#D5A34A] bg-[#D5A34A]/10 ring-1 ring-[#D5A34A]'
                        : 'border-[#D5A34A]/20 bg-[#17181C] hover:border-[#D5A34A]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pay"
                      checked={paymentMethod === 'CorporateCredit'}
                      onChange={() => setPaymentMethod('CorporateCredit')}
                      className="mt-1 text-[#D5A34A] accent-[#D5A34A]"
                    />
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-[#F5BD48] flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#D5A34A]" />
                        Approved Corporate Credit (Net 30 Terms)
                      </div>
                      <div className="text-[11px] text-[#CBD5E1] mt-0.5">
                        Credit limit available: ₹{(organization.creditLimit - organization.creditUsed).toLocaleString('en-IN')}. Invoiced directly against PO.
                      </div>
                    </div>
                  </label>
                )}

                {/* COD */}
                <label
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    paymentMethod === 'COD'
                      ? 'border-[#D5A34A] bg-[#D5A34A]/10 ring-1 ring-[#D5A34A]'
                      : 'border-[#D5A34A]/20 bg-[#17181C] hover:border-[#D5A34A]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                    className="mt-1 text-[#D5A34A] accent-[#D5A34A]"
                  />
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-white">
                      Cash on Delivery (COD)
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      Pay cash or UPI upon courier arrival
                    </div>
                  </div>
                </label>

              </div>

              {/* UPI Sub-form */}
              {paymentMethod === 'UPI' && (
                <div className="p-4 rounded-2xl bg-[#17181C] border border-[#D5A34A]/25 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 bg-white p-2 rounded-xl shadow-xs border border-[#D5A34A]/30 flex items-center justify-center shrink-0">
                    <QrCode className="w-20 h-20 text-[#08090B]" />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                      Enter your UPI ID / VPA
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. mobile@upi or username@okaxis"
                      className="w-full px-3 py-2 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs sm:text-sm font-mono text-[#F1F5F9] focus:border-[#D5A34A] focus:outline-hidden"
                    />
                    <div className="text-[11px] text-[#94A3B8] mt-1">
                      A payment request of <strong className="text-[#F5BD48]">₹{grandTotal.toLocaleString('en-IN')}</strong> will be authorized.
                    </div>
                  </div>
                </div>
              )}

              {/* Price Breakdown Review */}
              <div className="p-4 rounded-2xl bg-[#17181C] border border-[#D5A34A]/20 text-xs space-y-1.5">
                <div className="flex justify-between text-[#CBD5E1]">
                  <span>Subtotal ({cart.length} items)</span>
                  <span className="font-mono text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Discount</span>
                    <span>-₹{discountTotal.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#CBD5E1]">
                  <span>GST (18% Intra/Inter State)</span>
                  <span className="font-mono text-white">₹{taxTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-[#CBD5E1]">
                  <span>Delivery</span>
                  <span>{shippingTotal === 0 ? <strong className="text-emerald-400 uppercase text-[11px]">FREE</strong> : `₹${shippingTotal}`}</span>
                </div>
                <div className="pt-2 border-t border-[#D5A34A]/20 flex justify-between items-baseline font-bold text-sm">
                  <span className="text-white">Grand Total Payable</span>
                  <span className="font-serif text-xl text-[#F5BD48]">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Error Banner */}
              {checkoutError && (
                <div role="alert" className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{checkoutError}</div>
                </div>
              )}

              {/* Confirm Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('address')}
                  className="px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white hover:bg-[#24252A] rounded-xl transition-colors cursor-pointer"
                >
                  &larr; Back
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmOrder}
                  className="px-8 py-3 rounded-full bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] hover:brightness-105 text-[#08090B] font-bold text-sm shadow-[0_4px_16px_rgba(213,163,74,0.35)] flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <span>Verifying &amp; Securing Payment...</span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-[#08090B]" />
                      <span>Pay ₹{grandTotal.toLocaleString('en-IN')} &amp; Confirm Order</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* STEP 3: Order Confirmation Success Screen */}
          {step === 'success' && createdOrder && (
            <div className="text-center py-6 px-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#24252A] text-[#F5BD48] border border-[#D5A34A]/30 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10 text-[#F5BD48]" />
              </div>

              <h3 className="font-serif font-bold text-2xl text-white">
                Thank You! Your Gift Order is Placed!
              </h3>

              <p className="text-xs sm:text-sm text-[#CBD5E1] max-w-md mx-auto leading-relaxed">
                We have received your order and our artisan team at Snappy Gifts Atelier has commenced preparation with love and care.
              </p>

              {/* Order Box */}
              <div className="max-w-md mx-auto p-4 rounded-2xl bg-[#17181C] border border-[#D5A34A]/25 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-[#D5A34A]/15 pb-2">
                  <span className="text-[#94A3B8]">Order Number:</span>
                  <span className="font-mono font-bold text-[#F5BD48] text-sm">{createdOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">AWB Tracking ID:</span>
                  <span className="font-mono font-bold text-white">{createdOrder.awbNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Courier Partner:</span>
                  <span className="font-medium text-white">{createdOrder.courierPartner}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Estimated Delivery:</span>
                  <span className="font-bold text-emerald-400">{createdOrder.estimatedDeliveryDate}</span>
                </div>
                <div className="flex justify-between border-t border-[#D5A34A]/15 pt-2 font-bold">
                  <span className="text-white">Grand Total:</span>
                  <span className="text-[#F5BD48]">₹{createdOrder.grandTotal.toLocaleString('en-IN')} ({createdOrder.paymentMethod})</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrder(createdOrder);
                    onClose();
                    setActiveModal('order_track');
                  }}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] text-xs font-bold flex items-center gap-1.5 shadow-[0_2px_12px_rgba(213,163,74,0.3)] hover:brightness-105 transition-all cursor-pointer"
                >
                  <Truck className="w-4 h-4 text-[#08090B]" />
                  <span>Live Track Shipment</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrder(createdOrder);
                    onClose();
                    setActiveModal('invoice_view');
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#24252A] hover:bg-[#2E3036] text-[#CBD5E1] hover:text-[#F5BD48] border border-[#D5A34A]/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#D5A34A]" />
                  <span>Download GST Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-[#17181C] hover:bg-[#24252A] text-[#94A3B8] hover:text-white border border-[#D5A34A]/20 text-xs font-semibold transition-all cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
