# SNAPPY GIFTZ — Feature Status Matrix

This matrix documents the verification status, implementation evidence, and remaining work for every required capability across the SNAPPY GIFTZ e-commerce platform.

### Status Definitions
- **FULLY FUNCTIONAL** — Complete end-to-end workflow verified with real data and tests.
- **PARTIALLY FUNCTIONAL** — Core logic or partial flow works, but edge cases or integrations are incomplete.
- **UI ONLY** — Interface element exists, but backend persistence, API, or execution is missing or mocked.
- **MISSING** — Required feature does not exist in UI, API, or database schema.
- **EXTERNALLY UNCONFIGURED** — Implementation code is written but requires external credentials, accounts, or services to operate in production.
- **BROKEN** — Existing code fails, produces incorrect calculations, or violates security constraints.
- **NOT VERIFIED** — Insufficient safe runtime evidence to definitively establish production readiness.

---

## 1. Brand Identity & Global Presentation (Supplementary A)

| Feature / Requirement | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| Mandated Brand Name: **SNAPPY GIFTZ** | **BROKEN** | Header alt text has `Snappy Giftz`; Footer ribbon has `SNAPPYGIFTZ.COM`. | `layout.tsx` uses `Snappy Gifts`; `index.html` has `Ajmer Gift Charm`; `StoreConfig` default is `Snappy Gifts`; Footer email uses `ajmergiftcharm.com`. Global find-and-replace to standard `SNAPPY GIFTZ` required. |
| Original Logo Artwork Preservation | **FULLY FUNCTIONAL** | Logo files in `public/assets/snappy-gifts.png` and `snappy-gifts-trimmed.png`. Rendered cleanly in `Header.tsx` and `Footer.tsx`. | No modification needed. Logo artwork preserved without alteration. |
| Favicon & App Icons | **MISSING** | `public/` directory contains no `favicon.ico` or `apple-touch-icon.png`. | Generate and place standard `favicon.ico` and icon assets in `public/` and `src/app/`. |
| Header Navigation & Announcement Bar | **PARTIALLY FUNCTIONAL** | `Header.tsx`: Sticky luxury bar, announcement ticker, pill search input, responsive mobile drawer. | Unauthenticated persona simulator and mode switcher allow public admin bypass. Direct links missing. |
| Footer Information & Legal Links | **BROKEN** | `Footer.tsx`: Rich layout, atelier address, corporate desk contacts, trust badges. | Legal links (`Privacy Policy`, `Terms of Service`, `Shipping & Returns`) execute `onClick={() => setMode('b2c')}` (dead buttons). Email links point to legacy prototype domain. |

---

## 2. Authentication, Sessions & RBAC (Phase 3 & Supplementary D)

| Feature / Requirement | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| Email OTP Login & Verification | **PARTIALLY FUNCTIONAL** | `/api/auth/otp/send`, `/api/auth/otp/verify`: Server generates 6-digit OTP, SHA-256 hashed in `OtpChallenge`, 10m expiry, 3-attempt limit. | Requires active PostgreSQL database (fails over to in-memory store in dev). No standalone `/login` or `/verify-otp` page (modal only). |
| Password Authentication | **FULLY FUNCTIONAL** | `/api/auth/login`: `bcryptjs` password verification, creates DB `Session` record, sets HTTP-only `snappy_session` cookie. | Verified in `auth.test.ts`. |
| Customer Account Registration | **PARTIALLY FUNCTIONAL** | `/api/auth/register`: Validates name, email, password strength, creates `User` record with role `CUSTOMER`. | Registration occurs in modal; no email verification link or welcome sequence triggered. |
| Session Invalidation & Logout | **FULLY FUNCTIONAL** | `/api/auth/logout`: Deletes session from DB, clears HTTP-only cookie with `Max-Age=0`. | Verified in `auth.test.ts`. |
| Server-Side Role-Based Access Control (RBAC) | **FULLY FUNCTIONAL** | `src/lib/auth/rbac.ts`: `requireAuth()`, `requireRole([ADMIN, STAFF])` properly guard all `/api/admin/*` routes. | Returns 401/403 with standard JSON error payload. |
| Client-Side Admin Navigation Protection | **BROKEN** | `Header.tsx` lines 177-188, `App.tsx` lines 151-155. | Any guest can click 'Ops' in Header to render `AdminDashboard.tsx`. Even though API calls return 401, the UI displays without an authentication challenge. |
| Direct URL Protection & Redirects | **MISSING** | `src/app/` contains no `/admin`, `/checkout`, `/account` directories. | Navigating to `/admin` returns a 404 Not Found rather than challenging for login and preserving redirect target. |
| bfcache / Back-Button After Logout Security | **PARTIALLY FUNCTIONAL** | `next.config.mjs` sets global security headers, but client-side state in `AppContext` is not wiped on logout. | Browser back button in SPA can briefly display cached UI state until an API call rejects. |

