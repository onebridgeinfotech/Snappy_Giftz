# SNAPPY GIFTZ — Integration Status & External Service Audit

This document details the configuration status, verification findings, and remaining deployment requirements for all third-party and external services across the SNAPPY GIFTZ platform.

> **Security Note:** In compliance with strict audit security rules, all environment variable names are documented without revealing actual secrets, API tokens, or production credentials.

---

## Service Inventory & Launch Recommendation Matrix

| # | External Service | Launch Verdict | Current Code Status | Config Status | Production Blocker? |
| :-: | :--- | :--- | :--- | :--- | :---: |
| 1 | **Razorpay** | **Required for Launch** | Fully Implemented (Mock driver tested) | Test Keys in `.env.example`; Unconfigured in Prod | **YES** |
| 2 | **PostgreSQL (Database)** | **Required for Launch** | Fully Implemented (Prisma 6.19 Schema) | Local credentials mismatch; Unconfigured in Prod | **YES** |
| 3 | **Cloudinary / S3 Storage** | **Required for Launch** | Local disk adapter only | Unconfigured (Requires persistent cloud bucket) | **YES** |
| 4 | **Resend (Transactional Email)**| **Required for Launch** | Mailpit SMTP adapter only | Unconfigured (Requires Resend HTTP API adapter) | **YES** |
| 5 | **Internal GST & Invoicing** | **Required for Launch** | Fully Implemented (PDF engine complete) | Tax-inclusive pricing toggle needs correction | **YES** |
| 6 | **Internal Financials** | **Required for Launch** | Sales & Tax reports implemented | Profit, Cost & Expense models missing | **NO (Partial)** |
| 7 | **Google Search Console** | **Required for Launch** | `robots.ts` and `sitemap.ts` implemented | Verification meta tag required | **NO** |
| 8 | **Google Analytics 4** | **Required for Launch** | Not Implemented | Tracking snippet required in `layout.tsx` | **NO** |
| 9 | **Sentry (Error Monitoring)** | **Required for Launch** | Not Implemented | SDK installation and DSN configuration required | **NO** |
| 10 | **Upstash Redis** | **Recommended for Launch** | Memory adapter active; Redis client drafted | Unconfigured in production | **NO (Dev fallback works)** |
| 11 | **Shiprocket** | **Defer to Post-Launch** | Manual courier tracking active | Not configured; manual shipping sufficient for launch | **NO** |
| 12 | **MSG91 / 2Factor (SMS)** | **Defer to Post-Launch** | Not Implemented | Email OTP sufficient for launch; DLT registration pending | **NO** |
| 13 | **Google Maps Platform** | **Defer to Post-Launch** | Not Implemented | Indian PIN code verification sufficient for launch | **NO** |
| 14 | **Tally ERP** | **Skip for Initial Scope** | Not Implemented | CSV/Excel tax report exports sufficient for launch | **NO** |
| 15 | **Meta Pixel** | **Skip for Initial Scope** | Not Implemented | Not required until paid Meta ad campaigns launch | **NO** |

---

## Detailed Service Audits

### 1. Razorpay Payment Gateway & Webhooks
- **Purpose:** Core payment processing for B2C retail orders and B2B corporate sample orders (UPI, Credit/Debit Cards, Netbanking) with refund support.
- **Existing Implementation:**
  - Order creation: `src/app/api/payments/create-order/route.ts` & `src/lib/payments/payment.service.ts`.
  - Signature verification: Constant-time HMAC SHA-256 verification in `src/services/adapters/payment.adapter.ts`.
  - Webhook ingestion: `src/app/api/webhooks/razorpay/route.ts` with replay protection and `WebhookEvent` audit logging.
  - Reconciliation table: `PaymentReconciliation` model tracks late payments after 15-minute stock hold expiration.
- **Required Environment Variables:**
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
- **Configuration Status:** **EXTERNALLY UNCONFIGURED**. Currently configured with placeholder keys (`rzp_test_placeholder_key_id`) and running in local mock fallback mode.
- **Verification Status:** Verified via mock driver in automated test suite (`payment.test.ts`: 29 passed). Real live payment verification is pending production credentials.
- **Remaining Steps for Production:**
  1. Complete Razorpay merchant KYC and bank account verification.
  2. Generate Live API Key ID and Key Secret from Razorpay Dashboard > Settings > API Keys.
  3. Set Webhook URL to `https://<production-domain>/api/webhooks/razorpay` with secret.
  4. Enable webhook events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.
  5. Run 1 real rupee live test transaction (UPI QR) and verify webhook capture.

---

