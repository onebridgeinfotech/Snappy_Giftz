import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, BulkRecipient } from '../../types';
import {
  Building2,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Truck,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Layers,
  ChevronRight,
  Send,
  DollarSign,
  Loader2,
  RefreshCw,
  X,
  Check,
  Users,
  MapPin,
  Tag,
  Clock,
  Ban
} from 'lucide-react';

export const CorporatePortal: React.FC = () => {
  const {
    products,
    organization,
    updateOrganization,
    orders,
    addToCart,
    setActiveModal,
    showToast,
    checkPincode
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'bulk_order' | 'recipients' | 'rfqs' | 'onboarding'>('overview');

  // Real Corporate Backend State
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Registration Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    legalName: '',
    displayName: '',
    companyEmail: '',
    contactPerson: '',
    contactPhone: '',
    street: '',
    city: '',
    state: 'Rajasthan',
    stateCode: '08',
    pincode: '302021',
    gstin: '',
    businessDetails: '',
  });

  // RFQs & Quotes State
  const [rfqList, setRfqList] = useState<any[]>([]);
  const [quoteList, setQuoteList] = useState<any[]>([]);
  const [orderGroupList, setOrderGroupList] = useState<any[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);

  // Quote Action Modal (Accept / Reject)
  const [selectedQuoteForAction, setSelectedQuoteForAction] = useState<any | null>(null);
  const [quoteActionType, setQuoteActionType] = useState<'ACCEPT' | 'REJECT'>('ACCEPT');
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingQuoteAction, setIsSubmittingQuoteAction] = useState(false);

  // CSV State
  const [csvContent, setCsvContent] = useState('');
  const [csvValidationSummary, setCsvValidationSummary] = useState<any | null>(null);
  const [isValidatingCsv, setIsValidatingCsv] = useState(false);

  // Saved Addresses & Members
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [newAddressForm, setNewAddressForm] = useState({
    label: '',
    recipientName: '',
    recipientPhone: '',
    street: '',
    city: '',
    state: 'Rajasthan',
    stateCode: '08',
    pincode: '302021',
    department: '',
  });
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  // Member Management Form
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'REQUESTER' | 'APPROVER' | 'FINANCE'>('REQUESTER');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Bulk Product Builder State
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || 'prod-1');
  const [bulkQty, setBulkQty] = useState<number>(50);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const [engravedNote, setEngravedNote] = useState<string>('Welcome to the Corporate Family');
  const [deliveryLocationsCount, setDeliveryLocationsCount] = useState<number>(1);
  const [isSubmittingRFQ, setIsSubmittingRFQ] = useState(false);

  // Multi-recipient state (for manual / CSV roster)
  const [recipients, setRecipients] = useState<BulkRecipient[]>([]);
  const [newRec, setNewRec] = useState<Partial<BulkRecipient>>({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    customGiftNote: ''
  });

  // Fetch Corporate Profile
  const fetchProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch('/api/corporate/profile');
      const data = await res.json();
      if (res.ok && data.success && data.hasAccount) {
        setProfile(data.data);
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      console.warn('Could not fetch corporate profile:', err.message);
      setProfileError('Failed to load corporate profile.');
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  // Fetch RFQs, Quotes, Orders, Addresses
  const fetchCorporateData = useCallback(async () => {
    if (!profile || profile.status !== 'APPROVED') return;
    setIsLoadingQuotes(true);
    try {
      const [rfqRes, quoteRes, orderRes, addrRes] = await Promise.all([
        fetch('/api/corporate/rfq'),
        fetch('/api/corporate/quotes'),
        fetch('/api/corporate/orders'),
        fetch('/api/corporate/addresses'),
      ]);

      if (rfqRes.ok) {
        const rfqData = await rfqRes.json();
        if (rfqData.success) setRfqList(rfqData.data || []);
      }
      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        if (quoteData.success) setQuoteList(quoteData.data || []);
      }
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        if (orderData.success) setOrderGroupList(orderData.data || []);
      }
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        if (addrData.success) setSavedAddresses(addrData.data || []);
      }
    } catch (err: any) {
      console.warn('Error fetching corporate data:', err.message);
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      fetchCorporateData();
    }
  }, [profile, fetchCorporateData]);

  // Handle Registration
  const handleRegisterCorporate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.legalName || !regForm.displayName || !regForm.companyEmail || !regForm.contactPerson || !regForm.contactPhone || !regForm.street || !regForm.pincode) {
      showToast('Please fill all required business registration fields.', 'error');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await fetch('/api/corporate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalName: regForm.legalName,
          displayName: regForm.displayName,
          companyEmail: regForm.companyEmail,
          contactPerson: regForm.contactPerson,
          contactPhone: regForm.contactPhone,
          registeredAddress: {
            street: regForm.street,
            city: regForm.city || 'Hyderabad',
            state: regForm.state || 'Telangana',
            stateCode: regForm.stateCode || '36',
            pincode: regForm.pincode,
          },
          gstin: regForm.gstin || undefined,
          businessDetails: regForm.businessDetails || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      showToast('Corporate account application submitted! Awaiting administrator approval.', 'success');
      fetchProfile();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle RFQ Submission
  const handleGenerateRFQ = async () => {
    if (!profile) {
      showToast('Please register for a corporate account first.', 'error');
      setActiveTab('onboarding');
      return;
    }

    if (profile.status !== 'APPROVED') {
      showToast('Your corporate account is pending admin approval. You cannot submit RFQs yet.', 'error');
      return;
    }

    const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

    setIsSubmittingRFQ(true);
    try {
      const res = await fetch('/api/corporate/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryLocationsCount,
          brandingLogoRequired: !!companyLogoUrl,
          customPackagingRequired: true,
          additionalInstructions: `Laser Engraved Note: "${engravedNote}". Logo Asset: ${companyLogoUrl || 'Standard'}. Delivery count: ${deliveryLocationsCount}.`,
          items: [
            {
              productId: selectedProduct.id,
              quantity: bulkQty,
              personalizationNote: engravedNote,
              logoUrl: companyLogoUrl || undefined,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit RFQ.');

      showToast(`RFQ ${data.data.rfqNumber} submitted for sales review!`, 'success');
      fetchCorporateData();
      setActiveTab('rfqs');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingRFQ(false);
    }
  };

  // Handle Quotation Response (Accept or Reject)
  const handleRespondToQuote = async () => {
    if (!selectedQuoteForAction) return;

    if (quoteActionType === 'REJECT' && (!rejectReason || rejectReason.trim().length < 5)) {
      showToast('Please enter a rejection reason of at least 5 characters.', 'error');
      return;
    }

    setIsSubmittingQuoteAction(true);
    try {
      const res = await fetch(`/api/corporate/quotes/${selectedQuoteForAction.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: quoteActionType,
          comments: quoteActionType === 'REJECT' ? rejectReason : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to respond to quotation.');

      showToast(data.message || 'Quotation updated successfully.', 'success');
      setSelectedQuoteForAction(null);
      setRejectReason('');
      fetchCorporateData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingQuoteAction(false);
    }
  };

  // Handle CSV Validation
  const handleValidateCsv = async (csvTextToValidate: string) => {
    if (!csvTextToValidate.trim()) return;
    setIsValidatingCsv(true);
    try {
      const res = await fetch('/api/corporate/csv/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvTextToValidate }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'CSV validation failed.');

      setCsvValidationSummary(data.data);
      showToast(`CSV validated: ${data.data.validRowsCount} valid, ${data.data.invalidRowsCount} errors.`, data.data.invalidRowsCount > 0 ? 'error' : 'success');

      // Populate valid rows into roster
      const validRecs: BulkRecipient[] = data.data.rows
        .filter((r: any) => r.isValid)
        .map((r: any) => ({
          id: `rec-${Date.now()}-${r.rowNumber}`,
          name: r.recipientName,
          email: r.recipientEmail || '',
          phone: r.recipientPhone,
          address: r.street,
          city: r.city,
          state: r.state,
          pincode: r.pincode,
          department: r.department || 'Corporate',
          customGiftNote: r.personalizationNote || 'Best wishes from the leadership team!'
        }));

      if (validRecs.length > 0) {
        setRecipients(validRecs);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsValidatingCsv(false);
    }
  };

  // Load Sample CSV
  const handleLoadSampleCsv = () => {
    const sample = `Recipient Name,Recipient Phone,Recipient Email,Product SKU,Quantity,Address Line 1,Address Line 2,City,State,PIN Code,Department,Personalization Note
Rohan Sharma,9820111223,rohan@company.com,SKU-prod-1,10,Flat 301 Palm Grove,Powai,Mumbai,Maharashtra,400076,Engineering,Keep shining in Q4!
Priyanka Verma,9811033445,priyanka@company.com,SKU-prod-1,10,B-12 Green Park Ext,,New Delhi,Delhi,110016,Product,Welcome aboard Priyanka!
Karthik Ramanathan,9845077889,karthik@company.com,SKU-prod-1,15,Plot 45 Indiranagar,100ft Road,Bengaluru,Karnataka,560038,Design,Congrats on 3 years!
Ananya Sen,9830022334,ananya@company.com,SKU-prod-1,15,Salt Lake Sector V,,Kolkata,West Bengal,700091,Finance,Great quarter results!`;
    setCsvContent(sample);
    handleValidateCsv(sample);
  };

  // Convert Accepted Quote to Group Order Checkout
  const handleConvertQuoteToOrderGroup = async (quote: any) => {
    if (recipients.length === 0) {
      showToast('Please add or upload recipient addresses in the Multi-Address tab before placing group order.', 'error');
      setActiveTab('recipients');
      return;
    }

    try {
      const allocations = recipients.map((r) => ({
        recipientName: r.name,
        recipientPhone: r.phone,
        recipientEmail: r.email || undefined,
        street: r.address,
        city: r.city,
        state: r.state,
        pincode: r.pincode,
        department: r.department || undefined,
        customGiftNote: r.customGiftNote || undefined,
        quantity: Math.floor(quote.items[0]?.quantity / recipients.length) || 1,
        productId: quote.items[0]?.productId || products[0]?.id,
        sku: quote.items[0]?.sku || `SKU-${products[0]?.id}`,
      }));

      // Adjust last allocation so quantity equals quote quantity exactly
      const allocatedSum = allocations.reduce((acc, a) => acc + a.quantity, 0);
      const targetQty = quote.items[0]?.quantity || 50;
      if (allocatedSum !== targetQty) {
        allocations[allocations.length - 1].quantity += (targetQty - allocatedSum);
      }

      const res = await fetch('/api/corporate/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          paymentMethod: 'CORPORATE_BILLING',
          paymentReference: `NEFT-CORP-${Date.now()}`,
          allocations,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate corporate order group.');

      showToast(`Corporate Order Group ${data.data.groupOrderNumber} placed successfully with ${allocations.length} destination orders!`, 'success');
      fetchCorporateData();
      setActiveTab('overview');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Add Single Recipient
  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRec.name || !newRec.pincode || !newRec.address) {
      showToast('Please fill required recipient fields', 'error');
      return;
    }
    const pinVerification = checkPincode(newRec.pincode);
    if (!pinVerification.serviceable) {
      showToast(pinVerification.message, 'error');
      return;
    }

    const recItem: BulkRecipient = {
      id: `rec-${Date.now()}`,
      name: newRec.name || 'Recipient',
      email: newRec.email || '',
      phone: newRec.phone || '+91 98000 00000',
      address: newRec.address || '',
      city: newRec.city || pinVerification.city || 'Hyderabad',
      state: newRec.state || pinVerification.state || 'Telangana',
      pincode: newRec.pincode || '500062',
      department: newRec.department || 'Corporate',
      customGiftNote: newRec.customGiftNote || 'Best wishes from the leadership team!'
    };

    setRecipients(prev => [...prev, recItem]);
    setNewRec({ name: '', phone: '', address: '', city: '', state: '', pincode: '', customGiftNote: '' });
    showToast(`Added ${recItem.name} to bulk dispatch list!`);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

  // Calculate bulk price
  const calculateTierPrice = (prod: Product, qty: number) => {
    if (prod.bulkTiers && prod.bulkTiers.length > 0) {
      for (const tier of [...prod.bulkTiers].reverse()) {
        if (qty >= tier.minQty) {
          return tier.pricePerUnit;
        }
      }
    }
    // Dynamic bulk tiers
    if (qty >= 200) return Math.round(prod.basePrice * 0.8);
    if (qty >= 100) return Math.round(prod.basePrice * 0.85);
    if (qty >= 50) return Math.round(prod.basePrice * 0.9);
    return prod.basePrice;
  };

  const unitBulkPrice = calculateTierPrice(selectedProduct, bulkQty);
  const bulkSubtotal = unitBulkPrice * bulkQty;
  const bulkTax = Math.round(bulkSubtotal * 0.18);
  const bulkTotal = bulkSubtotal + bulkTax;

  const userRole = profile?.currentUserRole || 'REQUESTER';
  const isOwnerOrApprover = userRole === 'OWNER' || userRole === 'APPROVER';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Corporate Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white p-6 sm:p-8 shadow-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400 via-rose-500 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold uppercase tracking-wider">
                Corporate B2B Portal
              </span>
              {profile && (
                <>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    profile.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : profile.status === 'PENDING_APPROVAL'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    Status: {profile.status}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-mono font-semibold">
                    Role: {userRole}
                  </span>
                  {profile.gstin && (
                    <span className="text-xs text-rose-300">GSTIN: {profile.gstin}</span>
                  )}
                </>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
              {profile?.displayName || profile?.companyName || organization.companyName}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              End-to-end corporate gifting: Request for Quotation (RFQ), negotiated corporate pricing, multi-address CSV dispatch, and official GST tax invoicing.
            </p>
          </div>

          {/* Quick Account Status Card */}
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs space-y-1 sm:min-w-[240px]">
            <div className="flex justify-between text-slate-300">
              <span>Account Status:</span>
              <span className={`font-bold ${profile?.status === 'APPROVED' ? 'text-emerald-400' : 'text-amber-300'}`}>
                {profile ? profile.status : 'NOT REGISTERED'}
              </span>
            </div>
            <div className="flex justify-between text-slate-200">
              <span>Active RFQs:</span>
              <strong className="text-white">{rfqList.length}</strong>
            </div>
            <div className="flex justify-between text-slate-200">
              <span>Issued Quotes:</span>
              <strong className="text-amber-300">{quoteList.filter(q => q.status === 'ISSUED').length}</strong>
            </div>
            <div className="flex justify-between text-slate-200">
              <span>Order Groups:</span>
              <strong className="text-emerald-300">{orderGroupList.length}</strong>
            </div>
          </div>
        </div>

        {/* Corporate Sub Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-white/10 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Overview & Activity</span>
          </button>

          <button
            onClick={() => setActiveTab('bulk_order')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'bulk_order'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers className="w-4 h-4 text-rose-600" />
            <span>RFQ & Pricing Calculator</span>
          </button>

          <button
            onClick={() => setActiveTab('recipients')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'recipients'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Multi-Address & CSV ({recipients.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rfqs')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'rfqs'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Quotations & Approvals ({quoteList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('onboarding')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'onboarding'
                ? 'bg-white text-slate-900 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Company Profile & Members</span>
          </button>
        </div>
      </div>

      {/* Account Pending Approval Banner */}
      {profile && profile.status === 'PENDING_APPROVAL' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-900 shadow-xs">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="block font-bold">Corporate Application Pending Review</strong>
            <span>Your corporate onboarding details have been submitted and are being reviewed by Snappy Gifts administrative staff. RFQ submission and order creation will be activated upon approval.</span>
          </div>
        </div>
      )}

      {/* Account Suspended Banner */}
      {profile && profile.status === 'SUSPENDED' && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-900 shadow-xs">
          <Ban className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <strong className="block font-bold">Corporate Account Suspended</strong>
            <span>This corporate account has been temporarily suspended by Snappy Gifts management. Please contact your dedicated account manager or finance desk for reactivation.</span>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">Corporate Order Groups</div>
              <div className="text-2xl font-serif font-bold text-slate-900 mt-1">
                {orderGroupList.length} Groups
              </div>
              <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Split multi-address dispatch tracking
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">Quotations Received</div>
              <div className="text-2xl font-serif font-bold text-slate-900 mt-1">
                {quoteList.length} Quotes
              </div>
              <div className="text-[11px] text-amber-700 mt-1">
                {quoteList.filter(q => q.status === 'ISSUED').length} awaiting decision
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">Active RFQs</div>
              <div className="text-2xl font-serif font-bold text-slate-900 mt-1">
                {rfqList.length} RFQs
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Custom packaging & volume requests</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs">
              <div className="text-xs font-semibold text-slate-500">Corporate Account Desk</div>
              <div className="text-sm font-bold text-slate-900 mt-1">Corporate Client Services</div>
              <div className="text-[11px] text-rose-700 font-semibold mt-1">
                procurement@snappygifts.in
              </div>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-amber-900 uppercase bg-amber-100 px-2 py-0.5 rounded-full">
                  Volume Pricing
                </span>
                <h3 className="font-serif text-xl font-bold text-slate-900 mt-2">
                  Request RFQ & Custom Packaging Quotation
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Configure corporate gifts with logo branding, select box finishes, specify delivery locations, and receive formal quote proposals.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('bulk_order')}
                className="mt-5 w-fit px-5 py-2.5 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-2 shadow-xs"
              >
                <span>Launch RFQ Builder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-blue-900 uppercase bg-blue-100 px-2 py-0.5 rounded-full">
                  Bulk CSV Import
                </span>
                <h3 className="font-serif text-xl font-bold text-slate-900 mt-2">
                  Multi-Address Delivery & Recipient Roster
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Upload CSV spreadsheets with employee addresses, validate Indian PIN codes, and split large orders into doorstep shipments.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('recipients')}
                className="mt-5 w-fit px-5 py-2.5 rounded-full bg-blue-800 text-white text-xs font-semibold hover:bg-blue-900 flex items-center gap-2 shadow-xs"
              >
                <span>Manage CSV Recipients</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Recent Corporate Order Groups */}
          {orderGroupList.length > 0 && (
            <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-4">
              <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-rose-700" />
                <span>Recent Multi-Address Order Groups</span>
              </h3>

              <div className="divide-y divide-slate-100">
                {orderGroupList.map((grp) => (
                  <div key={grp.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{grp.groupOrderNumber}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {grp.paymentStatus}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {grp.totalDestinations} destination addresses • {grp.totalQuantity} total units
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif font-bold text-sm text-rose-950">
                        ₹{Number(grp.grandTotalPaise / 100n || grp.grandTotalPaise).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(grp.createdAt).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BULK ORDER & RFQ BUILDER */}
      {activeTab === 'bulk_order' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="font-serif text-2xl font-bold text-slate-900">
              Corporate Request for Quotation (RFQ) Builder
            </h2>
            <p className="text-xs text-slate-500">
              Configure gifts, branding specifications, delivery locations, and generate formal price quotation requests.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Product Choice & Quantity */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Corporate Gift / Hamper
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {products.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProductId(p.id)}
                      className={`p-3 rounded-2xl border text-left flex gap-3 transition-all ${
                        selectedProductId === p.id
                          ? 'border-rose-600 bg-rose-50/50 ring-2 ring-rose-500'
                          : 'border-slate-200 hover:border-rose-200'
                      }`}
                    >
                      <img src={p.images[0]} alt={p.name} className="w-14 h-14 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-500">{p.category}</div>
                        <div className="text-xs font-serif font-bold text-rose-900 mt-1">
                          Base: ₹{p.basePrice}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. Quantity: <span className="text-rose-700 text-sm font-bold font-mono">{bulkQty} Units</span>
                  </label>
                  <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    Tier Estimate: ₹{unitBulkPrice}/unit
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={bulkQty}
                  onChange={(e) => setBulkQty(parseInt(e.target.value))}
                  className="w-full accent-rose-700 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>10 units (Base)</span>
                  <span>50 units (10% off)</span>
                  <span>100 units (15% off)</span>
                  <span>200+ units (20% off)</span>
                </div>
              </div>

              {/* Delivery Locations Count */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  3. Number of Delivery Destinations / Addresses
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={deliveryLocationsCount}
                  onChange={(e) => setDeliveryLocationsCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Specify 1 for consolidated delivery or multiple for individual employee doorstep split.
                </span>
              </div>

              {/* Corporate Customization & Branding */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  4. Custom Branding & Gift Note
                </label>
                
                <div>
                  <span className="text-xs text-slate-600 block mb-1">Company Laser Engraving / Tagline</span>
                  <input
                    type="text"
                    value={engravedNote}
                    onChange={(e) => setEngravedNote(e.target.value)}
                    placeholder="e.g. Welcome to NovaTech Team"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium"
                  />
                </div>

                <div>
                  <span className="text-xs text-slate-600 block mb-1">Company Logo Asset URL</span>
                  <input
                    type="text"
                    value={companyLogoUrl}
                    onChange={(e) => setCompanyLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Right: Live RFQ Preview Card */}
            <div className="lg:col-span-5 bg-gradient-to-b from-[#FFFDFB] to-rose-50/50 p-6 rounded-3xl border border-rose-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-rose-200 pb-3 mb-4">
                  <div className="text-sm font-serif font-bold text-slate-900">
                    RFQ Commercial Estimate
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-bold">
                    SUBJECT TO QUOTATION
                  </span>
                </div>

                {/* Preview Image with mock overlay */}
                <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-slate-100 border border-white shadow-xs mb-4">
                  <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-4">
                    <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl text-center shadow-lg border border-white/50">
                      <div className="text-xs font-bold text-slate-900 font-mono">
                        {profile?.displayName || organization.companyName}
                      </div>
                      <div className="text-[11px] text-rose-700 italic font-serif">"{engravedNote}"</div>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Product:</span>
                    <strong className="text-slate-900">{selectedProduct.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <strong>{bulkQty} units</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Unit Price:</span>
                    <strong className="text-rose-900">₹{unitBulkPrice}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Subtotal:</span>
                    <span>₹{bulkSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated GST (18% ITC):</span>
                    <span>₹{bulkTax.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Destinations:</span>
                    <strong>{deliveryLocationsCount} Location(s)</strong>
                  </div>

                  <div className="pt-3 border-t border-rose-200 flex justify-between items-baseline font-bold text-base">
                    <span className="text-slate-900">Estimated Total:</span>
                    <span className="font-serif text-2xl text-rose-950">₹{bulkTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-rose-200 space-y-2.5">
                <button
                  type="button"
                  disabled={isSubmittingRFQ}
                  onClick={handleGenerateRFQ}
                  className="w-full py-3 rounded-full bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-rose-200 transition-all"
                >
                  {isSubmittingRFQ ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>Submit Formal RFQ to Sales Desk</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECIPIENTS & CSV LOGISTICS */}
      {activeTab === 'recipients' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900">
                Multi-Address CSV Upload & Recipient Allocation
              </h2>
              <p className="text-xs text-slate-500">
                Upload recipient CSV with formula injection defense and Indian PIN code validation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSampleCsv}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Load Sample CSV</span>
              </button>
            </div>
          </div>

          {/* CSV Input / Drop Area */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Paste CSV or Upload Spreadsheet File (Max 2MB, 500 rows)</span>
              {isValidatingCsv && <Loader2 className="w-4 h-4 animate-spin text-rose-600" />}
            </div>

            <textarea
              rows={4}
              placeholder="Paste raw CSV content here..."
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                if (e.target.value.includes('\n')) {
                  handleValidateCsv(e.target.value);
                }
              }}
              className="w-full p-3 rounded-xl border border-slate-200 font-mono text-xs focus:outline-hidden"
            />

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">
                Columns: Recipient Name, Recipient Phone, Product SKU, Quantity, Address Line 1, City, State, PIN Code
              </span>
              <button
                type="button"
                onClick={() => handleValidateCsv(csvContent)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Validate CSV</span>
              </button>
            </div>
          </div>

          {/* CSV Validation Feedback Banner */}
          {csvValidationSummary && (
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
              csvValidationSummary.invalidRowsCount === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>Validation Result: {csvValidationSummary.validRowsCount} valid / {csvValidationSummary.totalRows} total rows</span>
                {csvValidationSummary.invalidRowsCount === 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 text-[10px]">ALL ROWS VALID</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px]">{csvValidationSummary.invalidRowsCount} ERRORS FOUND</span>
                )}
              </div>

              {csvValidationSummary.errors.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-1 text-rose-700 font-mono text-[11px] bg-white/70 p-2 rounded-lg">
                  {csvValidationSummary.errors.slice(0, 5).map((err: string, idx: number) => (
                    <div key={idx}>• {err}</div>
                  ))}
                  {csvValidationSummary.errors.length > 5 && (
                    <div>+ {csvValidationSummary.errors.length - 5} more row errors...</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Add Row */}
          <form onSubmit={handleAddRecipient} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-rose-600" />
              Add Single Recipient Dispatch
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Recipient Full Name *"
                value={newRec.name || ''}
                onChange={(e) => setNewRec({ ...newRec, name: e.target.value })}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
              />
              <input
                type="text"
                placeholder="Phone (10 digits) *"
                value={newRec.phone || ''}
                onChange={(e) => setNewRec({ ...newRec, phone: e.target.value })}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
              />
              <input
                type="text"
                placeholder="6-Digit PIN Code *"
                maxLength={6}
                value={newRec.pincode || ''}
                onChange={(e) => setNewRec({ ...newRec, pincode: e.target.value })}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden"
              />
              <input
                type="text"
                placeholder="Department (e.g. Sales)"
                value={newRec.department || ''}
                onChange={(e) => setNewRec({ ...newRec, department: e.target.value })}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Street Address / Society *"
                value={newRec.address || ''}
                onChange={(e) => setNewRec({ ...newRec, address: e.target.value })}
                className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
              />
              <input
                type="text"
                placeholder="Custom Gift Note for this recipient"
                value={newRec.customGiftNote || ''}
                onChange={(e) => setNewRec({ ...newRec, customGiftNote: e.target.value })}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save to Dispatch Roster</span>
              </button>
            </div>
          </form>

          {/* Recipients Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Recipient Name</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">City / State</th>
                  <th className="p-3">PIN Code</th>
                  <th className="p-3">Personal Message</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recipients.map((rec, idx) => (
                  <tr key={rec.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-semibold text-slate-900">
                      <div>{rec.name}</div>
                      <div className="text-[10px] text-slate-400">{rec.phone}</div>
                    </td>
                    <td className="p-3">{rec.department || 'General'}</td>
                    <td className="p-3">
                      <div>{rec.city}, {rec.state}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">{rec.address}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-800">{rec.pincode}</td>
                    <td className="p-3 italic text-slate-600 max-w-xs truncate">
                      "{rec.customGiftNote || 'Best wishes'}"
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setRecipients(prev => prev.filter(r => r.id !== rec.id))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove recipient"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                      No recipients in roster. Import a CSV or add manually above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: RFQS & QUOTATIONS WITH APPROVAL WORKFLOW */}
      {activeTab === 'rfqs' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900">
                Quotations & Formal Commercial POs
              </h2>
              <p className="text-xs text-slate-500">
                Review official GST quotations, compare revisions, and exercise APPROVER / OWNER acceptance.
              </p>
            </div>
            <button
              onClick={fetchCorporateData}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1"
              title="Refresh Quotes"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Quotations List */}
          <div className="space-y-4">
            {quoteList.map((q) => (
              <div
                key={q.id}
                className="p-5 rounded-2xl border border-rose-100 bg-[#FFFDFB] shadow-2xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">{q.quoteNumber}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        Rev {q.revision}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        q.status === 'ACCEPTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.status === 'ISSUED'
                          ? 'bg-amber-100 text-amber-800'
                          : q.status === 'SUPERSEDED'
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {q.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Valid Until: <strong>{new Date(q.validUntil).toLocaleDateString('en-IN')}</strong>
                      {q.rfqId && <span className="ml-2 font-mono text-slate-400">Linked RFQ</span>}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">Total Commercial Value</div>
                    <div className="font-serif font-bold text-xl text-rose-950">
                      ₹{Number(q.grandTotalPaise / 100n || q.grandTotalPaise).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Items in Quotation */}
                <div className="space-y-2">
                  {(q.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[11px] text-slate-500">SKU: {item.sku} • HSN: {item.hsnCode}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{item.quantity} pcs @ ₹{item.unitPricePaise / 100}</div>
                        <div className="text-slate-500 text-[11px]">
                          Total: ₹{Number(item.lineTotalPaise / 100n || item.lineTotalPaise).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Commercial Terms & Customer Notes */}
                {q.commercialTerms && (
                  <div className="text-xs text-slate-600 p-2.5 rounded-xl bg-amber-50/50 border border-amber-100">
                    <strong className="block font-bold text-slate-800">Commercial Terms:</strong>
                    <span>{q.commercialTerms}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs">
                  <div className="text-slate-600">
                    <span>Tax Calculation: </span>
                    <strong className="text-slate-800">
                      ₹{Number(q.taxTotalPaise / 100n || q.taxTotalPaise).toLocaleString('en-IN')} (GST ITC Eligible)
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* APPROVAL WORKFLOW: Only APPROVER or OWNER can accept or reject */}
                    {q.status === 'ISSUED' && q.isLatestRevision && isOwnerOrApprover && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedQuoteForAction(q);
                            setQuoteActionType('REJECT');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold text-xs flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject Quote</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedQuoteForAction(q);
                            setQuoteActionType('ACCEPT');
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept Quotation</span>
                        </button>
                      </>
                    )}

                    {/* Convert accepted quote to order group */}
                    {q.status === 'ACCEPTED' && (
                      <button
                        onClick={() => handleConvertQuoteToOrderGroup(q)}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Place Multi-Address Order Group</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ))}

            {quoteList.length === 0 && (
              <div className="p-8 text-center text-slate-400 italic">
                No corporate quotations found. Submit an RFQ to receive an official GST quote from our sales desk.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: COMPANY PROFILE, MEMBERS & ADDRESSES */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          {!profile ? (
            /* Registration Form if user has no corporate account yet */
            <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="font-serif text-2xl font-bold text-slate-900">
                  Apply for a Corporate B2B Account
                </h2>
                <p className="text-xs text-slate-500">
                  Register your business entity for volume pricing agreements, dedicated sales manager, and multi-address order groups.
                </p>
              </div>

              <form onSubmit={handleRegisterCorporate} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Legal Company Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Innovations Pvt Ltd"
                      value={regForm.legalName}
                      onChange={(e) => setRegForm({ ...regForm, legalName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Brand / Display Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Innovations"
                      value={regForm.displayName}
                      onChange={(e) => setRegForm({ ...regForm, displayName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Company Procurement Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="procurement@acme.com"
                      value={regForm.companyEmail}
                      onChange={(e) => setRegForm({ ...regForm, companyEmail: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contact Person Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={regForm.contactPerson}
                      onChange={(e) => setRegForm({ ...regForm, contactPerson: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Contact Phone (10 digits) *</label>
                    <input
                      type="text"
                      required
                      placeholder="+91 98000 00000"
                      value={regForm.contactPhone}
                      onChange={(e) => setRegForm({ ...regForm, contactPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">GSTIN (Optional / Where Applicable)</label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="08AABCS1429B1Z1"
                      value={regForm.gstin}
                      onChange={(e) => setRegForm({ ...regForm, gstin: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono uppercase"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Registered Street Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="Floor 4, Tech Park, Outer Ring Road"
                      value={regForm.street}
                      onChange={(e) => setRegForm({ ...regForm, street: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bengaluru"
                      value={regForm.city}
                      onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">6-Digit PIN Code *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="560103"
                      value={regForm.pincode}
                      onChange={(e) => setRegForm({ ...regForm, pincode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="px-6 py-2.5 rounded-full bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-rose-200"
                  >
                    {isRegistering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>Submit Corporate Application</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Active Company Profile & Details */
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-4">
                <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-slate-900">
                      Registered Company Profile
                    </h2>
                    <p className="text-xs text-slate-500">Legal entity information registered with Snappy Gifts.</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    profile.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {profile.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Legal Name:</span>
                    <strong className="text-slate-900">{profile.legalName || profile.companyName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Business Display:</span>
                    <strong className="text-slate-900">{profile.displayName || profile.companyName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">GSTIN:</span>
                    <strong className="text-slate-900 font-mono">{profile.gstin || 'Not Provided'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Procurement Email:</span>
                    <strong className="text-slate-900">{profile.companyEmail || profile.businessEmail}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Contact Phone:</span>
                    <strong className="text-slate-900">{profile.contactPhone || profile.phone}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Your Role:</span>
                    <strong className="text-rose-700 font-bold">{userRole}</strong>
                  </div>
                </div>
              </div>

              {/* Members Management */}
              <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-rose-700" />
                      <span>Corporate Account Members</span>
                    </h3>
                    <p className="text-xs text-slate-500">Manage permissions across OWNER, REQUESTER, APPROVER, and FINANCE.</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {(profile.memberships || []).map((m: any) => (
                    <div key={m.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{m.userName || m.user?.name || m.userId}</div>
                        <div className="text-[11px] text-slate-400">{m.userEmail || m.user?.email}</div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-[10px]">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Saved Delivery Addresses */}
              <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-rose-700" />
                      <span>Saved Corporate Delivery Addresses</span>
                    </h3>
                    <p className="text-xs text-slate-500">Corporate branch offices and fulfillment hubs.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedAddresses.map((addr) => (
                    <div key={addr.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                      <div className="font-bold text-slate-900 flex justify-between">
                        <span>{addr.label}</span>
                        <span className="font-mono text-slate-500">{addr.pincode}</span>
                      </div>
                      <div className="text-slate-600">{addr.recipientName} ({addr.recipientPhone})</div>
                      <div className="text-slate-500">{addr.street}, {addr.city}, {addr.state}</div>
                    </div>
                  ))}
                  {savedAddresses.length === 0 && (
                    <div className="text-slate-400 italic text-xs col-span-2">
                      No saved corporate addresses recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quote Accept / Reject Confirmation Modal */}
      {selectedQuoteForAction && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedQuoteForAction(null);
          }}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900">
                {quoteActionType === 'ACCEPT' ? 'Accept Official Quotation' : 'Reject Quotation'}
              </h3>
              <button onClick={() => setSelectedQuoteForAction(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Quotation <strong className="font-mono">{selectedQuoteForAction.quoteNumber}</strong> (Rev {selectedQuoteForAction.revision}) with total commercial value of <strong>₹{Number(selectedQuoteForAction.grandTotalPaise / 100n || selectedQuoteForAction.grandTotalPaise).toLocaleString('en-IN')}</strong>.
            </p>

            {quoteActionType === 'REJECT' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Please state why this quotation was rejected..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedQuoteForAction(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingQuoteAction}
                onClick={handleRespondToQuote}
                className={`px-5 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs ${
                  quoteActionType === 'ACCEPT'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingQuoteAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm {quoteActionType === 'ACCEPT' ? 'Acceptance' : 'Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
