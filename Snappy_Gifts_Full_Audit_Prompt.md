# SNAPPY GIFTS — MASTER AUDIT & TEST PROMPT

> Paste everything below the line into your coding agent (Claude Code / Cursor / etc.) with access to the full codebase and a running local or staging build. Run it phase by phase if the agent hits context limits.

---

## ROLE

You are a senior QA lead, full-stack engineer and e-commerce product auditor. Audit the **Snappy Gifts** website (Next.js, PostgreSQL + Prisma, B2C storefront + B2B dealer portal + Admin Dashboard) completely. Do not assume anything works. Verify every claim by reading the code AND running the app. For every finding, give evidence (file path, route, steps to reproduce, screenshot description).

## RULES

1. Do not skip any page, section, button, form, modal, dropdown, toast, or empty/error state.
2. Do not just report. For every bug or mismatch, state: **ID, page/route, severity (Critical / High / Medium / Low), steps to reproduce, expected vs actual, suggested fix.**
3. Where a required feature is missing, mark it **MISSING** and propose an implementation plan. Implement it only after I approve the report.
4. Use ONE central PostgreSQL database. Flag any duplicate data store, hard-coded data, mock data, or placeholder content.
5. Excluded features (flag if present): loyalty programmes, reward points, marketing automation, automated promo campaigns, AI product/gift recommendations, third-party CRM, duplicate databases. Coupons are deferred for now; flag any half-built coupon code.
6. Brand name must be **"Snappy Gifts"** everywhere (the client note says "Snappy Giftz"; find every inconsistency in UI, metadata, emails, invoices, PDFs, footer, favicon).

---

## PHASE 1 — SITE MAP & INVENTORY

Crawl the codebase (`app/` or `pages/` routes, layouts, components, API routes) and produce:

1. **Total page count**, split into: Public storefront, Auth, Customer account, B2B dealer portal, Admin dashboard, Legal/utility, Error pages (404/500).
2. A numbered table: `# | Route | Purpose | Access (public / customer / dealer / admin) | Status (Working / Partial / Broken / Placeholder)`.
3. For **each page**: number of sections, and the list of containers/sections in order (e.g., Page 1 → Hero, Category strip, Featured products, Occasion grid, Testimonials, Footer), what each contains, and whether it works.
4. A list of **orphan pages** (exist but not linked) and **dead links** (linked but missing).
5. A list of every shared component (navbar, footer, product card, modal, toast, etc.) and where it is used.

---

## PHASE 2 — PAGE-BY-PAGE, SECTION-BY-SECTION AUDIT

For EVERY page and EVERY section, check and report:

**Function**
- Every button, link, form, tab, filter, sort, pagination, search, carousel, accordion, modal does what it should.
- Data is loaded from the database (not hard-coded). Loading, empty, error and success states exist.
- Form validation (required, format, length, duplicates), inline error messages, disabled/loading state on submit, double-click/double-submit protection.

**Theme & design consistency**
- Colors, fonts, spacing, border radius, button styles, icons match the Snappy Gifts theme.
- Flag any section that looks different from the rest, inconsistent headings, misaligned containers, overflow, broken images, text clipping.

**Responsive**
- Test at 360px, 390px, 768px, 1024px, 1440px. Check mobile menu, tap target sizes, horizontal scroll, sticky elements, keyboard overlap on forms.

**Performance & SEO (per page)**
- Title, meta description, OG tags, canonical, alt text, heading hierarchy (one H1), image optimization (next/image, lazy loading), Lighthouse scores (Performance, Accessibility, Best Practices, SEO).

**Accessibility**
- Keyboard navigation, focus states, labels, contrast, ARIA on modals/menus.

**Content**
- Placeholder text ("Lorem ipsum", "Coming soon", fake phone numbers/emails/addresses), wrong spellings, wrong prices, wrong currency format (₹, Indian number format).

---

## PHASE 3 — AUTHENTICATION, SESSION & NAVIGATION EDGE CASES

Verify pages exist and work: Login, Sign Up, Email Verification, Forgot/Reset (if applicable), Logout, B2B dealer login.

**Email-verification login (required)**
- Login/sign-up is completed via emailed OTP or magic link (Resend). Test: wrong code, expired code, reused code, resend (with cooldown), rate limiting, multiple attempts lockout, case/whitespace in email, disposable emails, already-registered email.
- OTP is generated and verified server-side, hashed in DB, single-use, short expiry.

