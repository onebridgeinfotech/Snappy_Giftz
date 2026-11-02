import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, Order, SupportTicket } from '../../types';
import { BUSINESS_CONFIG } from '../../config/business';
import {
  BarChart3,
  Package,
  ShoppingCart,
  Building2,
  FileText,
  AlertTriangle,
  Plus,
  Truck,
  CheckCircle2,
  Search,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Warehouse,
  ShieldAlert,
  Printer,
  X,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Send,
  Check,
  Loader2,
  Users,
  Settings,
  Activity,
  FileSpreadsheet,
  Download,
  Filter,
  Clock,
  ShieldCheck,
  Lock,
  Server,
  Database
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    orders,
    updateOrderStatus,
    quotations,
    updateQuotationStatus,
    tickets,
    addTicketReply,
    setSelectedOrder,
    setActiveModal,
    showToast
  } = useApp();

  const [activeAdminTab, setActiveAdminTab] = useState<
    | 'overview'
    | 'orders'
    | 'inventory'
    | 'quotations'
    | 'users'
    | 'reports'
    | 'settings'
    | 'seller-config'
    | 'email-outbox'
    | 'audit'
    | 'operations'
    | 'tickets'
  >('overview');

  // Batch 10: Overview Metrics State
  const [overviewMetrics, setOverviewMetrics] = useState<any | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // Batch 10: Users & Staff Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersPagination, setUsersPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<{ id: string; name: string; currentRole: string } | null>(null);
  const [newUserRole, setNewUserRole] = useState('CUSTOMER');

  // Batch 10: Business Reports State
  const [reportsSubTab, setReportsSubTab] = useState<'sales' | 'orders' | 'inventory' | 'taxes'>('sales');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [salesReportData, setSalesReportData] = useState<any | null>(null);
  const [ordersReportData, setOrdersReportData] = useState<any | null>(null);
  const [inventoryReportData, setInventoryReportData] = useState<any | null>(null);
  const [taxReportData, setTaxReportData] = useState<any | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Batch 10: Business Settings State
  const [storeConfig, setStoreConfig] = useState<any | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [storeConfigForm, setStoreConfigForm] = useState<{
    storeName: string;
    supportEmail: string;
    supportPhone: string;
    operatingHours: string;
    headquartersAddress: string;
    standardShippingFeeRupees: number;
    freeShippingThresholdRupees: number;
    expressShippingFeeRupees: number;
    shippingInstructions: string;
    lowStockThreshold: number;
    outOfStockThreshold: number;
    autoNotifyLowStock: boolean;
    allowCustomText: boolean;
    allowArtworkUpload: boolean;
    maxArtworkUploadBytes: number;
    woodenCrateSurchargeRupees: number;
  }>({
    storeName: BUSINESS_CONFIG.brandName,
    supportEmail: BUSINESS_CONFIG.officialEmail,
    supportPhone: '',
    operatingHours: BUSINESS_CONFIG.operatingHours,
    headquartersAddress: BUSINESS_CONFIG.address.formattedSingleLine,
    standardShippingFeeRupees: 99,
    freeShippingThresholdRupees: 999,
    expressShippingFeeRupees: 199,
    shippingInstructions: 'Dispatched via Air Express or Surface Courier across India within 24-48 hours.',
    lowStockThreshold: 100,
    outOfStockThreshold: 0,
    autoNotifyLowStock: true,
    allowCustomText: true,
    allowArtworkUpload: true,
    maxArtworkUploadBytes: 5242880,
    woodenCrateSurchargeRupees: 150,
  });

  // Batch 10: Audit Log State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPagination, setAuditPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [selectedAuditPayload, setSelectedAuditPayload] = useState<any | null>(null);

  // Batch 10: System Health & Operations State
  const [systemHealth, setSystemHealth] = useState<any | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Batch 6: Server-backed Order Management State
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminPagination, setAdminPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [adminOrderError, setAdminOrderError] = useState<string | null>(null);

  // Modals for admin order actions
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);
  const [dispatchModalOrder, setDispatchModalOrder] = useState<any | null>(null);
  const [dispatchCarrier, setDispatchCarrier] = useState('BlueDart Air Express');
  const [dispatchAwb, setDispatchAwb] = useState('');
  const [dispatchTrackingUrl, setDispatchTrackingUrl] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchPhysicalSignatureConfirmed, setDispatchPhysicalSignatureConfirmed] = useState(false);
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Batch 8: Seller Config & Email Outbox State
  const [sellerConfig, setSellerConfig] = useState<any | null>(null);
  const [isLoadingSeller, setIsLoadingSeller] = useState(false);
  const [sellerSaveLoading, setSellerSaveLoading] = useState(false);
  const [sellerForm, setSellerForm] = useState({
    legalName: '',
    tradeName: '',
    gstin: '',
    pan: '',
    registeredStreet: '',
    city: '',
    state: 'Rajasthan',
    stateCode: '08',
    pincode: '302021',
    contactEmail: '',
    contactPhone: '',
    invoicePrefix: 'SG',
    authorizedSignatoryName: '',
    isVerified: false,
  });

  const [outboxMessages, setOutboxMessages] = useState<any[]>([]);
  const [isLoadingOutbox, setIsLoadingOutbox] = useState(false);
  const [isProcessingOutbox, setIsProcessingOutbox] = useState(false);
  const [isIssuingInvoice, setIsIssuingInvoice] = useState(false);

  // Batch 9A: Corporate & Quotations Administration State
  const [corporateSubTab, setCorporateSubTab] = useState<'accounts' | 'rfqs' | 'quotes' | 'orders' | 'pricing'>('accounts');
  const [corporateAccounts, setCorporateAccounts] = useState<any[]>([]);
  const [corporateRFQs, setCorporateRFQs] = useState<any[]>([]);
  const [corporateQuotes, setCorporateQuotes] = useState<any[]>([]);
  const [corporateOrderGroups, setCorporateOrderGroups] = useState<any[]>([]);
  const [corporatePricingAgreements, setCorporatePricingAgreements] = useState<any[]>([]);
  const [isLoadingCorporate, setIsLoadingCorporate] = useState(false);
  const [rejectOrgReason, setRejectOrgReason] = useState('');
  const [rejectingOrgId, setRejectingOrgId] = useState<string | null>(null);
  const [preparingQuoteRFQ, setPreparingQuoteRFQ] = useState<any | null>(null);
  const [quoteDiscountPercent, setQuoteDiscountPercent] = useState<number>(10);

  const fetchCorporateAdminData = useCallback(async () => {
    setIsLoadingCorporate(true);
    try {
      const [accRes, rfqRes, quoteRes, orderRes, priceRes] = await Promise.all([
        fetch('/api/admin/corporate/accounts'),
        fetch('/api/admin/corporate/rfqs'),
        fetch('/api/admin/corporate/quotes'),
        fetch('/api/admin/corporate/orders'),
        fetch('/api/admin/corporate/pricing'),
      ]);

      if (accRes.ok) {
        const d = await accRes.json();
        if (d.success) setCorporateAccounts(d.data || []);
      }
      if (rfqRes.ok) {
        const d = await rfqRes.json();
        if (d.success) setCorporateRFQs(d.data || []);
      }
      if (quoteRes.ok) {
        const d = await quoteRes.json();
        if (d.success) setCorporateQuotes(d.data || []);
      }
      if (orderRes.ok) {
        const d = await orderRes.json();
        if (d.success) setCorporateOrderGroups(d.data || []);
      }
      if (priceRes.ok) {
        const d = await priceRes.json();
        if (d.success) setCorporatePricingAgreements(d.data || []);
      }
    } catch (err: any) {
      console.warn('Could not fetch corporate admin data:', err.message);
    } finally {
      setIsLoadingCorporate(false);
    }
  }, []);

  const fetchOverviewMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      if (res.ok && data.data) {
        setOverviewMetrics(data.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch admin overview metrics:', err.message);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  const fetchUsers = useCallback(async (page = 1) => {
    setIsLoadingUsers(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (userSearch.trim()) params.set('search', userSearch.trim());
      if (userRoleFilter) params.set('role', userRoleFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setUsersList(data.data);
        if (data.pagination) setUsersPagination(data.pagination);
      }
    } catch (err: any) {
      console.warn('Could not fetch users list:', err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [userSearch, userRoleFilter]);

  const handleUpdateUserRole = async () => {
    if (!editingUserRole) return;
    try {
      const res = await fetch(`/api/admin/users/${editingUserRole.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newUserRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user role');
      showToast(data.message || 'User role updated successfully.', 'success');
      setEditingUserRole(null);
      fetchUsers(usersPagination.page);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleUserStatus = async (user: any) => {
    const nextStatus = !user.isActive;
    const confirmMsg = nextStatus
      ? `Activate account for ${user.name}?`
      : `Deactivate account for ${user.name}? All active sessions will be revoked immediately.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update account status');
      showToast(`User account ${nextStatus ? 'activated' : 'deactivated'}.`, 'success');
      fetchUsers(usersPagination.page);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const fetchReports = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      const params = new URLSearchParams();
      if (reportDateFrom) params.set('from', reportDateFrom);
      if (reportDateTo) params.set('to', reportDateTo);
      const query = params.toString() ? `?${params.toString()}` : '';

      if (reportsSubTab === 'sales') {
        const res = await fetch(`/api/admin/reports/sales${query}`);
        const data = await res.json();
        if (res.ok) setSalesReportData(data.data);
      } else if (reportsSubTab === 'orders') {
        const res = await fetch(`/api/admin/reports/orders${query}`);
        const data = await res.json();
        if (res.ok) setOrdersReportData(data.data);
      } else if (reportsSubTab === 'inventory') {
        const res = await fetch(`/api/admin/reports/inventory`);
        const data = await res.json();
        if (res.ok) setInventoryReportData(data.data);
      } else if (reportsSubTab === 'taxes') {
        const res = await fetch(`/api/admin/reports/taxes${query}`);
        const data = await res.json();
        if (res.ok) setTaxReportData(data.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch report data:', err.message);
    } finally {
      setIsLoadingReport(false);
    }
  }, [reportsSubTab, reportDateFrom, reportDateTo]);

  const handleDownloadReportCsv = (reportType: string) => {
    const params = new URLSearchParams({ export: 'csv' });
    if (reportDateFrom) params.set('from', reportDateFrom);
    if (reportDateTo) params.set('to', reportDateTo);
    window.open(`/api/admin/reports/${reportType}?${params.toString()}`, '_blank');
    showToast(`${reportType.toUpperCase()} CSV report export initiated.`);
  };

  const fetchStoreConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (res.ok && data.data) {
        setStoreConfig(data.data);
        setStoreConfigForm({
          storeName: data.data.storeName || BUSINESS_CONFIG.brandName,
          supportEmail: data.data.supportEmail || BUSINESS_CONFIG.officialEmail,
          supportPhone: data.data.supportPhone || '',
          operatingHours: data.data.operatingHours || BUSINESS_CONFIG.operatingHours,
          headquartersAddress: data.data.headquartersAddress || BUSINESS_CONFIG.address.formattedSingleLine,
          standardShippingFeeRupees: Number(data.data.standardShippingFeePaise || 9900) / 100,
          freeShippingThresholdRupees: Number(data.data.freeShippingThresholdPaise || 99900) / 100,
          expressShippingFeeRupees: Number(data.data.expressShippingFeePaise || 19900) / 100,
          shippingInstructions: data.data.shippingInstructions || '',
          lowStockThreshold: data.data.lowStockThreshold || 100,
          outOfStockThreshold: data.data.outOfStockThreshold || 0,
          autoNotifyLowStock: Boolean(data.data.autoNotifyLowStock),
          allowCustomText: Boolean(data.data.allowCustomText),
          allowArtworkUpload: Boolean(data.data.allowArtworkUpload),
          maxArtworkUploadBytes: data.data.maxArtworkUploadBytes || 5242880,
          woodenCrateSurchargeRupees: Number(data.data.woodenCrateSurchargePaise || 15000) / 100,
        });
      }
    } catch (err: any) {
      console.warn('Could not fetch store config:', err.message);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  const handleSaveStoreConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const payload = {
        storeName: storeConfigForm.storeName,
        supportEmail: storeConfigForm.supportEmail,
        supportPhone: storeConfigForm.supportPhone,
        operatingHours: storeConfigForm.operatingHours,
        headquartersAddress: storeConfigForm.headquartersAddress,
        standardShippingFeePaise: Math.round(storeConfigForm.standardShippingFeeRupees * 100),
        freeShippingThresholdPaise: Math.round(storeConfigForm.freeShippingThresholdRupees * 100),
        expressShippingFeePaise: Math.round(storeConfigForm.expressShippingFeeRupees * 100),
        shippingInstructions: storeConfigForm.shippingInstructions,
        lowStockThreshold: Number(storeConfigForm.lowStockThreshold),
        outOfStockThreshold: Number(storeConfigForm.outOfStockThreshold),
        autoNotifyLowStock: storeConfigForm.autoNotifyLowStock,
        allowCustomText: storeConfigForm.allowCustomText,
        allowArtworkUpload: storeConfigForm.allowArtworkUpload,
        maxArtworkUploadBytes: Number(storeConfigForm.maxArtworkUploadBytes),
        woodenCrateSurchargePaise: Math.round(storeConfigForm.woodenCrateSurchargeRupees * 100),
      };

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update store settings');
      showToast('Store settings saved successfully.', 'success');
      setStoreConfig(data.data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const fetchAuditLogs = useCallback(async (page = 1) => {
    setIsLoadingAudit(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (auditActionFilter) params.set('action', auditActionFilter);
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setAuditLogs(data.data);
        if (data.pagination) setAuditPagination(data.pagination);
      }
    } catch (err: any) {
      console.warn('Could not fetch audit logs:', err.message);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [auditActionFilter]);

  const fetchSystemHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const res = await fetch('/api/admin/system/health');
      const data = await res.json();
      if (res.ok && data.data) {
        setSystemHealth(data.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch system health:', err.message);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  const fetchSellerConfig = useCallback(async () => {
    setIsLoadingSeller(true);
    try {
      const res = await fetch('/api/admin/seller-config');
      const data = await res.json();
      if (res.ok && data.data) {
        setSellerConfig(data.data);
        setSellerForm({
          legalName: data.data.legalName || '',
          tradeName: data.data.tradeName || '',
          gstin: data.data.gstin || '',
          pan: data.data.pan || '',
          registeredStreet: data.data.registeredStreet || '',
          city: data.data.city || '',
          state: data.data.state || 'Rajasthan',
          stateCode: data.data.stateCode || '08',
          pincode: data.data.pincode || '',
          contactEmail: data.data.contactEmail || '',
          contactPhone: data.data.contactPhone || '',
          invoicePrefix: data.data.invoicePrefix || 'SG',
          authorizedSignatoryName: data.data.authorizedSignatoryName || '',
          isVerified: Boolean(data.data.isVerified),
        });
      }
    } catch (err: any) {
      console.warn('Could not fetch seller config:', err.message);
    } finally {
      setIsLoadingSeller(false);
    }
  }, []);

  const fetchOutboxMessages = useCallback(async () => {
    setIsLoadingOutbox(true);
    try {
      const res = await fetch('/api/admin/email/outbox');
      const data = await res.json();
      if (res.ok && data.data) {
        setOutboxMessages(data.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch email outbox:', err.message);
    } finally {
      setIsLoadingOutbox(false);
    }
  }, []);

  useEffect(() => {
    if (activeAdminTab === 'overview') {
      fetchOverviewMetrics();
    } else if (activeAdminTab === 'quotations') {
      fetchCorporateAdminData();
    } else if (activeAdminTab === 'seller-config') {
      fetchSellerConfig();
    } else if (activeAdminTab === 'email-outbox') {
      fetchOutboxMessages();
    } else if (activeAdminTab === 'users') {
      fetchUsers(1);
    } else if (activeAdminTab === 'reports') {
      fetchReports();
    } else if (activeAdminTab === 'settings') {
      fetchStoreConfig();
    } else if (activeAdminTab === 'audit') {
      fetchAuditLogs(1);
    } else if (activeAdminTab === 'operations') {
      fetchSystemHealth();
    }
  }, [
    activeAdminTab,
    fetchOverviewMetrics,
    fetchCorporateAdminData,
    fetchSellerConfig,
    fetchOutboxMessages,
    fetchUsers,
    fetchReports,
    fetchStoreConfig,
    fetchAuditLogs,
    fetchSystemHealth,
  ]);

  const handleReviewCorporateAccount = async (orgId: string, action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE', reason?: string) => {
    try {
      const res = await fetch(`/api/admin/corporate/accounts/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to review account');
      showToast(data.message || `Account ${action}d successfully.`, 'success');
      setRejectingOrgId(null);
      setRejectOrgReason('');
      fetchCorporateAdminData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateQuotationFromRFQ = async (rfq: any) => {
    try {
      const res = await fetch('/api/admin/corporate/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqId: rfq.id,
          organizationId: rfq.organizationId,
          validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
          commercialTerms: 'Payment: 100% advance. Delivery: 7-10 business days.',
          customerNotes: `Official commercial quotation prepared for ${rfq.title}.`,
          items: (rfq.items || []).map((i: any) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.requestedQuantity || i.quantity || 50,
            discountPercent: quoteDiscountPercent,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create quotation');
      showToast(`Quotation ${data.data.quoteNumber} issued successfully!`, 'success');
      setPreparingQuoteRFQ(null);
      fetchCorporateAdminData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleReviseQuotation = async (quote: any) => {
    try {
      const res = await fetch(`/api/admin/corporate/quotes/${quote.id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNotes: `Revised quote with increased volume incentive discount.`,
          items: (quote.items || []).map((i: any) => ({
            productId: i.productId,
            variantId: i.variantId,
            sku: i.sku,
            quantity: i.quantity,
            discountPercent: Math.min(50, (i.discountPercent || 0) + 5),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revise quotation');
      showToast(`Revised quote issued: Rev ${data.data.revision}`, 'success');
      fetchCorporateAdminData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };


  const handleSaveSellerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerSaveLoading(true);
    try {
      const res = await fetch('/api/admin/seller-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sellerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save seller config');
      setSellerConfig(data.data);
      showToast('Seller & tax invoice configuration saved successfully.');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSellerSaveLoading(false);
    }
  };


  const handleProcessOutbox = async () => {
    setIsProcessingOutbox(true);
    try {
      const res = await fetch('/api/admin/email/process', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process outbox');
      showToast(data.message || 'Outbox processed successfully.');
      fetchOutboxMessages();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsProcessingOutbox(false);
    }
  };

  const handleRetryEmail = async (outboxId: string) => {
    try {
      const res = await fetch('/api/admin/email/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outboxId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retry email');
      showToast('Email queued for retry.');
      fetchOutboxMessages();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDownloadInvoice = async (orderNumber: string) => {
    try {
      const res = await fetch(`/api/orders/${orderNumber}/invoice`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to download tax invoice');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Tax invoice PDF downloaded.');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDownloadPackingSlip = async (orderId: string, orderNumber: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/packing-slip`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to download packing slip');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PackingSlip-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Packing slip PDF downloaded.');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleReissueInvoice = async (orderNumber: string) => {
    setIsIssuingInvoice(true);
    try {
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIdOrNumber: orderNumber, forceReissue: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue tax invoice');
      showToast(data.message || 'Tax invoice reissued successfully.');
      if (selectedOrderDetails) {
        handleViewOrderDetails(selectedOrderDetails.id);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsIssuingInvoice(false);
    }
  };

  const fetchAdminOrders = useCallback(async (page = 1) => {
    setIsLoadingOrders(true);
    setAdminOrderError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (orderSearch.trim()) params.set('search', orderSearch.trim());
      if (orderStatusFilter) params.set('orderStatus', orderStatusFilter);
      if (paymentStatusFilter) params.set('paymentStatus', paymentStatusFilter);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch orders from server.');
      }
      setAdminOrders(data.data || []);
      if (data.pagination) {
        setAdminPagination(data.pagination);
      }
    } catch (err: any) {
      console.warn('[AdminDashboard] API fetch failed, falling back to local orders:', err.message);
      // Dev/local fallback: map context orders into admin table structure
      let list = orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        destinationStateCode: o.shippingAddress?.state ? '08' : '08',
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        itemsCount: o.items.reduce((acc, i) => acc + i.quantity, 0),
        grandTotalPaise: Math.round(o.grandTotal * 100),
        createdAt: o.date ? new Date(o.date).toISOString() : new Date().toISOString(),
        shipment: o.awbNumber ? {
          carrierPartner: o.courierPartner,
          awbNumber: o.awbNumber,
          trackingUrl: o.trackingUrl || null,
          dispatchStatus: o.orderStatus === 'Delivered' ? 'DELIVERED' : 'DISPATCHED',
          dispatchedAt: new Date().toISOString(),
          deliveredAt: o.orderStatus === 'Delivered' ? new Date().toISOString() : null,
        } : null,
      }));

      if (orderStatusFilter) {
        list = list.filter((o) => o.orderStatus.toLowerCase() === orderStatusFilter.toLowerCase() || o.orderStatus.replace('_', ' ').toLowerCase() === orderStatusFilter.replace('_', ' ').toLowerCase());
      }
      if (paymentStatusFilter) {
        list = list.filter((o) => o.paymentStatus.toLowerCase() === paymentStatusFilter.toLowerCase());
      }
      if (orderSearch.trim()) {
        const s = orderSearch.trim().toLowerCase();
        list = list.filter((o) => o.orderNumber.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s) || o.customerPhone.includes(s));
      }

      setAdminOrders(list);
      setAdminPagination({ total: list.length, page: 1, limit: 10, totalPages: Math.max(1, Math.ceil(list.length / 10)) });
    } finally {
      setIsLoadingOrders(false);
    }
  }, [orderSearch, orderStatusFilter, paymentStatusFilter, orders]);

  useEffect(() => {
    if (activeAdminTab === 'orders') {
      fetchAdminOrders(1);
    } else if (activeAdminTab === 'seller-config') {
      fetchSellerConfig();
    } else if (activeAdminTab === 'email-outbox') {
      fetchOutboxMessages();
    }
  }, [activeAdminTab, orderStatusFilter, paymentStatusFilter, fetchAdminOrders, fetchSellerConfig, fetchOutboxMessages]);

  const handleStatusTransition = async (orderId: string, newStatus: string) => {
    setAdminOrderError(null);
    setActionInProgressId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transition order status.');
      }
      showToast(data.message || `Order status updated to ${newStatus}`);
      fetchAdminOrders(adminPagination.page);
    } catch (err: any) {
      setAdminOrderError(err.message);
      showToast(err.message, 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleOpenDispatchModal = (order: any) => {
    setDispatchModalOrder(order);
    setDispatchCarrier(order.shipment?.carrierPartner || 'BlueDart Air Express');
    setDispatchAwb(order.shipment?.awbNumber || '');
    setDispatchTrackingUrl(order.shipment?.trackingUrl || '');
    setDispatchNotes('');
    setDispatchPhysicalSignatureConfirmed(false);
    setDispatchError(null);
  };

  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalOrder) return;
    setDispatchError(null);

    if (!dispatchCarrier.trim()) {
      setDispatchError('Carrier partner name is required (e.g. BlueDart, Delhivery).');
      return;
    }
    if (!dispatchAwb.trim()) {
      setDispatchError('AWB tracking number is required.');
      return;
    }
    if (dispatchTrackingUrl.trim()) {
      try {
        const u = new URL(dispatchTrackingUrl.trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          setDispatchError('Tracking URL must use http: or https: scheme.');
          return;
        }
      } catch {
        setDispatchError('Invalid tracking URL format.');
        return;
      }
    }

    setDispatchSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${dispatchModalOrder.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierPartner: dispatchCarrier.trim(),
          awbNumber: dispatchAwb.trim(),
          trackingUrl: dispatchTrackingUrl.trim() || null,
          notes: dispatchNotes.trim() || null,
          invoicePhysicalSignatureConfirmed: dispatchPhysicalSignatureConfirmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch order.');
      }
      showToast(data.message || 'Order dispatched successfully!');
      setDispatchModalOrder(null);
      fetchAdminOrders(adminPagination.page);
    } catch (err: any) {
      setDispatchError(err.message);
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const handleConfirmDelivery = async (orderId: string) => {
    setAdminOrderError(null);
    setActionInProgressId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Confirmed delivery by staff in operations portal.' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to confirm order delivery.');
      }
      showToast(data.message || 'Delivery confirmed successfully!');
      fetchAdminOrders(adminPagination.page);
    } catch (err: any) {
      setAdminOrderError(err.message);
      showToast(err.message, 'error');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleViewOrderDetails = async (orderId: string) => {
    setLoadingDetailsId(orderId);
    setAdminOrderError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load order details.');
      }
      setSelectedOrderDetails(data.data);
    } catch (err: any) {
      showToast(err.message, 'error');
      // If server error, fallback to finding in context orders
      const fallback = orders.find((o) => o.id === orderId);
      if (fallback) {
        setSelectedOrderDetails({
          ...fallback,
          itemsSubtotalPaise: Math.round(fallback.subtotal * 100),
          taxTotalPaise: Math.round(fallback.taxTotal * 100),
          shippingTotalPaise: Math.round(fallback.shippingTotal * 100),
          grandTotalPaise: Math.round(fallback.grandTotal * 100),
          payments: [{ status: fallback.paymentStatus, amountPaise: Math.round(fallback.grandTotal * 100), gateway: fallback.paymentMethod }],
          shipments: fallback.awbNumber ? [{ carrierPartner: fallback.courierPartner, awbNumber: fallback.awbNumber, dispatchStatus: fallback.orderStatus === 'Delivered' ? 'DELIVERED' : 'DISPATCHED' }] : [],
          statusHistory: [{ fromStatus: 'PENDING', toStatus: fallback.orderStatus, changedBy: 'OPERATIONS', createdAt: fallback.date, notes: 'Order in operations pipeline.' }],
        });
      }
    } finally {
      setLoadingDetailsId(null);
    }
  };

  const handleReviewProof = async (orderItemId: string, status: 'ARTWORK_VERIFIED_BY_STAFF' | 'REJECTED_FOR_REWORK') => {
    try {
      const res = await fetch(`/api/admin/personalization/proofs/${orderItemId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: `Reviewed by staff on ${new Date().toLocaleDateString('en-IN')}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update proof review.');
      showToast(data.message || `Proof marked as ${status}`);
      if (selectedOrderDetails) {
        handleViewOrderDetails(selectedOrderDetails.id);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  
  // New Product Modal Form State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Personalized Gifts');
  const [newProdBasePrice, setNewProdBasePrice] = useState(1499);
  const [newProdMrp, setNewProdMrp] = useState(2199);
  const [newProdStock, setNewProdStock] = useState(100);
  const [newProdWarehouse, setNewProdWarehouse] = useState('Hyderabad Central Warehouse');
  const [newProdSku, setNewProdSku] = useState('SG-NEW-101');
  const [newProdTagline, setNewProdTagline] = useState(`Artisanal personalized gift handcrafted by ${BUSINESS_CONFIG.brandName}`);
  const [newProdImage, setNewProdImage] = useState(
    'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80'
  );

  // Financial calculations
  const totalRevenue = orders.reduce((acc, o) => acc + o.grandTotal, 0);
  const b2bRevenue = orders.filter(o => o.type === 'B2B').reduce((acc, o) => acc + o.grandTotal, 0);
  const b2cRevenue = orders.filter(o => o.type === 'B2C').reduce((acc, o) => acc + o.grandTotal, 0);
  const totalItemsSold = orders.reduce((acc, o) => acc + o.items.reduce((ia, i) => ia + i.quantity, 0), 0);
  const lowStockProducts = products.filter(p => p.stock < 100);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    addProduct({
      name: newProdName,
      tagline: newProdTagline,
      description: 'Handcrafted luxury gift with premium laser engraving or packaging.',
      category: newProdCategory,
      occasion: ['Festival', 'Corporate', 'Anniversary'],
      recipient: ['Colleague', 'Friends', 'Family'],
      basePrice: newProdBasePrice,
      mrp: newProdMrp,
      hsnCode: '69120010',
      taxRate: 18,
      rating: 5.0,
      reviewsCount: 1,
      images: [newProdImage],
      isCustomizable: true,
      customizationType: 'engraving',
      stock: newProdStock,
      sku: newProdSku,
      warehouseLocation: newProdWarehouse,
      estimatedDispatchDays: 1,
      badge: 'New Arrival'
    });

    setShowAddProductModal(false);
    setNewProdName('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Admin Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-mono font-bold uppercase">
              Operations Control Center
            </span>
            <span className="text-xs text-slate-400">Central Operations Hub</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-slate-900 mt-1">
            Store & Warehouse Administration
          </h1>
        </div>

        <button
          onClick={() => setShowAddProductModal(true)}
          className="px-4 py-2.5 rounded-full bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-rose-200 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product to Catalog</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveAdminTab('overview')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <span>Overview & KPIs</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('orders')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'orders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4 text-rose-500" />
          <span>Orders & Fulfillment ({adminPagination.total || orders.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('inventory')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'inventory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Warehouse className="w-4 h-4 text-amber-500" />
          <span>Catalogue & Stock ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('quotations')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'quotations'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>Corporate B2B & RFQs</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('users')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-cyan-500" />
          <span>Customers & Staff</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('reports')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'reports'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          <span>Reports & CSV Export</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('settings')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'settings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Settings className="w-4 h-4 text-violet-500" />
          <span>Business Settings</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('seller-config')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'seller-config'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-500" />
          <span>GST & Seller Setup</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('email-outbox')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'email-outbox'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Send className="w-4 h-4 text-blue-500" />
          <span>Emails ({outboxMessages.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('audit')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'audit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-teal-500" />
          <span>Audit Trail</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('operations')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'operations'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-rose-400" />
          <span>System Health & Ops</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('tickets')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeAdminTab === 'tickets'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-pink-500" />
          <span>Support ({tickets.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeAdminTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Captured Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-serif font-bold text-slate-900 mt-2">
                {overviewMetrics?.kpis?.capturedRevenueFormatted || `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1">
                Verified captured payments only
              </div>
              {overviewMetrics?.kpis?.pendingRevenuePaise > 0 && (
                <div className="text-[10px] text-amber-700 mt-0.5">
                  Pending/Auth: {overviewMetrics.kpis.pendingRevenueFormatted}
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Orders & Velocity</span>
                <Package className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-serif font-bold text-slate-900 mt-2">
                {overviewMetrics?.kpis?.totalOrders ?? orders.length} Orders
              </div>
              <div className="text-[11px] text-slate-600 font-medium mt-1">
                Today: <strong className="text-rose-700">{overviewMetrics?.kpis?.ordersToday ?? 0} new</strong> (Asia/Kolkata)
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Corporate B2B Pipeline</span>
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-serif font-bold text-slate-900 mt-2">
                {overviewMetrics?.kpis?.pendingCorporateRfqs ?? quotations.filter(q => q.status === 'Sent for Review').length} Pending RFQs
              </div>
              <div className="text-[11px] text-indigo-700 mt-1">
                Outstanding Quotes: {overviewMetrics?.kpis?.outstandingQuotations ?? 0}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Catalogue & Stock</span>
                <Warehouse className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-serif font-bold text-slate-900 mt-2">
                {overviewMetrics?.kpis?.totalProducts ?? products.length} SKUs
              </div>
              <div className="text-[11px] text-rose-600 font-semibold mt-1">
                {overviewMetrics?.kpis?.lowStockProductsCount ?? lowStockProducts.length} low stock • {overviewMetrics?.kpis?.outOfStockProductsCount ?? 0} out
              </div>
            </div>

          </div>

          {/* Operational Pipeline Tracker */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-rose-600" />
                <span>Live Fulfillment Pipeline Status</span>
              </h3>
              <button
                onClick={() => setActiveAdminTab('orders')}
                className="text-xs text-rose-700 hover:text-rose-900 font-semibold underline"
              >
                View Full Queue &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-slate-500 font-medium">Pending</div>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  {overviewMetrics?.kpis?.pendingOrders ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                <div className="text-purple-700 font-medium">Customization</div>
                <div className="text-lg font-bold text-purple-900 mt-1">
                  {overviewMetrics?.kpis?.ordersAwaitingCustomization ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <div className="text-blue-700 font-medium">Quality Check</div>
                <div className="text-lg font-bold text-blue-900 mt-1">
                  {overviewMetrics?.kpis?.ordersAwaitingQC ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="text-amber-700 font-medium">Ready to Dispatch</div>
                <div className="text-lg font-bold text-amber-900 mt-1">
                  {overviewMetrics?.kpis?.ordersReadyForDispatch ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="text-indigo-700 font-medium">Dispatched</div>
                <div className="text-lg font-bold text-indigo-900 mt-1">
                  {overviewMetrics?.kpis?.dispatchedOrders ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="text-emerald-700 font-medium">Delivered</div>
                <div className="text-lg font-bold text-emerald-900 mt-1">
                  {overviewMetrics?.kpis?.deliveredOrders ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Critical Operational Alerts */}
          {(overviewMetrics?.kpis?.failedEmailsCount > 0 || (overviewMetrics?.kpis?.lowStockProductsCount ?? lowStockProducts.length) > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(overviewMetrics?.kpis?.lowStockProductsCount ?? lowStockProducts.length) > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>
                      <strong>Stock Alert:</strong> {overviewMetrics?.kpis?.lowStockProductsCount ?? lowStockProducts.length} SKU(s) below reorder threshold (&lt;100 units).
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveAdminTab('inventory')}
                    className="text-xs font-bold underline hover:text-amber-950 shrink-0 ml-2"
                  >
                    Inventory
                  </button>
                </div>
              )}

              {overviewMetrics?.kpis?.failedEmailsCount > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>
                      <strong>Email Delivery:</strong> {overviewMetrics.kpis.failedEmailsCount} transactional email(s) failed delivery.
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveAdminTab('email-outbox')}
                    className="text-xs font-bold underline hover:text-rose-950 shrink-0 ml-2"
                  >
                    Retry Outbox
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Two-Column Operational Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Best Sellers */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Top Best-Selling Products</span>
                </h3>
                <span className="text-[11px] text-slate-400">Captured Volume</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-2">Product Name</th>
                      <th className="p-2 text-center">SKU</th>
                      <th className="p-2 text-center">Units Sold</th>
                      <th className="p-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overviewMetrics?.bestSellers && overviewMetrics.bestSellers.length > 0 ? (
                      overviewMetrics.bestSellers.slice(0, 5).map((prod: any) => (
                        <tr key={prod.id}>
                          <td className="p-2 font-semibold text-slate-900 truncate max-w-[180px]" title={prod.name}>
                            {prod.name}
                          </td>
                          <td className="p-2 text-center font-mono text-[11px] text-slate-500">
                            {prod.sku || '—'}
                          </td>
                          <td className="p-2 text-center font-bold text-slate-800">
                            {prod.unitsSold}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-700">
                            {prod.revenueFormatted}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                          No sales data recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Admin Audit Activity */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Recent Administrative Activity</span>
                </h3>
                <button
                  onClick={() => setActiveAdminTab('audit')}
                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline"
                >
                  Full Log &rarr;
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {overviewMetrics?.recentActivity && overviewMetrics.recentActivity.length > 0 ? (
                  overviewMetrics.recentActivity.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {log.action}
                          </span>
                          <span className="text-slate-600">{log.entityType}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          By: <span className="font-mono">{log.actorEmail}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 text-right whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 italic text-xs">
                    No recent administrative activity recorded.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORDER FULFILLMENT PIPELINE */}
      {activeAdminTab === 'orders' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900">
                Order Fulfillment & Logistics Pipeline
              </h2>
              <p className="text-xs text-slate-500">
                Update operational status, assign courier AWB tracking, inspect item snapshots, and confirm dispatches.
              </p>
            </div>

            <button
              onClick={() => fetchAdminOrders(adminPagination.page)}
              disabled={isLoadingOrders}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              <span>Refresh Orders</span>
            </button>
          </div>

          {/* Validation / Authorization Error Banner */}
          {adminOrderError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{adminOrderError}</span>
              </div>
              <button
                onClick={() => setAdminOrderError(null)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div className="sm:col-span-2 relative">
              <input
                type="text"
                placeholder="Search by Order #, Customer, Phone, or AWB..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAdminOrders(1)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-700 focus:outline-hidden"
              >
                <option value="">All Order Statuses</option>
                <option value="PENDING">PENDING (Order Placed)</option>
                <option value="CONFIRMED">CONFIRMED (Payment Verified)</option>
                <option value="IN_CUSTOMIZATION">IN CUSTOMIZATION (Artisan Lab)</option>
                <option value="QUALITY_CHECK">QUALITY CHECK (Packaging)</option>
                <option value="DISPATCHED">DISPATCHED (In Transit)</option>
                <option value="DELIVERED">DELIVERED (Fulfilled)</option>
                <option value="CANCELLED">CANCELLED (Terminal)</option>
              </select>
            </div>

            <div>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-700 focus:outline-hidden"
              >
                <option value="">All Payment States</option>
                <option value="CAPTURED">CAPTURED (Paid)</option>
                <option value="PENDING">PENDING (Unpaid)</option>
                <option value="AUTHORIZED">AUTHORIZED (Held)</option>
                <option value="FAILED">FAILED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Order # & Date</th>
                  <th className="p-3">Customer & Channel</th>
                  <th className="p-3">Items & Products</th>
                  <th className="p-3">Amount & Payment</th>
                  <th className="p-3">Fulfillment Status</th>
                  <th className="p-3">Logistics & AWB</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoadingOrders ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                        <span>Loading orders from server...</span>
                      </div>
                    </td>
                  </tr>
                ) : adminOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No orders found matching your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  adminOrders.map((ord) => {
                    const statusStr = (ord.orderStatus || 'PENDING').toUpperCase().replace(' ', '_');
                    const isTerminal = statusStr === 'DELIVERED' || statusStr === 'CANCELLED';
                    const isDispatched = statusStr === 'DISPATCHED';
                    const canDispatch = statusStr === 'QUALITY_CHECK' || statusStr === 'CONFIRMED';
                    const awbNum = ord.shipment?.awbNumber || ord.awbNumber || null;
                    const carrierName = ord.shipment?.carrierPartner || ord.courierPartner || null;
                    const trackLink = ord.shipment?.trackingUrl || ord.trackingUrl || null;

                    // Compute permitted next transitions from ORDER_TRANSITION_MATRIX
                    const allowedTransitions: string[] = {
                      PENDING: ['CONFIRMED', 'CANCELLED'],
                      ORDER_PLACED: ['CONFIRMED', 'CANCELLED'],
                      CONFIRMED: ['IN_CUSTOMIZATION', 'QUALITY_CHECK', 'CANCELLED'],
                      IN_CUSTOMIZATION: ['QUALITY_CHECK', 'CANCELLED'],
                      QUALITY_CHECK: ['DISPATCHED', 'IN_CUSTOMIZATION', 'CANCELLED'],
                      DISPATCHED: ['DELIVERED'],
                      DELIVERED: [],
                      CANCELLED: [],
                    }[statusStr] || [];

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-mono font-bold text-slate-900">{ord.orderNumber}</div>
                          <div className="text-[11px] text-slate-400">
                            {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-IN') : ord.date}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{ord.customerName}</div>
                          <div className="text-[11px] text-slate-500">{ord.customerPhone}</div>
                          <div className="text-[10px] text-slate-400">
                            {ord.type === 'B2B' ? '🏢 Corporate B2B' : '🛍️ B2C Customer'}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="font-medium text-slate-800">
                            {ord.itemsCount || (ord.items ? ord.items.reduce((s: number, i: any) => s + i.quantity, 0) : 1)} Items
                          </div>
                          {ord.items && ord.items[0]?.productName && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                              {ord.items[0].productName}
                            </div>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="font-serif font-bold text-slate-900">
                            ₹{((ord.grandTotalPaise ? ord.grandTotalPaise / 100 : ord.grandTotal) || 0).toLocaleString('en-IN')}
                          </div>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            ord.paymentStatus === 'CAPTURED' || ord.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ord.paymentStatus}
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="space-y-1">
                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                              statusStr === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : statusStr === 'DISPATCHED'
                                ? 'bg-blue-100 text-blue-800'
                                : statusStr === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {statusStr.replace('_', ' ')}
                            </span>

                            {/* Permitted transitions selector */}
                            {!isTerminal && allowedTransitions.length > 0 && (
                              <div className="mt-1">
                                <select
                                  disabled={actionInProgressId === ord.id}
                                  value=""
                                  onChange={(e) => {
                                    const target = e.target.value;
                                    if (!target) return;
                                    if (target === 'DISPATCHED') {
                                      handleOpenDispatchModal(ord);
                                    } else {
                                      handleStatusTransition(ord.id, target);
                                    }
                                  }}
                                  className="text-[10.5px] px-2 py-1 rounded border border-slate-300 bg-white font-medium text-slate-700 focus:outline-hidden disabled:opacity-50"
                                >
                                  <option value="">Move to &rarr;</option>
                                  {allowedTransitions.map((st) => (
                                    <option key={st} value={st}>
                                      {st.replace('_', ' ')}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-3 font-mono text-[11px]">
                          {awbNum ? (
                            <div>
                              <div className="font-bold text-slate-900">{awbNum}</div>
                              <div className="text-[10px] text-slate-400 font-sans">{carrierName || 'Express Courier'}</div>
                              {trackLink && (
                                <a
                                  href={trackLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-rose-700 hover:underline flex items-center gap-0.5 font-sans font-semibold mt-0.5"
                                >
                                  <span>Track Link</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic font-sans">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-right whitespace-nowrap space-x-1">
                          {/* Inspect Details & Audit */}
                          <button
                            onClick={() => handleViewOrderDetails(ord.id)}
                            disabled={loadingDetailsId === ord.id}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1 font-semibold"
                            title="Inspect Order Details & Audit Trail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Audit</span>
                          </button>

                          {/* Dispatch Action */}
                          {canDispatch && (
                            <button
                              onClick={() => handleOpenDispatchModal(ord)}
                              className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1 font-semibold"
                              title="Assign Courier Partner & AWB"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Dispatch</span>
                            </button>
                          )}

                          {/* Confirm Delivery Action */}
                          {isDispatched && (
                            <button
                              onClick={() => handleConfirmDelivery(ord.id)}
                              disabled={actionInProgressId === ord.id}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1 font-semibold disabled:opacity-50"
                              title="Confirm Order Delivery"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Delivered</span>
                            </button>
                          )}

                          {/* Print Invoice */}
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setActiveModal('invoice_view');
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1 font-semibold"
                            title="View & Print GST Tax Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {adminPagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
              <span className="text-slate-500">
                Showing {adminOrders.length} of {adminPagination.total} total orders (Page {adminPagination.page} of {adminPagination.totalPages})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchAdminOrders(adminPagination.page - 1)}
                  disabled={adminPagination.page <= 1 || isLoadingOrders}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 font-semibold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <button
                  onClick={() => fetchAdminOrders(adminPagination.page + 1)}
                  disabled={adminPagination.page >= adminPagination.totalPages || isLoadingOrders}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 font-semibold"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 3: INVENTORY & WAREHOUSES */}
      {activeAdminTab === 'inventory' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900">
                Warehouse Stock & SKU Management
              </h2>
              <p className="text-xs text-slate-500">
                Monitor real-time inventory counts across Hyderabad, Bengaluru, and national fulfillment hubs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((prod) => (
              <div
                key={prod.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between space-y-3"
              >
                <div className="flex gap-3">
                  <img src={prod.images[0]} alt={prod.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-slate-400 block">{prod.sku}</span>
                    <h4 className="font-serif font-bold text-xs text-slate-900 truncate">{prod.name}</h4>
                    <span className="text-[11px] text-slate-500 block">{prod.category}</span>
                    <span className="text-xs font-serif font-bold text-rose-900 mt-1 block">₹{prod.basePrice}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Stock Count:</span>
                    <strong className={`text-sm font-bold font-mono ${prod.stock < 100 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {prod.stock} units
                    </strong>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateProduct(prod.id, { stock: Math.max(0, prod.stock - 10) })}
                      className="px-2 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 font-bold"
                      title="Adjust down -10"
                    >
                      -10
                    </button>
                    <button
                      onClick={() => updateProduct(prod.id, { stock: prod.stock + 50 })}
                      className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold"
                      title="Restock +50"
                    >
                      +50
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Warehouse: {prod.warehouseLocation.split(' ')[0]}</span>
                  <span>HSN: {prod.hsnCode}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CORPORATE & QUOTATIONS DESK */}
      {activeAdminTab === 'quotations' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-rose-800" />
                <span>Corporate Accounts, RFQs & Quotations Desk</span>
              </h2>
              <p className="text-xs text-slate-500">
                Review corporate onboarding applications, manage RFQ lifecycle, issue & revise quotations, and oversee multi-address orders.
              </p>
            </div>
            <button
              onClick={fetchCorporateAdminData}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Desk</span>
            </button>
          </div>

          {/* Sub Navigation */}
          <div className="flex flex-wrap gap-2 text-xs font-semibold border-b border-slate-100 pb-3">
            <button
              onClick={() => setCorporateSubTab('accounts')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                corporateSubTab === 'accounts'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Corporate Accounts ({corporateAccounts.length})
            </button>
            <button
              onClick={() => setCorporateSubTab('rfqs')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                corporateSubTab === 'rfqs'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Incoming RFQs ({corporateRFQs.length})
            </button>
            <button
              onClick={() => setCorporateSubTab('quotes')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                corporateSubTab === 'quotes'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Quotations & Revisions ({corporateQuotes.length})
            </button>
            <button
              onClick={() => setCorporateSubTab('orders')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                corporateSubTab === 'orders'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Multi-Address Order Groups ({corporateOrderGroups.length})
            </button>
            <button
              onClick={() => setCorporateSubTab('pricing')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                corporateSubTab === 'pricing'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Agreed Pricing ({corporatePricingAgreements.length})
            </button>
          </div>

          {isLoadingCorporate ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading corporate administration data...</span>
            </div>
          ) : (
            <>
              {/* SUBTAB 1: ACCOUNTS */}
              {corporateSubTab === 'accounts' && (
                <div className="space-y-4">
                  {corporateAccounts.map((acc) => (
                    <div key={acc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{acc.displayName || acc.legalName || acc.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            acc.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : acc.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-800'
                              : acc.status === 'SUSPENDED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {acc.status}
                          </span>
                        </div>
                        <div className="text-slate-500 mt-1">
                          Contact: {acc.contactPerson} ({acc.companyEmail || acc.businessEmail} | {acc.contactPhone || acc.phone}) • GSTIN: {acc.gstin || 'None'}
                        </div>
                        {acc.rejectionReason && (
                          <div className="text-rose-600 italic mt-0.5">
                            Rejection Reason: "{acc.rejectionReason}"
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {acc.status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => handleReviewCorporateAccount(acc.id, 'APPROVE')}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                const r = window.prompt('Enter rejection reason:');
                                if (r) handleReviewCorporateAccount(acc.id, 'REJECT', r);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1 shadow-xs"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {acc.status === 'APPROVED' && (
                          <button
                            onClick={() => handleReviewCorporateAccount(acc.id, 'SUSPEND')}
                            className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold"
                          >
                            Suspend
                          </button>
                        )}

                        {acc.status === 'SUSPENDED' && (
                          <button
                            onClick={() => handleReviewCorporateAccount(acc.id, 'REACTIVATE')}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {corporateAccounts.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic">No corporate accounts registered yet.</div>
                  )}
                </div>
              )}

              {/* SUBTAB 2: INCOMING RFQS */}
              {corporateSubTab === 'rfqs' && (
                <div className="space-y-4">
                  {corporateRFQs.map((rfq) => (
                    <div key={rfq.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{rfq.rfqNumber}</span>
                            <span className="font-bold text-slate-800">{rfq.title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                              {rfq.status}
                            </span>
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            Organization: <strong>{rfq.organization?.displayName || rfq.organization?.companyName || rfq.organizationId}</strong> • Locations: {rfq.numberOfLocations}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {rfq.status !== 'QUOTED' && rfq.status !== 'ACCEPTED' && (
                            <button
                              onClick={() => handleCreateQuotationFromRFQ(rfq)}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold flex items-center gap-1 shadow-xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Issue Quotation</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                        <div>
                          <span className="text-slate-400">Items: </span>
                          <span>{(rfq.items || []).map((i: any) => `${i.productName} (${i.requestedQuantity || i.quantity} pcs)`).join(', ')}</span>
                        </div>
                        {rfq.internalAdminNotes && (
                          <div className="italic text-slate-500">
                            <span className="text-slate-400 not-italic">Internal Staff Note: </span>
                            {rfq.internalAdminNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {corporateRFQs.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic">No incoming RFQs.</div>
                  )}
                </div>
              )}

              {/* SUBTAB 3: QUOTATIONS */}
              {corporateSubTab === 'quotes' && (
                <div className="space-y-4">
                  {corporateQuotes.map((q) => (
                    <div key={q.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{q.quoteNumber}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold font-mono text-[10px]">
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
                          <div className="text-slate-500 mt-0.5">
                            Organization: <strong>{q.organization?.displayName || q.organization?.companyName}</strong> • Valid Until: {new Date(q.validUntil).toLocaleDateString('en-IN')}
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="text-slate-500 text-[10px]">Commercial Value</div>
                            <div className="font-serif font-bold text-sm text-rose-950">
                              ₹{Number(q.grandTotalPaise / 100n || q.grandTotalPaise).toLocaleString('en-IN')}
                            </div>
                          </div>

                          {q.status === 'ISSUED' && (
                            <button
                              onClick={() => handleReviseQuotation(q)}
                              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-semibold"
                            >
                              Revise Quote
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-slate-600 text-[11px]">
                        Items: {(q.items || []).map((i: any) => `${i.productName} (${i.quantity} pcs @ ₹${i.unitPricePaise / 100})`).join('; ')}
                      </div>
                    </div>
                  ))}
                  {corporateQuotes.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic">No quotations issued yet.</div>
                  )}
                </div>
              )}

              {/* SUBTAB 4: MULTI-ADDRESS ORDER GROUPS */}
              {corporateSubTab === 'orders' && (
                <div className="space-y-4">
                  {corporateOrderGroups.map((grp) => (
                    <div key={grp.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{grp.groupOrderNumber}</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              {grp.paymentStatus}
                            </span>
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            Company: <strong>{grp.organization?.displayName || grp.organization?.companyName}</strong> • {grp.totalDestinations} Destinations • {grp.totalQuantity} Total Units
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-serif font-bold text-sm text-rose-950">
                            ₹{Number(grp.grandTotalPaise / 100n || grp.grandTotalPaise).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-slate-400">{grp.paymentMethod}</div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        {(grp.deliveryAllocations || []).slice(0, 3).map((a: any) => `${a.recipientName} (${a.city}, ${a.pincode}) - ${a.quantity} units`).join(' • ')}
                        {(grp.deliveryAllocations || []).length > 3 && ` • +${grp.deliveryAllocations.length - 3} more destinations`}
                      </div>
                    </div>
                  ))}
                  {corporateOrderGroups.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic">No corporate order groups created yet.</div>
                  )}
                </div>
              )}

              {/* SUBTAB 5: NEGOTIATED PRICING AGREEMENTS */}
              {corporateSubTab === 'pricing' && (
                <div className="space-y-4">
                  {corporatePricingAgreements.map((agr) => (
                    <div key={agr.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{agr.agreementName}</div>
                        <div className="text-slate-500 mt-0.5">
                          Product: {agr.product?.name || agr.productId} • Negotiated by: {agr.negotiatedBy}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          Effective: {new Date(agr.effectiveFrom).toLocaleDateString('en-IN')} to {new Date(agr.effectiveTo).toLocaleDateString('en-IN')}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-serif font-bold text-sm text-rose-950">
                          ₹{agr.unitPricePaise / 100} / unit
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ACTIVE
                        </span>
                      </div>
                    </div>
                  ))}
                  {corporatePricingAgreements.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic">No corporate price agreements configured.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 5: SUPPORT DESK */}
      {activeAdminTab === 'tickets' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="font-serif text-2xl font-bold text-slate-900">
              Customer Support & Concierge Tickets
            </h2>
            <p className="text-xs text-slate-500">
              Resolve personalization adjustments, order status queries, and delivery instructions.
            </p>
          </div>

          <div className="space-y-4">
            {tickets.map(t => (
              <div key={t.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-rose-700">{t.ticketNumber}</span>
                    <span className="text-xs font-bold text-slate-800">{t.subject}</span>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase">{t.status}</span>
                </div>

                <div className="space-y-2 text-xs">
                  {t.messages.map((m, idx) => (
                    <div key={idx} className={`p-2.5 rounded-xl ${m.sender === 'agent' ? 'bg-rose-50 text-rose-950 ml-6' : 'bg-slate-50 text-slate-800 mr-6'}`}>
                      <div className="font-bold text-[10px] uppercase text-slate-400 mb-0.5">
                        {m.sender === 'agent' ? `${BUSINESS_CONFIG.brandName} Support Desk` : t.customerName} • {m.time}
                      </div>
                      <div>{m.text}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="Type official reply to customer..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        addTicketReply(t.id, e.currentTarget.value.trim(), 'agent');
                        e.currentTarget.value = '';
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousSibling as HTMLInputElement);
                      if (input && input.value.trim()) {
                        addTicketReply(t.id, input.value.trim(), 'agent');
                        input.value = '';
                      }
                    }}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                  >
                    Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SELLER & GST CONFIGURATION */}
      {activeAdminTab === 'seller-config' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-rose-800" />
                <span>Legal Seller & Tax Invoice Settings</span>
              </h2>
              <p className="text-xs text-slate-500">
                Manage registered business entity, GSTIN, supplier state code, and invoice series prefix.
              </p>
            </div>
            {sellerConfig?.updatedAt && (
              <span className="text-[11px] text-slate-400">
                Last updated: {new Date(sellerConfig.updatedAt).toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Verification Status Banner */}
          {sellerForm.isVerified ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong className="block font-bold">Verified Legal Business Information</strong>
                <span>Tax invoices will be issued as official legal tax documents without sample watermarks.</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong className="block font-bold">Non-Production / Unverified Sample Mode</strong>
                <span>Legal details have not been verified by the business owner/accountant. Generated invoices will carry a prominent <em>SAMPLE / NOT A TAX INVOICE</em> watermark.</span>
              </div>
            </div>
          )}

          {isLoadingSeller ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading seller configuration...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveSellerConfig} className="space-y-5 text-xs max-w-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Legal Business Name *</label>
                  <input
                    type="text"
                    required
                    value={sellerForm.legalName}
                    onChange={(e) => setSellerForm({ ...sellerForm, legalName: e.target.value })}
                    placeholder="e.g. Snappy Gifts Private Limited"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trade / Brand Name</label>
                  <input
                    type="text"
                    value={sellerForm.tradeName}
                    onChange={(e) => setSellerForm({ ...sellerForm, tradeName: e.target.value })}
                    placeholder="e.g. Snappy Gifts"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">GSTIN (15 characters) *</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={sellerForm.gstin}
                    onChange={(e) => setSellerForm({ ...sellerForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="e.g. 08AABCS1429B1Z1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Permanent Account Number (PAN)</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={sellerForm.pan}
                    onChange={(e) => setSellerForm({ ...sellerForm, pan: e.target.value.toUpperCase() })}
                    placeholder="e.g. AABCS1429B"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Registered Street Address *</label>
                  <input
                    type="text"
                    required
                    value={sellerForm.registeredStreet}
                    onChange={(e) => setSellerForm({ ...sellerForm, registeredStreet: e.target.value })}
                    placeholder="e.g. 42 Heritage Boulevard, Vaishali Nagar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={sellerForm.city}
                    onChange={(e) => setSellerForm({ ...sellerForm, city: e.target.value })}
                    placeholder="e.g. Jaipur"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">PIN Code (6 digits) *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={sellerForm.pincode}
                    onChange={(e) => setSellerForm({ ...sellerForm, pincode: e.target.value })}
                    placeholder="e.g. 302021"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">State & State Code *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={sellerForm.state}
                      onChange={(e) => setSellerForm({ ...sellerForm, state: e.target.value })}
                      className="w-2/3 px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={sellerForm.stateCode}
                      onChange={(e) => setSellerForm({ ...sellerForm, stateCode: e.target.value })}
                      placeholder="08"
                      className="w-1/3 px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Invoice Series Prefix *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={sellerForm.invoicePrefix}
                    onChange={(e) => setSellerForm({ ...sellerForm, invoicePrefix: e.target.value.toUpperCase() })}
                    placeholder="SG"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Used for GST format: [PREFIX]/[FY]/[SEQ] (Max 16 chars)</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tax & Billing Email *</label>
                  <input
                    type="email"
                    required
                    value={sellerForm.contactEmail}
                    onChange={(e) => setSellerForm({ ...sellerForm, contactEmail: e.target.value })}
                    placeholder="tax@snappygifts.in"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Support Phone *</label>
                  <input
                    type="text"
                    required
                    value={sellerForm.contactPhone}
                    onChange={(e) => setSellerForm({ ...sellerForm, contactPhone: e.target.value })}
                    placeholder="+91 141 234 5678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Authorized Signatory Name & Designation</label>
                  <input
                    type="text"
                    value={sellerForm.authorizedSignatoryName}
                    onChange={(e) => setSellerForm({ ...sellerForm, authorizedSignatoryName: e.target.value })}
                    placeholder="e.g. Ramesh Sharma, Head of Finance & Taxation"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isVerifiedCheckbox"
                    checked={sellerForm.isVerified}
                    onChange={(e) => setSellerForm({ ...sellerForm, isVerified: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="isVerifiedCheckbox" className="font-semibold text-slate-800 cursor-pointer">
                    I confirm that the registered entity name and GSTIN have been validated by the store owner or qualified accountant.
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={sellerSaveLoading}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {sellerSaveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 7: TRANSACTIONAL EMAIL OUTBOX */}
      {activeAdminTab === 'email-outbox' && (
        <div className="p-6 rounded-3xl bg-white border border-rose-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-6 h-6 text-blue-600" />
                <span>Transactional Email Outbox & Audit</span>
              </h2>
              <p className="text-xs text-slate-500">
                Track persistent outbox records for order confirmations, invoice notices, and shipment dispatch alerts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchOutboxMessages}
                disabled={isLoadingOutbox}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOutbox ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleProcessOutbox}
                disabled={isProcessingOutbox}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {isProcessingOutbox ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Process Outbox Worker</span>
              </button>
            </div>
          </div>

          {isLoadingOutbox ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Fetching email outbox messages...</span>
            </div>
          ) : outboxMessages.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Send className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-600 text-xs">No email outbox records currently queued.</p>
              <p className="text-[11px] text-slate-400 mt-1">Transactional emails will appear here when orders are confirmed, dispatched, or invoiced.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Event Type</th>
                    <th className="p-3">Order Ref</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Attempts</th>
                    <th className="p-3">Queued / Sent At</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outboxMessages.map((msg) => (
                    <tr key={msg.id} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {msg.eventType}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-900">
                        {msg.orderNumber || '—'}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{msg.recipientEmail}</div>
                        {msg.recipientName && <div className="text-[10px] text-slate-400">{msg.recipientName}</div>}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={msg.subject}>
                        {msg.subject}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          msg.status === 'SENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : msg.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : msg.status === 'PROCESSING'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {msg.status}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">
                        {msg.attempts} / {msg.maxAttempts}
                      </td>
                      <td className="p-3 text-[11px] text-slate-500">
                        {msg.sentAt
                          ? `Sent: ${new Date(msg.sentAt).toLocaleString('en-IN')}`
                          : `Queued: ${new Date(msg.createdAt).toLocaleString('en-IN')}`}
                        {msg.lastError && (
                          <div className="text-rose-600 text-[10px] truncate max-w-xs" title={msg.lastError}>
                            Err: {msg.lastError}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {msg.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetryEmail(msg.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-[11px] border border-rose-200"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CUSTOMER AND STAFF MANAGEMENT */}
      {activeAdminTab === 'users' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-cyan-600" />
                <span>Customer & Staff Management</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Authorized administration of customer profiles, corporate accounts, and staff roles with RBAC enforcement
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search name, email, phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs w-52 sm:w-64 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
              >
                <option value="">All Roles</option>
                <option value="CUSTOMER">Customer</option>
                <option value="B2B_CLIENT">B2B Client</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          {isLoadingUsers ? (
            <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
              <span>Loading customer and staff accounts...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">User / Identity</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Orders</th>
                    <th className="p-3">Registered</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.length > 0 ? (
                    usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{u.name || 'Unnamed User'}</div>
                          <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                          {u.corporateMembership && (
                            <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                              🏢 {u.corporateMembership.organizationName} ({u.corporateMembership.role})
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              u.role === 'ADMIN'
                                ? 'bg-rose-100 text-rose-800'
                                : u.role === 'STAFF'
                                ? 'bg-purple-100 text-purple-800'
                                : u.role === 'B2B_CLIENT'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-[11px]">
                          {u.phone || '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              u.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {u.orderCount}
                        </td>
                        <td className="p-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedUserDetail(u)}
                              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-[11px]"
                              title="Inspect User Details"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => {
                                setEditingUserRole({ id: u.id, name: u.name || u.email, currentRole: u.role });
                                setNewUserRole(u.role);
                              }}
                              className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] border border-indigo-200"
                            >
                              Role
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-2 py-1 rounded-lg font-semibold text-[11px] border ${
                                u.isActive
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                        No customer or staff records found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {usersPagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
              <div>
                Showing page {usersPagination.page} of {usersPagination.totalPages} ({usersPagination.total} total)
              </div>
              <div className="flex gap-1">
                <button
                  disabled={usersPagination.page <= 1}
                  onClick={() => fetchUsers(usersPagination.page - 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={usersPagination.page >= usersPagination.totalPages}
                  onClick={() => fetchUsers(usersPagination.page + 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: BUSINESS REPORTS AND ANALYTICS */}
      {activeAdminTab === 'reports' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                <span>Business Reports & CSV Exports</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Database-aggregated sales, order operations, inventory valuation, and GST tax invoice summaries
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <label>From:</label>
                <input
                  type="date"
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <label>To:</label>
                <input
                  type="date"
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <button
                onClick={() => fetchReports()}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Apply Filter
              </button>

              <button
                onClick={() => handleDownloadReportCsv(reportsSubTab)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export {reportsSubTab.toUpperCase()} CSV</span>
              </button>
            </div>
          </div>

          {/* Subtabs */}
          <div className="flex gap-2 border-b border-slate-100 pb-2">
            {[
              { id: 'sales', label: 'Sales & Revenue' },
              { id: 'orders', label: 'Order Fulfillment' },
              { id: 'inventory', label: 'Inventory & Stock' },
              { id: 'taxes', label: 'GST & Invoices' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setReportsSubTab(st.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  reportsSubTab === st.id
                    ? 'bg-emerald-100 text-emerald-900 font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {isLoadingReport ? (
            <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Generating report aggregation from database...</span>
            </div>
          ) : reportsSubTab === 'sales' && salesReportData ? (
            <div className="space-y-6">
              {/* Sales Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-xs text-slate-500 font-semibold">Captured Revenue</div>
                  <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
                    {salesReportData.summary.capturedRevenueFormatted}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Exclusively captured payments</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-semibold">Captured Orders</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {salesReportData.summary.capturedOrdersCount}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Total orders: {salesReportData.summary.totalOrdersCount}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-semibold">Average Order Value</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {salesReportData.summary.aovFormatted}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Based on captured orders</div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
                  <div className="text-xs text-slate-500 font-semibold">Pending/Authorized</div>
                  <div className="text-xl font-bold font-mono text-amber-800 mt-1">
                    {salesReportData.summary.pendingRevenueFormatted}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Unsettled orders: {salesReportData.summary.pendingOrdersCount}</div>
                </div>
              </div>

              {/* Product Breakdown Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Top Product Performance
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Product Name</th>
                        <th className="p-2.5 text-center">SKU</th>
                        <th className="p-2.5 text-center">Units Sold</th>
                        <th className="p-2.5 text-right">Captured Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {salesReportData.byProduct && salesReportData.byProduct.length > 0 ? (
                        salesReportData.byProduct.map((p: any) => (
                          <tr key={p.productId}>
                            <td className="p-2.5 font-semibold text-slate-900">{p.productName}</td>
                            <td className="p-2.5 text-center font-mono text-[11px] text-slate-500">{p.sku || '—'}</td>
                            <td className="p-2.5 text-center font-bold text-slate-800">{p.unitsSold}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{p.revenueFormatted}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400 italic">No sales recorded in selected window.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : reportsSubTab === 'orders' && ordersReportData ? (
            <div className="space-y-6">
              {/* Order Status Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {Object.entries(ordersReportData.statusBreakdown || {}).map(([st, count]: any) => (
                  <div key={st} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <div className="text-[11px] font-bold text-slate-600 uppercase">{st}</div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">{count}</div>
                  </div>
                ))}
              </div>

              {/* State-wise Delivery Breakdown */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Orders by Delivery State (India)
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">State</th>
                        <th className="p-2.5 text-center">Order Count</th>
                        <th className="p-2.5 text-right">Captured Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ordersReportData.byState && ordersReportData.byState.length > 0 ? (
                        ordersReportData.byState.map((s: any) => (
                          <tr key={s.state}>
                            <td className="p-2.5 font-semibold text-slate-900">{s.state}</td>
                            <td className="p-2.5 text-center font-bold text-slate-800">{s.count}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{s.revenueFormatted}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-slate-400 italic">No location records available.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : reportsSubTab === 'inventory' && inventoryReportData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-semibold">Total Stock Units</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {inventoryReportData.summary.totalStockUnits}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-xs text-slate-500 font-semibold">Stock Valuation</div>
                  <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
                    {inventoryReportData.summary.totalStockValueFormatted}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
                  <div className="text-xs text-slate-500 font-semibold">Low Stock SKUs (&lt;100)</div>
                  <div className="text-xl font-bold font-mono text-amber-800 mt-1">
                    {inventoryReportData.summary.lowStockCount}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
                  <div className="text-xs text-slate-500 font-semibold">Out of Stock SKUs</div>
                  <div className="text-xl font-bold font-mono text-rose-800 mt-1">
                    {inventoryReportData.summary.outOfStockCount}
                  </div>
                </div>
              </div>

              {/* Low Stock Warning List */}
              {inventoryReportData.lowStockItems && inventoryReportData.lowStockItems.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Low Stock SKU Priority Replenishment</span>
                  </h3>
                  <div className="overflow-x-auto border border-rose-100 rounded-2xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-rose-50/60 text-rose-900 font-bold border-b border-rose-200">
                        <tr>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5 text-center">SKU</th>
                          <th className="p-2.5 text-center">Stock Left</th>
                          <th className="p-2.5">Warehouse Location</th>
                          <th className="p-2.5 text-right">Base Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {inventoryReportData.lowStockItems.map((item: any) => (
                          <tr key={item.id} className="hover:bg-rose-50/30">
                            <td className="p-2.5 font-bold text-slate-900">{item.name}</td>
                            <td className="p-2.5 text-center font-mono text-[11px] text-slate-600">{item.sku}</td>
                            <td className="p-2.5 text-center font-bold text-rose-700 font-mono">{item.stock}</td>
                            <td className="p-2.5 text-slate-600">{item.warehouseLocation}</td>
                            <td className="p-2.5 text-right font-mono text-slate-900">₹{item.basePrice}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : reportsSubTab === 'taxes' && taxReportData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-semibold">Total Issued Invoices</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {taxReportData.summary.invoiceCount}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                  <div className="text-xs text-slate-500 font-semibold">Total Taxable Value</div>
                  <div className="text-xl font-bold font-mono text-blue-900 mt-1">
                    {taxReportData.summary.taxableTotalFormatted}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-xs text-slate-500 font-semibold">Total GST (CGST+SGST+IGST)</div>
                  <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
                    {taxReportData.summary.taxTotalFormatted}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
                  <div className="text-xs text-slate-500 font-semibold">Pending Physical Signatures</div>
                  <div className="text-xl font-bold font-mono text-amber-900 mt-1">
                    {taxReportData.summary.pendingPhysicalSignatureCount}
                  </div>
                </div>
              </div>

              {/* Tax Invoice Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5">Order #</th>
                      <th className="p-2.5">Customer / GSTIN</th>
                      <th className="p-2.5 text-right">Taxable</th>
                      <th className="p-2.5 text-right">GST</th>
                      <th className="p-2.5 text-right">Grand Total</th>
                      <th className="p-2.5 text-center">Signed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {taxReportData.invoices && taxReportData.invoices.length > 0 ? (
                      taxReportData.invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                          <td className="p-2.5 font-mono text-slate-600">{inv.orderNumber}</td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900">{inv.customerName}</div>
                            {inv.customerGstin && <div className="text-[10px] font-mono text-slate-500">{inv.customerGstin}</div>}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-700">₹{(inv.taxablePaise / 100).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono text-slate-700">₹{(inv.taxTotalPaise / 100).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-800">₹{(inv.grandTotalPaise / 100).toFixed(2)}</td>
                          <td className="p-2.5 text-center">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${inv.isPhysicallySigned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {inv.isPhysicallySigned ? 'Signed' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400 italic">No invoices recorded in window.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 italic text-xs">
              Select a report subtab to inspect operational aggregations.
            </div>
          )}
        </div>
      )}

      {/* TAB 7: COMPLETE BUSINESS SETTINGS */}
      {activeAdminTab === 'settings' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-violet-600" />
                <span>Business & Storefront Settings</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Centralized operational preferences, shipping thresholds, inventory alert parameters, and personalization controls
              </p>
            </div>

            <div className="text-xs text-slate-400">
              Last saved: {storeConfig?.updatedAt ? new Date(storeConfig.updatedAt).toLocaleString('en-IN') : 'Default setup'}
            </div>
          </div>

          <form onSubmit={handleSaveStoreConfig} className="space-y-6 text-xs">
            {/* General Settings */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wide flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <span>Store Identity & Contact</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Store Brand Name</label>
                  <input
                    type="text"
                    required
                    value={storeConfigForm.storeName}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, storeName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Support Email</label>
                  <input
                    type="email"
                    required
                    value={storeConfigForm.supportEmail}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, supportEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Support Phone</label>
                  <input
                    type="text"
                    required
                    value={storeConfigForm.supportPhone}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, supportPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Operating Hours</label>
                  <input
                    type="text"
                    required
                    value={storeConfigForm.operatingHours}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, operatingHours: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Central Warehouse / HQ Address</label>
                  <input
                    type="text"
                    required
                    value={storeConfigForm.headquartersAddress}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, headquartersAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Shipping & Delivery Settings */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wide flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Shipping Charges & Logistics Configuration</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Standard Shipping Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={storeConfigForm.standardShippingFeeRupees}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, standardShippingFeeRupees: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Stored as {Math.round(storeConfigForm.standardShippingFeeRupees * 100)} paise</span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Free Shipping Threshold (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={storeConfigForm.freeShippingThresholdRupees}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, freeShippingThresholdRupees: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Orders above this get free shipping</span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Express Air Shipping Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={storeConfigForm.expressShippingFeeRupees}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, expressShippingFeeRupees: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">Shipping & Packaging Instructions</label>
                  <textarea
                    rows={2}
                    value={storeConfigForm.shippingInstructions}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, shippingInstructions: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Inventory Controls */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wide flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-amber-600" />
                <span>Inventory & Low-Stock Alerts</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Low-Stock Alert Threshold (units)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={storeConfigForm.lowStockThreshold}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, lowStockThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Out-of-Stock Lock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={storeConfigForm.outOfStockThreshold}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, outOfStockThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeConfigForm.autoNotifyLowStock}
                      onChange={(e) => setStoreConfigForm({ ...storeConfigForm, autoNotifyLowStock: e.target.checked })}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="font-bold text-slate-700">Display persistent operational warnings when stock falls below reorder threshold</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Personalization Settings */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Personalization & Manufacturing Gates</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Wooden Crate Surcharge (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={storeConfigForm.woodenCrateSurchargeRupees}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, woodenCrateSurchargeRupees: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Server gate: requires ADMIN role to alter</span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Artwork Upload Limit (Bytes)</label>
                  <input
                    type="number"
                    min="1048576"
                    required
                    value={storeConfigForm.maxArtworkUploadBytes}
                    onChange={(e) => setStoreConfigForm({ ...storeConfigForm, maxArtworkUploadBytes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">{(storeConfigForm.maxArtworkUploadBytes / (1024 * 1024)).toFixed(1)} MB maximum upload size</span>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeConfigForm.allowCustomText}
                      onChange={(e) => setStoreConfigForm({ ...storeConfigForm, allowCustomText: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-semibold text-slate-700">Allow customers to submit custom engraved names / messages</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeConfigForm.allowArtworkUpload}
                      onChange={(e) => setStoreConfigForm({ ...storeConfigForm, allowArtworkUpload: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="font-semibold text-slate-700">Allow corporate and retail users to upload high-resolution logo artwork</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-6 py-2.5 rounded-xl bg-violet-700 text-white font-semibold hover:bg-violet-800 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-violet-200"
              >
                {isSavingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Business Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 8: AUDIT TRAIL LOGS */}
      {activeAdminTab === 'audit' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-teal-600" />
                <span>Administrative Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Immutable record of administrative actions, role elevations, configuration updates, and fulfillment events
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="">All Actions</option>
                <option value="USER_ROLE_UPDATE">Role Elevation / Changes</option>
                <option value="USER_STATUS_UPDATE">Account Activation / Revocation</option>
                <option value="STORE_CONFIG_UPDATE">Store Configuration Saved</option>
                <option value="SELLER_CONFIG_UPDATE">GST / Seller Settings</option>
                <option value="ORDER_DISPATCH">Courier Dispatches</option>
                <option value="INVOICE_GENERATED">Invoice Generations</option>
                <option value="QUOTE_ISSUED">Corporate Quotes Issued</option>
              </select>
            </div>
          </div>

          {isLoadingAudit ? (
            <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
              <span>Fetching audit records...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Timestamp (IST)</th>
                    <th className="p-3">Actor / Admin</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity Type</th>
                    <th className="p-3">Entity ID</th>
                    <th className="p-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 font-mono text-[11px]">{log.actorEmail}</div>
                          <div className="text-[10px] text-slate-400">ID: {log.actorId.slice(0, 8)}...</div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          {log.entityType}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {log.entityId}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedAuditPayload(log.payload)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        No audit trail entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Audit Pagination */}
          {auditPagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
              <div>
                Page {auditPagination.page} of {auditPagination.totalPages} ({auditPagination.total} audit events)
              </div>
              <div className="flex gap-1">
                <button
                  disabled={auditPagination.page <= 1}
                  onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={auditPagination.page >= auditPagination.totalPages}
                  onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: SYSTEM OPERATIONS & HEALTH OVERVIEW */}
      {activeAdminTab === 'operations' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-6 h-6 text-rose-600" />
                <span>System Operations & Platform Health</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Read-only operational diagnostics, adapter connectivity, background schedulers, and environment security status
              </p>
            </div>

            <button
              onClick={() => fetchSystemHealth()}
              disabled={isLoadingHealth}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {isLoadingHealth && !systemHealth ? (
            <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-rose-600" />
              <span>Checking platform services and adapters...</span>
            </div>
          ) : systemHealth ? (
            <div className="space-y-6 text-xs">
              {/* Primary Diagnostic Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Database Connectivity */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-blue-600" />
                      <span>PostgreSQL DB</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        systemHealth.database.connected
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {systemHealth.database.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Engine: <strong className="text-slate-800">{systemHealth.database.engine}</strong>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Latency: {systemHealth.database.latencyMs}ms • {systemHealth.database.message}
                  </div>
                </div>

                {/* Email Service */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-indigo-600" />
                      <span>Email Delivery</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        systemHealth.email.configured
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {systemHealth.email.adapter}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Outbox Queue: <strong className="text-slate-800">{systemHealth.email.pendingOutboxCount} pending</strong>
                  </div>
                  <div className="text-[10px] text-rose-600 font-semibold">
                    Failed deliveries: {systemHealth.email.failedOutboxCount}
                  </div>
                </div>

                {/* Storage Adapter */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-emerald-600" />
                      <span>Artwork Storage</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 uppercase">
                      {systemHealth.storage.adapter}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Status: <strong className="text-emerald-700">{systemHealth.storage.status}</strong>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Upload Limit: {(systemHealth.storage.maxUploadBytes / (1024 * 1024)).toFixed(0)} MB
                  </div>
                </div>

                {/* Application Build Info */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-purple-600" />
                      <span>App Version</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      v{systemHealth.app.version}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Node: <strong className="text-slate-800">{systemHealth.app.nodeVersion}</strong>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    TZ: {systemHealth.app.timezone} • {systemHealth.app.environment}
                  </div>
                </div>

              </div>

              {/* Security Environment Variables Status (Names Only, Values Masked) */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wide flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-700" />
                  <span>Production Environment Variables Checklist (Values Strictly Masked)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {systemHealth.environmentSecurity?.variables?.map((v: any) => (
                    <div
                      key={v.name}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between"
                    >
                      <span className="font-mono text-[10.5px] font-semibold text-slate-700 truncate" title={v.name}>
                        {v.name}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ml-1 ${
                          v.configured
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {v.configured ? 'SET' : 'MISSING'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-slate-400 italic">
                  Note: Sensitive secret values and raw credentials are never stored or transmitted to the client.
                </div>
              </div>

              {/* Background Workers and Schedulers */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wide flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-700" />
                  <span>Background Schedulers & Maintenance Workers</span>
                </h3>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">Transactional Email Outbox Worker</div>
                      <div className="text-[11px] text-slate-500">Processes queued order confirmations, quotations, and dispatch notifications</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase">
                      {systemHealth.scheduler.outboxWorker}
                    </span>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">Orphaned Artwork Cleanup Job</div>
                      <div className="text-[11px] text-slate-500">Purges temporary personalization uploads exceeding 48-hour unconfirmed retention</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 uppercase">
                      {systemHealth.scheduler.artworkCleanup}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-xl text-slate-900">Add New Product to Catalog</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. Royal Rajputana Scented Candle Crate"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="Personalized Gifts">Personalized Gifts</option>
                    <option value="Home Decor">Home Decor</option>
                    <option value="Soft Toys">Soft Toys</option>
                    <option value="Luxury Gifts">Luxury Gifts</option>
                    <option value="Gift Hampers">Gift Hampers</option>
                    <option value="Corporate Kits">Corporate Kits</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Units</label>
                  <input
                    type="number"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={newProdBasePrice}
                    onChange={(e) => setNewProdBasePrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={newProdMrp}
                    onChange={(e) => setNewProdMrp(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Warehouse Hub</label>
                <select
                  value={newProdWarehouse}
                  onChange={(e) => setNewProdWarehouse(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="Hyderabad Central Warehouse">Hyderabad Central Warehouse (Telangana)</option>
                  <option value="Jaipur Logistics Hub">Jaipur Logistics Hub</option>
                  <option value="Delhi Hub & Fulfillment Center">Delhi Hub & Fulfillment Center</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={newProdImage}
                  onChange={(e) => setNewProdImage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-700 text-white font-semibold hover:bg-rose-800"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch 6: Order Details & Audit History Modal */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-serif font-bold text-xl text-slate-900">
                    Order {selectedOrderDetails.orderNumber}
                  </h3>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                    selectedOrderDetails.orderStatus === 'DELIVERED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedOrderDetails.orderStatus === 'DISPATCHED'
                      ? 'bg-blue-100 text-blue-800'
                      : selectedOrderDetails.orderStatus === 'CANCELLED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedOrderDetails.orderStatus?.replace('_', ' ')}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                    selectedOrderDetails.paymentStatus === 'CAPTURED' || selectedOrderDetails.paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    Payment: {selectedOrderDetails.paymentStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Placed on {new Date(selectedOrderDetails.createdAt).toLocaleString('en-IN')} • Gateway: {selectedOrderDetails.paymentMethod}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Address Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wide mb-2">Customer & Tax Identity</h4>
                <div className="text-slate-800 font-semibold">{selectedOrderDetails.customerName}</div>
                <div className="text-slate-600">{selectedOrderDetails.customerEmail}</div>
                <div className="text-slate-600">Phone: {selectedOrderDetails.customerPhone}</div>
                {selectedOrderDetails.gstin && (
                  <div className="text-slate-600 font-mono text-[11px] pt-1">
                    GSTIN: <strong>{selectedOrderDetails.gstin}</strong>
                  </div>
                )}
                <div className="text-slate-500 text-[11px] pt-1">
                  Destination State Code: <strong>{selectedOrderDetails.destinationStateCode}</strong>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wide mb-2">Delivery Address</h4>
                {selectedOrderDetails.shippingAddress ? (
                  <>
                    <div className="text-slate-800">{selectedOrderDetails.shippingAddress.street || selectedOrderDetails.shippingAddress.addressLine1}</div>
                    <div className="text-slate-600">
                      {[selectedOrderDetails.shippingAddress.city, selectedOrderDetails.shippingAddress.state, selectedOrderDetails.shippingAddress.pincode || selectedOrderDetails.shippingAddress.postalCode].filter(Boolean).join(', ')}
                    </div>
                    <div className="text-slate-500 text-[11px]">{selectedOrderDetails.shippingAddress.country || 'India'}</div>
                  </>
                ) : (
                  <div className="text-slate-400 italic">No shipping address recorded.</div>
                )}
              </div>
            </div>

            {/* Line Items Snapshot */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wide">
                Items Snapshot & Customization
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Product / SKU</th>
                      <th className="p-3">HSN</th>
                      <th className="p-3 text-center">Tax %</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrderDetails.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{item.productName}</div>
                          <div className="font-mono text-[10px] text-slate-400">SKU: {item.sku}</div>
                          {item.customizationNote && (
                            <div className="text-[11px] text-rose-800 bg-rose-50 p-1.5 rounded-lg mt-1 border border-rose-100">
                              <strong>Customization:</strong> {item.customizationNote}
                            </div>
                          )}

                          {/* Batch 7: Detailed Personalization Snapshot & Proof Review */}
                          {(item.personalization || item.customizationMeta) && (
                            <div className="mt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[10.5px] space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1">
                                  <span>✦ Bespoke Specs</span>
                                  <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono">
                                    {(item.personalization?.personalizationType || item.customizationMeta?.personalizationType || 'TEXT_ENGRAVING').replace('_', ' ')}
                                  </span>
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                                  (item.personalization?.approvalStatus || 'APPROVED_BY_CUSTOMER') === 'ARTWORK_VERIFIED_BY_STAFF'
                                    ? 'bg-blue-100 text-blue-800'
                                    : (item.personalization?.approvalStatus || 'APPROVED_BY_CUSTOMER') === 'APPROVED_BY_CUSTOMER'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {(item.personalization?.approvalStatus || 'APPROVED_BY_CUSTOMER').replace('_', ' ')}
                                </span>
                              </div>

                              {(item.personalization?.engravedText || item.customizationMeta?.engravedText) && (
                                <div className="text-slate-800">
                                  <strong>Inscription:</strong> "{item.personalization?.engravedText || item.customizationMeta?.engravedText}"
                                  <span className="text-slate-500 font-sans ml-1">
                                    ({item.personalization?.fontFamily || item.customizationMeta?.fontFamily || 'Calligraphy Romance'})
                                  </span>
                                </div>
                              )}

                              {(item.personalization?.giftNote || item.customizationMeta?.giftNote) && (
                                <div className="text-slate-700 italic">
                                  <strong>Card Note:</strong> "{item.personalization?.giftNote || item.customizationMeta?.giftNote}"
                                </div>
                              )}

                              <div className="text-slate-600 text-[10px] flex flex-wrap gap-2 pt-0.5 border-t border-amber-200/60">
                                {(item.personalization?.ribbonColor || item.customizationMeta?.ribbonColor) && (
                                  <span>Ribbon: <strong>{item.personalization?.ribbonColor || item.customizationMeta?.ribbonColor}</strong></span>
                                )}
                                {(item.personalization?.boxWrapStyle || item.customizationMeta?.boxWrapStyle) && (
                                  <span>Box: <strong>{item.personalization?.boxWrapStyle || item.customizationMeta?.boxWrapStyle}</strong></span>
                                )}
                              </div>

                              {/* Artwork Proof Asset Link */}
                              {(item.proofImageUrl || item.personalization?.proofImageUrl || item.personalization?.artworkUploadId) && (
                                <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between">
                                  <a
                                    href={item.proofImageUrl || item.personalization?.proofImageUrl || `/api/personalization/uploads/${item.personalization?.artworkUploadId}/file`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#A21D32] hover:underline font-bold text-[10.5px]"
                                  >
                                    <span>Inspect Customer Artwork File</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>

                                  {/* Staff Artwork Approval Action */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleReviewProof(item.id, 'ARTWORK_VERIFIED_BY_STAFF')}
                                      className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[9.5px]"
                                      title="Mark artwork proof verified for crafting"
                                    >
                                      Verify Artwork
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReviewProof(item.id, 'REJECTED_FOR_REWORK')}
                                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[9.5px]"
                                      title="Reject and request artwork rework"
                                    >
                                      Rework
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">{item.hsnCode || '—'}</td>
                        <td className="p-3 text-center font-mono text-[11px]">{item.taxRatePercent != null ? `${item.taxRatePercent}%` : '18%'}</td>
                        <td className="p-3 text-center font-bold">{item.quantity}</td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          ₹{((item.unitPricePaise ? item.unitPricePaise / 100 : item.unitPrice) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          ₹{((item.subtotalPaise ? item.subtotalPaise / 100 : item.subtotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-1.5 text-xs">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wide mb-2">GST Financial Breakdown</h4>
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono">₹{((selectedOrderDetails.itemsSubtotalPaise ? selectedOrderDetails.itemsSubtotalPaise / 100 : selectedOrderDetails.subtotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {selectedOrderDetails.customizationTotalPaise > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Customization Charges:</span>
                  <span className="font-mono">₹{(selectedOrderDetails.customizationTotalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {selectedOrderDetails.discountTotalPaise > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount Applied:</span>
                  <span className="font-mono">-₹{(selectedOrderDetails.discountTotalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping Charges:</span>
                <span className="font-mono">₹{((selectedOrderDetails.shippingTotalPaise ? selectedOrderDetails.shippingTotalPaise / 100 : selectedOrderDetails.shippingTotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total GST (CGST+SGST / IGST):</span>
                <span className="font-mono">₹{((selectedOrderDetails.taxTotalPaise ? selectedOrderDetails.taxTotalPaise / 100 : selectedOrderDetails.taxTotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-rose-200">
                <span>Grand Total (Paise reconciled):</span>
                <span className="font-mono text-rose-950 font-bold">
                  ₹{((selectedOrderDetails.grandTotalPaise ? selectedOrderDetails.grandTotalPaise / 100 : selectedOrderDetails.grandTotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Batch 8: GST Tax Invoices & Fulfillment Documents */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wide flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-400" />
                    <span>GST Invoices & Fulfillment Documents</span>
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Official tax invoices and privacy-compliant packing slips (zero price/tax disclosure)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => handleDownloadInvoice(selectedOrderDetails.orderNumber)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>Download Tax Invoice (PDF)</span>
                </button>

                <button
                  onClick={() => handleDownloadPackingSlip(selectedOrderDetails.id, selectedOrderDetails.orderNumber)}
                  className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Download Packing Slip (PDF)</span>
                </button>

                <button
                  onClick={() => handleReissueInvoice(selectedOrderDetails.orderNumber)}
                  disabled={isIssuingInvoice}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isIssuingInvoice ? 'animate-spin' : ''}`} />
                  <span>Reissue / Refresh Invoice</span>
                </button>
              </div>
            </div>

            {/* Shipment History */}
            {selectedOrderDetails.shipments && selectedOrderDetails.shipments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wide">Shipment Records</h4>
                <div className="space-y-2">
                  {selectedOrderDetails.shipments.map((shipment: any) => (
                    <div key={shipment.id || shipment.awbNumber} className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-700" />
                          <span>{shipment.carrierPartner}</span>
                          <span className="font-mono text-slate-700">AWB: {shipment.awbNumber}</span>
                          <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded uppercase">
                            {shipment.dispatchStatus}
                          </span>
                        </div>
                        {shipment.dispatchedAt && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Dispatched: {new Date(shipment.dispatchedAt).toLocaleString('en-IN')}
                            {shipment.deliveredAt && ` • Delivered: ${new Date(shipment.deliveredAt).toLocaleString('en-IN')}`}
                          </div>
                        )}
                      </div>
                      {shipment.trackingUrl && (
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 self-start md:self-center"
                        >
                          <span>Track with Carrier</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Records */}
            {selectedOrderDetails.payments && selectedOrderDetails.payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wide">Payment Records</h4>
                <div className="space-y-2">
                  {selectedOrderDetails.payments.map((p: any) => (
                    <div key={p.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{p.gateway} — <span className="font-mono">{p.gatewayOrderId || p.id}</span></div>
                        {p.gatewayPaymentId && <div className="text-[11px] font-mono text-slate-500">Payment ID: {p.gatewayPaymentId}</div>}
                        {p.capturedAt && <div className="text-[11px] text-slate-500">Captured At: {new Date(p.capturedAt).toLocaleString('en-IN')}</div>}
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.status === 'CAPTURED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {p.status}
                        </span>
                        <div className="font-mono font-bold text-slate-900 mt-1">₹{(p.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Status Audit Trail */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wide">
                Order Status Audit Trail
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">From</th>
                      <th className="p-2.5">To</th>
                      <th className="p-2.5">Changed By</th>
                      <th className="p-2.5">Notes</th>
                      <th className="p-2.5 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrderDetails.statusHistory && selectedOrderDetails.statusHistory.length > 0 ? (
                      selectedOrderDetails.statusHistory.map((hist: any) => (
                        <tr key={hist.id}>
                          <td className="p-2.5 font-mono text-slate-500">{hist.fromStatus || 'INIT'}</td>
                          <td className="p-2.5 font-bold font-mono text-slate-900">{hist.toStatus}</td>
                          <td className="p-2.5 text-slate-600">{hist.changedBy || 'SYSTEM'}</td>
                          <td className="p-2.5 text-slate-700 italic max-w-xs">{hist.notes || '—'}</td>
                          <td className="p-2.5 text-right text-slate-500 text-[11px] whitespace-nowrap">
                            {new Date(hist.createdAt).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                          No audit trail records logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 text-xs"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch 6: Dispatch Courier Modal */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <span>Assign Courier & Dispatch</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Order {dispatchModalOrder.orderNumber} • {dispatchModalOrder.customerName}
                </p>
              </div>
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {dispatchError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{dispatchError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDispatch} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Carrier Partner *</label>
                <select
                  value={dispatchCarrier}
                  onChange={(e) => setDispatchCarrier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="BlueDart Air Express">BlueDart Air Express</option>
                  <option value="Delhivery Surface Express">Delhivery Surface Express</option>
                  <option value="DTDC Premium">DTDC Premium</option>
                  <option value="Shadowfax Local Delivery">Shadowfax Local Delivery</option>
                  <option value="India Post Speed Post">India Post Speed Post</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">AWB Tracking Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BD-8923019283"
                  value={dispatchAwb}
                  onChange={(e) => setDispatchAwb(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Public Carrier Tracking URL <span className="text-slate-400 font-normal">(Optional, must be http/https)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://www.bluedart.com/tracking?awb=..."
                  value={dispatchTrackingUrl}
                  onChange={(e) => setDispatchTrackingUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dispatch Staff Notes <span className="text-slate-400 font-normal">(Optional internal note)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Packed in secure corrugated box with bubble wrap from Central Hub..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dispatchPhysicalSignatureConfirmed}
                    onChange={(e) => setDispatchPhysicalSignatureConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <div className="text-[11px] text-amber-900 leading-snug">
                    <span className="font-bold">Physical Tax Invoice Signed (CGST Rule 46(q))</span>
                    <p className="text-amber-800/90 text-[10.5px] mt-0.5">
                      I confirm that the statutory tax invoice for this order has been physically printed, inspected, and physically signed by an authorized signatory before handing goods to the courier partner.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDispatchModalOrder(null)}
                  disabled={dispatchSubmitting}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-700 text-white font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {dispatchSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-3.5 h-3.5" />
                      <span>Confirm & Dispatch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch 10: Edit User Role Modal */}
      {editingUserRole && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>Modify System Role</span>
              </h3>
              <button
                onClick={() => setEditingUserRole(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Updating role permissions for: <strong className="text-slate-900">{editingUserRole.name}</strong>
              </p>
              <p className="text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px]">
                <strong>Security Policy:</strong> All active sessions for this user will be revoked immediately. The user will be required to log in again with their updated privileges.
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <label className="block font-bold text-slate-700">Assign Role</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="CUSTOMER">CUSTOMER (Standard retail buyer)</option>
                <option value="B2B_CLIENT">B2B_CLIENT (Corporate buyer / RFQ access)</option>
                <option value="STAFF">STAFF (Fulfillment, stock & operations management)</option>
                <option value="ADMIN">ADMIN (Full platform ownership & configuration)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setEditingUserRole(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateUserRole}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
              >
                Confirm Role Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch 10: View User Details Modal */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600" />
                <span>Account Profile & History</span>
              </h3>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Full Name:</span>
                  <span className="font-bold text-slate-900">{selectedUserDetail.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email Address:</span>
                  <span className="font-mono text-slate-800">{selectedUserDetail.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact Phone:</span>
                  <span className="font-mono text-slate-800">{selectedUserDetail.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">System Role:</span>
                  <span className="font-bold text-indigo-700">{selectedUserDetail.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Status:</span>
                  <span className={`font-bold ${selectedUserDetail.isActive ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {selectedUserDetail.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registered On:</span>
                  <span className="text-slate-800">{new Date(selectedUserDetail.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {selectedUserDetail.corporateMembership && (
                <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                  <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Corporate Organization Association</span>
                  </div>
                  <div className="text-slate-700">
                    Company: <strong>{selectedUserDetail.corporateMembership.organizationName}</strong>
                  </div>
                  <div className="text-slate-600">
                    Corporate Role: <span className="font-mono">{selectedUserDetail.corporateMembership.role}</span>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 text-[10.5px] text-amber-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Security Notice: Passwords, hashed credentials, active bearer tokens, and OTP secrets are never readable or exposed in client administration.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 text-xs"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch 10: Audit Payload Inspector Modal */}
      {selectedAuditPayload && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <span>Audit Log Metadata Payload</span>
              </h3>
              <button
                onClick={() => setSelectedAuditPayload(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-[11px] leading-relaxed">
              <pre>{JSON.stringify(selectedAuditPayload, null, 2)}</pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedAuditPayload(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
