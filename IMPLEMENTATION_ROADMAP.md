# SNAPPY GIFTZ — Prioritized Implementation Roadmap

This roadmap establishes the precise, phased execution plan to resolve all defects identified in the master audit and bring **SNAPPY GIFTZ** to complete, secure production readiness.

---

## Priority Classifications

- **P0 — Critical Launch Blockers:** Security vulnerabilities, payment failures, data integrity risks, or hosting blockers that must be resolved before any public access or transaction can occur.
- **P1 — Essential Business Functionality:** Core workflows required for daily retail and corporate operations (brand consistency, discounts, GST correctness, store pickup, quotation PDFs, owner alerts).
- **P2 — Operational & Management Improvements:** Enhancements that streamline back-office administration, inventory cataloging, content updates, and SEO discovery.
- **P3 — Optional & Post-Launch Refinements:** Non-blocking polish, automation upgrades, and external service enhancements.

---

## Phase Breakdown & Work Packages

```
   ┌─────────────────────────────────────────────────────────────┐
   │             PHASE 1: P0 CRITICAL LAUNCH BLOCKERS            │
   │  Security Gates • Real DB • Cloud Storage • Resend • Live Pay│
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │         PHASE 2: P1 ESSENTIAL BUSINESS WORKFLOWS            │
   │  Brand Fix • GST Engine • Store Pickup OTP • Quotation PDF  │
   │           Automatic Offers Engine • Owner Alerts            │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │         PHASE 3: P2 OPERATIONAL & ADMIN ENHANCEMENTS        │
   │  Admin Catalog CRUD • Financial Profit Model • Account Pages│
   │        Notification Bell • Next.js App Router URLs          │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │         PHASE 4: P3 POST-LAUNCH POLISH & AUTOMATION         │
   │  Shiprocket API • SMS DLT Gateway • GA4 DataLayer • CMS     │
   └─────────────────────────────────────────────────────────────┘
```

---

## Detailed Implementation Wave Plan

### WAVE 1: P0 — Critical Security, Infrastructure & Payment Blockers
*Target: Must be completed and verified before any staging or production deployment.*

#### Task P0-1: Close Admin Dashboard Security Bypass
- **Problem:** Public users can switch to 'Ops' in the header to view `AdminDashboard.tsx` without logging in (`BUG-001`).
- **Implementation:**
  1. Remove the public persona simulator and mode switcher from `Header.tsx` for unauthenticated visitors.
  2. Implement server-side middleware in `middleware.ts` guarding `/admin/:path*` with mandatory `Role.ADMIN` or `Role.STAFF` session token checks.
  3. Create a dedicated, secure `/admin/login` page with brute-force lockout and redirect preservation.
- **Dependencies:** Auth session service (`src/lib/auth/session.ts`).
- **Testing:** Verify unauthenticated direct access to `/admin` immediately redirects to `/admin/login` with 307 status.

#### Task P0-2: Connect & Migrate Active PostgreSQL Database
- **Problem:** Database authentication fails for `snappy_user` causing backend to fall back to in-memory fixtures (`BUG-003`).
- **Implementation:**
  1. Set valid credentials in `.env` or provision a managed PostgreSQL database (Neon or Supabase).
  2. Execute `npx prisma migrate deploy` to synchronize all 25 models and relational tables.
  3. Disable in-memory fallback stores in production mode (`isStorefrontFallbackAllowed() => false`).
- **Dependencies:** PostgreSQL instance.
- **Testing:** Execute `npm test` and verify all queries hit live database without `PrismaClientInitializationError`.

#### Task P0-3: Implement Persistent Cloud Object Storage (Cloudinary / S3)
- **Problem:** Uploads write to local disk (`public/uploads`) and will be lost on serverless deployment (`BUG-021`).
- **Implementation:**
  1. Create Cloudinary or AWS S3 adapter in `src/services/adapters/storage.adapter.ts`.
  2. Wire `privateStorageService` to upload artwork, proofs, and invoices to cloud bucket.
  3. Generate secure pre-signed URLs for customer proofs and private invoices.