---

## 3. Product Catalog & Automatic Offers (Supplementary B & Phase 7)

| Feature / Requirement | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| Public Catalog Browsing & Search | **FULLY FUNCTIONAL** | `/api/catalog/products`, `src/App.tsx`: Real-time search query matching name/tagline/category, multi-category pill filter, occasion filter, sort options. | Works smoothly in client and server API with pagination. |
| Server-Side Authoritative Product Lookup | **FULLY FUNCTIONAL** | `src/lib/catalog/public-catalog.service.ts`: `getPublicProductBySlug()`, variant resolution, stock checks, integer paise pricing. | Verified in `catalog.test.ts`. |
| Dynamic Product Detail Page (SSR) | **PARTIALLY FUNCTIONAL** | `src/app/products/[slug]/page.tsx`: Generates dynamic SEO metadata, canonical link, OpenGraph tags, JSON-LD Schema.org product data. | Header mode switcher inside page does not navigate back to homepage portals; links on homepage product cards open modal instead of route. |
| Automatic Percentage & Fixed Product Discounts | **MISSING** | `src/lib/pricing/pricing.service.ts` line 393: `discountTotalPaise = 0`. | No `Offer` model in Prisma; no automatic discount engine; no admin discount scheduling interface. |
| Offer Strikethrough & Badge Display | **UI ONLY** | `ProductCard.tsx`: Computes percentage off based on static `product.mrp` vs `product.basePrice`. | Displays a badge (e.g. `15% OFF`), but this reflects hardcoded static MRP data in fixtures rather than dynamic scheduled promotional offers. |
| Storewide & Category Promotional Offers | **MISSING** | Codebase inspection shows zero storewide promotional campaign logic. | Must be engineered from scratch with start/end scheduling and non-stacking rules. |
| Coupon Codes (Client-side) | **PARTIALLY FUNCTIONAL** | `AppContext.tsx` lines 380-402: Codes `WELCOME100` (₹100), `FESTIVE15` (₹250), `CORP20` (₹500). | Hardcoded in client state; deferred on server pricing service (`discountTotalPaise = 0`). Must remain isolated from automatic offers. |

---

## 4. GST & Tax Management Engine (Supplementary C & Phase 9)

| Feature / Requirement | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| HSN/SAC Classification per Product | **FULLY FUNCTIONAL** | `schema.prisma`, `initialData.ts`: All products include `hsnCode` (e.g. `69120010` for ceramics, `9405` for brass lamps). | Displayed in modals, persisted in order items, and rendered on tax invoices. |
| GST Rate Configuration per Product | **FULLY FUNCTIONAL** | `schema.prisma`: `taxRatePercent` integer field (default 18%). | Supported in schema and product models. |
| Intra-State (CGST + SGST) Split | **FULLY FUNCTIONAL** | `pricing.service.ts` lines 358-360: When destination state is Rajasthan (`08`), tax splits into 50% CGST + 50% SGST with zero rounding discrepancy. | Verified in `checkout.test.ts` and `invoicing.test.ts`. |
| Inter-State (IGST) Calculation | **FULLY FUNCTIONAL** | `pricing.service.ts` line 363: When destination is outside Rajasthan, 100% IGST is applied. | Verified in `checkout.test.ts` and `invoicing.test.ts`. |
| Tax-Inclusive vs Tax-Exclusive Pricing | **BROKEN** | `pricing.service.ts` line 352: `lineTaxTotalPaise = Math.round((lineTaxablePaise * taxRate) / 100)`. | Engine assumes all prices are strictly tax-exclusive. If retail prices are tax-inclusive, GST is added a second time. `isTaxInclusive` toggle is missing from schema and UI. |
| Shipping Charges Tax Treatment | **BROKEN** | `pricing.service.ts` line 405: `grandTotalPaise = taxableAmountPaise + taxTotalPaise + shippingTotalPaise`. | Shipping fee (₹99) is added without applicable 18% GST (SAC 9968) on the invoice. |
| Sequential B2C Tax Invoice Generation | **FULLY FUNCTIONAL** | `src/lib/invoices/invoice.service.ts`: Generates compliant sequence `SG/26-27/0001`, persists historical snapshots of supplier, customer, line items, and taxes. | Verified in `invoicing.test.ts`. |
| PDF Invoice Document Generation | **FULLY FUNCTIONAL** | `src/lib/pdf/invoice-pdf.ts`: Generates authentic binary PDF with two-page support, tax table, HSN summary, and authorized signatory. | Verified in `invoicing.test.ts`. |