### 2. PostgreSQL Central Database & Prisma ORM
- **Purpose:** Single central transactional data store for users, orders, corporate RFQs, quotations, inventory adjustments, and GST tax invoices.
- **Existing Implementation:**
  - `prisma/schema.prisma` (1,047 lines, 25 relational models, integer paise monetary storage).
  - Client instance: `src/lib/prisma.ts`.
- **Required Environment Variables:**
  - `DATABASE_URL` (Connection pooling URL, e.g. Neon or PgBouncer)
  - `DIRECT_URL` (Direct migration connection URL)
- **Configuration Status:** **BROKEN (Local Development)**. The local `.env` specifies `postgresql://snappy_user:snappy_dev_password_only@localhost:5432/snappy_gifts_db`, but connection attempts fail with authentication error, forcing tests to use in-memory fallback stores.
- **Verification Status:** Schema compiles and passes typecheck. In-memory data store validated in test suite. Real database connectivity not operational on local workstation.
- **Remaining Steps for Production:**
  1. Provision managed PostgreSQL 16+ instance on Neon, Supabase, or AWS RDS.
  2. Configure connection pooler URL (`DATABASE_URL`) and direct migration URL (`DIRECT_URL`).
  3. Execute `npx prisma migrate deploy` to create production tables and indexes.
  4. Seed initial categories, occasions, and system store configurations.
  5. Configure automated daily logical backups and verify restore procedure.

---

### 3. Persistent Object Storage (Cloudinary / AWS S3)
- **Purpose:** Permanent, persistent storage for customer-uploaded personalization artwork, digital proof previews, product catalog images, and generated PDF tax invoices.
- **Existing Implementation:**
  - `src/services/storage/local-storage.service.ts` writes files directly to local disk directory `public/uploads/` and `storage/private/`.
  - Binary magic-bytes inspection ensures uploaded files are genuine JPEG, PNG, or WebP images.
- **Required Environment Variables:**
  - For Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - Or for S3: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `STORAGE_BUCKET`, `STORAGE_PROVIDER="s3"`
- **Configuration Status:** **MISSING (Cloud Provider Adapter)**. No cloud storage adapter exists in code; only local filesystem writes are implemented.
- **Verification Status:** Local disk upload works in development. On serverless hosting (Vercel), local disk writes are read-only or ephemeral, causing uploaded artwork to vanish after container shutdown.
- **Remaining Steps for Production:**
  1. Create Cloudinary account or AWS S3 bucket with private ACL and CORS configuration.
  2. Implement Cloudinary / S3 adapter in `src/services/adapters/storage.adapter.ts`.
  3. Switch `STORAGE_PROVIDER` from `local` to `cloudinary` or `s3` in production environment.
  4. Test customer artwork upload, verify CDN URL generation, and confirm signed URL access for private proofs.

---

### 4. Resend Transactional Email Service
- **Purpose:** Delivering login OTP codes, order confirmations, tax invoice PDFs, quotation notifications, and store owner alerts.
- **Existing Implementation:**
  - Outbox queue: `src/lib/email/email-outbox.service.ts` (idempotent DB queue with retry backoff).
  - Service: `src/services/email/mailpit.service.ts` (connects via raw TCP socket to localhost SMTP port 1025 for local Mailpit testing).
  - Templates: `src/lib/email/email-templates.ts` (Order confirmation, invoice available, shipment dispatched).
- **Required Environment Variables:**
  - `RESEND_API_KEY`
  - `EMAIL_FROM` (e.g. `SNAPPY GIFTZ <info@snappygiftz.com>`)
  - `OWNER_NOTIFICATION_EMAIL` (Store owner address)
- **Configuration Status:** **MISSING (Production HTTP Adapter)**. No Resend API client or HTTP adapter exists in the codebase. Raw TCP socket connections to port 1025 are blocked on serverless platforms.
- **Verification Status:** Validated locally using Mailpit raw SMTP. Production delivery fails closed.
- **Remaining Steps for Production:**
  1. Register domain `snappygiftz.com` on Resend.
  2. Configure DNS records: SPF (`v=spf1 include:amazonses.com ~all`), DKIM, and DMARC (`v=DMARC1; p=quarantine`).
  3. Obtain Resend API Key (`re_...`).
  4. Implement `ResendEmailService` implementing `EmailAdapter` using official `@resend/node` or `fetch('https://api.resend.com/emails')`.
  5. Add owner alert email triggers (New Order, New RFQ, Payment Discrepancy, Low Stock).

---

