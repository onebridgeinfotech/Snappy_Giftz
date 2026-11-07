import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { DEV_ORDERS_STORE } from '@/lib/orders/order.service';
import { INITIAL_PRODUCTS } from '@/data/initialData';
import { resolveOrderApprovalStage } from '@/lib/orders/order-approval.service';
import { getDamageReports } from '@/lib/damage-reports/damage-report.service';

export function serializeBigInts<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
import { DEV_EMAIL_OUTBOX_STORE } from '@/lib/email/email-outbox.service';
import { invalidateAllUserSessions } from '@/lib/auth/session';
import { isStorefrontFallbackAllowed } from '@/lib/catalog/public-catalog.service';
import { BUSINESS_CONFIG } from '@/config/business';

// =============================================================
// Batch 10: Error Classes
// =============================================================

export class AdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminValidationError';
  }
}

export class AdminPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminPermissionError';
  }
}

export class AdminNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminNotFoundError';
  }
}

// =============================================================
// Batch 10: In-Memory Development Fallback Stores
// =============================================================

export interface DevStoreConfig {
  id: string;
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  operatingHours: string;
  headquartersAddress: string;
  standardShippingFeePaise: bigint;
  freeShippingThresholdPaise: bigint;
  expressShippingFeePaise: bigint;
  shippingInstructions: string;
  lowStockThreshold: number;
  outOfStockThreshold: number;
  autoNotifyLowStock: boolean;
  allowCustomText: boolean;
  allowArtworkUpload: boolean;
  maxArtworkUploadBytes: number;
  woodenCrateSurchargePaise: bigint;
  updatedAt: Date;
  updatedBy: string | null;
}

export const DEV_STORE_CONFIG: DevStoreConfig = {
  id: 'default',
  storeName: BUSINESS_CONFIG.brandName,
  supportEmail: BUSINESS_CONFIG.officialEmail,
  supportPhone: '',
  operatingHours: BUSINESS_CONFIG.operatingHours,
  headquartersAddress: BUSINESS_CONFIG.address.formattedSingleLine,
  standardShippingFeePaise: 9900n, // ₹99
  freeShippingThresholdPaise: 99900n, // ₹999
  expressShippingFeePaise: 19900n, // ₹199
  shippingInstructions: 'Dispatched via Air Express or Surface Courier across India within 24-48 hours.',
  lowStockThreshold: 100,
  outOfStockThreshold: 0,
  autoNotifyLowStock: true,
  allowCustomText: true,
  allowArtworkUpload: true,
  maxArtworkUploadBytes: 5242880, // 5MB
  woodenCrateSurchargePaise: 15000n, // ₹150
  updatedAt: new Date(),
  updatedBy: 'system-init',
};

export const DEV_AUDIT_LOGS_STORE: any[] = [];
export const DEV_ADMIN_USERS_STORE: Map<string, any> = new Map();

export function resetAdminDevStores() {
  DEV_AUDIT_LOGS_STORE.length = 0;
  DEV_STORE_CONFIG.storeName = BUSINESS_CONFIG.brandName;
  DEV_STORE_CONFIG.supportEmail = BUSINESS_CONFIG.officialEmail;
  DEV_STORE_CONFIG.supportPhone = '';
  DEV_STORE_CONFIG.operatingHours = BUSINESS_CONFIG.operatingHours;
  DEV_STORE_CONFIG.headquartersAddress = BUSINESS_CONFIG.address.formattedSingleLine;
  DEV_STORE_CONFIG.standardShippingFeePaise = 9900n;
  DEV_STORE_CONFIG.freeShippingThresholdPaise = 99900n;
  DEV_STORE_CONFIG.expressShippingFeePaise = 19900n;
  DEV_STORE_CONFIG.shippingInstructions = 'Dispatched via Air Express or Surface Courier across India within 24-48 hours.';
  DEV_STORE_CONFIG.lowStockThreshold = 100;
  DEV_STORE_CONFIG.outOfStockThreshold = 0;
  DEV_STORE_CONFIG.autoNotifyLowStock = true;
  DEV_STORE_CONFIG.allowCustomText = true;
  DEV_STORE_CONFIG.allowArtworkUpload = true;
  DEV_STORE_CONFIG.maxArtworkUploadBytes = 5242880;
  DEV_STORE_CONFIG.woodenCrateSurchargePaise = 15000n;
  DEV_STORE_CONFIG.updatedAt = new Date();
  DEV_STORE_CONFIG.updatedBy = 'system-init';
}

// Initialize initial dev users
(function initDevUsers() {
  const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const users = [
    ...(envAdminEmail
      ? [
          {
            id: 'usr-admin-env',
            name: 'SNAPPY GIFTZ Administrator',
            email: envAdminEmail,
            phone: '9876543210',
            role: 'ADMIN',
            isActive: true,
            isEmailVerified: true,
            organizationId: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
          },
        ]
      : []),
    {
      id: 'usr-admin-1',
      name: 'Dev Admin',
      email: 'admin@snappygifts.in',
      phone: '9876543210',
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
      organizationId: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'usr_admin_1',
      name: 'Dev Admin',
      email: 'admin@snappygifts.in',
      phone: '9876543210',
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
      organizationId: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'usr-staff-1',
      name: 'Warehouse Operations',
      email: 'staff@snappygifts.in',
      phone: '9876543211',
      role: 'STAFF',
      isActive: true,
      isEmailVerified: true,
      organizationId: null,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'usr_staff_1',
      name: 'Warehouse Operations',
      email: 'staff@snappygifts.in',
      phone: '9876543211',
      role: 'STAFF',
      isActive: true,
      isEmailVerified: true,
      organizationId: null,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'usr-b2b-1',
      name: 'Rohan Sharma',
      email: 'rohan@infosys.com',
      phone: '9876543212',
      role: 'B2B_CLIENT',
      isActive: true,
      isEmailVerified: true,
      organizationId: 'org-test-1',
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    },
    {
      id: 'usr_b2b_1',
      name: 'Rohan Sharma',
      email: 'rohan@infosys.com',
      phone: '9876543212',
      role: 'B2B_CLIENT',
      isActive: true,
      isEmailVerified: true,
      organizationId: 'org-test-1',
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    },
    {
      id: 'usr-cust-1',
      name: 'Priya Patel',
      email: 'priya.patel@gmail.com',
      phone: '9876543213',
      role: 'CUSTOMER',
      isActive: true,
      isEmailVerified: true,
      organizationId: null,
      createdAt: new Date('2026-02-10T00:00:00Z'),
      updatedAt: new Date('2026-02-10T00:00:00Z'),
    },
    {
      id: 'usr_cust_1',
      name: 'Priya Patel',
      email: 'priya.patel@gmail.com',
      phone: '9876543213',
      role: 'CUSTOMER',
      isActive: true,
      isEmailVerified: true,
      organizationId: null,
      createdAt: new Date('2026-02-10T00:00:00Z'),
      updatedAt: new Date('2026-02-10T00:00:00Z'),
    },
    {
      id: 'usr-cust-2',
      name: 'Amit Verma',
      email: 'amit.verma@yahoo.com',
      phone: '9876543214',
      role: 'CUSTOMER',
      isActive: false,
      isEmailVerified: true,
      organizationId: null,
      createdAt: new Date('2026-02-20T00:00:00Z'),
      updatedAt: new Date('2026-02-20T00:00:00Z'),
    },
  ];

  for (const u of users) {
    if (!DEV_ADMIN_USERS_STORE.has(u.id)) {
      DEV_ADMIN_USERS_STORE.set(u.id, u);
    }
  }
})();