---

## 5. Store Pickup & OTP Workflow (Supplementary E)

| Feature / Requirement | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| Checkout Delivery vs Pickup Selection | **MISSING** | `CheckoutModal.tsx`: Only shipping address form exists. | No option for customer to choose "Store Pickup (Ajmer Atelier)". |
| Order Fulfillment Method Tracking | **MISSING** | `Order` model in `schema.prisma` lacks `fulfillmentMethod` field (`HOME_DELIVERY` vs `STORE_PICKUP`). | Schema must be updated. |
| Ready for Pickup Status & Transition | **MISSING** | `OrderStatus` enum in `schema.prisma` only has `DISPATCHED` and `DELIVERED`. | `READY_FOR_PICKUP` and `COLLECTED` statuses do not exist in schema or lifecycle matrix. |
| Pickup OTP Generation & Hashing | **MISSING** | Codebase grep for pickup OTP returns 0 matches. | Must implement cryptographically secure 6-digit OTP generation, SHA-256 hashing, attempt limits, and 48-hour expiration. |
| Staff Dashboard OTP Verification & Collection | **MISSING** | `AdminDashboard.tsx`: No pickup verification tab or form exists. | Must build Admin Store Pickup verification view with order matching, OTP verification, and audit logging. |

---

## 6. Personalization Studio & File Uploads (Phase 6)

| Feature / Requirement | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| Live Personalization Studio Preview | **FULLY FUNCTIONAL** | `PersonalizationStudio.tsx`: Real-time preview canvas with 6 luxury typography choices, ribbon color selectors, wax seal styles, and packaging toggles. | Verified in `personalization.test.ts`. |
| Customer Artwork File Upload | **FULLY FUNCTIONAL** | `PersonalizationStudio.tsx`, `/api/personalization/upload`: Direct `<input type="file">` supporting JPEG, PNG, WebP up to 5 MB. | Validates MIME type and binary magic numbers. |
| Binary Magic-Bytes Security Verification | **FULLY FUNCTIONAL** | `local-storage.service.ts`: Inspects raw buffer headers (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `RIFF...WEBP`) to prevent renamed executable exploits. | Verified in `security.test.ts`. |
| Digital Proof Generation & Export | **FULLY FUNCTIONAL** | `PersonalizationStudio.tsx`: Generates authentic 500x380 proof canvas export with custom text, typography, and uploaded artwork. | Verified in `personalization.test.ts`. |
| Admin Product Image Upload | **MISSING** | `AdminDashboard.tsx`: Inventory tab only has +/- stock adjustment buttons. No product creation or image upload UI exists. | API exists (`/api/admin/catalog/images/upload`), but UI is completely missing. |
| Corporate RFQ Logo Input (Phase 6 Rule) | **BROKEN** | `CorporatePortal.tsx` line 871: Uses plain text URL input `placeholder="https://..."`. | Violates Phase 6 strict rule: "No paste image URL fields anywhere." Must be replaced with direct file picker. |
| Persistent Cloud Object Storage | **EXTERNALLY UNCONFIGURED** | `local-storage.service.ts`: Uploads written to local disk `public/uploads`. | In serverless deployments (Vercel), local disk writes are ephemeral and lost on container restart. Cloudinary or S3 adapter must be activated. |

---

## 7. Checkout, Payment & Webhooks (Phase 7 & Supplementary D)

