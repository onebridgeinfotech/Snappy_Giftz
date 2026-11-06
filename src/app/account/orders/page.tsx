'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  Download,
  AlertTriangle,
  ArrowLeft,
  Clock,
  CheckCircle2,
  ShieldAlert,
  FileText,
  ChevronDown,
  ChevronUp,
  Truck,
  CreditCard,
  Sparkles,
} from 'lucide-react';

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [damageReportingOrder, setDamageReportingOrder] = useState<string | null>(null);
  const [damageDescription, setDamageDescription] = useState('');
  const [damageSubmitting, setDamageSubmitting] = useState(false);
  const [damageFeedback, setDamageFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/orders')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?redirect=/account/orders');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.data)) {
          setOrders(data.data);
        } else {
          setOrders([]);
        }
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [router]);

  const handleReportDamage = async (orderNumber: string) => {
    if (!damageDescription.trim()) return;
    setDamageSubmitting(true);
    setDamageFeedback(null);

    try {
      const res = await fetch(`/api/orders/${orderNumber}/report-damage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: damageDescription.trim(),
          photos: [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit damage report.');
      }

      setDamageFeedback({
        type: 'success',
        message: 'Your report has been logged. Our Hyderabad support desk will contact you within 4 business hours.',
      });
      setDamageDescription('');
      setTimeout(() => {
        setDamageReportingOrder(null);
        setDamageFeedback(null);
      }, 3500);
    } catch (err: any) {
      setDamageFeedback({
        type: 'error',
        message: err.message || 'Unable to submit damage report. Note: reports must be made within 24 hours of delivery.',
      });
    } finally {
      setDamageSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090B] flex items-center justify-center text-[#D5A34A] text-sm font-semibold">
        <Sparkles className="w-5 h-5 mr-2 animate-spin text-[#F5BD48]" />
        Loading your order history...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F1F5F9] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D5A34A]/25">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#CBD5E1] hover:text-[#F5BD48] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Account</span>
          </Link>
          <span className="text-xs text-[#94A3B8]">{orders.length} Total Orders</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Your Orders</h1>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Review order details, track fulfillment status, download tax invoices, or file damage inquiries within 24 hours of delivery.
          </p>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-[#17181C] p-12 rounded-2xl border border-[#D5A34A]/25 text-center space-y-4">
            <Package className="w-12 h-12 text-[#D5A34A]/40 mx-auto" />
            <div className="text-sm font-semibold text-white">No Orders Placed Yet</div>
            <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
              Explore our curated selection of 24K gold foil keepsakes, vintage lanterns, and luxury hampers.
            </p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs shadow-md shadow-[#D5A34A]/10 hover:opacity-95 transition-opacity"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const totalAmount = ((Number(order.grandTotalPaise) || 0) / 100).toFixed(2);
              const itemsSubtotal = ((Number(order.itemsSubtotalPaise) || 0) / 100).toFixed(2);
              const taxTotal = ((Number(order.taxTotalPaise) || 0) / 100).toFixed(2);
              const shippingTotal = ((Number(order.shippingTotalPaise) || 0) / 100).toFixed(2);
              const isExpanded = expandedOrderId === (order.id || order.orderNumber);

              return (
                <div
                  key={order.id || order.orderNumber}
                  className="bg-[#17181C] rounded-2xl border border-[#D5A34A]/25 p-5 space-y-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#D5A34A]/15 text-xs">
                    <div>
                      <span className="text-white font-mono font-bold text-sm block">
                        #{order.orderNumber}
                      </span>
                      <span className="text-[#94A3B8] text-[11px]">Placed on {formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-[#24252A] text-[#D5A34A] border border-[#D5A34A]/30">
                        {order.orderStatus}
                      </span>
                      <span className="text-white font-bold text-sm">₹{totalAmount}</span>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="space-y-2">
                    {order.items &&
                      order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-[#CBD5E1]">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-[#24252A] text-[10px] font-bold flex items-center justify-center text-[#F5BD48]">
                              {item.quantity}x
                            </span>
                            <span>{item.productName}</span>
                            {item.customizationNote && (
                              <span className="text-[10px] text-[#D5A34A] bg-[#D5A34A]/10 px-1.5 py-0.5 rounded">
                                Customized
                              </span>
                            )}
                          </div>
                          <span className="text-[#94A3B8]">
                            ₹{((Number(item.subtotalPaise) || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Expandable Order Details */}
                  {isExpanded && (
                    <div className="p-4 rounded-xl bg-[#08090B] border border-[#D5A34A]/15 space-y-3 text-xs animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-[#D5A34A]/10">
                        <div>
                          <span className="text-[#64748B] block text-[11px] mb-1">Payment Information</span>
                          <div className="text-white font-medium flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-[#D5A34A]" />
                            <span>Method: {order.paymentMethod || 'Online'}</span>
                          </div>
                          <div className="text-[#94A3B8] text-[11px] mt-0.5">
                            Status: <span className="text-[#F5BD48] font-bold">{order.paymentStatus}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[#64748B] block text-[11px] mb-1">Fulfillment & Courier</span>
                          {order.shipment ? (
                            <div className="text-white font-medium space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-[#D5A34A]" />
                                <span>Carrier: {order.shipment.carrierPartner}</span>
                              </div>
                              <div className="text-[11px] text-[#94A3B8]">
                                AWB: <span className="font-mono text-white">{order.shipment.awbNumber}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[#94A3B8] text-[11px]">
                              Order is being hand-crafted in our Hyderabad Atelier.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pricing breakdown */}
                      <div className="space-y-1.5 text-[11px] text-[#94A3B8] pt-1">
                        <div className="flex justify-between">
                          <span>Items Subtotal:</span>
                          <span className="text-white font-medium">₹{itemsSubtotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax (GST):</span>
                          <span className="text-white font-medium">₹{taxTotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Insured Shipping:</span>
                          <span className="text-white font-medium">
                            {Number(shippingTotal) === 0 ? 'Free' : `₹${shippingTotal}`}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-white text-xs pt-1 border-t border-[#D5A34A]/10">
                          <span>Grand Total:</span>
                          <span className="text-[#F5BD48]">₹{totalAmount}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D5A34A]/15 text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId(
                            isExpanded ? null : (order.id || order.orderNumber)
                          )
                        }
                        className="inline-flex items-center gap-1 text-[#CBD5E1] hover:text-[#F5BD48] font-medium"
                      >
                        {isExpanded ? (
                          <>
                            <span>Hide Details</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>View Breakdown</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                      {/* Invoice Link */}
                      <a
                        href={`/api/orders/${order.orderNumber}/invoice`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#CBD5E1] hover:text-[#F5BD48] font-medium"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#D5A34A]" />
                        <span>Download Tax Invoice</span>
                      </a>
                    </div>

                    {/* Report Damage Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        setDamageReportingOrder(
                          damageReportingOrder === order.orderNumber ? null : order.orderNumber
                        );
                        setDamageFeedback(null);
                      }}
                      className="inline-flex items-center gap-1 text-[11.5px] text-amber-400 hover:text-amber-300 font-medium"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Report Damage (within 24 hrs)</span>
                    </button>
                  </div>

                  {/* Damage Report Drawer */}
                  {damageReportingOrder === order.orderNumber && (
                    <div className="mt-3 p-4 rounded-xl bg-[#08090B] border border-amber-500/30 space-y-3 animate-in fade-in duration-150">
                      <div className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>24-Hour Damaged Product Inquiry</span>
                      </div>
                      <p className="text-[11px] text-[#94A3B8]">
                        Under our delivery policy, any transit damage must be reported within 24 hours of receipt. Please describe the damage below:
                      </p>

                      {damageFeedback && (
                        <div
                          className={`p-2.5 rounded-lg text-xs ${
                            damageFeedback.type === 'success'
                              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                              : 'bg-red-950/60 border border-red-500/40 text-red-300'
                          }`}
                        >
                          {damageFeedback.message}
                        </div>
                      )}

                      <textarea
                        rows={3}
                        value={damageDescription}
                        onChange={(e) => setDamageDescription(e.target.value)}
                        placeholder="Please describe the damaged item, packaging condition, and unboxing details..."
                        className="w-full p-2.5 rounded-xl border border-[#D5A34A]/30 bg-[#17181C] text-xs text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#D5A34A]"
                      />

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDamageReportingOrder(null)}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={damageSubmitting || !damageDescription.trim()}
                          onClick={() => handleReportDamage(order.orderNumber)}
                          className="px-4 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 disabled:opacity-50"
                        >
                          {damageSubmitting ? 'Submitting...' : 'Submit Damage Report'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