- **Dependencies:** Cloudinary or S3 bucket credentials.
- **Testing:** Upload image in Personalization Studio; verify file is stored in cloud bucket and loads across cold starts.

#### Task P0-4: Implement Resend HTTP Transactional Email Service
- **Problem:** Mailpit raw TCP socket fails closed in serverless production environments (`BUG-022`).
- **Implementation:**
  1. Create `ResendEmailService` implementing `EmailAdapter` using official Resend API.
  2. Connect to `email-outbox.service.ts` to process pending outbox queue items asynchronously.
  3. Validate DNS SPF, DKIM, and DMARC records on domain.
- **Dependencies:** Resend API key and domain verification.
- **Testing:** Trigger test order confirmation; verify delivery to external inbox via Resend dashboard.

#### Task P0-5: Configure Live Razorpay Payment Gateway & Webhook Secret
- **Problem:** System operates in mock payment mode with placeholder keys (`BUG-028`).
- **Implementation:**
  1. Input live `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in production environment.
  2. Set production webhook URL `https://snappygiftz.com/api/webhooks/razorpay` with `RAZORPAY_WEBHOOK_SECRET`.
  3. Verify HMAC signature check in `processRazorpayWebhook`.
- **Dependencies:** Approved Razorpay live merchant account.
- **Testing:** Execute real ₹1 live UPI payment; verify order status transitions to `CONFIRMED` upon webhook capture.

---

### WAVE 2: P1 — Essential Business Functionality
*Target: Required for full legal, financial, and operational integrity.*

#### Task P1-1: Global Brand Name Standardization to **SNAPPY GIFTZ**
- **Problem:** Inconsistent brand naming across files (`SNAPPY GIFTZ` vs `Snappy Gifts` vs `Ajmer Gift Charm`) (`BUG-002`, `BUG-007`).
- **Implementation:**
  1. Update `index.html` title to `SNAPPY GIFTZ — Premier Personal & Corporate Gifting Platform`.
  2. Update `src/app/layout.tsx` metadata and OpenGraph titles to `SNAPPY GIFTZ`.
  3. Update `StoreConfig` and `SellerConfig` database defaults to `SNAPPY GIFTZ`.
  4. Standardize email templates, invoice headers, and footer contacts to `info@snappygiftz.com`.
  5. Preserve original logo artwork in `public/assets/snappy-gifts.png` without alteration.
- **Dependencies:** None.
- **Testing:** Grep codebase for "Ajmer Gift Charm" and "Snappy Gifts" to confirm 100% elimination of unauthorized brand variants.

#### Task P1-2: Fix GST Engine for Tax-Inclusive Pricing & Shipping Tax
- **Problem:** All prices treated as tax-exclusive, adding GST a second time; shipping fee omits GST (`BUG-009`, `BUG-010`).
- **Implementation:**
  1. Add `isTaxInclusive Boolean @default(true)` to `Product` model in Prisma.
  2. Update `calculateCartPricing()` in `pricing.service.ts`:
     - If `isTaxInclusive`: Extract taxable value: `taxableBase = unitPrice / (1 + rate / 100)`.
     - If `isTaxExclusive`: Calculate tax on top: `tax = unitPrice * (rate / 100)`.
  3. Subject shipping fees (₹99) to 18% GST (SAC 9968) and allocate CGST/SGST or IGST.
  4. Update `invoice.service.ts` line-item snapshots accordingly.
- **Dependencies:** Prisma schema migration.
- **Testing:** Run unit test with ₹1,000 tax-inclusive item (18% GST); verify grand total is exactly ₹1,000 (Taxable: ₹847.46, GST: ₹152.54).