### 5. Google Search Console & SEO Tools
- **Purpose:** Search engine indexing, crawl error detection, and organic discovery.
- **Existing Implementation:**
  - `src/app/robots.ts`: Allows `/` and `/products/`; disallows `/api/`, admin routes.
  - `src/app/sitemap.ts`: Generates dynamic XML sitemap querying public products from database.
  - `src/app/layout.tsx`: OpenGraph, Twitter card, canonical tags.
- **Required Environment Variables:**
  - `NEXT_PUBLIC_SITE_URL` (e.g. `https://snappygiftz.com`)
  - `GOOGLE_SITE_VERIFICATION_TOKEN`
- **Configuration Status:** **PARTIALLY FUNCTIONAL**. Sitemaps and robots exist, but Google verification token is not configured.
- **Remaining Steps for Production:**
  1. Add verification meta tag or upload HTML verification file.
  2. Expand `sitemap.ts` to include static categories, occasions, corporate page, and legal routes.
  3. Submit sitemap URL `https://snappygiftz.com/sitemap.xml` to Google Search Console upon domain launch.

---

### 6. Google Analytics 4 (GA4)
- **Purpose:** Tracking storefront visitors, catalog engagement, funnel progression, and conversion rates.
- **Existing Implementation:** None currently present in `layout.tsx`.
- **Required Environment Variables:**
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID` (e.g. `G-XXXXXXXXXX`)
- **Configuration Status:** **NOT IMPLEMENTED**.
- **Remaining Steps for Production:**
  1. Create GA4 Property for SNAPPY GIFTZ.
  2. Add Google Tag (`gtag.js`) via Next.js `next/script` in `src/app/layout.tsx` (gated by user cookie consent).
  3. Dispatch standard ecommerce events: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`.

---

### 7. Sentry Error Monitoring & Alerting
- **Purpose:** Real-time production runtime exception tracking, API failure alerts, and payment discrepancy monitoring.
- **Existing Implementation:** None currently present. Error handling returns standard JSON error responses.
- **Required Environment Variables:**
  - `SENTRY_DSN`
  - `SENTRY_AUTH_TOKEN` (for source map uploads)
- **Configuration Status:** **NOT IMPLEMENTED**.
- **Remaining Steps for Production:**
  1. Run `npx @sentry/wizard@latest -i nextjs` to scaffold Sentry client, server, and edge configurations.
  2. Configure alerts to email store owner / developer on critical payment or database exceptions.

---

### 8. Upstash Redis (Distributed Rate Limiting)
- **Purpose:** Multi-instance rate limiting across serverless function instances to prevent brute-force attacks on OTP endpoints and checkout spamming.
- **Existing Implementation:** `src/lib/security/rate-limiter.ts` contains in-memory sliding window rate limiter with placeholder Upstash Redis branch.
- **Required Environment Variables:**
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `RATE_LIMIT_BACKEND="upstash"`
- **Configuration Status:** **UNCONFIGURED IN PRODUCTION** (Defaults to in-memory fallback).
- **Remaining Steps for Production:**
  1. Create free/low-cost Upstash Redis database.
  2. Add REST URL and Token to Vercel environment variables.
  3. Switch `RATE_LIMIT_BACKEND="upstash"`.

---

### 9. Deferred Services (Post-Launch Enhancements)

#### Shiprocket (Courier Aggregator API)
- **Current Status:** Not configured.
- **Why it can be deferred:** SNAPPY GIFTZ can launch immediately with **Manual Shipping Management**: Admin generates BlueDart / Delhivery waybills through their existing courier portal, inputs the AWB tracking number in the admin dispatch modal, and the customer receives an automatic tracking update. Automated Shiprocket API integration can be added post-launch without blocking sales.

#### MSG91 / 2Factor (SMS Gateway)
- **Current Status:** Not configured.
- **Why it can be deferred:** India DLT (Distributed Ledger Technology) registration under TRAI regulations requires entity verification, header approval, and message template registration, which typically takes 1–2 weeks and incurs compliance fees. Email OTP and email order receipts are legally compliant and operational immediately. SMS can be activated once DLT registration is approved.

#### Google Maps Platform
- **Current Status:** Not configured.
- **Why it can be deferred:** Address autocomplete via Google Places API is an expensive add-on. The current 6-digit Indian PIN code validation system accurately determines state, city, serviceability, and transit timelines without incurring recurring Google Maps billing costs.

#### Tally ERP
- **Current Status:** Excluded from initial scope.
- **Why it can be deferred:** The Admin Reports module provides full CSV/Excel export of sales, orders, and GST tax breakdowns with HSN and state codes. Accountants can import these standard CSV files into Tally, Zoho Books, or Excel directly.
