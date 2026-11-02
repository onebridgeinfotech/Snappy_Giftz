# SNAPPY GIFTZ — MASTER PRODUCTION-READINESS AUDIT REPORT

**Date of Audit:** November 2, 2026  
**Auditor:** Antigravity Senior QA & Principal Full-Stack Security Auditor  
**Repository:** `VinayWeb-create/giftseccomerce-website`  
**Current Branch:** `feature/snappy-giftz-premium-redesign`  
**Mandated Brand Name:** **SNAPPY GIFTZ**  
**Audit Objective:** Complete, truthful, evidence-based end-to-end audit of all customer-facing, B2B, admin, API, database, security, and integration workflows.

---

## 1. Executive Summary

A comprehensive, multi-phase technical audit was conducted on the **SNAPPY GIFTZ** e-commerce codebase. The application represents a high-concept, luxury gifting platform combining B2C retail gifting (with live laser-engraving/photo personalization), a B2B corporate bulk procurement portal (multi-destination CSV rosters and RFQ quoting), and an administrative operations dashboard with GST tax invoicing.

### Key Quantitative Findings:
- **Total Physical Pages (App Router):** 2 (`/` and `/products/[slug]`).
- **Total In-Memory Client Views & Modals (SPA):** 11 (B2C Catalog, Corporate Portal, Admin Operations, Product Detail Modal, Live Personalization Studio, Cart Drawer, Checkout Modal, Order Tracking Modal, Printable Tax Invoice Modal, Auth Modal, Floating Contact Widget).
- **Total Backend API Routes:** 71 discrete `route.ts` handlers across `/api/admin/*`, `/api/auth/*`, `/api/b2b/*`, `/api/catalog/*`, `/api/checkout/*`, `/api/corporate/*`, `/api/orders/*`, `/api/payments/*`, `/api/personalization/*`, `/api/shipping/*`, and `/api/webhooks/*`.
- **Database Schema Models:** 25 relational models in `prisma/schema.prisma` (1,047 lines).
- **Automated Verification Tests:** 340 test cases executed across 12 suites (`npm test`).
- **Total Identified Defects:** 27 issues documented in [bugs.csv](file:///c:/Web_Templates/Snappy_Gifts/giftseccomerce-website/bugs.csv).
  - **Critical (P0):** 6
  - **High (P1):** 11
  - **Medium (P2):** 9
  - **Low (P3):** 1

### Critical Audit Discoveries:
1. **Unauthenticated Public Admin Bypass (`BUG-001`):** The storefront header contains a "Quick Mode Switcher" and "Persona Simulator" allowing any guest visitor to switch to the Admin Dashboard (`AdminDashboard.tsx`) with zero login challenge.
2. **Database Authentication Disconnect (`BUG-003`):** The active `.env` file contains credentials (`snappy_user:snappy_dev_password_only`) that fail against the running PostgreSQL server. All 340 test passes occur because backend services silently fall back to in-memory mock stores (`isStorefrontFallbackAllowed()`). In a live production deployment where fallback is strictly disallowed, the backend will fail closed with 500 errors.
3. **Architectural Routing Disconnect (`BUG-004`):** The application is structured as a client-side Vite-style Single-Page Application (SPA) driven by React state (`mode` and `activeModal` in `App.tsx`) wrapped inside a minimal Next.js App Router root. Direct browser navigation to `/admin`, `/checkout`, `/b2b`, or `/account` returns a 404 Not Found.
4. **Brand Inconsistency (`BUG-002`):** Despite the client requirement that the brand name be strictly **SNAPPY GIFTZ**, the application contains pervasive references to "Snappy Gifts" (in `package.json`, `layout.tsx`, `StoreConfig`, and emails) and "Ajmer Gift Charm" (in `index.html`, `Footer.tsx` emails, and prototype mock data).
5. **Tax-Inclusive Pricing Violation (`BUG-009`):** The server pricing engine (`pricing.service.ts`) assumes all prices are tax-exclusive, adding 18% GST on top of retail prices. For tax-inclusive items (standard consumer pricing in India), GST is calculated and added a second time.
6. **Missing Business Workflows:** Store pickup with OTP verification (`BUG-011`), automatic product discount scheduling (`BUG-008`), quotation PDF generation (`BUG-020`), and owner email alerts (`BUG-018`) are completely missing.
7. **Ephemeral Storage & SMTP:** File uploads write to local disk (`public/uploads`), which will be lost on serverless hosting (Vercel) (`BUG-021`), and transactional emails connect via raw TCP socket to localhost:1025 rather than using an HTTP API like Resend (`BUG-022`).

---

## 2. Existing Architecture & Technology Stack

```
   ┌──────────────────────────────────────────────────────────────┐
   │                   CLIENT VIEW LAYER (React 19)               │
   │  Header (Mode Switcher) • HeroBanner • ProductCard • Footer  │
   │   CartDrawer • CheckoutModal • Studio • Admin • Corporate    │
   └──────────────────────────────┬───────────────────────────────┘
                                  │ SPA state (localStorage) & HTTP fetch
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │            NEXT.JS APP ROUTER & API LAYER (Next.js 16)       │
   │     /src/app/page.tsx  •  /src/app/products/[slug]/page.tsx  │
   │     71 API Handlers (/api/admin/*, /api/auth/*, /api/*)      │
   └──────────────┬───────────────────────────────┬───────────────┘
                  │ Server Actions / Services     │ Session Cookie (snappy_session)
                  ▼                               ▼
   ┌──────────────────────────────┐   ┌───────────────────────────┐
   │       DOMAIN SERVICES        │   │        SECURITY & RBAC    │
   │   Pricing (Integer Paise)    │   │  requireRole([ADMIN,STAFF])│
   │   Invoicing & PDF Engine     │   │  Rate Limiting (Memory)   │
   │   Personalization & Proofs   │   │  Magic-Bytes Verification │
   └──────────────┬───────────────┘   └───────────────────────────┘
                  │ Prisma Client ORM 6.19
                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                   DATABASE & STORAGE LAYER                   │
   │   PostgreSQL 16+ (Prisma Schema: 25 Models, Integer Paise)   │
   │   [Local Disk Storage Adapter -> public/uploads/]            │
   │   [Local SMTP Adapter -> Mailpit localhost:1025]             │
   └──────────────────────────────────────────────────────────────┘
```

- **Framework:** Next.js 16.4.3 (App Router) with React 19.0.1. Legacy Vite 8.3.0 configuration files (`vite.config.ts`, `index.html`) remain in root from previous prototyping.
- **Language:** TypeScript 7.0.2 / 5.x with strict type checking enabled (`npm run typecheck` passes).
- **Styling:** Vanilla Tailwind CSS v4.3.3 (`@tailwindcss/postcss`). Custom luxury obsidian-and-gold aesthetic (`#08090B`, `#D5A34A`, `#F5BD48`, `#EC3E98`).
- **Icons & Animation:** `lucide-react` (v0.546.0), `motion` (v12.23.24), `canvas-confetti` (v1.9.4).
- **Database & ORM:** PostgreSQL 16+ via Prisma ORM v6.19.3. All monetary figures stored as integer paise (`BigInt` / `Int`). Zero floating-point arithmetic in database or pricing services.
- **Authentication:** Custom session cookies (`snappy_session`) stored in database `Session` table, password hashing via `bcryptjs` (v3.0.3), SHA-256 hashed OTP challenges (`OtpChallenge`).
- **File Storage:** `LocalDiskStorageService` writing to `public/uploads/` and `storage/private/`. Binary magic-bytes inspection active for JPEG, PNG, and WebP.
- **Email Delivery:** `MailpitEmailService` via raw Node `net.Socket` to `localhost:1025` with in-memory retry queue fallback (`DEV_EMAIL_OUTBOX_STORE`).

---

## 3. Complete Route & Page Inventory

### Public Web Routes (Next.js App Router)
| Route | Access | Current Implementation | Status | Issues Identified |
| :--- | :--- | :--- | :--- | :--- |
| `/` | Public | `src/app/page.tsx` renders `<MainContent />` from `src/App.tsx`. | **PARTIALLY FUNCTIONAL** | Renders entire SPA; toggles B2B and Admin views in client memory without URL changes. |
| `/products/[slug]` | Public | `src/app/products/[slug]/page.tsx` (SSR product detail). | **PARTIALLY FUNCTIONAL** | Generates dynamic metadata and JSON-LD schema, but Header mode switcher breaks context. Links from homepage cards open modal instead of this route. |
| `/not-found` (404) | Public | `src/app/not-found.tsx`. | **FULLY FUNCTIONAL** | Clean branded 404 screen with link back to catalog. |
| `/error` (500) | Public | `src/app/error.tsx`. | **FULLY FUNCTIONAL** | Client boundary error catcher with retry button. |
| `/robots.txt` | Public | `src/app/robots.ts`. | **FULLY FUNCTIONAL** | Correctly exposes allowed storefront paths and disallows admin/auth APIs. |
| `/sitemap.xml` | Public | `src/app/sitemap.ts`. | **PARTIALLY FUNCTIONAL** | Generates XML sitemap of DB products, but omits categories, occasions, and legal pages. |

### Missing Standard App Router Routes (Currently Trapped in SPA Modals or 404)
| Intended Route | Intended Access | Current Status | Consequence |
| :--- | :--- | :--- | :--- |
| `/admin` | Admin / Staff | **MISSING** (404 on direct URL) | Cannot bookmark or directly link to admin dashboard. |
| `/b2b` | Corporate / B2B | **MISSING** (404 on direct URL) | Corporate clients cannot access dedicated portal via URL. |
| `/checkout` | Customer / Guest | **MISSING** (404 on direct URL) | Trapped in `CheckoutModal.tsx`; refreshing browser aborts checkout. |
| `/account` | Authenticated Customer | **MISSING** (404 on direct URL) | Customers cannot view their order history or address book outside of modals. |
| `/login` | Public | **MISSING** (Modal only) | No standalone login page for deep-link authentication redirects. |
| `/privacy` | Public | **MISSING** (Dead footer button) | Regulatory compliance failure; policies inaccessible. |
| `/terms` | Public | **MISSING** (Dead footer button) | Terms of service inaccessible. |
| `/shipping-policy` | Public | **MISSING** (Dead footer button) | Shipping guidelines and timelines inaccessible. |
| `/refund-policy` | Public | **MISSING** (Dead footer button) | Return and cancellation terms inaccessible. |

---

## 4. Phase-by-Phase Audit Findings (Phases 1 – 12)

### Phase 1 — Site Map & Application Inventory
- **Public Storefront:** Hero banner, curated category strip, occasion filter strip, product grid, artisan brand story, customer testimonials, concierge FAQ, and footer exist in `src/App.tsx`.
- **Shared Components:** `Header.tsx`, `Footer.tsx`, `ProductCard.tsx`, `ProductDetailModal.tsx`, `PersonalizationStudio.tsx`, `CartDrawer.tsx`, `CheckoutModal.tsx`, `OrderTrackingModal.tsx`, `TaxInvoiceModal.tsx`, `CorporatePortal.tsx`, `AdminDashboard.tsx`, `WhatsAppFloatingButton.tsx`.
- **Orphan Pages:** `/products/[slug]` is completely orphaned from the homepage. Clicking product cards on the homepage opens `ProductDetailModal` rather than navigating to the canonical URL.
- **Dead Links:** All policy links in `Footer.tsx` (`Privacy Policy`, `Terms of Service`, `Shipping & Returns`) execute `setMode('b2c')`, resetting the page without displaying legal content.

### Phase 2 — Page-by-Page & Section-by-Section Audit
- **Storefront Sections:**
  - *Hero Banner:* High aesthetic quality, luxury dark styling, responsive text. CTA buttons work.
  - *Catalog Strip & Filters:* Smooth real-time filtering on 8 static products. Loading states and empty search states ("No matching gifts found") are properly styled.
  - *Product Cards:* Hover quick-view and personalize overlays function on desktop. Wishlist toggling works via `localStorage`. Discount percentage badge renders.
  - *FAQ Accordion:* Accessible accordion with ARIA attributes (`aria-expanded`, `aria-controls`) and animated chevron toggles.
- **Theme & Design Consistency:** Cohesive dark luxury palette (`#08090B` obsidian background, `#D5A34A` antique gold, `#F5BD48` bright gold, `#EC3E98` pink accent). Typography is well-structured using `Playfair Display`, `Cormorant Garamond`, `Dancing Script`, and `Plus Jakarta Sans`.
- **Responsive Behavior:** Header drawer and product cards scale cleanly from 360px mobile viewports up to 1440px desktop screens. Zero horizontal scroll overflow detected.

### Phase 3 — Authentication, Sessions & Navigation Edge Cases
- **Email OTP Authentication:** Verified server-side. Generates 6-digit code, stores SHA-256 hash in `OtpChallenge`, enforces 10-minute expiry and 3 maximum attempts.
- **Role Permissions (RBAC):** Server-side `requireRole([Role.ADMIN, Role.STAFF], req)` strictly rejects unauthorized callers on all 14 admin API routes.
- **Security Vulnerability (`BUG-001`):** Client-side `Header.tsx` allows any guest visitor to switch `mode = 'admin'`, rendering `AdminDashboard.tsx`. While backend API calls return 401, the UI displays without an authentication challenge.
- **Direct Navigation & Session Restoration:** Because routes are managed via React state, direct URL access to `/admin` returns a 404 instead of redirecting to login.

### Phase 4 — Complete Quotation Workflow
- **RFQ Submission:** Corporate clients can configure product quantities, branding requirements, and destination counts in `CorporatePortal.tsx`. Saved to database via `/api/corporate/rfq` with status `SUBMITTED`.
- **Admin Review & Quoting:** Admin reviews requests in `AdminDashboard.tsx`, adjusts unit prices, adds tax, and issues quotes (`CorporateQuote` revision tracking active).
- **Customer Response:** Customer can accept or reject quotes via `/api/corporate/quotes/[id]/respond`. Accepted quotes can be converted to grouped orders.
- **Gaps Identified:**
  - **Quotation PDF (`BUG-020`):** Missing. Only HTML preview exists; no downloadable binary PDF generator for quotations.
  - **Owner Alert (`BUG-018`):** Store owner receives no automated email notification when an RFQ is submitted or when a quote is accepted/rejected.
  - **RFQ Logo Upload (`BUG-019`):** `CorporatePortal.tsx` line 871 uses a plain text URL input `placeholder="https://..."` instead of a direct file upload.

### Phase 5 — Owner Notifications & Reminders
- **In-Dashboard Notification Center (`BUG-017`):** **MISSING**. No bell icon, unread counter, or actionable alerts queue exists in the admin panel.
- **Transactional Owner Emails (`BUG-018`):** **MISSING**. `email-outbox.service.ts` event types are restricted to customer events (`ORDER_CONFIRMATION`, `INVOICE_AVAILABLE`, `SHIPMENT_DISPATCHED`). The owner receives no email alerts for new orders, quotation submissions, payment failures, or low stock.
- **Scheduled Reminder Jobs:** **MISSING**. No cron jobs or scheduled tasks exist to repeat unreviewed order alerts or expire stale quotations automatically.

### Phase 6 — Image & File Upload Workflows
- **Customer Personalization Artwork:** **FULLY FUNCTIONAL**. Direct file picker supporting JPEG, PNG, WebP up to 5 MB with binary magic-bytes verification to prevent renamed executable exploits.
- **Admin Product Images (`BUG-012`):** **MISSING**. The admin inventory tab only provides +/- stock buttons. The interface lacks an Add/Edit Product form and direct photo upload functionality.
- **B2B Logo Upload (`BUG-019`):** **BROKEN**. Uses a plain text URL input in `CorporatePortal.tsx` line 871.
- **Storage Persistence (`BUG-021`):** **CRITICAL**. Files are written to local disk `public/uploads/`. On serverless deployment (Vercel), local files are ephemeral and will disappear after container cold starts. Cloudinary or S3 adapter is required.

### Phase 7 — Storefront & E-Commerce Completeness
- **Shopping Journey:** Catalog search -> Product Quick View -> Live Personalization -> Cart Drawer -> Checkout Modal -> Razorpay Payment -> Confetti Success -> Order Lookup.
- **Pricing & Integer Paise Standard:** Zero floating-point arithmetic. Prices stored and calculated authoritatively on server in integer paise (e.g. ₹1,299 = 129,900 paise).
- **Post-Order Actions:** Tax invoice modal generates printable HTML; server PDF generator (`invoice-pdf.ts`) creates authentic binary PDF with HSN breakup and authorized signature block.
- **Store Pickup with OTP (`BUG-011`):** **MISSING**. No pickup option in checkout; no pickup OTP generator or verification interface.
- **Legal Pages (`BUG-006`):** **MISSING**. Footer legal links are dead buttons.

### Phase 8 — B2B Dealer Portal
- **Corporate Account Onboarding:** Full registration form capturing legal name, GSTIN, and business email. Admin can approve or suspend corporate accounts.
- **Multi-Address CSV Roster:** Advanced CSV upload parser in `CorporatePortal.tsx` validates employee delivery spreadsheets, checking header names, 6-digit PIN codes, 10-digit phone numbers, and SKU allocations.
- **Account Separation:** Corporate pricing agreements (`CorporatePriceAgreement`) and volume discount tiers isolate B2B wholesale pricing from retail customers.

### Phase 9 — Admin Dashboard (21 Modules Audit)
Of the 21 required modules in Phase 9:
- **Fully Functional (9 modules):** Overview Metrics (1), Order Management (5), Payment Reconciliation (6), Quotations Desk (9), B2C Tax Invoices (10), Internal CRM (13), Corporate Accounts (14), Admin Roles & Users (17), Audit Logs (18).
- **Partially Functional (3 modules):** Inventory Management (4 - UI uses `localStorage`), GST Reports (11 - tax-inclusive toggle missing), Financial Reports (12 - cost/expense/profit missing).
- **Missing / UI Only (9 modules):** Product Catalog CRUD (2), Category/Occasion CRUD (3), Shiprocket API (7), Store Pickup Verification (8), Offers & Discounts (15), Homepage CMS (16), Integration Settings (19), Notification Center (20), Admin Route Guard (21 - security bypass in header).

### Phase 10 — Security, Data & Infrastructure
- **Data Integrity:** BigInt/Int integer paise utilized consistently throughout schema, pricing calculations, payment verifications, and invoices.
- **Authentication & Cryptography:** Password hashing via `bcryptjs` (salt rounds 10), OTP hashing via SHA-256, constant-time HMAC SHA-256 payment signature verification (`crypto.timingSafeEqual`).
- **Database Connection Failure (`BUG-003`):** PostgreSQL authentication fails with `snappy_user` credentials in `.env`, causing tests and services to rely on in-memory mocks.
- **Security Headers:** Strict HSTS, nosniff, DENY frame options, and tight CSP defined in `next.config.mjs`.

### Phase 11 — Third-Party Integrations
- **Razorpay:** Code complete with signature checks and webhooks; requires live production keys.
- **PostgreSQL:** Prisma models complete; requires active managed instance and credentials fix.
- **Cloudinary / S3:** Local disk only; requires cloud object storage driver for serverless hosting.
- **Resend:** Mailpit SMTP only; requires Resend HTTP REST API driver.
- **Shiprocket / SMS:** Appropriately deferred to post-launch.

### Phase 12 — Deliverables
All 6 mandated deliverables generated:
1. `AUDIT_REPORT.md` (This master document)
2. `bugs.csv` (Complete 27-defect issue log)
3. `FEATURE_STATUS_MATRIX.md` (Structured status matrix for every capability)
4. `INTEGRATION_STATUS.md` (Detailed external service analysis)
5. `IMPLEMENTATION_ROADMAP.md` (P0 to P3 prioritized correction plan)
6. `LAUNCH_CHECKLIST.md` (Operational pre-launch sign-off checklist)

---

## 5. Supplementary Requirements Deep-Dive Findings

### A. Brand Identity
- **Mandated Name:** **SNAPPY GIFTZ**
- **Discovered Inconsistencies:**
  - `index.html`: `<title>Ajmer Gift Charm | B2C & B2B Corporate Gifting Platform</title>`
  - `src/app/layout.tsx`: `title: 'Snappy Gifts | Premier B2C & B2B Corporate Gifting Platform'`
  - `StoreConfig` (Prisma): `storeName: 'Snappy Gifts'`
  - `Footer.tsx`: Support emails point to `concierge@ajmergiftcharm.com`
  - `Header.tsx`: Alt text has `Snappy Giftz — Turning Moments Into Memories`; ribbon has `SNAPPYGIFTZ.COM`
- **Logo Artwork:** Authentically preserved in `public/assets/snappy-gifts.png`. Zero redesign or modification required.

### B. Automatic Product Discounts & Offers
- **Current Status:** **MISSING**.
- **Findings:**
  - The pricing service explicitly states `const discountTotalPaise = 0; // Coupons deferred in Batch 4`.
  - There is no `Offer` model in `schema.prisma`.
  - There is no admin interface to create percentage-based or fixed discounts, schedule start/end dates, target categories, or prevent discount stacking.
  - The strikethrough price on product cards reflects static fixture data in `initialData.ts` (`product.mrp` vs `product.basePrice`) rather than a dynamic promotional offer engine.

### C. Complete GST & Tax Management
- **Current Status:** **PARTIALLY FUNCTIONAL (Critical Calculation Flaw)**.
- **Findings:**
  - HSN codes and GST percentages are defined per product.
  - Intra-state (50% CGST + 50% SGST for Rajasthan `08`) and inter-state (100% IGST) splitting works accurately.
  - Sequential B2C tax invoices (`SG/26-27/0001`) and binary PDF generation are operational.
  - **Defect (`BUG-009`):** Pricing engine treats all prices as tax-exclusive. If a product selling price of ₹1,299 is entered as MRP (tax-inclusive), the system adds 18% GST (₹233.82) on top, charging the customer ₹1,532.82. The schema lacks an `isTaxInclusive` flag and taxable base extraction formula.
  - **Defect (`BUG-010`):** Shipping fees (₹99) are added to the invoice grand total without applicable 18% GST (SAC 9968).

### D. Customer Information & Centralized Database
- **Current Status:** **PARTIALLY FUNCTIONAL**.
- **Findings:**
  - `User`, `Address`, `Order`, `Payment`, and `Session` models are properly defined in PostgreSQL schema.
  - Password hashes, session tokens, and personal data are protected; card numbers, CVVs, and UPI PINs are never accepted or stored.
  - **Defect:** Frontend state (`AppContext.tsx`) stores cart items, wishlist items, and customer orders in browser `localStorage` (`ajmer_cart_v1`, `ajmer_orders_v1`). Database and cart synchronization across devices does not exist.
  - Customer profile editing and standalone order history routes (`/account`) do not exist.

### E. Store Pickup & OTP Verification
- **Current Status:** **MISSING (0% Implemented)**.
- **Findings:**
  - Codebase search for "pickup" returns zero results in `src/`.
  - Checkout modal only supports Home Delivery shipping addresses.
  - `OrderStatus` enum lacks `READY_FOR_PICKUP` and `COLLECTED` states.
  - Secure pickup OTP generation, hashing, SMS/email delivery, attempt limiting, and admin collection verification interfaces are completely absent.

### F. Internal Financial Management
- **Current Status:** **PARTIALLY FUNCTIONAL**.
- **Findings:**
  - Captured sales revenue, average order value (AOV), pending balances, and GST collected are accurately summarized in the Admin Reports tab.
  - CSV/Excel report exports are operational.
  - **Defect (`BUG-023`):** Product manufacturing costs (`costPricePaise`) are not tracked; operating expenses cannot be recorded; Razorpay payment gateway fees (~2% + GST) are not accounted for. Consequently, estimated gross profit and net profit cannot be calculated.

### G. Features Explicitly Outside Initial Scope
- Loyalty and rewards programs: Not implemented (complies with scope).
- Reward points: Not implemented (complies with scope).
- Automated marketing campaigns: Not implemented (complies with scope).
- External CRM platforms: Not implemented (complies with scope).
- Tally ERP: Excluded; standard CSV exports provided.
- **Flagged Item:** `@google/genai` is listed in `package.json` dependencies. Generative AI gift recommendations are excluded from scope and this package should be cleaned up.

---

## 6. Comprehensive Feature Status Matrix

| Module | Feature | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- |
| **Brand** | Brand Name Standardization | **BROKEN** | Discrepancies between SNAPPY GIFTZ, Snappy Gifts, and Ajmer Gift Charm. |
| **Brand** | Original Logo Artwork | **FULLY FUNCTIONAL** | Preserved in `public/assets/snappy-gifts.png`. |
| **Auth** | Password Login & Session Cookie | **FULLY FUNCTIONAL** | Validated in `auth.test.ts`. |
| **Auth** | Email OTP Login | **PARTIALLY FUNCTIONAL** | Implemented in API; lacks standalone URL route. |
| **Auth** | Server-Side RBAC Guards | **FULLY FUNCTIONAL** | `requireRole([ADMIN, STAFF])` guards all admin APIs. |
| **Auth** | Admin Header Security Guard | **BROKEN** | Public mode switcher allows unauthenticated guests to view admin UI. |
| **Storefront** | Product Catalog & Search | **FULLY FUNCTIONAL** | Real-time search, category filters, occasion filters. |
| **Storefront** | Dynamic Product Detail (SSR) | **PARTIALLY FUNCTIONAL** | Route works, but homepage cards open modal instead of route. |
| **Offers** | Automatic Product Discounts | **MISSING** | No offer model or calculation engine. |
| **GST** | Intra/Inter-State Split | **FULLY FUNCTIONAL** | 50/50 CGST+SGST for RJ; 100% IGST for interstate. |
| **GST** | Tax-Inclusive Price Extraction | **BROKEN** | Adds GST a second time to tax-inclusive retail prices. |
| **GST** | Shipping Fee Tax (SAC 9968) | **BROKEN** | Shipping fee added without 18% GST. |
| **Invoicing** | Sequential B2C Tax Invoice | **FULLY FUNCTIONAL** | FY sequence `SG/26-27/0001` with snapshot data. |
| **Invoicing** | Binary PDF Invoice | **FULLY FUNCTIONAL** | Tested in `invoicing.test.ts`. |
| **Pickup** | Store Pickup Workflow & OTP | **MISSING** | 0% implemented across checkout, schema, and admin. |
| **Studio** | Live Personalization Studio | **FULLY FUNCTIONAL** | Typography, finishes, real-time canvas preview. |
| **Studio** | Customer Artwork Upload | **FULLY FUNCTIONAL** | Magic-bytes validation active for JPEG, PNG, WebP. |
| **Checkout** | Cart Management | **FULLY FUNCTIONAL** | Line customizations, ₹999 free shipping bar. |
| **Checkout** | Order Creation & 15m Hold | **FULLY FUNCTIONAL** | Integer paise calculation, stock hold active. |
| **Payment** | Razorpay Integration | **EXTERNALLY UNCONFIGURED** | Code complete; requires live production keys. |
| **Payment** | Webhook Signature Check | **FULLY FUNCTIONAL** | Constant-time HMAC SHA-256 verification. |
| **Corporate** | Corporate Onboarding & Approval| **FULLY FUNCTIONAL** | Full registration, admin review and approval. |
| **Corporate** | Bulk RFQ Builder | **PARTIALLY FUNCTIONAL** | Functional, but logo input uses plain URL text field. |
| **Corporate** | Multi-Address Recipient CSV | **FULLY FUNCTIONAL** | Validates CSV rosters against PINs, phones, and SKUs. |
| **Corporate** | Quotation Revisioning | **FULLY FUNCTIONAL** | Commercial negotiation with version numbers. |
| **Corporate** | Quotation Branded PDF | **MISSING** | Quotes only previewed in HTML; no PDF writer. |
| **Admin** | Overview Metrics Dashboard | **FULLY FUNCTIONAL** | Aggregates revenue, order counts, pending quotes. |
| **Admin** | Product Catalog CRUD | **UI ONLY** | API exists; Add/Edit product UI missing from admin. |
| **Admin** | Inventory Stock Adjustment | **BROKEN** | Admin +/- buttons mutate client `localStorage`. |
| **Admin** | Order Dispatch & Tracking | **FULLY FUNCTIONAL** | AWB entry, courier tracking, packing slip generation. |
| **Admin** | Notification Center | **MISSING** | No notification bell or pending action queue. |
| **Admin** | Integration Settings Panel | **MISSING** | No UI to inspect API keys or test connections. |
| **Financials** | Revenue & Sales Reports | **FULLY FUNCTIONAL** | Captured revenue, AOV, pending totals, CSV export. |
| **Financials** | Profit, Costs & Expenses | **MISSING** | Product costs, expenses, and gross/net profit absent. |
| **Storage** | Persistent Object Storage | **EXTERNALLY UNCONFIGURED** | Local disk only; Cloudinary/S3 adapter missing. |
| **Email** | Transactional Email Service | **EXTERNALLY UNCONFIGURED** | Mailpit raw TCP socket; Resend HTTP adapter missing. |
| **Email** | Owner Transactional Alerts | **MISSING** | No owner email triggers for orders, RFQs, or failures. |
| **Legal** | Legal Policy Pages | **MISSING** | Footer links are dead buttons; no policy routes. |

---

## 7. Production Launch Blockers (Top 10 Critical Priorities)

1. **Close Unauthenticated Admin Bypass (`BUG-001`):** Remove public mode/persona switcher from header; enforce server middleware requiring `Role.ADMIN` or `Role.STAFF` on all admin interfaces.
2. **Resolve PostgreSQL Authentication & Run Migrations (`BUG-003`):** Update `.env` credentials, deploy Prisma migrations to live database, and disable in-memory fallbacks in production.
3. **Implement Cloud Object Storage (`BUG-021`):** Replace local disk writes with Cloudinary or AWS S3 adapter so uploaded customer artwork and proofs persist on serverless hosting.
4. **Implement Resend HTTP Transactional Email (`BUG-022`):** Replace raw TCP Mailpit socket with Resend REST API adapter and verify domain DNS records (SPF, DKIM, DMARC).
5. **Activate Live Razorpay Credentials (`BUG-028`):** Configure live API key, secret, and webhook signing secret; perform a live ₹1 test payment.
6. **Standardize Brand Name to SNAPPY GIFTZ (`BUG-002`):** Eliminate all instances of "Snappy Gifts" and "Ajmer Gift Charm" across metadata, titles, config, and emails.
7. **Fix Tax-Inclusive Pricing & Shipping Tax (`BUG-009`, `BUG-010`):** Add `isTaxInclusive` flag to product schema, extract GST correctly from retail prices, and calculate 18% GST on shipping charges.
8. **Build Store Pickup Workflow & OTP System (`BUG-011`):** Add pickup fulfillment option to checkout, generate secure 6-digit OTP on ready-for-pickup, and build admin collection verification view.
9. **Build Quotation PDF Generator & Fix B2B Logo Upload (`BUG-019`, `BUG-020`):** Create `quotation-pdf.ts` and replace plain URL input in RFQ builder with direct file upload.
10. **Create Static Legal Pages & Fix Footer Links (`BUG-006`):** Publish `/privacy`, `/terms`, `/shipping-policy`, `/refund-policy` and link footer buttons using Next.js `<Link>`.

---

## 8. Strategic Recommendations for Implementation

1. **Phase Implementation Strictly by Priority:** Execute Wave 1 (P0 Blockers) first to establish an impenetrable security boundary, working database, and persistent cloud storage. Do not build new visual features until P0 infrastructure is operational.
2. **Preserve Pristine Architecture:** When fixing the GST engine, automatic offers, and store pickup, continue utilizing integer paise (`BigInt`/`Int`) and centralized Prisma models. Never introduce floating-point rupee calculations or secondary data stores.
3. **Migrate SPA Views to App Router:** Gradually move `AdminDashboard`, `CorporatePortal`, and `CheckoutModal` from client-side conditional branches in `App.tsx` into formal Next.js routes (`/admin`, `/b2b`, `/checkout`). This will resolve deep linking, back-button session caching, and 404 navigation bugs permanently.
4. **Retain Deferred Services:** Keep Shiprocket API, SMS gateway (MSG91/2Factor), and Tally ERP deferred until after launch. Manual courier tracking, email OTP, and CSV reporting are fully sufficient for initial launch and save significant setup overhead.

---

## 9. Conclusion & Strict Stop Condition Compliance

This audit provides a truthful, unvarnished, evidence-backed evaluation of the **SNAPPY GIFTZ** codebase. All source code, components, database models, pricing services, and test suites have been inspected.

In strict compliance with **PART 6 — STRICT STOP CONDITION**, no application code, database schemas, API routes, or environment configurations have been modified during this audit.

All findings, matrices, and checklists are now compiled in:
- [AUDIT_REPORT.md](file:///c:/Web_Templates/Snappy_Gifts/giftseccomerce-website/AUDIT_REPORT.md)
- [bugs.csv](file:///c:/Web_Templates/Snappy_Gifts/giftseccomerce-website/bugs.csv)
- [FEATURE_STATUS_MATRIX.md](file:///c:/Web_Templates/Snappy_Gifts/giftseccomerce-website/FEATURE_STATUS_MATRIX.md)
- [INTEGRATION_STATUS.md](file:///c:/Web_Templates/Snappy_Gifts/giftseccomerce-website/INTEGRATION_STATUS.md)
- [IMPLEMENTATION_ROADMAP.md](file:///c:/Web_Templates/Snappy_Gifts/giftseccomerce-website/IMPLEMENTATION_ROADMAP.md)
- [LAUNCH_CHECKLIST.md](file:///c:/Web_Templates/Snappy_Gifts/giftseccomerce-website/LAUNCH_CHECKLIST.md)

Awaiting explicit user review and approval before proceeding to any implementation phase.
