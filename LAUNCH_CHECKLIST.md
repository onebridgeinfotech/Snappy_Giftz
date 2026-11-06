# SNAPPY GIFTZ — Production Launch Checklist

This checklist is the final operational verification gate before pointing production DNS, activating live payments, and opening the **SNAPPY GIFTZ** platform to the public.

---

## 1. Brand & Business Identity Verification

- [ ] **Official Brand Name Standardized:** Verify that **SNAPPY GIFTZ** is displayed consistently across header, footer, page titles, OpenGraph metadata, email templates, and invoices (zero instances of "Ajmer Gift Charm" or "Snappy Gifts").
- [ ] **Logo Artwork Verified:** Original logo artwork in `public/assets/snappy-gifts.png` renders sharply without distortion or clipping across mobile, tablet, and desktop viewports.
- [ ] **Favicon & Web App Icons:** `favicon.ico`, `apple-touch-icon.png`, and web manifest icons configured in `public/` and `src/app/`.
- [ ] **Business Contact Details:** Official support email (`info@snappygiftz.com`), corporate desk phone, and central atelier address (`14, Ana Sagar Circular Road, Civil Lines, Ajmer, Rajasthan - 305001`) confirmed.
- [ ] **Tax & Regulatory Identifiers:** Verified GSTIN and MSME Udyam registration numbers configured in `SellerConfig` and printed in the footer.

---

## 2. Domain, Hosting & SSL Security

- [ ] **Production Domain Configured:** Primary domain (`snappygiftz.com` or approved production domain) connected to hosting platform (Vercel / AWS).
- [ ] **Canonical Redirection:** Ensure `www` to non-`www` (or vice-versa) 301 redirects are enforced.
- [ ] **SSL / TLS Certificate:** Valid 256-bit SSL certificate active with automatic renewal (A+ grade on SSL Labs).
- [ ] **HTTP Security Headers:** HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and Content Security Policy (CSP) active in `next.config.mjs`.
- [ ] **No Secret Keys in Client Bundle:** Verify that no database URLs, service role keys, or payment secret keys appear in client JavaScript chunks.

---

## 3. Central PostgreSQL Database & Migrations

- [ ] **Managed Database Provisioned:** Production PostgreSQL 16+ instance active (Neon, Supabase, or AWS RDS) in an India-adjacent region (e.g. `ap-south-1` Mumbai) for minimal latency.
- [ ] **Connection Pooling Active:** PgBouncer or serverless connection pooling configured for `DATABASE_URL` with appropriate connection limits.
- [ ] **Direct Migration URL:** Direct connection string configured for `DIRECT_URL`.
- [ ] **Schema Migrations Deployed:** `npx prisma migrate deploy` executed with 0 pending migrations.
- [ ] **Demo Fallback Strictly Disabled:** `isStorefrontFallbackAllowed()` returns `false` when `NODE_ENV=production`. Under no circumstances will demo data mask database outages.
- [ ] **Automated Daily Backups:** Automated point-in-time recovery (PITR) and daily logical backups scheduled with tested restore procedure.

---

## 4. Live Payment Gateway (Razorpay)

- [ ] **Live Merchant Account Activated:** Razorpay merchant onboarding, KYC, and settlement bank account verified.
- [ ] **Production API Keys Set:** Live `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` configured in production environment variables (never committed to Git).
- [ ] **Webhook Endpoint Configured:** Webhook URL set to `https://<domain>/api/webhooks/razorpay` in Razorpay Dashboard.
- [ ] **Webhook Secret Active:** `RAZORPAY_WEBHOOK_SECRET` matching dashboard secret configured in production environment.
- [ ] **Subscribed Webhook Events:** `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.
- [ ] **Payment Methods Enabled:** UPI (GPay, PhonePe, Paytm, QR), Credit Cards, Debit Cards, Netbanking.
- [ ] **Live Penny Test:** Execute 1 real live payment (₹1.00 via UPI) from a mobile device; verify:
  - Immediate webhook delivery and signature validation.
  - Payment status updates to `CAPTURED`.
  - Order status updates to `CONFIRMED`.
  - Inventory stock decrements authoritatively.
  - Transactional receipt email is dispatched to buyer.

---

## 5. Persistent Cloud Media Storage (Cloudinary / S3)

- [ ] **Cloud Bucket Active:** Cloudinary account or AWS S3 bucket provisioned with appropriate bucket policy.
- [ ] **Credentials Configured:** Cloudinary keys or AWS S3 credentials set in production environment variables.
- [ ] **File Size & Type Gates:** Server strictly rejects uploads larger than 5 MB or files failing binary magic-bytes validation.
- [ ] **Signed Proof Access:** Customer-uploaded artwork and private order proofs require signed pre-signed URLs or authorized session tokens to view.
- [ ] **CORS Configuration:** Bucket CORS rules permit uploads and preview rendering from production domain.

---

## 6. Transactional Email System (Resend)

- [ ] **Domain Verification:** Domain added to Resend and verified with DNS records:
  - SPF record: `v=spf1 include:amazonses.com ~all`
  - DKIM CNAME records (all 3 records verified)
  - DMARC record: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@snappygiftz.com`