**Back-button and session behaviour**
- Enter a page → navigate forward → press Back: does it return correctly with state preserved?
- **Log in → Logout → press Browser Back:** must NOT show the logged-in profile/orders/admin data. It must redirect to login. Check bfcache/cached pages, `Cache-Control: no-store` on authenticated pages, and that protected API calls return 401.
- Open the site in two tabs, logout in one, act in the other.
- Session expiry, token tampering, deleted user with live session.
- Direct URL access to `/account`, `/admin`, `/dealer`, `/checkout` while logged out → redirect to login, then return to the intended page after login.
- Customer trying to open admin URLs and admin APIs (must be blocked server-side, not only hidden in UI). Dealer vs customer vs admin role separation.
- Refresh on every protected page; deep links; 404 page has a way back home.

---

## PHASE 4 — QUOTATION WORKFLOW (VERIFY, AND BUILD IF MISSING)

Required flow:

1. **Customer** (B2B or bulk buyer) submits a quotation request: selected products/SKUs, quantities, customization notes, company name, GSTIN (optional, validated), delivery city/pincode, required-by date, **mobile number (mandatory, validated, ideally OTP-verified)**, email (from verified account).
2. System saves it in the central DB with a unique quotation number and status `SUBMITTED`.
3. **Owner is notified immediately** (see Notifications below). Reminder if not reviewed within a set time (e.g., 2h, 24h).
4. **Owner reviews** in Admin Dashboard → Quotations: sees request details, customer contact, can edit line prices, add GST (CGST/SGST/IGST by state), shipping, discount, validity date, notes. Can also mark "Contacted customer by phone" and log notes.
5. Owner **sends quote** → status `QUOTED`; customer gets email (and SMS if enabled) with a link to view the quote and a **PDF**.
6. **Customer accepts / rejects / requests revision** from their account (or secure link). Status → `ACCEPTED` / `REJECTED` / `REVISION_REQUESTED` / `EXPIRED`.
7. **Owner is notified** of the customer's response.
8. On acceptance, owner can convert the quotation to an Order / proforma invoice and request payment (Razorpay link) or record offline payment.

Test and report on: every status transition (and illegal transitions), edit after sending (versioning), expiry, duplicate submissions, missing mobile number, invalid GSTIN, quantity limits/MOQ, price mismatch between quote and invoice, PDF correctness (company details, GSTIN, HSN, tax split, totals, rounding), who can see which quotation (customers only their own), audit log entries for every action, and CSV export.

---

## PHASE 5 — OWNER NOTIFICATIONS & REMINDERS (VERIFY, AND BUILD IF MISSING)

The owner must never miss an order or quotation. Check/implement:

- **In-dashboard notification bell** with unread count and a "Needs action" queue (new orders, new quotations, accepted quotes, refund requests, low stock, failed payments, failed shipments).
- **Email to owner** (Resend) on: new order, payment success/failure, new quotation, quotation accepted/rejected, refund request, low stock.
- Optional (decide in report): SMS/WhatsApp alert to owner's mobile for new quotations and orders.
- **Reminder logic:** repeat reminders until the item is actioned (cron / scheduled job). Configurable owner email(s) and mobile in Admin → Integration Settings.
- Notifications are idempotent (no duplicates on retries), logged in DB, and failures are retried and surfaced in error monitoring.

---

## PHASE 6 — IMAGE & FILE UPLOADS (NO IMAGE URLs)

- **Product images:** admin uploads photos **directly from device (file picker, drag-and-drop, camera on mobile)**. No "paste image URL" fields anywhere. Check: multiple images per product, reorder, set primary, replace, delete (and delete from storage), preview before save, progress indicator.
- **Profile picture:** user uploads/captures photo directly (file picker + camera), with crop/preview, replace, remove. No URL field.
- Validate: file type (jpg/png/webp), max size, dimensions, malware-safe handling, server-side validation (not just client), image optimization/compression, persistent URLs after redeploy, Cloudinary folder structure, orphaned images on product delete, signed uploads (no exposed secret).
- Personalization studio uploads (if present): same checks.
- Grep the codebase for any `imageUrl`, `image_url`, `type="url"` inputs and list each one.

---

## PHASE 7 — STOREFRONT (E-COMMERCE COMPLETENESS)

Test the full buyer journey and confirm each feature exists and works:

- Home, category, occasion, product listing (filters: price, category, occasion, rating, availability; sort; pagination or infinite scroll; URL-synced filters), search (typo tolerance, empty results, suggestions), product detail (gallery/zoom, MRP vs selling price and % off, SKU/variants, stock status, quantity limits, delivery pincode check, description, specs, reviews/ratings if included, related products, share, breadcrumbs, structured data).
- Cart (add/update/remove, persistence after login, stock re-validation, price recalculation, GST-inclusive/exclusive display), wishlist (if included).
- Checkout: guest vs logged-in, address book, pincode validation, shipping charges, GST breakup, COD (if offered), store pickup with OTP, order notes/gift message, order summary, Terms acceptance.
- Payments (Razorpay): UPI, card, netbanking; success, failure, cancel, timeout, double payment, browser closed mid-payment, **webhook verification and signature check**, amount tampering, order created only after verified payment (or correct pending state), refunds (full/partial).
- Post-order: confirmation page, email, SMS, invoice PDF, order history, order detail, tracking page, cancel/return/refund request, reorder.
- Customer account: profile edit, addresses, orders, invoices, quotations, notifications, delete account / data request.
- Gift-specific: personalization (name/photo/text), preview, gift wrap, message card, bulk gifting, occasion reminders (NOT automated marketing).
- Static & legal pages: About, Contact (form works and reaches the owner), FAQ, Shipping policy, Return/Refund policy, Privacy, Terms, Cookie notice. Footer links all valid. WhatsApp/call buttons correct.
- Trust & conversion: store address/GSTIN in footer, order tracking by order ID + phone/email, clear delivery timelines, stock/low-stock labels.

---

## PHASE 8 — B2B DEALER PORTAL

- Individual dealer IDs/passwords (or email-verified login), admin-created/approved dealer accounts, dealer-specific pricing, bulk ordering, daily offers, minimum order quantities, credit/online payment, dealer order history, dealer quotations, dealer GST invoices.
- Dealer cannot see other dealers' prices/orders; customers cannot see dealer prices.

---

## PHASE 9 — ADMIN DASHBOARD (EVERY PAGE, EVERY ACTION)

Verify each module for **create, read, update, delete, search, filter, sort, pagination, bulk actions, CSV/Excel export, validation, permission checks, audit log entry, empty/error states, mobile usability**:

1. **Dashboard home:** today's orders, revenue, pending quotations, low stock, failed payments, pending shipments. Numbers must match DB.
2. **Products:** add product (name, description, category, occasion, tags, MRP, selling price, cost price, GST rate, HSN, SKU, variants, stock, weight/dimensions for shipping, images by direct upload, SEO fields, publish/draft/archive), edit, duplicate, bulk upload via CSV, delete (with order-history safety), validation (selling price ≤ MRP, unique SKU, negative stock).
3. **Categories & Occasions:** CRUD, ordering, images, hide/show.
4. **Inventory:** stock adjust with reason, low-stock threshold, stock movement log, oversell prevention, stock decrement on payment, restore on cancel/refund.
5. **Orders:** list, filters (status/date/payment), detail, status updates (with customer email/SMS), cancel, refund, notes, invoice download, shipment creation.
6. **Payments & Refunds:** reconciliation with Razorpay, failed/pending payments, refund processing and status.
7. **Shipping (Shiprocket):** create shipment, courier select, AWB, label, pickup schedule, tracking sync, cancel, failure handling, pincode serviceability.
8. **Store pickup:** OTP generation, verification, expiry, retries.
9. **Quotations:** the full Phase 4 flow.
10. **Invoices (B2C tax invoice) :** create-invoice action works from an order and manually; sequential invoice numbers (financial-year based, no gaps/duplicates), correct GST (CGST+SGST vs IGST by state), HSN, rounding, PDF layout, regenerate/void, credit notes for refunds.
11. **GST management:** per-product rates, HSN, inclusive/exclusive pricing, GST reports (by rate, by month).
12. **Financials:** sales, discounts, tax collected, Razorpay fees, refunds, expenses (add/edit), product costs, profit report, date-range filters, CSV/Excel export. Numbers must reconcile with orders/payments.
13. **Customers (internal CRM):** list, detail, orders, quotations, notes, tags, block/unblock, export.
14. **Dealers:** create, approve, pricing, deactivate.
15. **Offers & Discounts:** create, schedule, apply rules (coupons deferred; flag status).
16. **Homepage content management:** banners, featured sections, ordering, image upload, preview, publish.
17. **Admin users, roles & permissions:** create staff, role matrix, restrict by module, deactivate, enforce server-side.
18. **Audit logs:** every critical action logged with user, time, before/after; cannot be edited.
19. **Integration Settings:** keys never shown in plain text, test-connection buttons, status indicators.
20. **Notifications center** (Phase 5).
21. Admin login/logout, session timeout, back-button-after-logout (Phase 3), optional 2FA, brute-force protection.

---