| Feature / Requirement | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| Cart Management & Free Shipping Threshold | **FULLY FUNCTIONAL** | `CartDrawer.tsx`: Add/update/remove items, line-item customization notes, dynamic progress bar to ₹999 free shipping threshold. | State currently stored in `localStorage`; needs customer account sync. |
| Pincode Serviceability Verification | **FULLY FUNCTIONAL** | `/api/shipping/pincode`, `initialData.ts`: 15+ verified Indian PIN codes with delivery time estimates. | Works in UI and server API. Real logistics partner API (Shiprocket) can be connected later. |
| Checkout Modal Order Creation | **FULLY FUNCTIONAL** | `CheckoutModal.tsx`, `/api/checkout/orders`: Creates order with server-calculated integer paise totals and 15-minute stock hold. | Verified in `checkout.test.ts`. |
| Razorpay Payment Gateway Integration | **EXTERNALLY UNCONFIGURED** | `/api/payments/create-order`, `/api/payments/verify`: Creates Razorpay order, loads checkout SDK, verifies HMAC SHA-256 signature. | Code is fully written and tested with mock driver; requires real `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` for live transactions. |
| Payment Replay & Discrepancy Protection | **FULLY FUNCTIONAL** | `payment.service.ts`: Validates currency agreement (`INR`), amount agreement, rejects late payments on expired 15-minute holds, logs to `PaymentReconciliation`. | Verified in `payment.test.ts`. |
| Razorpay Webhook Verification & Idempotency | **FULLY FUNCTIONAL** | `/api/webhooks/razorpay`: Verifies `x-razorpay-signature` against raw request body; stores `WebhookEvent` with payload hash. | Verified in `payment.test.ts`. |
| Customer Data Privacy (No Sensitive Card/UPI Data) | **FULLY FUNCTIONAL** | `schema.prisma`, `payment.service.ts`: No card numbers, CVV, UPI PINs, or plaintext OTPs are ever accepted or stored. | Complies strictly with RBI and PCI-DSS guidelines. |

---

## 8. B2B Corporate Portal & Quotation Flow (Phase 4 & Phase 8)

| Feature / Requirement | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| Corporate Account Registration | **FULLY FUNCTIONAL** | `CorporatePortal.tsx`, `/api/corporate/register`: Captures company name, GSTIN, business email, contact details, sets status `PENDING_APPROVAL`. | Verified in `corporate.test.ts`. |
| Admin Corporate Review & Approval | **FULLY FUNCTIONAL** | `AdminDashboard.tsx`, `/api/admin/corporate/accounts`: Admin can inspect company details and approve/reject applications. | Verified in `admin.test.ts`. |
| Bulk RFQ Submission | **FULLY FUNCTIONAL** | `CorporatePortal.tsx`, `/api/corporate/rfq`: Submits product, quantity (10-500), branding instructions, delivery destination count. | Verified in `corporate.test.ts`. |
| Multi-Address Recipient CSV Upload & Validation | **FULLY FUNCTIONAL** | `CorporatePortal.tsx`, `/api/corporate/csv/validate`: Parses CSV roster, validates headers, PIN codes, phone formats, SKU matching, and total allocations. | Verified in `corporate.test.ts`. |
| Admin Quote Review, Pricing & Revision | **FULLY FUNCTIONAL** | `AdminDashboard.tsx`, `/api/admin/corporate/quotes`: Admin views RFQs, sets negotiated unit prices, applies tax, issues quotes with versioning (`revision`). | Verified in `corporate.test.ts`. |
| Customer Quote Response (Accept / Reject) | **FULLY FUNCTIONAL** | `CorporatePortal.tsx`, `/api/corporate/quotes/[id]/respond`: Client accepts or rejects quote with rejection reason tracking. | Verified in `corporate.test.ts`. |
| Corporate Group Order Checkout | **FULLY FUNCTIONAL** | `/api/corporate/orders/checkout`: Converts accepted quote into grouped order with multi-destination allocations. | Verified in `corporate.test.ts`. |
| Quotation Branded PDF Generation | **MISSING** | No `quotation-pdf.ts` file in `src/lib/pdf/`. | Quotes can only be viewed as HTML in modal; formal downloadable PDF missing. |
| Owner Email Notification on RFQ / Quote Response | **MISSING** | `email-outbox.service.ts`: No owner alert event triggers when a customer submits an RFQ or accepts/rejects a quote. | Must be added to transactional email triggers. |

---

## 9. Admin Dashboard & Operations (Phase 9)

