'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  MapPin,
  Clock,
  ShieldCheck,
  Truck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Gift,
  CreditCard,
  Banknote,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

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

export default function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    clearCart,
    currentPincode,
    appliedCoupon,
    couponDiscount,
    showToast
  } = useApp();

  // Navigation steps: 'details' -> 'approval' -> 'payment' -> 'confirmed'
  const [currentStep, setCurrentStep] = useState<'details' | 'approval' | 'payment' | 'confirmed'>('details');

  // Address & Customer Info
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Hyderabad');
  const [state, setState] = useState('Telangana');
  const [pincode, setPincode] = useState(currentPincode || '500062');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'RAZORPAY' | 'COD'>('RAZORPAY');

  // Distance & Serviceability state
  const [distanceInfo, setDistanceInfo] = useState<{
    distanceKm?: number;
    eligible?: boolean;
    areaName?: string;
    message?: string;
  } | null>(null);
  const [isValidatingPin, setIsValidatingPin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Order State after creation
  const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(null);
  const [orderStageDetails, setOrderStageDetails] = useState<any | null>(null);
  const [isPollingStage, setIsPollingStage] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Minimum delivery date is 2 days from today (preparation time invariant)
  const minDeliveryDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Cart pricing computations
  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const isOrderGiftWrapped = cart.some((item) => Boolean(item.isGiftWrapped || item.customization?.giftWrap));
  const giftWrapFee = isOrderGiftWrapped ? 20 : 0;
  const discountTotal = couponDiscount;
  const taxableAmount = Math.max(0, subtotal + giftWrapFee - discountTotal);
  const estimatedGst = Math.round(taxableAmount * 0.18);
  const subtotalExclDelivery = taxableAmount + estimatedGst;

  // Validate Delivery PIN code & Distance when PIN changes
  useEffect(() => {
    const cleanPin = (pincode || '').trim();
    if (cleanPin.length === 6 && /^[1-9][0-9]{5}$/.test(cleanPin)) {
      setIsValidatingPin(true);
      fetch(`/api/shipping/distance?pincode=${cleanPin}`)
        .then((res) => res.json())
        .then((data) => {
          setIsValidatingPin(false);
          if (data.success && data.data) {
            const d = data.data as Record<string, unknown>;
            const distanceKm =
              typeof d.estimatedDistanceKm === 'number'
                ? d.estimatedDistanceKm
                : typeof d.distanceKm === 'number'
                  ? d.distanceKm
                  : undefined;
            const eligible =
              typeof d.eligible === 'boolean'
                ? d.eligible
                : typeof d.isServiceable === 'boolean'
                  ? d.isServiceable
                  : false;
            const areaName = typeof d.areaName === 'string' ? d.areaName : undefined;
            const message = typeof d.message === 'string' ? d.message : '';
            setDistanceInfo({
              distanceKm,
              eligible,
              areaName,
              message,
            });
            if (!eligible) {
              const rejection =
                typeof d.rejectionReason === 'string'
                  ? d.rejectionReason
                  : message || 'Destination exceeds our 20km delivery radius from A S Rao Nagar studio.';
              setFormError(rejection);
            } else {
              setFormError(null);
            }
          }
        })
        .catch(() => {
          setIsValidatingPin(false);
        });
    } else {
      setDistanceInfo(null);
    }
  }, [pincode]);

  // Set default delivery date (2 days from now)
  useEffect(() => {
    if (!deliveryDate) {
      setDeliveryDate(minDeliveryDate);
    }
  }, [deliveryDate, minDeliveryDate]);

  // Stage Polling for submitted order
  const checkOrderStage = async (orderNum: string) => {
    if (!orderNum) return;
    try {
      setIsPollingStage(true);
      const res = await fetch(`/api/orders/${orderNum}/approve-final-amount`);
      const json = await res.json();
      setIsPollingStage(false);
      if (res.ok && json.success && json.data) {
        setOrderStageDetails(json.data);
        if (json.data.stage === 'CONFIRMED') {
          setCurrentStep('confirmed');
        } else if (json.data.stage === 'CUSTOMER_APPROVED' || json.data.stage === 'PAYMENT_PENDING') {
          setCurrentStep('payment');
        } else {
          setCurrentStep('approval');
        }
      }
    } catch {
      setIsPollingStage(false);
    }
  };

  // Auto-poll stage while in approval view
  useEffect(() => {
    if (!activeOrderNumber || currentStep === 'confirmed') return;
    const interval = setInterval(() => {
      checkOrderStage(activeOrderNumber);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeOrderNumber, currentStep]);

  // Step 1: Handle Order Submission
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (cart.length === 0) {
      setFormError('Your shopping bag is empty.');
      return;
    }

    if (!customerName.trim() || customerName.trim().length < 2) {
      setFormError('Please enter a valid customer name.');
      return;
    }

    if (!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    const cleanPhone = customerPhone.replace(/[\s\-]/g, '');
    if (!cleanPhone || !/^(?:\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
      setFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!street.trim()) {
      setFormError('Street address is required.');
      return;
    }

    if (!pincode.trim() || pincode.trim().length !== 6) {
      setFormError('Please enter a valid 6-digit PIN code.');
      return;
    }

    if (distanceInfo && !distanceInfo.eligible) {
      setFormError('Delivery address is outside our Hyderabad 20km service radius.');
      return;
    }

    // Validate 2-day preparation time
    const selectedTime = new Date(deliveryDate).getTime();
    const minTime = new Date(minDeliveryDate).getTime();
    if (selectedTime < minTime) {
      setFormError('Selected delivery date must allow at least 2 days for preparation.');
      return;
    }

    setIsSubmitting(true);

    try {
      const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await fetch('/api/checkout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim().toLowerCase(),
          customerPhone: cleanPhone,
          shippingAddress: {
            name: customerName.trim(),
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            phone: cleanPhone,
          },
          items: cart.map((i) => ({
            productId: i.productId,
            variantId: i.variant?.id,
            quantity: i.quantity,
            isGiftWrapped: Boolean(i.isGiftWrapped || i.customization?.giftWrap),
            customization: i.customization ? {
              note: i.customization.engravedText || i.customization.specialInstructions || i.customization.giftNote || undefined,
              engravedText: i.customization.engravedText || undefined,
              fontFamily: i.customization.fontFamily || undefined,
              giftNote: i.customization.giftNote || undefined,
              giftWrap: Boolean(i.isGiftWrapped || i.customization?.giftWrap),
              artworkUploadId: i.customization.artworkUploadId,
              artworkUploadIds: i.customization.artworkUploadIds || (i.customization.artworkUploadId ? [i.customization.artworkUploadId] : undefined),
            } : (i.isGiftWrapped ? { giftWrap: true } : undefined),
          })),
          paymentMethod,
          idempotencyKey,
        }),
      });

      const json = await res.json();
      setIsSubmitting(false);

      if (!res.ok || !json.success || !json.data) {
        setFormError(json.error || 'Failed to submit order for delivery assessment.');
        return;
      }

      const orderData = json.data;
      setActiveOrderNumber(orderData.orderNumber);
      setCurrentStep('approval');
      checkOrderStage(orderData.orderNumber);
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err.message || 'An unexpected error occurred while submitting your order.');
    }
  };

  // Step 2: Handle Customer Final Amount Decision (Approve or Decline)
  const handleCustomerApprovalAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!activeOrderNumber || isProcessingApproval) return;
    setIsProcessingApproval(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/orders/${activeOrderNumber}/approve-final-amount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes: action === 'REJECT' ? 'Customer opted to decline delivery charge' : undefined,
        }),
      });

      const json = await res.json();
      setIsProcessingApproval(false);

      if (!res.ok || !json.success) {
        setFormError(json.error || 'Failed to submit approval.');
        return;
      }

      if (action === 'APPROVE') {
        setCurrentStep('payment');
        checkOrderStage(activeOrderNumber);
      } else {
        // Declined
        alert('Order has been cancelled as requested.');
        router.push('/cart');
      }
    } catch (err: any) {
      setIsProcessingApproval(false);
      setFormError(err.message || 'An error occurred during approval processing.');
    }
  };

  // Step 3: Handle Final Payment Execution
  const handleInitiatePayment = async () => {
    if (!activeOrderNumber || isSubmitting) return;
    setIsSubmitting(true);
    setFormError(null);

    if (paymentMethod === 'COD') {
      // Cash on Delivery confirmed
      setIsSubmitting(false);
      clearCart();
      setCurrentStep('confirmed');
      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch {}
      return;
    }

    try {
      const pmtRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: activeOrderNumber,
          customerAcceptedDeliveryCharge: true,
        }),
      });

      const pmtJson = await pmtRes.json();
      if (!pmtRes.ok || !pmtJson.success || !pmtJson.data) {
        setIsSubmitting(false);
        setFormError(pmtJson.error || 'Failed to initialize payment gateway.');
        return;
      }

      const pmtConfig = pmtJson.data;
      const scriptReady = await loadRazorpayScript();

      if (scriptReady && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: pmtConfig.gatewayKeyId,
          amount: pmtConfig.amountPaise,
          currency: pmtConfig.currency || 'INR',
          name: 'SNAPPY GIFTZ',
          description: `Order ${activeOrderNumber}`,
          order_id: pmtConfig.gatewayOrderId,
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone,
          },
          theme: { color: '#D5A34A' },
          handler: async function (rzpResp: any) {
            try {
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderNumber: activeOrderNumber,
                  gatewayOrderId: rzpResp.razorpay_order_id,
                  gatewayPaymentId: rzpResp.razorpay_payment_id,
                  gatewaySignature: rzpResp.razorpay_signature,
                }),
              });
              const verifyJson = await verifyRes.json();
              setIsSubmitting(false);
              if (verifyRes.ok && verifyJson.success) {
                clearCart();
                setCurrentStep('confirmed');
                try {
                  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
                } catch {}
              } else {
                setFormError(verifyJson.error || 'Payment verification failed.');
              }
            } catch (vErr: any) {
              setIsSubmitting(false);
              setFormError(vErr.message || 'Payment verification network error.');
            }
          },
          modal: {
            ondismiss: function () {
              setIsSubmitting(false);
            },
          },
        });
        rzp.open();
      } else {
        // Fallback for mock/offline environment
        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: activeOrderNumber,
            gatewayOrderId: pmtConfig.gatewayOrderId,
            gatewayPaymentId: `pay_mock_${Date.now()}`,
            gatewaySignature: 'mock_signature_valid',
          }),
        });
        const verifyJson = await verifyRes.json();
        setIsSubmitting(false);
        if (verifyRes.ok && verifyJson.success) {
          clearCart();
          setCurrentStep('confirmed');
          try {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          } catch {}
        } else {
          setFormError(verifyJson.error || 'Payment mock verification failed.');
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err.message || 'Payment initialization error.');
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
          <Link href="/cart" className="hover:text-[#F5BD48] transition-colors">Cart</Link>
          <span>/</span>
          <span className="text-[#D5A34A] font-medium">Bespoke Checkout</span>
        </nav>

        {/* Checkout Header */}
        <div className="pb-6 border-b border-[#24252A] mb-8">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F1F5F9] tracking-tight">
            Bespoke Checkout
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Handcrafted personal delivery across Hyderabad within 20km from our A S Rao Nagar studio.
          </p>

          {/* Checkout Steps Indicator */}
          <div className="flex items-center gap-2 sm:gap-4 mt-6 text-xs font-semibold overflow-x-auto pb-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              currentStep === 'details'
                ? 'bg-[#D5A34A]/20 border-[#D5A34A] text-[#F5BD48]'
                : 'bg-[#17181C] border-[#24252A] text-[#94A3B8]'
            }`}>
              <span className="w-5 h-5 rounded-full bg-[#08090B] flex items-center justify-center text-[10px]">1</span>
              <span>Delivery Details</span>
            </div>

            <span className="text-[#24252A]">→</span>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              currentStep === 'approval'
                ? 'bg-[#D5A34A]/20 border-[#D5A34A] text-[#F5BD48]'
                : 'bg-[#17181C] border-[#24252A] text-[#94A3B8]'
            }`}>
              <span className="w-5 h-5 rounded-full bg-[#08090B] flex items-center justify-center text-[10px]">2</span>
              <span>Delivery Fee &amp; Approval</span>
            </div>

            <span className="text-[#24252A]">→</span>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              currentStep === 'payment'
                ? 'bg-[#D5A34A]/20 border-[#D5A34A] text-[#F5BD48]'
                : 'bg-[#17181C] border-[#24252A] text-[#94A3B8]'
            }`}>
              <span className="w-5 h-5 rounded-full bg-[#08090B] flex items-center justify-center text-[10px]">3</span>
              <span>Payment</span>
            </div>

            <span className="text-[#24252A]">→</span>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              currentStep === 'confirmed'
                ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                : 'bg-[#17181C] border-[#24252A] text-[#94A3B8]'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmed</span>
            </div>
          </div>
        </div>

        {formError && (
          <div className="mb-6 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs sm:text-sm text-[#EF4444] flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Notice:</strong> {formError}
            </div>
          </div>
        )}

        {/* STEP 1: Delivery Details Form */}
        {currentStep === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7">
              <form onSubmit={handleSubmitOrder} className="bg-[#17181C] rounded-2xl border border-[#24252A] p-6 sm:p-8 space-y-6 shadow-xl">
                <h2 className="text-lg font-serif font-bold text-[#F1F5F9] flex items-center gap-2 border-b border-[#24252A] pb-3">
                  <MapPin className="w-5 h-5 text-[#D5A34A]" />
                  Recipient &amp; Delivery Information
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Aarav Malhotra"
                      className="w-full bg-[#08090B] border border-[#24252A] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#D5A34A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-[#08090B] border border-[#24252A] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#D5A34A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                    Email Address (For order tracking &amp; invoice) *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    className="w-full bg-[#08090B] border border-[#24252A] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#D5A34A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                    Complete Street Address *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Apartment/Villa No., Street, Landmark"
                    className="w-full bg-[#08090B] border border-[#24252A] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#D5A34A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      disabled
                      value={city}
                      className="w-full bg-[#08090B]/50 border border-[#24252A] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#94A3B8] cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      disabled
                      value={state}
                      className="w-full bg-[#08090B]/50 border border-[#24252A] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#94A3B8] cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                      Delivery PIN Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="500062"
                      className="w-full bg-[#08090B] border border-[#24252A] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#D5A34A]"
                    />
                  </div>
                </div>

                {/* Distance & 20km Verification Card */}
                {isValidatingPin && (
                  <div className="p-3 rounded-xl bg-[#08090B] border border-[#24252A] flex items-center gap-2 text-xs text-[#94A3B8]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D5A34A]" />
                    <span>Checking distance from A S Rao Nagar hub...</span>
                  </div>
                )}

                {distanceInfo && (
                  <div className={`p-4 rounded-xl border text-xs ${
                    distanceInfo.eligible
                      ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                      : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                  }`}>
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      {distanceInfo.eligible ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Eligible for Studio Delivery ({distanceInfo.distanceKm} km from hub)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          <span>Delivery Unavailable: Exceeds 20km Coverage ({distanceInfo.distanceKm} km)</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-xs opacity-90">{distanceInfo.message}</p>
                  </div>
                )}

                {/* Delivery Date Picker (Enforcing 2-day prep time) */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                    Desired Delivery Date (Minimum 2 Days Required for Handcrafted Preparation) *
                  </label>
                  <input
                    type="date"
                    required
                    min={minDeliveryDate}
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-[#08090B] border border-[#24252A] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#F1F5F9] focus:outline-none focus:border-[#D5A34A]"
                  />
                  <p className="text-[11px] text-[#94A3B8] mt-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#D5A34A]" />
                    Earliest available handcrafted dispatch: {new Date(minDeliveryDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                      paymentMethod === 'RAZORPAY'
                        ? 'bg-[#D5A34A]/10 border-[#D5A34A] text-[#F1F5F9]'
                        : 'bg-[#08090B] border-[#24252A] text-[#94A3B8]'
                    }`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'RAZORPAY'}
                        onChange={() => setPaymentMethod('RAZORPAY')}
                        className="sr-only"
                      />
                      <CreditCard className="w-5 h-5 text-[#D5A34A]" />
                      <div>
                        <p className="text-xs sm:text-sm font-semibold">Online Payment (Razorpay)</p>
                        <p className="text-[11px] opacity-80">UPI, Cards, NetBanking (Post Approval)</p>
                      </div>
                    </label>

                    <label className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                      paymentMethod === 'COD'
                        ? 'bg-[#D5A34A]/10 border-[#D5A34A] text-[#F1F5F9]'
                        : 'bg-[#08090B] border-[#24252A] text-[#94A3B8]'
                    }`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'COD'}
                        onChange={() => setPaymentMethod('COD')}
                        className="sr-only"
                      />
                      <Banknote className="w-5 h-5 text-[#D5A34A]" />
                      <div>
                        <p className="text-xs sm:text-sm font-semibold">Cash on Delivery (COD)</p>
                        <p className="text-[11px] opacity-80">Pay upon physical delivery</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting || (distanceInfo !== null && !distanceInfo.eligible)}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#D5A34A]/25"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Submitting Order for Studio Review...
                    </>
                  ) : (
                    <>
                      Submit Order for Studio Assessment
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Column: Order Review Sidebar */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#17181C] rounded-2xl border border-[#24252A] p-6 shadow-xl space-y-4">
                <h3 className="text-base font-serif font-bold text-[#F1F5F9] pb-3 border-b border-[#24252A]">
                  Order Items ({cart.length})
                </h3>

                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3 items-center text-xs">
                      <div className="w-12 h-12 rounded-lg bg-[#08090B] border border-[#24252A] overflow-hidden relative flex-shrink-0">
                        <Image
                          src={item.product.images?.[0] || '/assets/snappy-gifts-trimmed.png'}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#F1F5F9] truncate">{item.product.name}</p>
                        <p className="text-[11px] text-[#94A3B8]">Qty: {item.quantity}</p>
                        {item.customization?.engravedText && (
                          <p className="text-[10px] text-[#D5A34A] truncate">
                            Engrave: &ldquo;{item.customization.engravedText}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="text-right font-semibold text-[#F5BD48]">
                        ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotals */}
                <div className="pt-4 border-t border-[#24252A] space-y-2 text-xs">
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Items Subtotal</span>
                    <span className="text-[#F1F5F9]">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Luxury Gift Wrapping</span>
                    <span className="text-[#F1F5F9]">{giftWrapFee > 0 ? `₹${giftWrapFee}` : '₹0'}</span>
                  </div>

                  {discountTotal > 0 && (
                    <div className="flex justify-between text-[#10B981]">
                      <span>Coupon Discount</span>
                      <span>-₹{discountTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Estimated GST (18%)</span>
                    <span className="text-[#F1F5F9]">₹{estimatedGst.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="pt-2 border-t border-[#24252A] flex justify-between font-bold text-sm">
                    <span className="text-[#F1F5F9]">Initial Total (Excl. Delivery)</span>
                    <span className="text-[#F5BD48]">₹{subtotalExclDelivery.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Delivery Notice Callout */}
                <div className="p-4 rounded-xl bg-[#08090B] border border-[#D5A34A]/30 text-xs text-[#94A3B8] space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-[#D5A34A]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bespoke Delivery Approval Flow</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    Delivery charges are personally assessed by the studio owner based on your exact location (~20km from A S Rao Nagar).
                    <strong> No payment is taken until you review and explicitly approve the final delivery charge.</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Studio Assessment & Customer Approval */}
        {currentStep === 'approval' && (
          <div className="max-w-2xl mx-auto bg-[#17181C] rounded-2xl border border-[#D5A34A]/40 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center pb-4 border-b border-[#24252A]">
              <span className="text-xs uppercase tracking-widest text-[#D5A34A] font-bold">
                Order Under Studio Review
              </span>
              <h2 className="text-2xl font-serif font-bold text-[#F1F5F9] mt-1">
                Order #{activeOrderNumber}
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                {orderStageDetails?.isDeliveryChargeAssigned
                  ? 'The studio owner has assigned your delivery charge. Please review and approve.'
                  : 'Awaiting delivery charge assignment from our A S Rao Nagar studio...'}
              </p>
            </div>

            {/* Stage Status Card */}
            <div className="p-4 rounded-xl bg-[#08090B] border border-[#24252A] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#94A3B8]">Review Status:</span>
                <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                  orderStageDetails?.stage === 'AWAITING_CUSTOMER_APPROVAL'
                    ? 'bg-[#F5BD48]/20 text-[#F5BD48] border border-[#F5BD48]/40 animate-pulse'
                    : 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/40'
                }`}>
                  {orderStageDetails?.stage === 'AWAITING_CUSTOMER_APPROVAL'
                    ? '⚡ Action Required: Approve Amount'
                    : '⏳ Awaiting Studio Delivery Charge'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#94A3B8]">Items Subtotal:</span>
                <span className="font-semibold text-[#F1F5F9]">
                  ₹{(orderStageDetails ? orderStageDetails.itemsSubtotalPaise / 100 : subtotal).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[#94A3B8]">Assigned Delivery Charge:</span>
                <span className="font-bold text-[#D5A34A]">
                  {orderStageDetails?.isDeliveryChargeAssigned
                    ? `₹${(orderStageDetails.shippingTotalPaise / 100).toFixed(2)}`
                    : 'Pending Owner Review'}
                </span>
              </div>

              <div className="pt-2 border-t border-[#24252A] flex justify-between items-baseline">
                <span className="font-bold text-sm text-[#F1F5F9]">Final Grand Total:</span>
                <span className="text-xl font-bold text-[#F5BD48]">
                  ₹{(orderStageDetails
                    ? orderStageDetails.grandTotalPaise / 100
                    : subtotalExclDelivery
                  ).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Action buttons based on stage */}
            {orderStageDetails?.stage === 'AWAITING_CUSTOMER_APPROVAL' ? (
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleCustomerApprovalAction('APPROVE')}
                  disabled={isProcessingApproval}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#D5A34A]/25"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Final Amount (₹{(orderStageDetails.grandTotalPaise / 100).toLocaleString('en-IN')}) &amp; Proceed to Payment
                </button>

                <button
                  type="button"
                  onClick={() => handleCustomerApprovalAction('REJECT')}
                  disabled={isProcessingApproval}
                  className="w-full py-2.5 rounded-xl border border-[#EF4444]/40 text-[#EF4444] text-xs hover:bg-[#EF4444]/10 transition-colors"
                >
                  Decline &amp; Cancel Order
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-center pt-2">
                <button
                  type="button"
                  onClick={() => activeOrderNumber && checkOrderStage(activeOrderNumber)}
                  disabled={isPollingStage}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#24252A] text-xs font-semibold text-[#F1F5F9] hover:bg-[#D5A34A] hover:text-[#08090B] transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPollingStage ? 'animate-spin' : ''}`} />
                  Refresh Studio Status
                </button>
                <p className="text-[11px] text-[#94A3B8]">
                  This page checks for updates automatically every 5 seconds.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Payment Screen (Unlocked only after customer approval) */}
        {currentStep === 'payment' && (
          <div className="max-w-xl mx-auto bg-[#17181C] rounded-2xl border border-[#D5A34A]/40 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center pb-4 border-b border-[#24252A]">
              <span className="text-xs uppercase tracking-widest text-[#10B981] font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Delivery Amount Approved
              </span>
              <h2 className="text-2xl font-serif font-bold text-[#F1F5F9] mt-2">
                Complete Your Payment
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                Order #{activeOrderNumber}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#08090B] border border-[#24252A] flex justify-between items-center">
              <div>
                <p className="text-xs text-[#94A3B8]">Total Amount to Pay</p>
                <p className="text-2xl font-bold text-[#F5BD48]">
                  ₹{(orderStageDetails ? orderStageDetails.grandTotalPaise / 100 : subtotalExclDelivery).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#94A3B8]">Selected Method</p>
                <p className="text-xs font-semibold text-[#D5A34A]">
                  {paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online (Razorpay)'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInitiatePayment}
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#D5A34A]/25"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing Payment...
                </>
              ) : paymentMethod === 'COD' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Cash on Delivery Order
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Pay with Razorpay (₹{(orderStageDetails ? orderStageDetails.grandTotalPaise / 100 : subtotalExclDelivery).toLocaleString('en-IN')})
                </>
              )}
            </button>

            <p className="text-[11px] text-[#94A3B8] text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#D5A34A]" />
              {paymentMethod === 'COD'
                ? 'Stock is held and will be deducted upon physical delivery.'
                : '100% Encrypted Gateway Processing. Verified by Razorpay.'}
            </p>
          </div>
        )}

        {/* STEP 4: Confirmed Order Screen */}
        {currentStep === 'confirmed' && (
          <div className="max-w-xl mx-auto bg-[#17181C] rounded-2xl border border-[#10B981]/40 p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs uppercase tracking-widest text-[#10B981] font-bold">
                Order Confirmed
              </span>
              <h2 className="text-2xl font-serif font-bold text-[#F1F5F9] mt-1">
                Thank You For Your Bespoke Order!
              </h2>
              <p className="text-xs text-[#94A3B8] mt-2">
                Order <strong className="text-[#F5BD48]">#{activeOrderNumber}</strong> has been successfully placed and forwarded to our Hyderabad workshop.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#08090B] border border-[#24252A] text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Customer:</span>
                <span className="font-semibold text-[#F1F5F9]">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Delivery Destination:</span>
                <span className="font-semibold text-[#F1F5F9]">{city}, {pincode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Target Delivery Date:</span>
                <span className="font-semibold text-[#D5A34A]">
                  {new Date(deliveryDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#24252A]">
                <span className="text-[#94A3B8]">Payment Status:</span>
                <span className="font-bold text-[#10B981]">
                  {paymentMethod === 'COD' ? 'Pending Upon Delivery' : 'Paid & Verified'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/account/orders"
                className="flex-1 py-3 rounded-xl bg-[#24252A] hover:bg-[#D5A34A] hover:text-[#08090B] text-xs font-bold text-[#F1F5F9] transition-all flex items-center justify-center gap-1.5"
              >
                View Order in Account
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/#catalog-section"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#D5A34A] to-[#F5BD48] text-[#08090B] text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
              >
                Continue Gifting
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

