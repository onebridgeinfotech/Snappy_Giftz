'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  RefreshCw,
  Eye,
  MessageSquare,
  ShieldAlert,
  Loader2,
  X,
  FileImage,
  User,
  Phone,
  Mail,
  ArrowRight
} from 'lucide-react';
import { DamageClaim } from '@/lib/damage-reports/damage-report.service';

interface AdminDamageReportsDeskProps {
  onClaimUpdated?: () => void;
}

export const AdminDamageReportsDesk: React.FC<AdminDamageReportsDeskProps> = ({ onClaimUpdated }) => {
  const [claims, setClaims] = useState<DamageClaim[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClaim, setSelectedClaim] = useState<DamageClaim | null>(null);

  // Review action modal state
  const [reviewAction, setReviewAction] = useState<'APPROVE_REPLACEMENT' | 'APPROVE_REFUND' | 'REJECT'>('APPROVE_REPLACEMENT');
  const [ownerNotes, setOwnerNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Photo viewer modal state
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/admin/damage-reports?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setClaims(data.data || []);
      } else {
        setErrorMsg(data.error || 'Failed to load damage reports.');
      }
    } catch {
      setErrorMsg('Network error while fetching damage reports.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleOpenReview = (claim: DamageClaim) => {
    setSelectedClaim(claim);
    setReviewAction(claim.requestedResolution === 'REFUND' ? 'APPROVE_REFUND' : 'APPROVE_REPLACEMENT');
    setOwnerNotes(claim.ownerReviewNotes || '');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    if (!ownerNotes.trim() || ownerNotes.trim().length < 5) {
      setErrorMsg('Please enter detailed owner review notes (at least 5 characters).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/damage-reports/${selectedClaim.claimId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewAction,
          ownerNotes: ownerNotes.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Claim #${selectedClaim.claimId} resolved as ${reviewAction}. Customer notified via email.`);
        setTimeout(() => {
          setSelectedClaim(null);
          setSuccessMsg(null);
          fetchClaims();
          if (onClaimUpdated) onClaimUpdated();
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Failed to submit review decision.');
      }
    } catch {
      setErrorMsg('Error contacting review server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = claims.filter((c) => c.status === 'PENDING_OWNER_REVIEW').length;
  const replacementCount = claims.filter((c) => c.status === 'APPROVED_REPLACEMENT').length;
  const refundCount = claims.filter((c) => c.status === 'APPROVED_REFUND').length;
  const rejectedCount = claims.filter((c) => c.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D5A34A]/20 pb-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#F5BD48]" />
            <span>Damaged Products & Transit Claims Desk</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            Review customer defect and transit damage reports submitted within the strict 24-hour delivery window. No automated refunds.
          </p>
        </div>

        <button
          onClick={fetchClaims}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-[#17181C] hover:bg-[#1E2028] border border-white/10 text-xs font-semibold text-white flex items-center gap-2 transition-all self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Claims</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#12141A] border border-amber-500/20 shadow-md">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] font-semibold">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-amber-400 mt-2">{pendingCount}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Awaiting owner determination</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#12141A] border border-emerald-500/20 shadow-md">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] font-semibold">
            <span>Replacements Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-emerald-400 mt-2">{replacementCount}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Priority dispatch queued</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#12141A] border border-cyan-500/20 shadow-md">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] font-semibold">
            <span>Refunds Approved</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-cyan-400 mt-2">{refundCount}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Payment gateway reversals</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#12141A] border border-rose-500/20 shadow-md">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] font-semibold">
            <span>Claims Rejected</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-rose-400 mt-2">{rejectedCount}</div>
          <div className="text-[11px] text-[#94A3B8] mt-1">Policy / change-of-mind</div>
        </div>
      </div>

      {/* 2. Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#12141A] p-4 rounded-2xl border border-white/10 text-xs">
        <div className="sm:col-span-2 relative">
          <input
            type="text"
            placeholder="Search by Claim ID, Order Number, Customer Name, or Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 text-xs bg-[#0D0F14] text-white focus:outline-hidden focus:border-[#D5A34A]"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-white/10 text-xs bg-[#0D0F14] text-white focus:outline-hidden focus:border-[#D5A34A]"
          >
            <option value="">All Review Statuses</option>
            <option value="PENDING_OWNER_REVIEW">Pending Owner Review</option>
            <option value="APPROVED_REPLACEMENT">Approved Replacement</option>
            <option value="APPROVED_REFUND">Approved Refund</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* 3. Claims Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#12141A]">
        <table className="w-full text-left text-xs text-[#CBD5E1]">
          <thead className="bg-[#17181C] text-[#94A3B8] uppercase text-[10px] tracking-wider border-b border-white/10 font-bold">
            <tr>
              <th className="p-3">Claim & Order #</th>
              <th className="p-3">Customer Contact</th>
              <th className="p-3">Delivery Window</th>
              <th className="p-3">Customer Description</th>
              <th className="p-3 text-center">Evidence</th>
              <th className="p-3">Resolution Requested</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[#94A3B8]">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#F5BD48]" />
                    <span>Loading damage claims...</span>
                  </div>
                </td>
              </tr>
            ) : claims.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[#94A3B8]">
                  <div className="max-w-md mx-auto space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="font-semibold text-white">No damage reports found</p>
                    <p className="text-[11px] text-[#64748B]">All orders delivered within the last 24 hours arrived in pristine handcrafted condition.</p>
                  </div>
                </td>
              </tr>
            ) : (
              claims.map((claim) => (
                <tr key={claim.claimId} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3">
                    <div className="font-bold text-[#F5BD48] font-mono">{claim.claimId}</div>
                    <div className="text-[11px] text-white font-semibold">Order: #{claim.orderNumber}</div>
                    <div className="text-[10px] text-[#94A3B8]">{new Date(claim.submittedAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-medium text-white">{claim.customerName}</div>
                    <div className="text-[11px] text-[#94A3B8] font-mono">{claim.customerEmail}</div>
                    <div className="text-[10px] text-[#64748B] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-[#D5A34A]" />
                      <span>{claim.customerPhone}</span>
                    </div>
                  </td>

                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Clock className="w-3 h-3" />
                      <span>Reported {claim.elapsedHoursAtSubmission}h after delivery</span>
                    </span>
                    <div className="text-[10px] text-[#64748B] mt-1">24h policy compliant</div>
                  </td>

                  <td className="p-3 max-w-xs">
                    <p className="text-[11px] text-white line-clamp-2 leading-relaxed">{claim.description}</p>
                    {claim.ownerReviewNotes && (
                      <div className="text-[10px] text-[#F5BD48] italic mt-1">
                        Owner note: "{claim.ownerReviewNotes}"
                      </div>
                    )}
                  </td>

                  <td className="p-3 text-center">
                    {claim.photoUrls && claim.photoUrls.length > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        {claim.photoUrls.slice(0, 2).map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt="Damage evidence"
                            onClick={() => setActivePhotoUrl(url)}
                            className="w-8 h-8 rounded-lg object-cover border border-white/20 cursor-pointer hover:border-[#D5A34A] transition-all"
                          />
                        ))}
                        {claim.photoUrls.length > 2 && (
                          <span className="text-[10px] text-[#94A3B8]">+{claim.photoUrls.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#64748B] italic">No photos</span>
                    )}
                  </td>

                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      claim.requestedResolution === 'REPLACEMENT'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                        : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    }`}>
                      {claim.requestedResolution}
                    </span>
                  </td>

                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      claim.status === 'PENDING_OWNER_REVIEW'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                        : claim.status === 'APPROVED_REPLACEMENT'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : claim.status === 'APPROVED_REFUND'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {claim.status.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleOpenReview(claim)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:brightness-110 text-[#08090B] font-bold text-[11px] shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review Claim</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Owner Review Determination Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141A] border border-[#D5A34A]/30 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedClaim(null)}
              className="absolute top-5 right-5 text-[#94A3B8] hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-white/10 pb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase mb-2">
                <ShieldAlert className="w-3 h-3" />
                <span>24-Hour Policy Inspection</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-white">
                Review Damage Claim: #{selectedClaim.claimId}
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">
                Order Number: <strong className="text-white">#{selectedClaim.orderNumber}</strong> • Customer: <strong className="text-white">{selectedClaim.customerName}</strong>
              </p>
            </div>

            {/* Error / Success banners */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs">
                {successMsg}
              </div>
            )}

            {/* Claim details summary */}
            <div className="grid grid-cols-2 gap-3 bg-[#17181C] p-4 rounded-2xl border border-white/10 text-xs">
              <div>
                <span className="text-[#94A3B8]">Delivery Timestamp:</span>
                <div className="font-medium text-white">{new Date(selectedClaim.deliveredAt).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <span className="text-[#94A3B8]">Claim Submitted:</span>
                <div className="font-medium text-white">{new Date(selectedClaim.submittedAt).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <span className="text-[#94A3B8]">Elapsed Hours:</span>
                <div className="font-bold text-emerald-400">{selectedClaim.elapsedHoursAtSubmission} Hours (Eligible &lt;24h)</div>
              </div>
              <div>
                <span className="text-[#94A3B8]">Requested Resolution:</span>
                <div className="font-bold text-[#F5BD48]">{selectedClaim.requestedResolution}</div>
              </div>
            </div>

            {/* Customer Statement */}
            <div className="bg-[#17181C] p-4 rounded-2xl border border-white/10 space-y-1">
              <span className="text-xs font-semibold text-[#D5A34A]">Customer Defect / Damage Description:</span>
              <p className="text-xs text-white leading-relaxed">{selectedClaim.description}</p>
            </div>

            {/* Evidence Photographs */}
            {selectedClaim.photoUrls && selectedClaim.photoUrls.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#D5A34A]">Customer Evidence Photographs:</span>
                <div className="flex flex-wrap gap-2">
                  {selectedClaim.photoUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Damage photo ${idx + 1}`}
                      onClick={() => setActivePhotoUrl(url)}
                      className="w-20 h-20 rounded-xl object-cover border border-white/20 hover:border-[#D5A34A] cursor-pointer transition-all"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Official Determination Form */}
            <form onSubmit={handleSubmitReview} className="space-y-4 pt-2 border-t border-white/10">
              <label className="block text-xs font-bold text-white">Owner Official Decision:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                  reviewAction === 'APPROVE_REPLACEMENT'
                    ? 'bg-emerald-500/15 border-emerald-500 text-white'
                    : 'bg-[#17181C] border-white/10 text-[#94A3B8] hover:border-white/30'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    checked={reviewAction === 'APPROVE_REPLACEMENT'}
                    onChange={() => setReviewAction('APPROVE_REPLACEMENT')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Replacement</span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Craft & dispatch replacement gift</span>
                </label>

                <label className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                  reviewAction === 'APPROVE_REFUND'
                    ? 'bg-cyan-500/15 border-cyan-500 text-white'
                    : 'bg-[#17181C] border-white/10 text-[#94A3B8] hover:border-white/30'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    checked={reviewAction === 'APPROVE_REFUND'}
                    onChange={() => setReviewAction('APPROVE_REFUND')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Refund</span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Reversal to original payment source</span>
                </label>

                <label className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition-all ${
                  reviewAction === 'REJECT'
                    ? 'bg-rose-500/15 border-rose-500 text-white'
                    : 'bg-[#17181C] border-white/10 text-[#94A3B8] hover:border-white/30'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    checked={reviewAction === 'REJECT'}
                    onChange={() => setReviewAction('REJECT')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <XCircle className="w-4 h-4" />
                    <span>Reject Claim</span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8]">Change-of-mind / invalid defect</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1.5">
                  Owner Review Notes (Transmitted to Customer):
                </label>
                <textarea
                  required
                  rows={3}
                  value={ownerNotes}
                  onChange={(e) => setOwnerNotes(e.target.value)}
                  placeholder="Explain inspection finding and replacement/refund timeline for the customer..."
                  className="w-full p-3 rounded-xl bg-[#0D0F14] border border-white/15 text-white text-xs placeholder-slate-500 focus:outline-hidden focus:border-[#D5A34A]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="px-4 py-2 rounded-xl bg-[#17181C] hover:bg-[#1E2028] text-xs font-semibold text-[#94A3B8] hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:brightness-110 text-[#08090B] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  <span>Submit Official Determination</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. High-Resolution Photo Zoom Modal */}
      {activePhotoUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActivePhotoUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-[#D5A34A]/40">
            <button
              onClick={() => setActivePhotoUrl(null)}
              className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black/90"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={activePhotoUrl} alt="Enlarged damage evidence" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

