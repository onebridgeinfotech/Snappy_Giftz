import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Order } from '../types';
import {
  X,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Sparkles,
  FileText,
  ShieldCheck,
  Search,
  ExternalLink,
  AlertCircle,
  Loader2,
  Crown
} from 'lucide-react';

interface OrderTrackingModalProps {
  onClose: () => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({ onClose }) => {
  const { orders, selectedOrder, setSelectedOrder, setActiveModal } = useApp();

  const [activeTab, setActiveTab] = useState<'current' | 'lookup'>('current');
  const [lookupOrderNumber, setLookupOrderNumber] = useState('');
  const [lookupContact, setLookupContact] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookedUpOrder, setLookedUpOrder] = useState<any | null>(null);

  // Authenticated customer orders fetched from server
  const [serverCustomerOrders, setServerCustomerOrders] = useState<any[]>([]);
  const [fetchingCustomerOrders, setFetchingCustomerOrders] = useState(false);

  // Customer proof approval states
  const [consentChecked, setConsentChecked] = useState<Record<string, boolean>>({});
  const [approvingProof, setApprovingProof] = useState<Record<string, boolean>>({});
  const [approvalError, setApprovalError] = useState<Record<string, string | null>>({});
  const [approvalSuccess, setApprovalSuccess] = useState<Record<string, string | null>>({});

  // Secure proof preview object URLs and loading state
  const [proofObjectUrls, setProofObjectUrls] = useState<Record<string, string>>({});
  const [proofLoading, setProofLoading] = useState<Record<string, boolean>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const objectUrlsRef = useRef<Record<string, string>>({});