- [ ] **Production API Key:** Live `RESEND_API_KEY` configured in environment.
- [ ] **Sender Address:** `EMAIL_FROM` set to `SNAPPY GIFTZ <info@snappygiftz.com>`.
- [ ] **Store Owner Alerts:** `OWNER_NOTIFICATION_EMAIL` configured to receive immediate alerts for new orders, new RFQs, and payment discrepancies.
- [ ] **Outbox Background Worker:** Concurrency-safe email outbox processor active to dispatch queued messages with automatic retry.

---

## 7. GST Compliance & Invoicing

- [ ] **Seller Configuration Verified:** Legal business name, trade name, GSTIN, and registered address configured in `SellerConfig`.
- [ ] **Sequential Invoice Series:** Financial-year based sequence configured (e.g. `SG/26-27/0001`) with zero gaps or duplicates.
- [ ] **Tax-Inclusive Pricing Check:** Verify that tax-inclusive retail prices extract GST correctly without adding tax a second time.
- [ ] **Intra/Inter-State Tax Splitting:** Rajasthan orders receive 50% CGST + 50% SGST; out-of-state orders receive 100% IGST.
- [ ] **Invoice PDF Layout:** B2C Tax Invoice PDF includes HSN code, state codes, tax breakdown, and authorized signatory signature block.
- [ ] **Physical Signature Flow:** Authorized staff can mark physical signature confirmed upon packing before dispatch.

---

## 8. Store Pickup & OTP Security

- [ ] **Store Pickup Option Active:** Customer can select "Store Pickup (Ajmer Atelier)" at checkout.
- [ ] **Pickup OTP Generation:** System generates cryptographically random 6-digit OTP, stores SHA-256 hash, and emails code to customer upon marking "Ready for Pickup".
- [ ] **Staff Verification Interface:** Staff enters OTP in admin dashboard; system validates match, marks order `COLLECTED`, and invalidates OTP against reuse.
- [ ] **Brute-Force Protection:** Maximum 3 verification attempts enforced before locking pickup OTP for administrative reset.

---

## 9. Legal & Policy Pages

- [ ] **Privacy Policy:** Active at `/privacy` detailing data minimization, cookies, and non-storage of payment credentials.
- [ ] **Terms of Service:** Active at `/terms` governing order placement, bespoke personalization approval, and disputes subject to Ajmer jurisdiction.
- [ ] **Shipping & Delivery Policy:** Active at `/shipping-policy` specifying 24-48 hour dispatch, courier partners (BlueDart/Delhivery), and PIN code coverage.
- [ ] **Cancellation, Return & Refund Policy:** Active at `/refund-policy` explicitly stating that customized/laser-engraved items are non-refundable unless damaged in transit.
- [ ] **Footer Links Operational:** Every legal link in the footer navigates to its verified policy page without dead buttons.

---

## 10. SEO, Analytics & Monitoring

- [ ] **XML Sitemap:** Accessible at `/sitemap.xml` listing all public products, categories, occasions, and legal pages.
- [ ] **Robots.txt:** Accessible at `/robots.txt` permitting public crawlers while disallowing `/api/` and `/admin/`.
- [ ] **Google Search Console:** Domain ownership verified via DNS TXT record or HTML meta tag; sitemap submitted.
- [ ] **Google Analytics 4:** GA4 measurement tag installed in `layout.tsx` tracking pageviews and ecommerce funnel events.
- [ ] **Error Monitoring (Sentry):** Sentry SDK installed and active with owner alert notifications on uncaught exceptions.
- [ ] **Uptime Monitoring:** External uptime monitor (e.g. BetterStack or UptimeRobot) pinging `/api/admin/system/health` every 5 minutes.

---

## 11. Final End-to-End User Journey Sign-Off

- [ ] **Retail Buyer Journey:** Search product -> Personalize text/photo -> Add to cart -> Checkout with Home Delivery -> Razorpay payment -> Order confirmation email received -> Invoice PDF downloadable.
- [ ] **Store Pickup Journey:** Checkout with Store Pickup -> Admin marks Ready for Pickup -> Customer receives OTP -> Staff verifies OTP in admin -> Order marked Collected.
- [ ] **Corporate B2B Journey:** Register company -> Admin approves account -> Build bulk RFQ -> Admin reviews and issues quotation -> Customer accepts quote -> Group order created.
- [ ] **Admin Operations Journey:** Log in securely via `/admin/login` -> Review today's metrics -> Pack order and download packing slip -> Enter AWB -> Mark dispatched -> Customer receives shipment tracking email.
- [ ] **Mobile Responsiveness Check:** Entire shopping, personalization, and checkout flow verified on 360px (mobile), 768px (tablet), and 1440px (desktop) without horizontal overflow.
