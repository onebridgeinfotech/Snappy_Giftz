'use client';

/**
 * Admin portal shell + overview widgets (light content area with a dark sidebar).
 * Pure presentational components: AdminDashboard owns all state and data loading.
 */
import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  Users,
  Tag,
  BarChart3,
  FileText,
  Activity,
  Settings,
  ShieldAlert,
  Building2,
  Mail,
  ShieldCheck,
  Headphones,
  Store,
  ExternalLink,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  Crown,
  Menu,
  X,
  Plus,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Box,
  Zap,
  AlertTriangle,
  ArrowRight,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Landmark,
  Newspaper,
} from 'lucide-react';

export type AdminNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

/** Sidebar (left) — the main admin sections. */
export const ADMIN_PRIMARY_NAV: AdminNavItem[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders & Fulfillment', icon: ShoppingCart },
  { id: 'inventory', label: 'Products & Catalog', icon: Package },
  { id: 'categories', label: 'Categories & Occasions', icon: Layers },
  { id: 'content', label: 'Content & SEO', icon: Newspaper },
  { id: 'users', label: 'Customers & Staff', icon: Users },
  { id: 'offers', label: 'Offers & Coupons', icon: Tag },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'pricing', label: 'Tax & Delivery', icon: Truck },
  { id: 'seller-config', label: 'GST & Billing', icon: FileText },
  { id: 'operations', label: 'Operations & Health', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/** Secondary sections, shown under "More" in the sidebar. */
export const ADMIN_SECONDARY_NAV: AdminNavItem[] = [
  { id: 'damage-reports', label: 'Damage Claims', icon: ShieldAlert },
  { id: 'email-outbox', label: 'Email Outbox', icon: Mail },
  { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
  { id: 'tickets', label: 'Support', icon: Headphones },
  { id: 'quotations', label: 'Corporate & Quotes', icon: Building2 },
];

/** Section tiles under the KPI cards. */
export const ADMIN_SECTION_TILES: AdminNavItem[] = [
  { id: 'overview', label: 'Overview & KPIs', icon: BarChart3 },
  { id: 'orders', label: 'Orders & Fulfillment', icon: ShoppingCart },
  { id: 'inventory', label: 'Products & Offers', icon: Box },
  { id: 'categories', label: 'Categories & Occasions', icon: Layers },
  { id: 'users', label: 'Customers & Staff', icon: Users },
  { id: 'damage-reports', label: 'Damage Claims', icon: ShieldAlert },
  { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
  { id: 'pricing', label: 'Tax & Delivery', icon: Truck },
  { id: 'settings', label: 'Business Settings', icon: Settings },
  { id: 'seller-config', label: 'GST & Seller Setup', icon: Landmark },
  { id: 'email-outbox', label: 'Email Outbox', icon: Mail },
  { id: 'tickets', label: 'Support', icon: Headphones },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function SidebarContent({
  active,
  onSelect,
  badges,
}: {
  active: string;
  onSelect: (id: string) => void;
  badges?: Record<string, number>;
}) {
  const item = (n: AdminNavItem) => {
    const Icon = n.icon;
    const isActive = active === n.id;
    const badge = badges?.[n.id];
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => onSelect(n.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13.5px] font-medium transition-all cursor-pointer ${
          isActive
            ? 'bg-gradient-to-r from-[#F5BD48] to-[#E5A93C] text-[#111215] font-bold shadow-[0_6px_18px_rgba(245,189,72,0.35)]'
            : 'text-[#D7DBE3] hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[#111215]' : 'text-[#C9CDD6]'}`} />
        <span className="flex-1 text-left truncate">{n.label}</span>
        {badge ? (
          <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${isActive ? 'bg-[#111215] text-[#F5BD48]' : 'bg-[#F5BD48] text-[#111215]'}`}>
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col px-3 py-5">
      <a href="/" className="flex justify-center mb-4" aria-label="SNAPPY GIFTZ storefront">
        <img src="/assets/snappy-gifts.png" alt="SNAPPY GIFTZ" className="h-14 w-auto object-contain" />
      </a>
      <div className="mx-auto mb-5 inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#F5BD48]/40 bg-white/[0.03] text-[#F5BD48] text-[13px] font-semibold">
        <Crown className="w-4 h-4" />
        <span>Admin Portal</span>
      </div>

      <nav className="space-y-1 flex-1 overflow-y-auto no-scrollbar" aria-label="Admin sections">
        {ADMIN_PRIMARY_NAV.map(item)}
        <div className="pt-4 pb-1.5 px-4 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#7C8290]">More</div>
        {ADMIN_SECONDARY_NAV.map(item)}
      </nav>

      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-white/15 text-[#D7DBE3] hover:text-white hover:border-[#F5BD48]/50 text-sm font-medium transition-all"
      >
        <span className="flex items-center gap-2.5">
          <Store className="w-4 h-4" />
          Storefront
        </span>
        <ExternalLink className="w-4 h-4 opacity-70" />
      </a>

      {/* Ambient gold glow, like the design's sidebar art */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-[radial-gradient(ellipse_at_bottom_left,rgba(245,189,72,0.18),transparent_70%)]" />
    </div>
  );
}

export function AdminSidebar({
  active,
  onSelect,
  badges,
  mobileOpen,
  onCloseMobile,
}: {
  active: string;
  onSelect: (id: string) => void;
  badges?: Record<string, number>;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-[#121316] border-r border-white/5 z-30 overflow-hidden">
        <SidebarContent active={active} onSelect={onSelect} badges={badges} />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#121316] shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent
              active={active}
              badges={badges}
              onSelect={(id) => {
                onSelect(id);
                onCloseMobile();
              }}
            />
          </aside>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

export function AdminTopBar({
  onOpenMenu,
  onSearch,
  attentionCount,
  onOpenAttention,
  userName,
  userRole,
  onLogout,
}: {
  onOpenMenu: () => void;
  onSearch: (query: string) => void;
  attentionCount: number;
  onOpenAttention: () => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
}) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const initial = (userName || 'A').trim().charAt(0).toUpperCase();
  const roleLabel = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' ? 'Super Admin' : userRole === 'STAFF' ? 'Staff' : userRole;

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#ECEDF2]">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-[68px]">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="lg:hidden w-10 h-10 rounded-xl border border-[#E5E7EB] text-[#111215] flex items-center justify-center"
        >
          <Menu className="w-5 h-5" />
        </button>

        <form
          className="relative flex-1 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) onSearch(query.trim());
          }}
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders, customers, phone, AWB..."
            aria-label="Search orders"
            className="w-full h-11 pl-11 pr-20 rounded-full border border-[#E5E7EB] bg-white text-sm text-[#111215] placeholder:text-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#F5BD48]/50 focus:border-[#F5BD48]"
          />
          <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[11px] font-semibold text-[#4B5563]">
            Ctrl + K
          </kbd>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            onClick={onOpenAttention}
            aria-label={`${attentionCount} items need attention`}
            title="Items that need your attention"
            className="relative w-10 h-10 rounded-full hover:bg-[#F3F4F6] text-[#111215] flex items-center justify-center"
          >
            <Bell className="w-5 h-5" />
            {attentionCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center">
                {attentionCount > 99 ? '99+' : attentionCount}
              </span>
            )}
          </button>
          <a
            href="mailto:info@snappygiftz.com?subject=Admin%20portal%20help"
            aria-label="Help"
            title="Help"
            className="hidden sm:flex w-10 h-10 rounded-full hover:bg-[#F3F4F6] text-[#111215] items-center justify-center"
          >
            <HelpCircle className="w-5 h-5" />
          </a>

          <div className="relative pl-1 sm:pl-3 sm:border-l border-[#ECEDF2]">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              className="flex items-center gap-2.5 rounded-full pr-1 cursor-pointer"
            >
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F5BD48] to-[#E5A93C] text-[#111215] font-bold flex items-center justify-center">
                {initial}
              </span>
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-sm font-bold text-[#111215] max-w-[160px] truncate">{userName}</span>
                <span className="block text-xs text-[#6B7280]">{roleLabel}</span>
              </span>
              <ChevronDown className="hidden md:block w-4 h-4 text-[#111215]" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-[#ECEDF2] shadow-lg py-1 text-sm">
                <a href="/" className="block px-4 py-2 text-[#111215] hover:bg-[#F9FAFB]">View storefront</a>
                <button type="button" onClick={onLogout} className="w-full text-left px-4 py-2 text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------------

type Tone = 'amber' | 'violet' | 'blue' | 'green';
const TONES: Record<Tone, { card: string; icon: string }> = {
  amber: { card: 'bg-gradient-to-br from-[#FFF8EA] to-white border-[#F8E7C3]', icon: 'bg-[#FDEFD0] text-[#D99A1E]' },
  violet: { card: 'bg-gradient-to-br from-[#F6F1FF] to-white border-[#E7DCFB]', icon: 'bg-[#EDE3FE] text-[#7C3AED]' },
  blue: { card: 'bg-gradient-to-br from-[#EEF5FF] to-white border-[#D9E7FB]', icon: 'bg-[#DFEBFE] text-[#2563EB]' },
  green: { card: 'bg-gradient-to-br from-[#EEFBF3] to-white border-[#D3F1DF]', icon: 'bg-[#D9F5E4] text-[#16A34A]' },
};

export function KpiCard({
  title,
  value,
  changePct,
  icon: Icon,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  changePct: number | null | undefined;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  onClick?: () => void;
}) {
  const t = TONES[tone];
  const up = (changePct ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full rounded-2xl border ${t.card} p-4 sm:p-5 flex items-center gap-4 shadow-[0_2px_10px_rgba(17,18,21,0.04)] hover:shadow-[0_6px_20px_rgba(17,18,21,0.08)] transition-all cursor-pointer`}
    >
      <span className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${t.icon} flex items-center justify-center shrink-0`}>
        <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-semibold text-[#374151]">{title}</span>
        <span className="block text-2xl sm:text-[28px] font-extrabold text-[#111215] tracking-tight truncate">{value}</span>
      </span>
      <span className="flex flex-col items-end gap-1 shrink-0">
        {typeof changePct === 'number' ? (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
              up ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'
            }`}
          >
            {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {up ? '+' : ''}
            {changePct}%
          </span>
        ) : (
          <span className="inline-flex px-2 py-1 rounded-full text-[11px] font-bold bg-[#F3F4F6] text-[#4B5563]">New</span>
        )}
        <span className="text-[10.5px] text-[#6B7280] whitespace-nowrap">vs. last 7 days</span>
      </span>
    </button>
  );
}

export const KpiIcons = { ShoppingCart, Package, Users, IndianRupee };

// ---------------------------------------------------------------------------
// Section tiles
// ---------------------------------------------------------------------------

export function SectionTiles({
  active,
  onSelect,
  items = ADMIN_SECTION_TILES,
}: {
  active: string;
  onSelect: (id: string) => void;
  items?: AdminNavItem[];
}) {
  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
      <div className="flex gap-3 w-max min-w-full">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-[112px] max-w-[150px] h-[92px] rounded-2xl border flex flex-col items-center justify-center gap-2 px-2 text-center text-[12.5px] font-semibold leading-tight transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-b from-[#FBD27A] to-[#F5BD48] border-[#F5BD48] text-[#111215] shadow-[0_8px_22px_rgba(245,189,72,0.35)]'
                  : 'bg-white border-[#ECEDF2] text-[#111215] hover:border-[#F5BD48]/60 hover:shadow-[0_6px_16px_rgba(17,18,21,0.06)]'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'text-[#8A5A00]' : 'text-[#111215]'}`} />
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export function WidgetCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white border border-[#ECEDF2] shadow-[0_2px_10px_rgba(17,18,21,0.04)] p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <Icon className="w-6 h-6 text-[#E5A93C] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#111215] leading-tight">{title}</h3>
            {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export const WidgetIcons = { BarChart3, Box, Zap, ShoppingCart, AlertTriangle };

export function LinkPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#F5BD48]/60 text-[#8A5A00] text-xs font-semibold hover:bg-[#FFF8EA] transition-colors cursor-pointer"
    >
      {label}
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Order trends (SVG area chart)
// ---------------------------------------------------------------------------

export function OrderTrendsChart({
  data,
}: {
  data: Array<{ label: string; orders: number; revenuePaise: number }>;
}) {
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders');
  const values = data.map((d) => (metric === 'orders' ? d.orders : Math.round(d.revenuePaise / 100)));
  const max = Math.max(1, ...values);
  const niceMax = useMemo(() => {
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const steps = [1, 2, 2.5, 5, 10];
    for (const s of steps) if (s * pow >= max) return s * pow;
    return 10 * pow;
  }, [max]);

  const W = 560;
  const H = 210;
  const padL = 44;
  const padR = 16;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const y = (v: number) => padT + innerH - (v / niceMax) * innerH;
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0][0].toFixed(1)},${(padT + innerH).toFixed(1)} Z` : '';
  // Whole-number grid values with no repeats (small counts like max=1 would otherwise round to 0,0,1,1,1).
  const ticks = Array.from(new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f))));
  const fmt = (v: number) => (metric === 'revenue' ? (v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${v}`) : String(v));
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <WidgetCard
      title="Order Trends"
      subtitle={metric === 'orders' ? `${total} orders in the last 7 days` : `₹${total.toLocaleString('en-IN')} captured in the last 7 days`}
      icon={BarChart3}
      action={
        <div className="flex p-1 rounded-full bg-[#F3F4F6] text-xs font-semibold shrink-0" role="group" aria-label="Chart metric">
          {(['orders', 'revenue'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={`px-3.5 py-1.5 rounded-full capitalize transition-all cursor-pointer ${
                metric === m ? 'bg-gradient-to-r from-[#FBD27A] to-[#F5BD48] text-[#111215] shadow-sm' : 'text-[#374151]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${metric} per day for the last 7 days`}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5BD48" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F5BD48" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={`tick-${t}`}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#EEF0F3" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6B7280">
              {fmt(t)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill="url(#trendFill)" />}
        {line && <path d={line} fill="none" stroke="#F5BD48" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r="5" fill="#fff" stroke="#F5BD48" strokeWidth="2.5">
              <title>{`${data[i].label}: ${fmt(values[i])}`}</title>
            </circle>
            <text x={px} y={H - 8} textAnchor="middle" fontSize="11.5" fill="#374151">
              {data[i].label}
            </text>
          </g>
        ))}
      </svg>
    </WidgetCard>
  );
}

// ---------------------------------------------------------------------------
// Order status donut
// ---------------------------------------------------------------------------

export function OrderStatusDonut({
  breakdown,
}: {
  breakdown: { delivered: number; inTransit: number; processing: number; pending: number; cancelled: number };
}) {
  const segments = [
    { key: 'delivered', label: 'Delivered', value: breakdown.delivered, color: '#22C55E', icon: CheckCircle2 },
    { key: 'inTransit', label: 'In Transit', value: breakdown.inTransit, color: '#3B82F6', icon: Truck },
    { key: 'processing', label: 'Processing', value: breakdown.processing, color: '#F5BD48', icon: Clock },
    { key: 'pending', label: 'Pending', value: breakdown.pending, color: '#A78BFA', icon: Clock },
    { key: 'cancelled', label: 'Cancelled', value: breakdown.cancelled, color: '#EF4444', icon: XCircle },
  ];
  const total = segments.reduce((a, s) => a + s.value, 0);
  const R = 62;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <WidgetCard title="Order Status" subtitle={`${total.toLocaleString('en-IN')} total orders`} icon={Box}>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0 -rotate-90" role="img" aria-label="Orders by status">
          <circle cx="80" cy="80" r={R} fill="none" stroke="#F3F4F6" strokeWidth="22" />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const len = (s.value / total) * C;
                const el = (
                  <circle
                    key={s.key}
                    cx="80"
                    cy="80"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="22"
                    strokeDasharray={`${Math.max(len - 2, 0.5)} ${C}`}
                    strokeDashoffset={-offset}
                  >
                    <title>{`${s.label}: ${s.value}`}</title>
                  </circle>
                );
                offset += len;
                return el;
              })}
          <g className="rotate-90 origin-center">
            <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="800" fill="#111215">
              {total.toLocaleString('en-IN')}
            </text>
            <text x="80" y="97" textAnchor="middle" fontSize="11" fill="#374151">
              Orders
            </text>
          </g>
        </svg>
        <ul className="flex-1 w-full space-y-2.5 text-sm">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1 text-[#111215]">{s.label}</span>
              <span className="text-[#374151] tabular-nums">
                {total ? Math.round((s.value / total) * 100) : 0}% ({s.value})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetCard>
  );
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

export function QuickActions({
  actions,
}: {
  actions: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; primary?: boolean }>;
}) {
  return (
    <WidgetCard title="Quick Actions" icon={Zap}>
      <div className="space-y-2.5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                a.primary
                  ? 'bg-[#FFF3D6] border-[#F8DFA3] text-[#111215] hover:bg-[#FDEBC2]'
                  : 'bg-white border-[#ECEDF2] text-[#111215] hover:border-[#F5BD48]/60 hover:bg-[#FFFCF5]'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}

export const QuickActionIcons = { Plus, Tag, ShoppingCart, BarChart3, Truck };

// ---------------------------------------------------------------------------
// Recent orders
// ---------------------------------------------------------------------------

const AVATAR_COLORS = ['bg-[#FDEFD0] text-[#B7791F]', 'bg-[#FCE7F3] text-[#BE185D]', 'bg-[#FEE2E2] text-[#B91C1C]', 'bg-[#DBEAFE] text-[#1D4ED8]', 'bg-[#DCFCE7] text-[#15803D]'];

function initials(name: string) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function statusBadge(status: string) {
  const st = String(status || '').toUpperCase();
  if (st === 'DELIVERED') return { label: 'Delivered', cls: 'bg-[#DCFCE7] text-[#15803D]', icon: CheckCircle2 };
  if (st === 'DISPATCHED' || st === 'OUT_FOR_DELIVERY') return { label: 'In Transit', cls: 'bg-[#DBEAFE] text-[#1D4ED8]', icon: Truck };
  if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(st)) return { label: st.charAt(0) + st.slice(1).toLowerCase(), cls: 'bg-[#FEE2E2] text-[#B91C1C]', icon: XCircle };
  if (['CONFIRMED', 'PROCESSING', 'IN_CUSTOMIZATION', 'QUALITY_CHECK'].includes(st)) return { label: 'Processing', cls: 'bg-[#FEF3C7] text-[#92400E]', icon: Clock };
  return { label: 'Pending', cls: 'bg-[#EDE9FE] text-[#6D28D9]', icon: Clock };
}

function paymentBadge(paymentStatus: string, paymentMethod: string) {
  const ps = String(paymentStatus || '').toUpperCase();
  if (ps === 'CAPTURED' || ps === 'PAID') return { label: 'Paid', cls: 'bg-[#DCFCE7] text-[#15803D]' };
  if (String(paymentMethod || '').toUpperCase() === 'COD') return { label: 'COD', cls: 'bg-[#F3F4F6] text-[#374151]' };
  if (ps === 'FAILED') return { label: 'Failed', cls: 'bg-[#FEE2E2] text-[#B91C1C]' };
  if (ps === 'REFUNDED' || ps === 'PARTIALLY_REFUNDED') return { label: 'Refunded', cls: 'bg-[#F3F4F6] text-[#374151]' };
  return { label: 'Unpaid', cls: 'bg-[#FEF3C7] text-[#92400E]' };
}

export function RecentOrdersTable({
  orders,
  onViewAll,
  onOpenOrder,
}: {
  orders: any[];
  onViewAll: () => void;
  onOpenOrder: (orderId: string) => void;
}) {
  return (
    <WidgetCard
      title="Recent Orders"
      subtitle="Latest orders from your store"
      icon={ShoppingCart}
      action={<LinkPill label="View All Orders" onClick={onViewAll} />}
    >
      {orders.length === 0 ? (
        <p className="text-sm text-[#6B7280] py-6 text-center">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-[#F9FAFB] text-left text-[13px] text-[#111215]">
                <th className="px-3 py-2.5 font-semibold rounded-l-lg">Order #</th>
                <th className="px-3 py-2.5 font-semibold">Customer</th>
                <th className="px-3 py-2.5 font-semibold">Items</th>
                <th className="px-3 py-2.5 font-semibold">Amount</th>
                <th className="px-3 py-2.5 font-semibold">Payment</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold rounded-r-lg">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, idx) => {
                const sb = statusBadge(o.orderStatus);
                const pb = paymentBadge(o.paymentStatus, o.paymentMethod);
                const SIcon = sb.icon;
                return (
                  <tr
                    key={o.id}
                    onClick={() => onOpenOrder(o.id)}
                    className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FFFCF5] cursor-pointer"
                  >
                    <td className="px-3 py-3 font-medium text-[#111215] whitespace-nowrap">{o.orderNumber}</td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2.5">
                        <span className={`w-8 h-8 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                          {initials(o.customerName)}
                        </span>
                        <span className="text-[#111215] truncate max-w-[160px]">{o.customerName}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#111215] whitespace-nowrap">
                      {o.itemsCount || 0} {o.itemsCount === 1 ? 'item' : 'items'}
                    </td>
                    <td className="px-3 py-3 font-medium text-[#111215] whitespace-nowrap">
                      ₹{(Number(o.grandTotalPaise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${pb.cls}`}>{pb.label}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${sb.cls}`}>
                        <SIcon className="w-3.5 h-3.5" />
                        {sb.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#111215] whitespace-nowrap">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}

// ---------------------------------------------------------------------------
// Inventory alerts
// ---------------------------------------------------------------------------

export function InventoryAlerts({ alerts, onViewAll }: { alerts: any[]; onViewAll: () => void }) {
  return (
    <WidgetCard
      title="Inventory Alerts"
      subtitle={alerts.length ? `${alerts.length} ${alerts.length === 1 ? 'item needs' : 'items need'} your attention` : 'All products are well stocked'}
      icon={AlertTriangle}
      action={<LinkPill label="View All" onClick={onViewAll} />}
    >
      {alerts.length === 0 ? (
        <p className="text-sm text-[#6B7280] py-6 text-center">No low-stock products right now.</p>
      ) : (
        <ul className="divide-y divide-[#F3F4F6]">
          {alerts.slice(0, 4).map((a) => {
            const out = a.status === 'OUT_OF_STOCK' || a.stock <= 0;
            return (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="w-14 h-14 rounded-xl bg-[#F3F4F6] overflow-hidden shrink-0 flex items-center justify-center">
                  {a.imageUrl ? (
                    <img src={a.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Package className="w-6 h-6 text-[#9CA3AF]" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-[#111215] truncate capitalize">{a.name}</span>
                  <span className="block text-sm text-[#DC2626]">{out ? 'Out of stock' : `Only ${a.stock} left in stock`}</span>
                </span>
                <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${out ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#FFE4E6] text-[#E11D48]'}`}>
                  {out ? 'Out of Stock' : 'Low Stock'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