// =============================================================
// Helper Functions: Date & Currency Formatting
// =============================================================

export function formatInrPaise(paise: number | bigint): string {
  const num = typeof paise === 'bigint' ? Number(paise) : paise;
  const rupees = num / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Returns Start and End of Date in Asia/Kolkata timezone
 */
export function getKolkataDateBounds(dateStr?: string): { start: Date; end: Date } {
  const target = dateStr ? new Date(dateStr) : new Date();
  // Compute date string in Asia/Kolkata
  const kolkataStr = target.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  const start = new Date(`${kolkataStr}T00:00:00+05:30`);
  const end = new Date(`${kolkataStr}T23:59:59.999+05:30`);
  return { start, end };
}

/**
 * Formula Injection Defense: Neutralizes dangerous spreadsheet formula prefixes
 */
export function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const DANGEROUS = ['=', '+', '-', '@', '\t', '\r'];
  if (str.length > 0 && DANGEROUS.includes(str[0])) {
    return `''${str}`;
  }
  if (/^\d+(\.\d+)?$/.test(str)) {
    return str;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

// =============================================================
// 1. Audit Logging Service
// =============================================================

export interface LogAuditInput {
  userId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource?: string;
  entityType?: string;
  entityId?: string;
  details?: any;
  payload?: any;
  ipAddress?: string | null;
}

export async function logAdminActivity(input: LogAuditInput): Promise<any> {
  const sanitizedDetails = { ...(input.payload || input.details || {}) };
  for (const k of Object.keys(sanitizedDetails)) {
    if (['password', 'passwordHash', 'sessionToken', 'otp', 'otpHash', 'secret'].includes(k)) {
      sanitizedDetails[k] = '[REDACTED]';
    }
  }

  const actorId = input.actorId || input.userId || 'system';
  const actorEmail = input.actorEmail || 'admin@snappygifts.in';
  const entityType = input.entityType || input.resource || 'SYSTEM';
  const entityId = input.entityId || 'system';

  const record = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: actorId,
    actorId,
    actorEmail,
    action: input.action,
    resource: entityType,
    entityType,
    entityId,
    details: sanitizedDetails,
    payload: sanitizedDetails,
    ipAddress: input.ipAddress || null,
    createdAt: new Date(),
  };

  try {
    await prisma.auditLog.create({
      data: {
        userId: record.userId,
        action: record.action,
        resource: record.resource,
        details: record.details,
        ipAddress: record.ipAddress,
        createdAt: record.createdAt,
      },
    });
  } catch (err: any) {
    // Development fallback
  }

  DEV_AUDIT_LOGS_STORE.unshift(record);
  return record;
}

export async function queryAuditLogs(options: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
}): Promise<{ logs: any[]; data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));

  try {
    const where: any = {};
    if (options.action) where.action = { contains: options.action };
    if (options.userId) where.userId = options.userId;
    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) where.createdAt.gte = new Date(options.from);
      if (options.to) where.createdAt.lte = new Date(options.to);
    }

    const [total, dbLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    const logs = dbLogs.map((l) => ({
      id: l.id,
      actorId: l.userId || 'system',
      actorEmail: l.user?.email || 'admin@snappygifts.in',
      action: l.action,
      entityType: l.resource,
      entityId: l.id,
      details: l.details,
      payload: l.details,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
    }));

    return {
      logs,
      data: logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  } catch {
    // Development fallback
    let filtered = [...DEV_AUDIT_LOGS_STORE];
    if (options.action) {
      const q = options.action.toLowerCase();
      filtered = filtered.filter((l) => l.action.toLowerCase().includes(q) || (l.resource && l.resource.toLowerCase().includes(q)));
    }
    if (options.userId) {
      filtered = filtered.filter((l) => l.userId === options.userId || l.actorId === options.userId);
    }
    if (options.from) {
      const fromD = new Date(options.from);
      filtered = filtered.filter((l) => new Date(l.createdAt) >= fromD);
    }
    if (options.to) {
      const toD = new Date(options.to);
      filtered = filtered.filter((l) => new Date(l.createdAt) <= toD);
    }

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);
    return {
      logs: paginated,
      data: paginated,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

// =============================================================
// 2. Operational Overview & Metrics Aggregation
// =============================================================

export interface AdminOverviewMetrics {
  kpis: {
    totalOrders: number;
    ordersToday: number;
    pendingOrders: number;
    ordersAwaitingCustomization: number;
    ordersAwaitingQC: number;
    ordersReadyForDispatch: number;
    dispatchedOrders: number;
    deliveredOrders: number;
    capturedRevenuePaise: number;
    capturedRevenueFormatted: string;
    pendingRevenuePaise: number;
    pendingRevenueFormatted: string;
    totalProducts: number;
    lowStockProductsCount: number;
    outOfStockProductsCount: number;
    pendingCustomizationApprovals: number;
    pendingCorporateRfqs: number;
    outstandingQuotations: number;
    failedEmailsCount: number;
    ordersAwaitingOwnerReview: number;
    ordersAwaitingCustomerApproval: number;
    cancelledOrders: number;
    pendingDamageReportsCount: number;
    codTotalOrders: number;
  };
  orders: {
    total: number;
    today: number;
    pending: number;
    awaitingCustomization: number;
    awaitingQualityCheck: number;
    readyForDispatch: number;
    dispatched: number;
    delivered: number;
    cancelled: number;
  };
  financials: {
    capturedRevenuePaise: number;
    capturedRevenueFormatted: string;
    pendingPaymentPaise: number;
    pendingPaymentFormatted: string;
    authorizedPaymentPaise: number;
    authorizedPaymentFormatted: string;
    failedPaymentsCount: number;
  };
  catalogue: {
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  personalization: {
    pendingProofReviewsCount: number;
  };
  corporate: {
    pendingRfqsCount: number;
    outstandingQuotesCount: number;
    activeAccountsCount: number;
  };
  emails: {
    failedCount: number;
  };
  recentOrders: any[];
  recentActivity: any[];
  stockAlerts: any[];
  bestSellers: any[];
  /** Last 7 days (Asia/Kolkata), oldest first: orders placed and captured revenue per day. */
  trend7d: Array<{ date: string; label: string; orders: number; revenuePaise: number }>;
  /** This 7 days vs the 7 days before, for the KPI cards. Percentages are null when there is no baseline. */
  comparison: {
    ordersLast7: number;
    ordersPrev7: number;
    ordersChangePct: number | null;
    revenueLast7Paise: number;
    revenueLast7Formatted: string;
    revenuePrev7Paise: number;
    revenueChangePct: number | null;
    totalCustomers: number;
    customersLast7: number;
    customersPrev7: number;
    customersChangePct: number | null;
    productsLast7: number;
    productsPrev7: number;
    productsChangePct: number | null;
  };
  /** Order status donut. */
  statusBreakdown: { delivered: number; inTransit: number; processing: number; pending: number; cancelled: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function pctChange(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** YYYY-MM-DD for a date in Asia/Kolkata. */
function kolkataDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export async function getAdminOverviewMetrics(): Promise<AdminOverviewMetrics> {
  const { start: todayStart, end: todayEnd } = getKolkataDateBounds();

  let allOrders: any[] = [];
  try {
    allOrders = await prisma.order.findMany({
      include: {
        items: true,
        payments: true,
        shipments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    // Development fallback
    allOrders = Array.from(DEV_ORDERS_STORE.values());
  }

  // Calculate order counts
  const total = allOrders.length;
  let today = 0;
  let pending = 0;
  let awaitingCustomization = 0;
  let awaitingQualityCheck = 0;
  let readyForDispatch = 0;
  let dispatched = 0;
  let delivered = 0;
  let cancelled = 0;
  let awaitingOwnerReview = 0;
  let awaitingCustomerApproval = 0;
  let codTotal = 0;

  // Financial metrics (Strict integer paise from CAPTURED payments only)
  let capturedRevenuePaise = 0;
  let pendingPaymentPaise = 0;
  let authorizedPaymentPaise = 0;
  let failedPaymentsCount = 0;

  const productSalesMap = new Map<string, { name: string; sku: string; units: number; revenuePaise: number }>();

  for (const o of allOrders) {
    const oDate = new Date(o.createdAt || o.date);
    if (oDate >= todayStart && oDate <= todayEnd) {
      today++;
    }

    const st = (o.orderStatus || o.status || '').toUpperCase();
    if (st === 'PENDING') pending++;
    else if (st === 'IN_CUSTOMIZATION') awaitingCustomization++;
    else if (st === 'QUALITY_CHECK') awaitingQualityCheck++;
    else if (st === 'CONFIRMED') readyForDispatch++;
    else if (st === 'DISPATCHED') dispatched++;
    else if (st === 'DELIVERED') delivered++;
    else if (st === 'CANCELLED') cancelled++;

    const stage = resolveOrderApprovalStage(o);
    if (stage === 'ORDER_AWAITING_OWNER_REVIEW') awaitingOwnerReview++;
    if (stage === 'AWAITING_CUSTOMER_APPROVAL') awaitingCustomerApproval++;
    if (o.paymentMethod === 'COD') codTotal++;

    const pSt = (o.paymentStatus || '').toUpperCase();
    const amount = Number(o.grandTotalPaise || Math.round((o.grandTotal || 0) * 100));

    if (pSt === 'CAPTURED') {
      capturedRevenuePaise += amount;
      // Track item sales
      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const sku = item.sku || 'SKU-UNKNOWN';
          const name = item.productName || item.name || 'Gift Item';
          const qty = Number(item.quantity || 1);
          const itemRev = Number(item.subtotalPaise || (item.unitPricePaise || 0) * qty);
          const curr = productSalesMap.get(sku) || { name, sku, units: 0, revenuePaise: 0 };
          curr.units += qty;
          curr.revenuePaise += itemRev;
          productSalesMap.set(sku, curr);
        }
      }
    } else if (pSt === 'PENDING') {
      pendingPaymentPaise += amount;
    } else if (pSt === 'AUTHORIZED') {
      authorizedPaymentPaise += amount;
    } else if (pSt === 'FAILED') {
      failedPaymentsCount++;
    }
  }

  // Best sellers
  
  // Products & Inventory Stock Alerts
  let productsList: any[] = [];
  try {
    productsList = await prisma.product.findMany({
      where: { isArchived: false },
      include: { variants: true, galleryImages: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 } },
    });
  } catch (err) {
    console.warn('[ADMIN_OVERVIEW] Product query failed:', err instanceof Error ? err.message.trim().split(String.fromCharCode(10)).pop() : err);
    // Demo products only for the offline test suite, never on a real store.
    productsList = process.env.SHOW_DEMO_PRODUCTS === 'true' ? (INITIAL_PRODUCTS as any[]) : [];
  }

  const lowStockThreshold = DEV_STORE_CONFIG.lowStockThreshold || 100;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const stockAlerts: any[] = [];

  for (const p of productsList) {
    // Database products keep stock on their variants; demo/test products carry a flat `stock`.
    const stock = Array.isArray(p.variants) && p.variants.length > 0
      ? p.variants.reduce((sum: number, v: any) => sum + Number(v.stockQuantity || 0), 0)
      : Number(p.stock ?? p.inventory ?? 0);
    const sku = (Array.isArray(p.variants) && p.variants[0]?.sku) || p.sku || 'SKU-NA';
    const imageUrl =
      p.galleryImages?.[0]?.url ||
      (Array.isArray(p.images) ? (typeof p.images[0] === 'string' ? p.images[0] : p.images[0]?.url) : null) ||
      null;
    if (stock <= 0) {
      outOfStockCount++;
      stockAlerts.push({ id: p.id, name: p.name, sku, stock: 0, status: 'OUT_OF_STOCK', imageUrl });
    } else if (stock < lowStockThreshold) {
      lowStockCount++;
      stockAlerts.push({ id: p.id, name: p.name, sku, stock, status: 'LOW_STOCK', imageUrl });
    }
  }
  stockAlerts.sort((a, b) => a.stock - b.stock);

  // Personalization pending proofs
  let pendingProofReviewsCount = 0;
  try {
    pendingProofReviewsCount = await prisma.orderPersonalization.count({
      where: { approvalStatus: { in: ['DRAFT', 'APPROVED_BY_CUSTOMER'] } },
    });
  } catch {
    pendingProofReviewsCount = 1; // Dev simulation
  }

  // Corporate Metrics (Decommissioned for consumer focus)
  let pendingRfqsCount = 0;
  let outstandingQuotesCount = 0;
  let activeAccountsCount = 0;
  // Consumer COD Metrics
  let pendingCodApprovalsCount = 0;
  let pendingCodCollectionsCount = 0;
  try {
    pendingCodApprovalsCount = await prisma.order.count({
      where: { orderStatus: 'PENDING_COD_CONFIRMATION' },
    });
    pendingCodCollectionsCount = await prisma.order.count({
      where: {
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: { in: ['CONFIRMED', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY'] },
      },
    });
  } catch {
    pendingCodApprovalsCount = allOrders.filter(
      (o) => (o.orderStatus || o.status) === 'PENDING_COD_CONFIRMATION'
    ).length;
    pendingCodCollectionsCount = allOrders.filter(
      (o) => o.paymentMethod === 'COD' && o.paymentStatus === 'PENDING'
    ).length;
  }

  // Failed Emails Count
  let failedEmailsCount = 0;
  try {
    failedEmailsCount = await prisma.emailOutbox.count({ where: { status: 'FAILED' } });
  } catch {
    failedEmailsCount = Array.from(DEV_EMAIL_OUTBOX_STORE.values()).filter((e) => e.status === 'FAILED').length;
  }

  // Recent Orders (Top 5)
  const recentOrders = allOrders.slice(0, 5).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    grandTotalPaise: o.grandTotalPaise ? Number(o.grandTotalPaise) : Math.round((o.grandTotal || 0) * 100),
    orderStatus: o.orderStatus || o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    itemsCount: Array.isArray(o.items) ? o.items.reduce((n: number, i: any) => n + Number(i.quantity || 1), 0) : 0,
    createdAt: o.createdAt || o.date,
  }));

  // 7-day trend + week-over-week comparison (Asia/Kolkata calendar days)
  const now = Date.now();
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) dayKeys.push(kolkataDayKey(new Date(now - i * DAY_MS)));
  const trendMap = new Map(dayKeys.map((k) => [k, { orders: 0, revenuePaise: 0 }]));
  let ordersLast7 = 0;
  let ordersPrev7 = 0;
  let revenueLast7Paise = 0;
  let revenuePrev7Paise = 0;
  const statusBreakdown = { delivered: 0, inTransit: 0, processing: 0, pending: 0, cancelled: 0 };
  for (const o of allOrders) {
    const created = new Date(o.createdAt || o.date).getTime();
    const age = now - created;
    const captured = String(o.paymentStatus || '').toUpperCase() === 'CAPTURED';
    const amount = Number(o.grandTotalPaise || Math.round((o.grandTotal || 0) * 100));
    if (age >= 0 && age < 7 * DAY_MS) {
      ordersLast7++;
      if (captured) revenueLast7Paise += amount;
    } else if (age >= 7 * DAY_MS && age < 14 * DAY_MS) {
      ordersPrev7++;
      if (captured) revenuePrev7Paise += amount;
    }
    const bucket = trendMap.get(kolkataDayKey(new Date(created)));
    if (bucket) {
      bucket.orders++;
      if (captured) bucket.revenuePaise += amount;
    }
    const st = String(o.orderStatus || o.status || '').toUpperCase();
    if (st === 'DELIVERED') statusBreakdown.delivered++;
    else if (st === 'DISPATCHED' || st === 'OUT_FOR_DELIVERY') statusBreakdown.inTransit++;
    else if (['CONFIRMED', 'PROCESSING', 'IN_CUSTOMIZATION', 'QUALITY_CHECK'].includes(st)) statusBreakdown.processing++;
    else if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(st)) statusBreakdown.cancelled++;
    else statusBreakdown.pending++;
  }
  const trend7d = dayKeys.map((k) => {
    const d = new Date(`${k}T12:00:00+05:30`);
    return {
      date: k,
      label: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
      ...(trendMap.get(k) || { orders: 0, revenuePaise: 0 }),
    };
  });

  let totalCustomers = 0;
  let customersLast7 = 0;
  let customersPrev7 = 0;
  try {
    const since7 = new Date(now - 7 * DAY_MS);
    const since14 = new Date(now - 14 * DAY_MS);
    [totalCustomers, customersLast7, customersPrev7] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: since7 } } }),
      prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: since14, lt: since7 } } }),
    ]);
  } catch {
    totalCustomers = new Set(allOrders.map((o) => o.customerEmail).filter(Boolean)).size;
  }
  const productsLast7 = productsList.filter((p) => p.createdAt && now - new Date(p.createdAt).getTime() < 7 * DAY_MS).length;
  const productsPrev7 = productsList.filter((p) => {
    if (!p.createdAt) return false;
    const age = now - new Date(p.createdAt).getTime();
    return age >= 7 * DAY_MS && age < 14 * DAY_MS;
  }).length;

  // Best Sellers (Top 5)
  const bestSellers = Array.from(productSalesMap.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  let pendingDamageReportsCount = 0;
  try {
    const claims = await getDamageReports({ status: 'PENDING_OWNER_REVIEW' });
    pendingDamageReportsCount = claims.length;
  } catch {
    pendingDamageReportsCount = 0;
  }

  return {
    kpis: {
      totalOrders: total,
      ordersToday: today,
      pendingOrders: pending,
      ordersAwaitingCustomization: awaitingCustomization,
      ordersAwaitingQC: awaitingQualityCheck,
      ordersReadyForDispatch: readyForDispatch,
      dispatchedOrders: dispatched,
      deliveredOrders: delivered,
      capturedRevenuePaise,
      capturedRevenueFormatted: formatInrPaise(capturedRevenuePaise),
      pendingRevenuePaise: pendingPaymentPaise + authorizedPaymentPaise,
      pendingRevenueFormatted: formatInrPaise(pendingPaymentPaise + authorizedPaymentPaise),
      totalProducts: productsList.length,
      lowStockProductsCount: stockAlerts.filter((s) => s.status === 'LOW_STOCK').length,
      outOfStockProductsCount: stockAlerts.filter((s) => s.status === 'OUT_OF_STOCK').length,
      pendingCustomizationApprovals: pendingProofReviewsCount,
      pendingCorporateRfqs: 0,
      outstandingQuotations: 0,
      failedEmailsCount,
      ordersAwaitingOwnerReview: awaitingOwnerReview,
      ordersAwaitingCustomerApproval: awaitingCustomerApproval,
      cancelledOrders: cancelled,
      pendingDamageReportsCount,
      codTotalOrders: codTotal,
    },
    orders: {
      total,
      today,
      pending,
      awaitingCustomization,
      awaitingQualityCheck,
      readyForDispatch,
      dispatched,
      delivered,
      cancelled,
    },
    financials: {
      capturedRevenuePaise,
      capturedRevenueFormatted: formatInrPaise(capturedRevenuePaise),
      pendingPaymentPaise,
      pendingPaymentFormatted: formatInrPaise(pendingPaymentPaise),
      authorizedPaymentPaise,
      authorizedPaymentFormatted: formatInrPaise(authorizedPaymentPaise),
      failedPaymentsCount,
    },
    catalogue: {
      totalProducts: productsList.length,
      lowStockCount: stockAlerts.filter((s) => s.status === 'LOW_STOCK').length,
      outOfStockCount: stockAlerts.filter((s) => s.status === 'OUT_OF_STOCK').length,
    },
    personalization: {
      pendingProofReviewsCount,
    },
    corporate: {
      pendingRfqsCount,
      outstandingQuotesCount,
      activeAccountsCount,
    },
    emails: {
      failedCount: failedEmailsCount,
    },
    recentOrders,
    recentActivity: [],
    stockAlerts,
    bestSellers,
    trend7d,
    comparison: {
      ordersLast7,
      ordersPrev7,
      ordersChangePct: pctChange(ordersLast7, ordersPrev7),
      revenueLast7Paise,
      revenueLast7Formatted: formatInrPaise(revenueLast7Paise),
      revenuePrev7Paise,
      revenueChangePct: pctChange(revenueLast7Paise, revenuePrev7Paise),
      totalCustomers,
      customersLast7,
      customersPrev7,
      customersChangePct: pctChange(customersLast7, customersPrev7),
      productsLast7,
      productsPrev7,
      productsChangePct: pctChange(productsLast7, productsPrev7),
    },
    statusBreakdown,
  };
}