| Module # | Module Name | Status | Verification Evidence | Deficiencies & Remaining Work |
| :---: | :--- | :--- | :--- | :--- |
| 1 | Dashboard Overview Metrics | **FULLY FUNCTIONAL** | `AdminDashboard.tsx`, `/api/admin/overview`: Today's revenue, order counts, pending quotes, low stock count. | Aggregates accurately from DB/fallback. |
| 2 | Product Catalog Management (CRUD) | **UI ONLY** | API exists (`/api/admin/catalog/products`), but UI has no Add/Edit product modal. | Build full Product CRUD modal in Admin Dashboard. |
| 3 | Categories & Occasions Management | **MISSING** | APIs exist, but zero UI exists in `AdminDashboard.tsx`. | Add Category & Occasion management tab in Admin. |
| 4 | Inventory & Warehouse Adjustments | **BROKEN** | Inventory tab has +/- buttons, but they only mutate client `localStorage`. | Wire +/- buttons to POST `/api/admin/catalog/inventory/adjust`. |
| 5 | Order Management & Fulfillment | **FULLY FUNCTIONAL** | Lists orders, filters by status, dispatches with courier/AWB, delivers, downloads packing slip. | Verified in `fulfillment.test.ts`. |
| 6 | Payments & Reconciliation | **FULLY FUNCTIONAL** | Displays payment records, discrepancies, late payment hold alerts. | Working in database and admin overview. |
| 7 | Shipping (Shiprocket) | **MISSING** | Only manual courier partner selection and AWB input exist. | Shiprocket automated label/courier API can be connected post-launch. |
| 8 | Store Pickup Management | **MISSING** | Zero UI or API exists for pickup OTP verification. | Build complete store pickup verification interface. |
| 9 | Quotations Management | **FULLY FUNCTIONAL** | Reviews corporate RFQs, calculates commercial pricing, issues quotes, handles revisions. | Verified in `corporate.test.ts`. |
| 10 | B2C Tax Invoices | **FULLY FUNCTIONAL** | Generates sequential FY invoice numbers, records physical signatures, generates binary PDF. | Verified in `invoicing.test.ts`. |
| 11 | GST Tax Management | **PARTIALLY FUNCTIONAL** | Tax report tab aggregates taxable subtotal, CGST, SGST, IGST. | Per-product tax-inclusive/exclusive toggle missing; bulk rate update missing. |
| 12 | Internal Financial Management | **PARTIALLY FUNCTIONAL** | Reports tab aggregates captured sales and taxes. | Operating expenses, product manufacturing costs, gateway fees, and gross/net profit missing. |
| 13 | Customers (Internal CRM) | **FULLY FUNCTIONAL** | Users tab: lists customers, filters by role, edits role, toggles active/deactivated status. | Customer notes and tags missing from schema. |
| 14 | Dealers & Corporate Accounts | **FULLY FUNCTIONAL** | Corporate Accounts tab: reviews applications, approves/suspends accounts, manages price agreements. | Verified in `corporate.test.ts`. |
| 15 | Offers & Discounts Management | **MISSING** | Zero UI or API exists for creating promotional offers. | Build Offers & Discounts tab in Admin Dashboard. |
| 16 | Homepage Content Management (CMS) | **MISSING** | HeroBanner and homepage sections are hardcoded in React. | Build Banner & Section CMS tab in Admin. |
| 17 | Admin Users & Role Permissions | **FULLY FUNCTIONAL** | Staff and admin management with server-enforced RBAC. | Verified in `admin.test.ts`. |
| 18 | Audit Logs | **FULLY FUNCTIONAL** | Audit tab: immutable log entries with user ID, action, resource, timestamp, and JSON before/after diffs. | Verified in `admin.test.ts`. |
| 19 | Integration Settings Panel | **MISSING** | No UI panel to review API key health or test external service connections. | Build Integration Settings panel with test-ping buttons. |
| 20 | Notification Center (Bell Queue) | **MISSING** | No notification bell with unread badge or actionable alerts queue. | Build Notification Center component in Admin Header. |
| 21 | Admin Authentication & Session Security | **BROKEN** | Public mode toggle in header allows guests to view Admin Dashboard without logging in. | Enforce server-side route authentication on `/admin`. |

---

## 10. Financial Management & Accounting (Supplementary F)