  const handleApproveProof = async (orderItemId: string, proofVersion: number) => {
    const orderNum = displayOrder?.orderNumber;
    if (!orderNum) return;

    setApprovalError(prev => ({ ...prev, [orderItemId]: null }));
    setApprovalSuccess(prev => ({ ...prev, [orderItemId]: null }));
    setApprovingProof(prev => ({ ...prev, [orderItemId]: true }));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (displayOrder.guestLookupToken) {
        headers['x-guest-token'] = displayOrder.guestLookupToken;
      }

      const res = await fetch(`/api/orders/${encodeURIComponent(orderNum)}/proofs/${encodeURIComponent(orderItemId)}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          proofVersion,
          consent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setApprovalError(prev => ({
          ...prev,
          [orderItemId]: data.error || 'Failed to approve proof.',
        }));
      } else {
        setApprovalSuccess(prev => ({
          ...prev,
          [orderItemId]: `Proof v${proofVersion} successfully approved for production!`,
        }));

        // Immediately update state in UI
        const updateItem = (item: any) => {
          if (item.id === orderItemId && item.personalization) {
            return {
              ...item,
              personalization: {
                ...item.personalization,
                customerApprovalStatus: 'APPROVED',
                customerApprovedAt: new Date().toISOString(),
              },
            };
          }
          return item;
        };

        if (lookedUpOrder) {
          setLookedUpOrder((prev: any) => ({
            ...prev,
            items: prev.items ? prev.items.map(updateItem) : [],
          }));
        } else if (selectedOrder) {
          setSelectedOrder({
            ...selectedOrder,
            items: selectedOrder.items ? selectedOrder.items.map(updateItem) : [],
          });
        }
      }
    } catch (err: any) {
      setApprovalError(prev => ({
        ...prev,
        [orderItemId]: err.message || 'Network error approving proof.',
      }));
    } finally {
      setApprovingProof(prev => ({ ...prev, [orderItemId]: false }));
    }
  };

  // Fetch real authenticated customer orders from server on mount
  useEffect(() => {
    let isCancelled = false;
    setFetchingCustomerOrders(true);
    fetch('/api/orders')
      .then(res => res.json())
      .then(data => {
        if (!isCancelled && data.orders && Array.isArray(data.orders)) {
          setServerCustomerOrders(data.orders);
          // If no order is currently selected, select the latest server order
          if (!selectedOrder && data.orders.length > 0) {
            setSelectedOrder(data.orders[0]);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setFetchingCustomerOrders(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Determine which order to display
  const displayOrder: any = lookedUpOrder || selectedOrder || serverCustomerOrders[0] || orders[0] || null;

  // Handle guest lookup form submission
  const handleGuestLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupLoading(true);

    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: lookupOrderNumber.trim(),
          contact: lookupContact.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No matching order found.');
      }

      setLookedUpOrder(data.order);
      setActiveTab('lookup');
    } catch (err: any) {
      setLookupError(err.message || 'Lookup failed.');
      setLookedUpOrder(null);
    } finally {
      setLookupLoading(false);
    }
  };

  // Fetch verified preview images securely through authenticated private storage endpoint
  useEffect(() => {
    if (!displayOrder || !Array.isArray(displayOrder.items)) return;

    let isCancelled = false;
    const abortController = new AbortController();

    displayOrder.items.forEach(async (item: any) => {
      const proofUrl = item.personalization?.proofImageUrl || item.proofImageUrl;
      if (!proofUrl) return;

      // Revoke any existing object URL when replacing proof
      if (objectUrlsRef.current[item.id]) {
        try {
          URL.revokeObjectURL(objectUrlsRef.current[item.id]);
        } catch {}
        delete objectUrlsRef.current[item.id];
      }

      setProofLoading(prev => ({ ...prev, [item.id]: true }));
      setProofErrors(prev => ({ ...prev, [item.id]: false }));

      try {
        const headers: Record<string, string> = {};
        if (displayOrder.guestLookupToken) {
          headers['x-guest-token'] = displayOrder.guestLookupToken;
        }

        const res = await fetch(proofUrl, {
          method: 'GET',
          headers,
          credentials: 'same-origin',
          signal: abortController.signal,
        });

        if (!res.ok) {
          if (!isCancelled) {
            setProofErrors(prev => ({ ...prev, [item.id]: true }));
          }
          return;
        }

        const blob = await res.blob();
        if (isCancelled) return;

        const objUrl = URL.createObjectURL(blob);
        objectUrlsRef.current[item.id] = objUrl;

        setProofObjectUrls(prev => ({ ...prev, [item.id]: objUrl }));
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (!isCancelled) {
          setProofErrors(prev => ({ ...prev, [item.id]: true }));
        }
      } finally {
        if (!isCancelled) {
          setProofLoading(prev => ({ ...prev, [item.id]: false }));
        }
      }
    });

    // Cleanup: revoke all active object URLs on unmount or before next run
    return () => {
      isCancelled = true;
      abortController.abort();
      Object.values(objectUrlsRef.current).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      objectUrlsRef.current = {};
      setProofObjectUrls({});
    };
  }, [
    displayOrder?.id,
    displayOrder?.orderNumber,
    displayOrder?.guestLookupToken,
    displayOrder?.items
      ? displayOrder.items
          .map((i: any) => `${i.id}:${i.personalization?.proofImageUrl || i.proofImageUrl}:${i.personalization?.proofVersion}`)
          .join('|')
      : '',
  ]);

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

  const steps = [
    { title: 'Order Placed', desc: 'Payment verified & order booked' },
    { title: 'Artwork Approval', desc: 'Laser typography preview verified' },
    { title: 'In Customization', desc: 'Laser etching / UV printing in SNAPPY GIFTZ Craft Atelier' },
    { title: 'Quality Check', desc: 'Tamper-proof gift packaging & wax seal' },
    { title: 'Dispatched', desc: 'Handed to express logistics courier' },
    { title: 'In Transit', desc: 'On route to destination delivery hub' },
    { title: 'Delivered', desc: 'Safely handed over to recipient' }
  ];

  const getStepIndex = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
      case 'ORDER PLACED':
        return 0;
      case 'CONFIRMED':
      case 'ARTWORK APPROVAL':
        return 1;
      case 'IN_CUSTOMIZATION':
      case 'IN CUSTOMIZATION':
        return 2;
      case 'QUALITY_CHECK':
      case 'QUALITY CHECK':
        return 3;
      case 'DISPATCHED':
        return 4;
      case 'IN TRANSIT':
        return 5;
      case 'DELIVERED':
        return 6;
      default:
        return 0;
    }
  };

  const statusString = displayOrder?.orderStatus || 'PENDING';
  const activeIdx = getStepIndex(statusString);
  const shipment = displayOrder?.shipment || null;
  const awb = shipment?.awbNumber || displayOrder?.awbNumber || null;
  const carrier = shipment?.carrierPartner || displayOrder?.courierPartner || null;
  const trackingUrl = shipment?.trackingUrl || displayOrder?.trackingUrl || null;
  const isDispatchedOrDelivered = activeIdx >= 4;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-[#08090B] rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-[#D5A34A]/30 overflow-hidden my-6 text-[#F1F5F9]">
        
        {/* Header - Refined Dark Luxury */}
        <div className="bg-[#17181C] text-white px-6 py-4 flex items-center justify-between border-b border-[#D5A34A]/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#24252A] border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48]">
              <Truck className="w-5 h-5 text-[#D5A34A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="tracking-modal-title" className="font-serif font-bold text-lg text-white">Live Shipment Tracking</h3>
                <Crown className="w-3.5 h-3.5 text-[#F5BD48]" />
              </div>
              <p className="text-xs text-[#CBD5E1]">
                Courier Partner: <span className="text-[#F5BD48] font-semibold">{carrier || (isDispatchedOrDelivered ? 'Express Logistics' : 'Assigned Upon Dispatch')}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close tracking modal"
            className="p-1.5 rounded-full text-[#CBD5E1] hover:text-[#F5BD48] hover:bg-[#24252A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Active Order vs Search Lookup */}
        <div className="bg-[#121316] border-b border-[#D5A34A]/15 px-6 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveTab('current'); setLookedUpOrder(null); }}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'current'
                  ? 'bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold shadow-xs'
                  : 'text-[#CBD5E1] hover:text-[#F5BD48] bg-[#24252A] border border-[#D5A34A]/20'
              }`}
            >
              Recent Orders {orders.length > 0 ? `(${orders.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lookup')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'lookup'
                  ? 'bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold shadow-xs'
                  : 'text-[#CBD5E1] hover:text-[#F5BD48] bg-[#24252A] border border-[#D5A34A]/20'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track with Order # &amp; Phone/Email</span>
            </button>
          </div>
          {fetchingCustomerOrders && (
            <span className="text-[11px] text-[#94A3B8] flex items-center gap-1 font-mono">
              <Loader2 className="w-3 h-3 animate-spin text-[#D5A34A]" /> Syncing...
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* LOOKUP FORM TAB */}
          {activeTab === 'lookup' && !lookedUpOrder && (
            <form onSubmit={handleGuestLookup} className="p-5 rounded-2xl bg-[#17181C] border border-[#D5A34A]/25 space-y-4 text-xs">
              <div>
                <h4 className="font-serif font-bold text-white text-sm">Guest &amp; Order Lookup</h4>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  Enter your Snappy Gifts Order Number and matching Email or Mobile Phone to check real-time progress.
                </p>
              </div>

              {lookupError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{lookupError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                    Order Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SG-2026-10492"
                    value={lookupOrderNumber}
                    onChange={(e) => setLookupOrderNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] font-mono text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
                    Matching Email or Phone
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. rahul@example.com or 9876543210"
                    value={lookupContact}
                    onChange={(e) => setLookupContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5A34A]/25 bg-[#24252A] text-xs text-[#F1F5F9] placeholder-[#94A3B8] focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A] outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 hover:brightness-105 shadow-[0_2px_12px_rgba(213,163,74,0.3)] cursor-pointer"
                >
                  {lookupLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#08090B]" />
                      <span>Verifying Order...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5 text-[#08090B]" />
                      <span>Track Shipment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* If looking up succeeded, show 'Search Another' banner */}
          {activeTab === 'lookup' && lookedUpOrder && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
              <span>Showing verified shipment status for <strong>{lookedUpOrder.orderNumber}</strong>.</span>
              <button
                type="button"
                onClick={() => { setLookedUpOrder(null); setLookupOrderNumber(''); }}
                className="font-bold underline hover:text-emerald-200 cursor-pointer"
              >
                Track Another
              </button>
            </div>
          )}

          {/* Order Selector (if multiple exist in context or from server) */}
          {activeTab === 'current' && (orders.length > 1 || serverCustomerOrders.length > 0) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[#94A3B8] font-semibold shrink-0">Select Order:</span>
              {(serverCustomerOrders.length > 0 ? serverCustomerOrders : orders).map((o: any) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOrder(o)}
                  className={`px-3 py-1 rounded-full font-mono font-semibold transition-all shrink-0 cursor-pointer ${
                    displayOrder?.id === o.id
                      ? 'bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold shadow-xs'
                      : 'bg-[#24252A] text-[#CBD5E1] hover:text-[#F5BD48] border border-[#D5A34A]/20'
                  }`}
                >
                  {o.orderNumber}
                </button>
              ))}
            </div>
          )}

          {/* Shipment Summary Box */}
          <div className="p-4 rounded-2xl bg-[#17181C] border border-[#D5A34A]/20 text-xs space-y-2.5">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <span className="text-[#94A3B8]">AWB Tracking #</span>
                <div className="font-mono font-bold text-sm text-white mt-0.5">
                  {awb || (
                    <span className="text-[#F5BD48] font-sans text-xs bg-[#D5A34A]/15 px-2.5 py-0.5 rounded border border-[#D5A34A]/30">
                      Pending Dispatch Assignment
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[#94A3B8]">Current Fulfillment Status</span>
                <div className="font-bold text-[#F5BD48] text-sm mt-0.5 flex items-center justify-end gap-1 font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#F5BD48] animate-pulse" />
                  {statusString.replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            {/* Destination info */}
            <div className="pt-2 border-t border-[#D5A34A]/15 flex flex-wrap justify-between items-center gap-2 text-[#CBD5E1]">
              <span>
                Destination: {displayOrder?.shippingAddress?.city || 'City'}, {displayOrder?.shippingAddress?.state || 'State'} ({displayOrder?.shippingAddress?.pincode || 'PIN'})
              </span>
              <span>
                Recipient: <strong className="text-white">{displayOrder?.shippingAddress?.name || displayOrder?.customerName}</strong>
              </span>
            </div>

            {/* External Carrier Link if tracking URL exists */}
            {trackingUrl && (
              <div className="pt-2 border-t border-[#D5A34A]/15 flex justify-end">
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#D5A34A] hover:text-[#F5BD48] font-semibold underline text-[11px]"
                >
                  <span>Track on {carrier || 'Courier'} Express Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Banner when tracking is not yet assigned */}
            {!awb && (
              <div className="pt-2 border-t border-[#D5A34A]/15 text-[11px] text-[#CBD5E1] bg-[#24252A] p-2.5 rounded-xl border border-[#D5A34A]/15 leading-relaxed">
                ✨ <strong className="text-[#F5BD48]">Artisan Lab in Progress:</strong> Your gift is undergoing precision customization and quality inspection in our SNAPPY GIFTZ workshop. Express courier tracking information will be dispatched once sealed.
              </div>
            )}
          </div>

          {/* Personalized Items Proof Review & Approval */}
          {Array.isArray(displayOrder?.items) && displayOrder.items.some((it: any) => it.personalization || it.proofImageUrl) && (
            <div className="p-4 rounded-2xl bg-[#17181C] border border-[#D5A34A]/25 text-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#D5A34A]/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F5BD48]" />
                  <h4 className="font-serif font-bold text-white text-sm">
                    Artisan Personalization &amp; Customer Proof Review
                  </h4>
                </div>
                <span className="text-[10px] text-[#F5BD48] bg-[#D5A34A]/15 border border-[#D5A34A]/30 font-medium px-2 py-0.5 rounded-full font-mono">
                  Atelier Verification
                </span>
              </div>

              <div className="space-y-4">
                {displayOrder.items
                  .filter((it: any) => it.personalization || it.proofImageUrl)
                  .map((item: any) => {
                    const pers = item.personalization;
                    const proofUrl = pers?.proofImageUrl || item.proofImageUrl;
                    const proofVer = pers?.proofVersion || 1;
                    const isApproved = pers?.customerApprovalStatus === 'APPROVED';
                    const isRework = pers?.staffReviewStatus === 'REJECTED_FOR_REWORK';
                    const isRevisedPending = !isApproved && proofVer > 1;

                    const previewBlobUrl = proofObjectUrls[item.id];
                    const isProofLoading = proofLoading[item.id];
                    const isProofFailed = proofErrors[item.id];

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-[#24252A] border border-[#D5A34A]/20 shadow-xs space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-white text-sm">{item.productName}</div>
                            {item.sku && <div className="text-[10px] text-[#94A3B8] font-mono">SKU: {item.sku}</div>}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono bg-[#17181C] text-[#CBD5E1] px-2 py-0.5 rounded border border-[#D5A34A]/20">
                              Proof v{proofVer}
                            </span>
                            {isApproved ? (
                              <span className="text-[10px] font-semibold bg-emerald-950/50 text-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/40">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Customer Approved</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-amber-950/50 text-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/40">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>Pending Customer Approval</span>
                              </span>
                            )}
                            {isRework && (
                              <span className="text-[10px] font-semibold bg-rose-950/50 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40">
                                Staff Rework Requested
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Revised Proof Invalidation Notice */}
                        {isRevisedPending && (
                          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px] flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <strong>Revised Proof Notice (v{proofVer}):</strong> An updated design proof has been created.
                              Any earlier customer approval has been invalidated. Please review the updated preview below and submit your approval to authorize engraving for production.
                            </div>
                          </div>
                        )}

                        {/* Inscription preview info */}
                        {pers?.engravedText && (
                          <div className="p-2.5 rounded-lg bg-[#17181C] border border-[#D5A34A]/20 text-[11px] flex flex-wrap justify-between gap-1 text-[#CBD5E1]">
                            <div>
                              <span className="text-[#94A3B8]">Inscription: </span>
                              <span className="font-semibold text-[#F5BD48]">&ldquo;{pers.engravedText}&rdquo;</span>
                            </div>
                            {pers.fontFamily && (
                              <div>
                                <span className="text-[#94A3B8]">Typography: </span>
                                <span className="font-mono text-white">{pers.fontFamily}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Visual Proof Preview */}
                        {proofUrl && (
                          <div className="relative border border-[#D5A34A]/25 rounded-xl overflow-hidden bg-[#08090B] aspect-video max-h-48 flex items-center justify-center">
                            {isProofLoading ? (
                              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                                <Loader2 className="w-4 h-4 animate-spin text-[#F5BD48]" />
                                <span>Loading verified proof preview...</span>
                              </div>
                            ) : previewBlobUrl ? (
                              <>
                                <img
                                  src={previewBlobUrl}
                                  alt={`${item.productName} Proof Preview v${proofVer}`}
                                  className="max-h-full max-w-full object-contain"
                                />
                                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#08090B]/90 border border-[#D5A34A]/30 text-[#F5BD48] font-mono text-[10px]">
                                  Proof v{proofVer}
                                </div>
                              </>
                            ) : isProofFailed ? (
                              <div className="p-3 text-center text-xs text-[#94A3B8] flex flex-col items-center gap-1">
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                                <span>Proof preview unavailable. Please check authorization or network.</span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Approval Controls */}
                        {!isApproved ? (
                          <div className="p-3 rounded-xl bg-[#17181C] border border-[#D5A34A]/20 space-y-2.5">
                            {approvalError[item.id] && (
                              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                <span>{approvalError[item.id]}</span>
                              </div>
                            )}
                            {approvalSuccess[item.id] && (
                              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                <span>{approvalSuccess[item.id]}</span>
                              </div>
                            )}

                            <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#CBD5E1] select-none">
                              <input
                                type="checkbox"
                                checked={!!consentChecked[item.id]}
                                onChange={(e) =>
                                  setConsentChecked((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 rounded text-[#D5A34A] focus:ring-[#D5A34A] accent-[#D5A34A]"
                              />
                              <span>
                                I have inspected this exact proof design (v{proofVer}) and grant my consent to proceed with artisan laser crafting.
                              </span>
                            </label>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={!consentChecked[item.id] || approvingProof[item.id]}
                                onClick={() => handleApproveProof(item.id, proofVer)}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F5BD48] via-[#D5A34A] to-[#B88728] text-[#08090B] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 text-xs shadow-xs hover:brightness-105 cursor-pointer"
                              >
                                {approvingProof[item.id] ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin text-[#08090B]" />
                                    <span>Recording Approval...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#08090B]" />
                                    <span>Approve Proof v{proofVer} for Production</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <span>Proof design verified and authorized by customer for production etching.</span>
                            </span>
                            {pers?.customerApprovedAt && (
                              <span className="text-[10px] text-emerald-400 font-mono">
                                {new Date(pers.customerApprovedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Stepper Timeline - Dark Luxury with Champagne Gold Accents */}
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D5A34A]/25">
            {steps.map((st, idx) => {
              const isDone = idx <= activeIdx;
              const isCurrent = idx === activeIdx;

              return (
                <div key={idx} className="relative flex items-start gap-4">
                  {/* Step circle */}
                  <div className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent
                      ? 'bg-[#F5BD48] text-[#08090B] ring-4 ring-[#D5A34A]/30 font-extrabold animate-pulse'
                      : isDone
                      ? 'bg-[#D5A34A] text-[#08090B] font-bold'
                      : 'bg-[#24252A] text-[#94A3B8] border border-[#D5A34A]/20'
                  }`}>
                    {isDone ? '✓' : idx + 1}
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold ${isCurrent ? 'text-[#F5BD48] font-serif text-sm' : isDone ? 'text-white' : 'text-[#64748B]'}`}>
                      {st.title}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] bg-[#D5A34A]/20 text-[#F5BD48] border border-[#D5A34A]/30 font-medium px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                          Current Stage
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-[#D5A34A]/20 flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedOrder(displayOrder);
                onClose();
                setActiveModal('invoice_view');
              }}
              className="text-[#D5A34A] font-semibold hover:text-[#F5BD48] hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#D5A34A]" />
              <span>Download Tax Invoice</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-[#24252A] hover:bg-[#2E3036] border border-[#D5A34A]/30 text-[#CBD5E1] hover:text-[#F5BD48] font-semibold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