#### Task P1-3: Implement Complete Store Pickup & OTP Workflow
- **Problem:** Store pickup workflow is completely missing from checkout and admin (`BUG-011`).
- **Implementation:**
  1. Add `fulfillmentMethod` (`HOME_DELIVERY` | `STORE_PICKUP`) and pickup OTP fields to `Order` model in Prisma.
  2. Update `CheckoutModal.tsx` to allow buyer to choose "Store Pickup (Ajmer Atelier)".
  3. Add `READY_FOR_PICKUP` and `COLLECTED` to `OrderStatus` enum and transition matrix.
  4. Build OTP generation: generate secure 6-digit OTP, store SHA-256 hash with 48h expiry, send via email.
  5. Build Admin Store Pickup module: staff enters OTP, system verifies against order, marks `COLLECTED`, records staff ID and timestamp.
- **Dependencies:** Prisma schema migration, Email service.
- **Testing:** Place pickup order, mark Ready for Pickup, verify OTP generated, enter OTP in admin, confirm transition to Collected.

#### Task P1-4: Build Automatic Product Discounts & Offers Engine
- **Problem:** Automatic offers and scheduling engine missing; only client coupons exist (`BUG-008`).
- **Implementation:**
  1. Create `Offer` model in Prisma (`id`, `title`, `discountType` [PERCENTAGE/FIXED], `discountValue`, `scope` [PRODUCT/CATEGORY/STOREWIDE], `startDate`, `endDate`, `priority`, `isActive`).
  2. Update `pricing.service.ts` to evaluate active offers, apply highest priority offer, prevent stacking, and snapshot `discountTotalPaise`.
  3. Store historical discount snapshots in `OrderItem` (`originalPricePaise`, `discountAmountPaise`, `offerId`).
  4. Build Admin Offers & Discounts tab to create, edit, activate, deactivate, and schedule offers.
- **Dependencies:** Prisma schema migration.
- **Testing:** Create 10% offer on ₹1,000 product; verify storefront displays ₹900 with 10% OFF badge and strikethrough; verify backend charges ₹900.

#### Task P1-5: Build Quotation PDF Generator & Fix B2B Logo Upload
- **Problem:** Quotation PDF generator missing (`BUG-020`); B2B RFQ logo uses text URL input (`BUG-019`).
- **Implementation:**
  1. Create `src/lib/pdf/quotation-pdf.ts` using existing `pdf-writer.ts` to render formal branded corporate quotes.
  2. Replace text URL input in `CorporatePortal.tsx` line 871 with direct file picker wired to `/api/personalization/upload`.
  3. Add customer quotation download endpoint `/api/corporate/quotes/[id]/pdf`.
- **Dependencies:** `pdf-writer.ts`, file upload service.
- **Testing:** Submit corporate RFQ with direct file upload, issue quote in admin, download binary PDF quotation.

#### Task P1-6: Implement Store Owner Alert Notifications
- **Problem:** Owner receives no email notifications on orders, RFQs, or failures (`BUG-018`).
- **Implementation:**
  1. Add owner event templates: `OWNER_NEW_ORDER`, `OWNER_NEW_RFQ`, `OWNER_PAYMENT_FAILURE`, `OWNER_LOW_STOCK`.
  2. Trigger owner alert in order checkout, corporate RFQ creation, and webhook reconciliation routes.
  3. Configure owner notification email in Store Settings.
- **Dependencies:** Resend email service.
- **Testing:** Place test order; verify immediate notification dispatch to owner inbox.

#### Task P1-7: Create Static Legal & Policy Pages
- **Problem:** Footer legal links are dead buttons (`BUG-006`).
- **Implementation:**
  1. Create static routes: `/privacy`, `/terms`, `/shipping-policy`, `/refund-policy`.
  2. Populate with legally compliant e-commerce terms, GST details, cancellation windows, and custom goods return exemptions.
  3. Link footer buttons to static routes using `<Link>`.
- **Dependencies:** None.
- **Testing:** Click every footer policy link; verify clean rendering with SEO metadata and single H1.

---

### WAVE 3: P2 — Operational & Admin Enhancements
*Target: Back-office productivity, reporting accuracy, and complete URL routing.*