## PHASE 10 — SECURITY, DATA & INFRASTRUCTURE

- All third-party calls server-side; no secret keys in client bundle, repo, or logs; `.env` handling; separate dev/prod keys.
- Verified webhooks (Razorpay, Shiprocket) with signature checks and idempotency.
- AuthZ on every API route (IDOR tests: change order/quotation ID in URL as another user).
- Input validation (Zod or similar), SQL injection via Prisma raw queries, XSS in product descriptions/notes/reviews, CSRF, rate limiting on OTP/login/contact forms, bot protection (CAPTCHA/Turnstile) on public forms.
- Security headers (CSP, HSTS, X-Frame-Options), HTTPS-only cookies (HttpOnly, Secure, SameSite).
- PII protection: minimal data stored, no PII in logs, privacy policy matches reality.
- Prisma: schema review, indexes, relations, cascade rules, migrations clean, seed data, no N+1 queries, transactions around order+payment+stock updates.
- Backups and recovery: automated daily DB backups, tested restore procedure, image storage persistence.
- Error monitoring: frontend, API, failed integrations, runtime exceptions, production alerts to owner/dev.
- Analytics: GA4 events (view_item, add_to_cart, begin_checkout, purchase) fire correctly with right values; Search Console: sitemap.xml, robots.txt, canonical URLs, indexable pages only.
- Cross-browser (Chrome, Safari iOS, Firefox, Edge) and low-network behaviour.

---

## PHASE 11 — INTEGRATION RECOMMENDATION (REQUIRED vs NOT REQUIRED)

Review the integration list below against the actual code and give a final **Required now / Add later / Skip** verdict with reasons. My starting view:

| # | Integration | Verdict | Notes |
|---|---|---|---|
| 1 | Razorpay | **Required now** | Core payments, refunds, webhooks |
| 2 | PostgreSQL + Prisma | **Required now** | Single central DB |
| 3 | Cloudinary (or equivalent) | **Required now** | Direct photo uploads, persistent images |
| 4 | Resend | **Required now** | Email-verification login, order mail, owner alerts, quotations |
| 5 | MSG91 / 2Factor | **Optional at launch** | Needs India DLT registration (time/cost). Email OTP + email alerts cover launch. Add for pickup OTP, quotation mobile verification and owner SMS alerts if wanted |
| 6 | Shiprocket | **Required once shipping live** | Can start with manual shipping, but plan it for launch |
| 7 | Internal GST system | **Required now** | |
| 8 | Internal Financial Mgmt | **Required now** | Inside Admin Dashboard |
| 9 | Google Analytics 4 | **Required now** | |
| 10 | Google Search Console | **Required now** | Free, essential for SEO |
| 11 | Error monitoring (e.g., Sentry) | **Required now** | |
| 12 | Tally | **Skip for now** | Only if accountant needs it; CSV/Excel exports are enough initially |
| 13 | Google Maps Platform | **Later** | Pincode lookup is enough at first; Maps adds cost |
| 14 | Meta Pixel | **Later** | Only when running Meta ads |

Also evaluate whether these **missing items** are needed: owner notification channel (email now, WhatsApp/SMS later), CAPTCHA/bot protection, scheduled jobs (cron) for reminders and quote expiry, automated DB backups, uptime monitoring, sitemap/robots, cookie consent, pincode serviceability API, and a transactional-email domain setup (SPF/DKIM/DMARC).

---

## PHASE 12 — DELIVERABLES

Produce, in this order:

1. **Executive summary:** total pages, total sections, working %, count of issues by severity, top 10 blockers.
2. **Site map table** (Phase 1) and **per-page report** with sections, status and issues (Phase 2).
3. **Feature matrix:** every feature from Phases 3–9 marked `Working / Partial / Broken / Missing`.
4. **Bug list** (ID, route, severity, steps, expected vs actual, fix).
5. **Quotation and notification gap analysis** with proposed data model (Prisma schema changes), statuses, routes and emails.
6. **Upload audit:** every place image URLs are used and what to replace.
7. **Integration verdict table** (Phase 11).
8. **Prioritized fix plan:** P0 (before launch), P1 (first week), P2 (later), with effort estimates.
9. **Launch checklist** (env keys, domain, SSL, email DNS, Razorpay live mode, webhooks, backups, monitoring, legal pages, test orders).

Save the report as `AUDIT_REPORT.md` (and a CSV of bugs as `bugs.csv`). Do not start fixing until I approve the prioritized plan.

---

## START

Begin with Phase 1 now. Report the full site map first, then continue phase by phase, without skipping any step.