| Capability | Status | Verification Evidence | Deficiencies & Remaining Work |
| :--- | :--- | :--- | :--- |
| Captured Sales & Gross Revenue | **FULLY FUNCTIONAL** | `/api/admin/reports/sales`: Aggregates captured order revenue and average order value (AOV). | Excludes unpaid or pending orders from captured figures. |
| Pending & Authorized Balances | **FULLY FUNCTIONAL** | `/api/admin/reports/sales`: Summarizes pending revenue from unsettled orders. | Displayed clearly in sales summary cards. |
| GST Tax Collected (Intra/Inter-State) | **FULLY FUNCTIONAL** | `/api/admin/reports/taxes`: Breaks down taxable totals, CGST, SGST, and IGST by invoice. | Verified in `invoicing.test.ts`. |
| Product Purchase / Manufacturing Costs | **MISSING** | `Product` model only has `basePricePaise` and `mrpPaise`. | `costPricePaise` field does not exist; product cost is untracked. |
| Operating Expenses Recording | **MISSING** | No `Expense` model or expense entry interface exists in the application. | Owner cannot record rent, packaging supplies, electricity, or salaries. |
| Payment Gateway Fees (Razorpay ~2%) | **MISSING** | Fees are not deducted from gross revenue in reports. | Gateway commission is not calculated or tracked. |
| Estimated Gross & Net Profit Calculation | **MISSING** | Sales report only shows revenue, not profit. | Cannot calculate profit without cost prices, gateway fees, and operating expenses. |
| Pre-set Timeframe Aggregations | **PARTIALLY FUNCTIONAL** | Date picker (`from` / `to`) exists for custom ranges. | Daily, weekly, monthly, and yearly quick-select filter toggles are missing. |

---

## 11. Infrastructure, Database & Integrations (Phase 10 & Phase 11)

| Integration / Service | Required Status | Current Implementation Status | Verification Evidence | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL 16+** | Required Now | **BROKEN (Local Config)** | `schema.prisma` is comprehensive; local test run failed with `Authentication failed for snappy_user`. | Update `.env` credentials or provision production PostgreSQL (Neon/Supabase/RDS). |
| **Prisma ORM 6.19** | Required Now | **FULLY FUNCTIONAL** | Schema compiled, client generated, models properly structured with relations. | Deploy migrations to active database. |
| **Razorpay Payments** | Required Now | **EXTERNALLY UNCONFIGURED** | Code complete with signature checks and webhooks; test sandbox keys in `.env.example`. | Input live merchant keys and configure webhook secret. |
| **Cloudinary / S3 Storage** | Required Now | **MISSING (Cloud Driver)** | Only local disk storage (`public/uploads`) implemented; will fail on Vercel. | Implement Cloudinary or S3 adapter for persistent uploads. |
| **Resend (Email Service)** | Required Now | **MISSING (HTTP Adapter)** | Only local Mailpit SMTP adapter exists; raw TCP socket will fail on Vercel. | Implement Resend HTTP REST API adapter for production delivery. |
| **Internal GST Engine** | Required Now | **PARTIALLY FUNCTIONAL** | Sequence, intra/inter-state split, PDF invoice complete; tax-inclusive toggle missing. | Add tax-inclusive calculation formula. |
| **Internal Financials** | Required Now | **PARTIALLY FUNCTIONAL** | Sales & tax reporting complete; cost/expense/profit accounting missing. | Add cost fields and expense tracking. |
| **Shiprocket** | Post-Launch / Optional | **NOT IMPLEMENTED** | Manual carrier partner and AWB tracking operational. | Connect automated API when courier account approved. |
| **MSG91 / 2Factor SMS** | Post-Launch / Optional | **NOT IMPLEMENTED** | Email OTP and email notifications operational. | Implement SMS when India DLT registration approved. |
| **Google Analytics 4** | Required Now | **NOT IMPLEMENTED** | GA4 tracking script not included in `layout.tsx`. | Add GA4 measurement ID and basic ecommerce data layer events. |
| **Google Search Console** | Required Now | **PARTIALLY FUNCTIONAL** | `robots.ts` and `sitemap.ts` exist. | Add verification meta tag; expand sitemap to include static pages. |
| **Error Monitoring (Sentry)**| Required Now | **NOT IMPLEMENTED** | Error handling returns standard JSON; no centralized error monitor SDK installed. | Add `@sentry/nextjs` for production runtime alert notifications. |
| **Tally ERP Integration** | Skip for Launch | **EXCLUDED** | CSV/Excel export available in Admin Reports. | Retain as future enhancement; CSV export meets immediate needs. |
| **Meta Pixel** | Defer | **EXCLUDED** | Outside initial launch scope. | Add when running paid Meta ad campaigns. |