#### Task P2-1: Build Admin Product & Category CRUD Interface
- **Problem:** Admin cannot add, edit, or upload images for products or categories via dashboard (`BUG-012`, `BUG-013`).
- **Implementation:**
  1. Build "Add/Edit Product" modal in `AdminDashboard.tsx` with name, description, category, occasion, MRP, selling price, cost price, GST rate, HSN, stock, and direct image upload.
  2. Build Category & Occasion management panel connecting to existing `/api/admin/catalog/*` APIs.
  3. Connect inventory stock adjustments to live backend API instead of `localStorage`.
- **Dependencies:** Cloud storage service.
- **Testing:** Create new product with 2 photos via admin panel; verify instant appearance in public storefront.

#### Task P2-2: Complete Financial Management & Cost Accounting
- **Problem:** Profit, product manufacturing costs, and operating expenses are missing from reports (`BUG-023`).
- **Implementation:**
  1. Add `costPricePaise` to `Product` model.
  2. Create `Expense` model (`id`, `category`, `amountPaise`, `date`, `notes`, `receiptUrl`).
  3. Update `/api/admin/reports/sales` to compute:
     - Gross Sales vs Discounts vs Refunds.
     - Product Costs (COGS).
     - Razorpay Fees (2% + 18% GST).
     - Operating Expenses.
     - Estimated Gross Profit & Net Profit.
  4. Add daily, weekly, monthly, and yearly pre-set filter buttons.
- **Dependencies:** Prisma schema migration.
- **Testing:** Record ₹500 product cost and ₹2,000 monthly expense; verify accurate gross and net profit computation.

#### Task P2-3: Migrate SPA Views to Next.js App Router URLs
- **Problem:** `/admin`, `/checkout`, `/b2b`, `/account` lack discrete URLs and 404 on direct access (`BUG-004`).
- **Implementation:**
  1. Create `/app/admin/page.tsx` rendering guarded AdminDashboard.
  2. Create `/app/b2b/page.tsx` rendering CorporatePortal.
  3. Create `/app/checkout/page.tsx` rendering Checkout page.
  4. Create `/app/account/page.tsx` for customer order history and address management.
- **Dependencies:** Auth route guards.
- **Testing:** Refresh browser on `/admin` or `/b2b`; verify state and URL persist seamlessly.

#### Task P2-4: In-Dashboard Notification Bell & Needs Action Queue
- **Problem:** Admin has no notification bell or actionable alerts list (`BUG-017`).
- **Implementation:**
  1. Build notification dropdown in Admin Header with unread count.
  2. Query pending action queue: unfulfilled orders, pending RFQs, low stock SKUs (<100), and unverified payment holds.
- **Dependencies:** Admin overview API.
- **Testing:** Place new order; verify unread badge increments and order appears in action queue.

#### Task P2-5: Expand XML Sitemap & Search Console Setup
- **Problem:** Sitemap omits categories, occasions, and legal pages (`BUG-025`).
- **Implementation:**
  1. Update `sitemap.ts` to index all active categories, occasions, corporate page, and legal pages.
  2. Configure Google Site Verification meta tag.
- **Dependencies:** Static routes.
- **Testing:** Fetch `/sitemap.xml`; verify all public URLs are present with valid `lastmod` dates.

---

### WAVE 4: P3 — Post-Launch Polish & Automation Upgrades
*Target: Long-term operational automation.*

1. **Shiprocket Automated Logistics Integration:** Connect Shiprocket REST API to auto-generate AWBs, shipping labels, and track courier pickups directly from admin dispatch modal.
2. **India DLT SMS Integration (MSG91 / 2Factor):** Complete TRAI DLT registration and connect SMS gateway for customer pickup OTP and owner SMS alerts.
3. **Google Analytics 4 Enhanced Ecommerce:** Install GA4 tracking script and fire dataLayer events (`view_item`, `add_to_cart`, `purchase`).
4. **Sentry Runtime Monitoring:** Install `@sentry/nextjs` for centralized production crash reporting.
5. **Customer Cart & Wishlist Account Sync:** Add database models for persistent cross-device cart and wishlist synchronization upon login.
6. **Homepage CMS:** Allow store owner to edit hero slides, reorder featured categories, and update promotional announcements dynamically.