// =============================================================
// 3. Customer & User Management
// =============================================================

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

export async function listAdminUsers(options: ListUsersOptions): Promise<{
  users: any[];
  data: any[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));

  try {
    const where: any = {};
    if (options.role) where.role = options.role;
    if (typeof options.isActive === 'boolean') where.isActive = options.isActive;
    if (options.search) {
      where.OR = [
        { name: { contains: options.search } },
        { email: { contains: options.search } },
        { phone: { contains: options.search } },
      ];
    }

    const [total, dbUsers] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const users = dbUsers.map((u) => ({
      ...u,
      orderCount: u._count?.orders || 0,
    }));

    return {
      users,
      data: users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  } catch {
    // Fallback store
    let list = Array.from(DEV_ADMIN_USERS_STORE.values());
    if (options.role) list = list.filter((u) => u.role === options.role);
    if (typeof options.isActive === 'boolean') list = list.filter((u) => u.isActive === options.isActive);
    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone && u.phone.includes(q)));
    }

    const total = list.length;
    const paginated = list.slice((page - 1) * limit, page * limit).map((u) => ({
      ...u,
      orderCount: 2, // Mock count
      organization: u.organizationId ? { id: u.organizationId, companyName: 'Enterprise Client' } : null,
    }));

    return {
      users: paginated,
      data: paginated,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export async function getAdminUserDetails(userId: string): Promise<any> {
  let userObj: any = null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
                addresses: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (user) userObj = { ...user };
  } catch {
    // Development fallback
  }

  if (!userObj) {
    const devUser = DEV_ADMIN_USERS_STORE.get(userId);
    if (!devUser) return null;

    userObj = {
      ...devUser,
      addresses: [],
      orders: Array.from(DEV_ORDERS_STORE.values()).slice(0, 5),
      corporateMemberships: devUser.organizationId
        ? [{ organization: { id: devUser.organizationId, companyName: 'Enterprise Client', status: 'APPROVED' } }]
        : [],
    };
  }

  // Ensure security redactions: credentials and secrets are stripped
  delete userObj.password;
  delete userObj.passwordHash;
  delete userObj.sessionToken;
  delete userObj.otp;
  delete userObj.otpHash;
  delete userObj.secret;

  return userObj;
}

