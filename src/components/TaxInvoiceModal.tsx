import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Order, CorporateQuotation } from '../types';
import {
  X,
  Printer,
  FileText,
  Building2,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

import { BUSINESS_CONFIG } from '../config/business';

interface TaxInvoiceModalProps {
  onClose: () => void;
}

export const TaxInvoiceModal: React.FC<TaxInvoiceModalProps> = ({ onClose }) => {
  const { selectedOrder, selectedQuotation, orders, quotations } = useApp();

  const isQuotation = !selectedOrder && !!selectedQuotation;
  const order: Order = selectedOrder || orders[0];
  const quotation: CorporateQuotation = selectedQuotation || quotations[0];

  const handlePrint = () => {
    window.print();
  };

  const isIntraState = order.shippingAddress.state.toLowerCase() === 'telangana';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock body scroll while invoice modal is active
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
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={isQuotation ? 'Formal Corporate Quotation' : 'Official GST Tax Invoice'}
    >
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#D5A34A]/30 overflow-hidden my-6 print:shadow-none print:border-none print:m-0 print:rounded-none">
        
        {/* Modal Top Actions (Hidden in print) */}
        <div className="bg-[#08090B] text-[#F1F5F9] px-6 py-3.5 flex items-center justify-between border-b border-[#D5A34A]/20 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#F5BD48]" />
            <span className="text-xs font-semibold text-[#F1F5F9]">
              {isQuotation ? 'Formal Corporate Quotation' : 'Official GST Tax Invoice'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:from-[#E5AD38] hover:to-[#C5933A] text-[#08090B] text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 text-slate-800 text-xs font-sans space-y-6">
          
          {/* Header & Seller Info */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-serif text-2xl font-bold tracking-tight text-slate-900">
                  {BUSINESS_CONFIG.brandName}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Curated Bespoke Luxury • Gifts That Create Memories</p>
              <div className="text-[11px] text-slate-600 mt-2 space-y-0.5">
                <div>{BUSINESS_CONFIG.address.formattedSingleLine}</div>
                <div><strong>State:</strong> Telangana | <strong>State Code:</strong> 36</div>
                <div><strong>Email:</strong> <a href={`mailto:${BUSINESS_CONFIG.officialEmail}`} className="text-blue-700 underline">{BUSINESS_CONFIG.officialEmail}</a></div>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 rounded bg-slate-100 font-bold text-slate-900 text-sm uppercase tracking-wider mb-2">
                {isQuotation ? 'CORPORATE QUOTATION' : 'TAX INVOICE'}
              </span>
              <div className="space-y-0.5 font-mono text-xs">
                <div><strong>Doc #:</strong> {isQuotation ? quotation.rfqNumber : order.orderNumber}</div>
                <div><strong>Date:</strong> {isQuotation ? quotation.createdAt : order.date}</div>
                <div><strong>Place of Supply:</strong> {isQuotation ? 'India' : `${order.shippingAddress.state} (${order.shippingAddress.pincode})`}</div>
                {!isQuotation && (
                  <div><strong>AWB Tracking:</strong> {order.awbNumber || 'BLUEDART-882910'}</div>
                )}
              </div>
            </div>
          </div>

          {/* Bill To & Ship To Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1">
                Billed To (Customer):
              </h4>
              <div className="font-semibold text-sm text-slate-900">
                {isQuotation ? quotation.companyName : (order.organizationName || order.customerName)}
              </div>
              <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                <div>Attn: {isQuotation ? quotation.contactPerson : order.customerName}</div>
                <div>Address: {isQuotation ? 'Corporate Headquarters' : order.shippingAddress.street}</div>
                <div>
                  {isQuotation ? '' : `${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`}
                </div>
                <div>Phone: {isQuotation ? quotation.phone : order.customerPhone}</div>
                {(isQuotation ? quotation.gstin : order.gstin) && (
                  <div className="text-rose-900 font-bold font-mono">
                    Buyer GSTIN: {isQuotation ? quotation.gstin : order.gstin}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1">
                Dispatch / Logistics:
              </h4>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div><strong>Fulfillment Hub:</strong> {BUSINESS_CONFIG.brandName} Central Fulfillment</div>
                <div><strong>Courier Partner:</strong> {isQuotation ? 'Delhivery Corporate Logistics' : order.courierPartner}</div>
                <div><strong>Payment Terms:</strong> {isQuotation ? quotation.paymentTerms : `${order.paymentMethod} (${order.paymentStatus})`}</div>
                <div><strong>Reverse Charge (RCM):</strong> No</div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-300">
                <tr>
                  <th className="p-2.5 border-r border-slate-300">#</th>
                  <th className="p-2.5 border-r border-slate-300">Description of Goods</th>
                  <th className="p-2.5 border-r border-slate-300">HSN/SAC</th>
                  <th className="p-2.5 border-r border-slate-300 text-center">Qty</th>
                  <th className="p-2.5 border-r border-slate-300 text-right">Unit Rate (₹)</th>
                  <th className="p-2.5 text-right">Taxable Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {isQuotation ? (
                  quotation.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 border-r border-slate-300 font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 border-r border-slate-300">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-500">{item.customizationNote}</div>
                      </td>
                      <td className="p-2.5 border-r border-slate-300 font-mono">69120010</td>
                      <td className="p-2.5 border-r border-slate-300 text-center font-bold">{item.quantity}</td>
                      <td className="p-2.5 border-r border-slate-300 text-right font-mono">₹{item.unitPrice}</td>
                      <td className="p-2.5 text-right font-mono font-bold">₹{item.total.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                ) : (
                  order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 border-r border-slate-300 font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 border-r border-slate-300">
                        <div className="font-bold text-slate-900">{item.product.name}</div>
                        {item.customization?.engravedText && (
                          <div className="text-[10px] text-rose-800 font-mono">
                            Laser Engraving: "{item.customization.engravedText}" ({item.customization.fontFamily})
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 border-r border-slate-300 font-mono">{item.product.hsnCode}</td>
                      <td className="p-2.5 border-r border-slate-300 text-center font-bold">{item.quantity}</td>
                      <td className="p-2.5 border-r border-slate-300 text-right font-mono">₹{item.unitPrice}</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Tax Calculation Breakup */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Total Taxable Amount:</span>
                <span className="font-mono font-bold">
                  ₹{(isQuotation ? quotation.subtotal : order.subtotal).toLocaleString('en-IN')}
                </span>
              </div>

              {/* GST Split (CGST + SGST vs IGST) */}
              {isIntraState && !isQuotation ? (
                <>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>CGST @ 9%:</span>
                    <span className="font-mono">₹{(order.taxTotal / 2).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>SGST (Telangana) @ 9%:</span>
                    <span className="font-mono">₹{(order.taxTotal / 2).toLocaleString('en-IN')}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>IGST (Integrated Tax) @ 18%:</span>
                  <span className="font-mono">
                    ₹{(isQuotation ? quotation.taxAmount : order.taxTotal).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Shipping & Packaging:</span>
                <span className="font-mono text-emerald-700 font-bold">FREE (₹0.00)</span>
              </div>

              <div className="pt-2 border-t-2 border-slate-900 flex justify-between font-bold text-sm">
                <span>Total Invoice Value (INR):</span>
                <span className="font-mono text-base text-slate-950 font-bold">
                  ₹{(isQuotation ? quotation.grandTotal : order.grandTotal).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Declaration and Seal */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
            <div className="text-[10px] text-slate-500 space-y-1">
              <div className="font-bold text-slate-700 uppercase">Declaration:</div>
              <p>
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Goods once sold are covered under {BUSINESS_CONFIG.brandName} 7-day transit replacement guarantee.
              </p>
              <div className="text-slate-400">Computer generated invoice. No physical signature required.</div>
            </div>

            <div className="text-right">
              <div className="w-32 h-16 border border-dashed border-[#D5A34A] rounded-lg ml-auto flex items-center justify-center text-[10px] text-amber-900 font-serif italic bg-amber-50/50">
                {BUSINESS_CONFIG.brandName} Authorized Seal
              </div>
              <div className="text-xs font-bold text-slate-800 mt-1">For {BUSINESS_CONFIG.brandName}</div>
              <div className="text-[10px] text-slate-500">Authorized Signatory</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