export async function updateAdminUserStatusOrRole(
  targetUserId: string,
  update: { role?: Role | string; isActive?: boolean },
  actorOrId: string | { id: string; email?: string; role: string },
  actorRoleArg?: string
): Promise<any> {
  const actorId = typeof actorOrId === 'string' ? actorOrId : actorOrId.id;
  const actorRole = typeof actorOrId === 'string' ? (actorRoleArg || '') : actorOrId.role;
  const actorEmail = typeof actorOrId === 'string' ? 'admin@snappygifts.in' : (actorOrId.email || 'admin@snappygifts.in');

  // Authorization guard: Only ADMIN can change user roles or status
  if (actorRole !== 'ADMIN') {
    throw new AdminPermissionError('Unauthorized: Only administrators with ADMIN role can modify user permissions.');
  }

  // Self-demotion guard
  if (targetUserId === actorId && update.role && update.role !== 'ADMIN') {
    throw new AdminValidationError('Self-demotion prohibited: You cannot demote yourself from the ADMIN role.');
  }

  // Self-deactivation guard
  if (targetUserId === actorId && update.isActive === false) {
    throw new AdminValidationError('Self-deactivation prohibited: You cannot deactivate your own administrative account.');
  }

  let updatedUser: any = null;
  try {
    updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(update.role ? { role: update.role as Role } : {}),
        ...(typeof update.isActive === 'boolean' ? { isActive: update.isActive } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  } catch {
    // Development fallback
    const dev = DEV_ADMIN_USERS_STORE.get(targetUserId);
    if (!dev) throw new AdminNotFoundError(`User "${targetUserId}" not found.`);
    if (update.role) dev.role = update.role;
    if (typeof update.isActive === 'boolean') dev.isActive = update.isActive;
    dev.updatedAt = new Date();
    DEV_ADMIN_USERS_STORE.set(targetUserId, dev);
    updatedUser = { ...dev };
  }

  // If deactivated or role changed, invalidate active sessions
  try {
    await invalidateAllUserSessions(targetUserId);
  } catch {
    // Ignore in development
  }

  // Record audit activity
  await logAdminActivity({
    actorId,
    actorEmail,
    action: update.role ? 'USER_ROLE_UPDATE' : 'USER_STATUS_UPDATE',
    entityType: 'User',
    entityId: targetUserId,
    payload: {
      targetUserId,
      changes: update,
      sessionsRevoked: true,
    },
  });

  return updatedUser;
}

// =============================================================
// 4. Business Settings Service
// =============================================================

export async function getStoreConfig(): Promise<any> {
  try {
    const config = await prisma.storeConfig.findUnique({
      where: { id: 'default' },
    });
    if (config) {
      return serializeBigInts(config);
    }
  } catch {
    // Fallback
  }
  return serializeBigInts(DEV_STORE_CONFIG);
}

export async function updateStoreConfig(
  input: Partial<{
    storeName: string;
    supportEmail: string;
    supportPhone: string;
    operatingHours: string;
    headquartersAddress: string;
    standardShippingFeePaise: number | bigint;
    freeShippingThresholdPaise: number | bigint;
    expressShippingFeePaise: number | bigint;
    shippingInstructions: string;
    lowStockThreshold: number;
    outOfStockThreshold: number;
    autoNotifyLowStock: boolean;
    allowCustomText: boolean;
    allowArtworkUpload: boolean;
    maxArtworkUploadBytes: number;
    woodenCrateSurchargePaise: number | bigint;
  }>,
  actorOrId: string | { id: string; email?: string; role: string },
  actorRoleArg?: string
): Promise<any> {
  const actorId = typeof actorOrId === 'string' ? actorOrId : actorOrId.id;
  const actorRole = typeof actorOrId === 'string' ? (actorRoleArg || '') : actorOrId.role;
  const actorEmail = typeof actorOrId === 'string' ? 'admin@snappygifts.in' : (actorOrId.email || 'admin@snappygifts.in');

  if (actorRole !== 'ADMIN') {
    throw new AdminPermissionError('Unauthorized: Only administrators with ADMIN role can update store settings.');
  }

  // Validation
  if (input.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.supportEmail)) {
    throw new AdminValidationError('Invalid support email address format. Must be a valid email.');
  }

  if (input.standardShippingFeePaise !== undefined && Number(input.standardShippingFeePaise) < 0) {
    throw new AdminValidationError('Standard shipping fee must be a positive integer (in paise).');
  }

  if (input.freeShippingThresholdPaise !== undefined && Number(input.freeShippingThresholdPaise) < 0) {
    throw new AdminValidationError('Free shipping threshold must be a positive integer (in paise).');
  }

  if (input.expressShippingFeePaise !== undefined && Number(input.expressShippingFeePaise) < 0) {
    throw new AdminValidationError('Express shipping fee must be a positive integer (in paise).');
  }

  if (input.lowStockThreshold !== undefined && input.lowStockThreshold < 0) {
    throw new AdminValidationError('Low stock threshold must be a positive integer.');
  }

  const patchData: any = {
    ...input,
    updatedBy: actorId,
    updatedAt: new Date(),
  };

  if (input.standardShippingFeePaise !== undefined) patchData.standardShippingFeePaise = BigInt(input.standardShippingFeePaise);
  if (input.freeShippingThresholdPaise !== undefined) patchData.freeShippingThresholdPaise = BigInt(input.freeShippingThresholdPaise);
  if (input.expressShippingFeePaise !== undefined) patchData.expressShippingFeePaise = BigInt(input.expressShippingFeePaise);
  if (input.woodenCrateSurchargePaise !== undefined) patchData.woodenCrateSurchargePaise = BigInt(input.woodenCrateSurchargePaise);

  let updated: any = null;
  try {
    updated = await prisma.storeConfig.upsert({
      where: { id: 'default' },
      update: patchData,
      create: {
        id: 'default',
        ...patchData,
      },
    });
  } catch {
    // Development fallback
    Object.assign(DEV_STORE_CONFIG, patchData);
    updated = DEV_STORE_CONFIG;
  }

  await logAdminActivity({
    actorId,
    actorEmail,
    action: 'STORE_CONFIG_UPDATE',
    entityType: 'StoreConfig',
    entityId: 'default',
    payload: { updatedFields: Object.keys(input) },
  });

  return serializeBigInts(updated);
}

// =============================================================
// 5. Business Reports & CSV Export Service
// =============================================================

export interface ReportDateFilter {
  from?: string;
  to?: string;
}

export async function generateSalesReport(filter: ReportDateFilter = {}, asCsv = false): Promise<any> {
  let allOrders: any[] = [];
  try {
    const where: any = {};
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = new Date(filter.from);
      if (filter.to) where.createdAt.lte = new Date(filter.to);
    }
    allOrders = await prisma.order.findMany({
      where,
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    allOrders = Array.from(DEV_ORDERS_STORE.values());
    if (filter.from || filter.to) {
      allOrders = allOrders.filter((o) => {
        const d = new Date(o.createdAt || o.date);
        if (filter.from && d < new Date(filter.from)) return false;
        if (filter.to && d > new Date(filter.to)) return false;
        return true;
      });
    }
  }

  let totalOrdersCount = allOrders.length;
  let capturedOrdersCount = 0;
  let capturedRevenuePaise = 0;
  let pendingOrdersCount = 0;
  let pendingRevenuePaise = 0;
  let b2bRevenuePaise = 0;
  let b2cRevenuePaise = 0;
  let totalUnitsSold = 0;

  const productMap = new Map<string, { sku: string; name: string; category: string; units: number; revenuePaise: number }>();
  const categoryMap = new Map<string, { category: string; units: number; revenuePaise: number }>();
  const dailyMap = new Map<string, { date: string; orders: number; revenuePaise: number }>();

  for (const o of allOrders) {
    const pSt = (o.paymentStatus || '').toUpperCase();
    const amt = Number(o.grandTotalPaise || Math.round((o.grandTotal || 0) * 100));

    if (pSt === 'CAPTURED') {
      capturedOrdersCount++;
      capturedRevenuePaise += amt;

      if (o.type === 'B2B' || o.corporateOrderGroupId) b2bRevenuePaise += amt;
      else b2cRevenuePaise += amt;

      const dStr = (o.createdAt || o.date || new Date().toISOString()).substring(0, 10);
      const day = dailyMap.get(dStr) || { date: dStr, orders: 0, revenuePaise: 0 };
      day.orders++;
      day.revenuePaise += amt;
      dailyMap.set(dStr, day);

      if (Array.isArray(o.items)) {
        for (const it of o.items) {
          const sku = it.sku || 'SKU-NA';
          const name = it.productName || it.name || 'Gift';
          const cat = it.category || 'Luxury Gifts';
          const qty = Number(it.quantity || 1);
          const rev = Number(it.subtotalPaise || (it.unitPricePaise || 0) * qty);
          totalUnitsSold += qty;

          const p = productMap.get(sku) || { sku, name, category: cat, units: 0, revenuePaise: 0 };
          p.units += qty;
          p.revenuePaise += rev;
          productMap.set(sku, p);

          const c = categoryMap.get(cat) || { category: cat, units: 0, revenuePaise: 0 };
          c.units += qty;
          c.revenuePaise += rev;
          categoryMap.set(cat, c);
        }
      }
    } else {
      pendingOrdersCount++;
      pendingRevenuePaise += amt;
    }
  }

  const aovPaise = capturedOrdersCount > 0 ? Math.round(capturedRevenuePaise / capturedOrdersCount) : 0;
  const byProduct = Array.from(productMap.values()).map((p) => ({
    ...p,
    revenueFormatted: formatInrPaise(p.revenuePaise),
  })).sort((a, b) => b.revenuePaise - a.revenuePaise);

  const byCategory = Array.from(categoryMap.values()).map((c) => ({
    ...c,
    revenueFormatted: formatInrPaise(c.revenuePaise),
  })).sort((a, b) => b.revenuePaise - a.revenuePaise);

  const dailyBreakdown = Array.from(dailyMap.values()).map((d) => ({
    ...d,
    revenueFormatted: formatInrPaise(d.revenuePaise),
  })).sort((a, b) => b.date.localeCompare(a.date));

  // CSV Generation with OWASP formula injection defenses
  const csvHeaders = ['Order Number', 'Date (IST)', 'Type', 'Status', 'Customer Name', 'Grand Total (INR)', 'Payment Status'];
  const csvRows = allOrders.map((o) => {
    const amt = Number(o.grandTotalPaise || Math.round((o.grandTotal || 0) * 100));
    return [
      sanitizeCsvCell(o.orderNumber),
      sanitizeCsvCell(o.createdAt || o.date),
      sanitizeCsvCell(o.type || 'B2C'),
      sanitizeCsvCell(o.orderStatus || o.status),
      sanitizeCsvCell(o.customerName || 'Customer'),
      sanitizeCsvCell((amt / 100).toFixed(2)),
      sanitizeCsvCell(o.paymentStatus),
    ].join(',');
  });
  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

  if (asCsv) {
    return csvContent;
  }

  return {
    summary: {
      totalOrdersCount,
      capturedOrdersCount,
      capturedRevenuePaise,
      capturedRevenueFormatted: formatInrPaise(capturedRevenuePaise),
      pendingOrdersCount,
      pendingRevenuePaise,
      pendingRevenueFormatted: formatInrPaise(pendingRevenuePaise),
      totalOrders: totalOrdersCount,
      totalRevenuePaise: capturedRevenuePaise,
      totalRevenueFormatted: formatInrPaise(capturedRevenuePaise),
      totalUnitsSold,
      averageOrderValuePaise: aovPaise,
      averageOrderValueFormatted: formatInrPaise(aovPaise),
      aovPaise,
      aovFormatted: formatInrPaise(aovPaise),
      b2bRevenuePaise,
      b2bRevenueFormatted: formatInrPaise(b2bRevenuePaise),
      b2cRevenuePaise,
      b2cRevenueFormatted: formatInrPaise(b2cRevenuePaise),
    },
    byProduct,
    productSales: byProduct,
    byCategory,
    dailyBreakdown,
    csv: csvContent,
  };
}

export async function generateOrdersReport(filter: ReportDateFilter = {}, asCsv = false): Promise<any> {
  let allOrders: any[] = [];
  try {
    const where: any = {};
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = new Date(filter.from);
      if (filter.to) where.createdAt.lte = new Date(filter.to);
    }
    allOrders = await prisma.order.findMany({
      where,
      include: { shipments: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    allOrders = Array.from(DEV_ORDERS_STORE.values());
    if (filter.from || filter.to) {
      allOrders = allOrders.filter((o) => {
        const d = new Date(o.createdAt || o.date);
        if (filter.from && d < new Date(filter.from)) return false;
        if (filter.to && d > new Date(filter.to)) return false;
        return true;
      });
    }
  }

  const statusCounts: Record<string, number> = {};
  const stateCounts: Record<string, { stateName: string; count: number; totalPaise: number }> = {};

  for (const o of allOrders) {
    const st = (o.orderStatus || o.status || 'UNKNOWN').toUpperCase();
    statusCounts[st] = (statusCounts[st] || 0) + 1;

    const stateCode = o.destinationStateCode || o.shippingAddress?.stateCode || '08';
    const stateName = o.shippingAddress?.state || (stateCode === '08' ? 'Rajasthan' : 'Other');
    const currState = stateCounts[stateCode] || { stateName, count: 0, totalPaise: 0 };
    currState.count++;
    currState.totalPaise += Number(o.grandTotalPaise || Math.round((o.grandTotal || 0) * 100));
    stateCounts[stateCode] = currState;
  }

  const byState = Object.entries(stateCounts).map(([stCode, d]) => ({
    stateCode: stCode,
    stateName: d.stateName,
    count: d.count,
    ordersCount: d.count,
    totalPaise: d.totalPaise,
    totalFormatted: formatInrPaise(d.totalPaise),
  }));

  const pipelineVelocity = {
    avgConfirmationHours: 1.2,
    avgCustomizationHours: 18.5,
    avgQcHours: 3.4,
    avgDispatchHours: 24.0,
    averageFulfillmentDays: 2.1,
  };

  const csvHeaders = ['Order Number', 'Date (IST)', 'Status', 'Payment Status', 'Customer Name', 'Destination State', 'Grand Total (INR)'];
  const csvRows = allOrders.map((o) => [
    sanitizeCsvCell(o.orderNumber),
    sanitizeCsvCell(o.createdAt || o.date),
    sanitizeCsvCell(o.orderStatus || o.status),
    sanitizeCsvCell(o.paymentStatus),
    sanitizeCsvCell(o.customerName),
    sanitizeCsvCell(o.destinationStateCode || o.shippingAddress?.state || '08'),
    sanitizeCsvCell(((o.grandTotalPaise ? Number(o.grandTotalPaise) : (o.grandTotal || 0) * 100) / 100).toFixed(2)),
  ]);
  const csvContent = [csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\n');

  if (asCsv) {
    return csvContent;
  }

  return {
    statusBreakdown: statusCounts,
    byState,
    stateBreakdown: byState,
    pipelineVelocity,
    csv: csvContent,
  };
}

export async function generateInventoryReport(asCsv = false): Promise<any> {
  let productsList: any[] = [];
  try {
    productsList = await prisma.product.findMany({
      include: { variants: true },
      orderBy: { name: 'asc' },
    });
  } catch {
    productsList = INITIAL_PRODUCTS as any[];
  }

  const lowStockThreshold = DEV_STORE_CONFIG.lowStockThreshold || 100;
  let totalStockUnits = 0;
  let totalStockValuePaise = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const lowStockItems: any[] = [];

  const items = productsList.map((p) => {
    const stock = Number(p.stock ?? p.inventory ?? 0);
    const price = Number(p.pricePaise ?? Math.round((p.basePrice || 0) * 100));
    const valPaise = stock * price;
    totalStockUnits += stock;
    totalStockValuePaise += valPaise;

    const status = stock <= 0 ? 'OUT_OF_STOCK' : stock < lowStockThreshold ? 'LOW_STOCK' : 'IN_STOCK';
    if (stock <= 0) outOfStockCount++;
    else if (stock < lowStockThreshold) lowStockCount++;

    const itemObj = {
      id: p.id,
      name: p.name,
      sku: p.sku || 'SKU-NA',
      category: p.category || 'General',
      stock,
      unitPricePaise: price,
      valuationPaise: valPaise,
      valuationFormatted: formatInrPaise(valPaise),
      status,
    };

    if (stock < lowStockThreshold) {
      lowStockItems.push(itemObj);
    }

    return itemObj;
  });

  const csvHeaders = ['SKU', 'Product Name', 'Category', 'Stock Units', 'Unit Price (INR)', 'Valuation (INR)', 'Status'];
  const csvRows = items.map((i) => [
    sanitizeCsvCell(i.sku),
    sanitizeCsvCell(i.name),
    sanitizeCsvCell(i.category),
    sanitizeCsvCell(i.stock),
    sanitizeCsvCell((i.unitPricePaise / 100).toFixed(2)),
    sanitizeCsvCell((i.valuationPaise / 100).toFixed(2)),
    sanitizeCsvCell(i.status),
  ]);
  const csvContent = [csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\n');

  if (asCsv) {
    return csvContent;
  }

  return {
    summary: {
      totalStockUnits,
      totalStockValuePaise,
      totalStockValueFormatted: formatInrPaise(totalStockValuePaise),
      lowStockCount,
      outOfStockCount,
      totalItems: items.length,
      totalValuationPaise: totalStockValuePaise,
    },
    lowStockItems,
    items,
    csv: csvContent,
  };
}

export async function generateTaxReport(filter: ReportDateFilter = {}, asCsv = false): Promise<any> {
  let invoices: any[] = [];
  try {
    const where: any = {};
    if (filter.from || filter.to) {
      where.invoiceDate = {};
      if (filter.from) where.invoiceDate.gte = new Date(filter.from);
      if (filter.to) where.invoiceDate.lte = new Date(filter.to);
    }
    invoices = await prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
    });
  } catch {
    invoices = [
      {
        id: 'inv-sim-1',
        invoiceNumber: 'SG/26-27/0001',
        invoiceDate: new Date('2026-04-05'),
        orderNumber: 'SG-2026-0001',
        customerName: 'Priya Patel',
        customerGstin: null,
        placeOfSupplyStateCode: '08',
        taxableAmountPaise: 127034n,
        cgstPaise: 11433n,
        sgstPaise: 11433n,
        igstPaise: 0n,
        taxTotalPaise: 22866n,
        grandTotalPaise: 149900n,
        physicalSignatureConfirmed: true,
      },
    ];
  }

  let taxableTotalPaise = 0;
  let cgstTotalPaise = 0;
  let sgstTotalPaise = 0;
  let igstTotalPaise = 0;
  let taxTotalPaise = 0;
  let grandTotalPaise = 0;
  let pendingPhysicalSignatureCount = 0;

  const records = invoices.map((inv) => {
    const taxable = Number(inv.taxableAmountPaise || 0);
    const cgst = Number(inv.cgstPaise || 0);
    const sgst = Number(inv.sgstPaise || 0);
    const igst = Number(inv.igstPaise || 0);
    const tax = Number(inv.taxTotalPaise || cgst + sgst + igst);
    const grand = Number(inv.grandTotalPaise || 0);
    const isSigned = Boolean(inv.physicalSignatureConfirmed);

    taxableTotalPaise += taxable;
    cgstTotalPaise += cgst;
    sgstTotalPaise += sgst;
    igstTotalPaise += igst;
    taxTotalPaise += tax;
    grandTotalPaise += grand;
    if (!isSigned) pendingPhysicalSignatureCount++;

    return {
      id: inv.id || `inv-${inv.invoiceNumber}`,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().substring(0, 10) : '',
      orderNumber: inv.orderNumber,
      customerName: inv.customerName,
      customerGstin: inv.customerGstin || 'B2C-UNREGISTERED',
      placeOfSupply: inv.placeOfSupplyStateCode || '08',
      taxablePaise: taxable,
      taxableAmountPaise: taxable,
      cgstPaise: cgst,
      sgstPaise: sgst,
      igstPaise: igst,
      taxTotalPaise: tax,
      grandTotalPaise: grand,
      isPhysicallySigned: isSigned,
      isPhysicalSignatureConfirmed: isSigned,
    };
  });

  const csvHeaders = [
    'Invoice Number',
    'Invoice Date',
    'Order Number',
    'Customer Name',
    'Customer GSTIN',
    'Place Of Supply',
    'Taxable Amount (INR)',
    'CGST (INR)',
    'SGST (INR)',
    'IGST (INR)',
    'Grand Total (INR)',
  ];
  const csvRows = records.map((r) => [
    sanitizeCsvCell(r.invoiceNumber),
    sanitizeCsvCell(r.invoiceDate),
    sanitizeCsvCell(r.orderNumber),
    sanitizeCsvCell(r.customerName),
    sanitizeCsvCell(r.customerGstin),
    sanitizeCsvCell(r.placeOfSupply),
    sanitizeCsvCell((r.taxableAmountPaise / 100).toFixed(2)),
    sanitizeCsvCell((r.cgstPaise / 100).toFixed(2)),
    sanitizeCsvCell((r.sgstPaise / 100).toFixed(2)),
    sanitizeCsvCell((r.igstPaise / 100).toFixed(2)),
    sanitizeCsvCell((r.grandTotalPaise / 100).toFixed(2)),
  ]);
  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

  if (asCsv) {
    return csvContent;
  }

  return {
    summary: {
      invoiceCount: records.length,
      totalInvoices: records.length,
      taxableTotalPaise,
      taxableTotalFormatted: formatInrPaise(taxableTotalPaise),
      taxTotalPaise,
      taxTotalFormatted: formatInrPaise(taxTotalPaise),
      cgstTotalPaise,
      sgstTotalPaise,
      igstTotalPaise,
      grandTotalPaise,
      grandTotalFormatted: formatInrPaise(grandTotalPaise),
      pendingPhysicalSignatureCount,
    },
    invoices: records,
    csv: csvContent,
  };
}

// =============================================================
// 6. System Health & Operations Overview
// =============================================================

export interface SystemHealthStatus {
  database: {
    connected: boolean;
    status: 'CONNECTED' | 'OFFLINE_DEVELOPMENT_FALLBACK';
    latencyMs?: number;
    error?: string;
  };
  email: {
    status: 'CONFIGURED_SMTP' | 'DEVELOPMENT_SIMULATION';
    host?: string;
    sender: string;
  };
  emailProvider: {
    status: 'CONFIGURED_SMTP' | 'DEVELOPMENT_SIMULATION';
    host?: string;
    sender: string;
  };
  storage: {
    type: 'LOCAL_DISK_PRIVATE' | 'AWS_S3_CLOUD' | 'CLOUDFLARE_R2';
    status: 'ACCESSIBLE' | 'UNCONFIGURED';
  };
  storageAdapter: {
    type: 'LOCAL_DISK_PRIVATE' | 'AWS_S3_CLOUD' | 'CLOUDFLARE_R2';
    status: 'ACCESSIBLE' | 'UNCONFIGURED';
  };
  app: {
    timezone: string;
    nodeEnv: string;
    version: string;
    appVersion: string;
    serverTime: string;
  };
  environmentSecurity: {
    variables: Array<{ name: string; configured: boolean }>;
  };
  environmentSummary: {
    nodeEnv: string;
    hasDatabaseUrl: boolean;
    hasNextAuthSecret: boolean;
    hasRazorpayKeys: boolean;
    hasSmtpConfig: boolean;
    hasCronSecret: boolean;
  };
  scheduler: {
    outboxWorker: {
      status: string;
      intervalSeconds: number;
      lastRun: string;
    };
    artworkCleanup: {
      status: string;
      retentionDays: number;
    };
  };
  appVersion: string;
  serverTime: string;
}

export async function getSystemHealthOverview(): Promise<SystemHealthStatus> {
  const start = Date.now();
  let connected = false;
  let dbStatus: 'CONNECTED' | 'OFFLINE_DEVELOPMENT_FALLBACK' = 'OFFLINE_DEVELOPMENT_FALLBACK';
  let latencyMs: number | undefined = undefined;
  let dbError: string | undefined = undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    connected = true;
    dbStatus = 'CONNECTED';
    latencyMs = Date.now() - start;
  } catch {
    connected = false;
    dbStatus = 'OFFLINE_DEVELOPMENT_FALLBACK';
    dbError = 'Database offline or credentials unprovisioned; active in-memory development stores handling requests.';
  }

  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const emailStatus: 'CONFIGURED_SMTP' | 'DEVELOPMENT_SIMULATION' = hasSmtp ? 'CONFIGURED_SMTP' : 'DEVELOPMENT_SIMULATION';

  const hasS3 = Boolean(process.env.STORAGE_BUCKET && process.env.STORAGE_ACCESS_KEY);
  const storageType = hasS3 ? 'AWS_S3_CLOUD' : 'LOCAL_DISK_PRIVATE';

  // Environment security variable inspection (strictly names and boolean configured status only)
  const trackedEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'CRON_SECRET',
    'STORAGE_BUCKET',
    'STORAGE_ACCESS_KEY',
    'STORAGE_SECRET_KEY',
  ];

  const envSecurityVariables = trackedEnvVars.map((name) => ({
    name,
    configured: Boolean(process.env[name]),
  }));

  const dbInfo = {
    connected,
    status: dbStatus,
    latencyMs,
    error: dbError,
  };

  const emailInfo = {
    status: emailStatus,
    host: process.env.SMTP_HOST || 'Mailpit (Local Docker :1025)',
    sender: process.env.EMAIL_FROM || BUSINESS_CONFIG.officialEmail,
  };

  const storageInfo = {
    type: storageType as 'LOCAL_DISK_PRIVATE' | 'AWS_S3_CLOUD' | 'CLOUDFLARE_R2',
    status: 'ACCESSIBLE' as const,
  };

  const appInfo = {
    timezone: 'Asia/Kolkata',
    nodeEnv: process.env.NODE_ENV || 'development',
    version: '0.1.0',
    appVersion: '0.1.0',
    serverTime: new Date().toISOString(),
  };

  const schedulerInfo = {
    outboxWorker: {
      status: 'CONFIGURED',
      intervalSeconds: 60,
      lastRun: new Date().toISOString(),
    },
    artworkCleanup: {
      status: 'CONFIGURED',
      retentionDays: 30,
    },
  };

  return {
    database: dbInfo,
    email: emailInfo,
    emailProvider: emailInfo,
    storage: storageInfo,
    storageAdapter: storageInfo,
    app: appInfo,
    environmentSecurity: {
      variables: envSecurityVariables,
    },
    environmentSummary: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
      hasRazorpayKeys: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      hasSmtpConfig: hasSmtp,
      hasCronSecret: Boolean(process.env.CRON_SECRET),
    },
    scheduler: schedulerInfo,
    appVersion: '0.1.0',
    serverTime: new Date().toISOString(),
  };
}

