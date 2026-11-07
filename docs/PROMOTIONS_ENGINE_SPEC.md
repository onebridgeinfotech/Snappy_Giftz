# SNAPPY GIFTZ — Promotions & Coupons Engine (Build Spec)

> Hand this file to the developer / Claude Code as the source of truth for building promo codes,
> coupons and automatic offers. It is written against **this** codebase (Next.js API routes,
> Prisma on MySQL, integer-paise pricing in `src/lib/pricing/pricing.service.ts`, owner-set delivery
> charges with customer approval, Razorpay + COD).
>
> Goal: festival / product-specific / customer-specific discounts **with zero money leakage**.

---

## 0. Where we are today (must fix first)

| Area | Today | Problem |
|---|---|---|
| Cart coupon box (`src/context/AppContext.tsx → applyCoupon`) | Hard-coded `WELCOME100`, `FESTIVE15`, `CORP20` checked **in the browser** | Anyone can read the codes in the JS bundle. `FESTIVE15` says "15%" but applies a flat ₹250. |
| Server pricing (`calculateCartPricing`) | `const discountTotalPaise = 0; // Coupons deferred in Batch 4` | The cart/checkout **show** a discount the server never applies → customer sees ₹X, Razorpay charges ₹X + discount. Misleading, and a support/trust problem. |
| Checkout payload | Coupon is never sent to the server | Nothing to validate. |
| Gift wrap ₹20 | Added to `taxableAmountPaise` but no GST is computed on it | Small tax under-collection (separate bug, fix while touching pricing). |

**Step 0 (before anything else):** remove or hide the client-side coupon box until the engine in
this spec is live. Never ship a discount that the server does not compute.

---

## 1. Non-negotiable rules (the "no leakage" contract)

1. **The server is the only source of truth.** The client sends at most a *code string*
   (`"DIWALI50"`). It never sends a discount amount, percentage, eligibility flag, or final total.
2. **Re-price and re-validate at every money step**: cart preview → order creation → payment
   initiation → payment capture. A discount valid in the cart can expire before checkout.
3. **Money is integer paise** end to end (already the case in this repo). No floats for money.
4. **Usage limits are enforced atomically in the database**, not by "read count, then write".
   Two customers redeeming the last use at the same second must not both succeed.
5. **Every order stores a snapshot** of exactly which promotion, which code, which rule values and
   how much discount went on **each line**. Editing or deleting a promotion later must never change
   an existing order, invoice or refund.
6. **A discount can never exceed what it applies to**: line discount ≤ line price, order discount ≤
   eligible subtotal, shipping discount ≤ shipping charge. Grand total is never negative.
7. **Discount reduces GST taxable value per line** (see §6), so it must be allocated to lines
   before tax is calculated.
8. **Everything is audited**: who created/edited a promotion, and every apply / reject / redeem /
   release / reverse with order, customer, amount and IP.

---

## 2. How established platforms do it (and what we copy)

| Platform | Model worth copying |
|---|---|
| **Shopify** (Discounts) | Two delivery mechanisms: **discount codes** and **automatic discounts**. Three **classes**: *product*, *order*, *shipping*. Combination is decided per class ("can combine with product / order / shipping discounts"), not a single `stackable` boolean. Limits: total uses, **one use per customer**, start/end dates, minimum purchase amount or quantity, specific customers/segments. |
| **Magento / Adobe Commerce** (Cart Price Rules) | **Conditions** (cart subtotal, qty, shipping region, payment method) separated from **Actions** (which items get the discount). **Priority** plus **"Discard subsequent rules"** to stop stacking. **Maximum qty discount applied to**. Uses per coupon and **uses per customer**. Auto-generated unique coupon codes per rule. |
| **WooCommerce** (Coupons) | Include/**exclude** products and categories, **exclude sale items**, minimum/maximum spend, usage limit per coupon and **per user** (matched by email), "individual use only". |

What this means for our design:

- A **Promotion** (the rule) is separate from its **Codes** (one promotion can have one shared
  code like `DIWALI50` *or* thousands of unique single-use codes for influencers/customers).
- Use **discount classes** (`PRODUCT`, `ORDER`, `SHIPPING`) and **combination flags** instead of
  one `stackable` field. Default: one PRODUCT/ORDER code per order; SHIPPING can combine.
- **Conditions** (who/when/cart) and **targets** (which lines get money off) are different things.
- Support **exclude** lists, not only include lists.

---

## 3. Scope

**Phase 1 (build now):**
- Percentage off, flat amount off — on the order or on specific products/categories.
- Free delivery / delivery discount (applied when the owner sets the delivery charge, §8.5).
- Codes: one shared code or many unique single-use codes per promotion.
- Automatic offers (no code), e.g. "₹200 off above ₹2,500".
- Limits: total uses, uses per customer, first order only, min order value, min quantity, max
  discount cap, date window, payment method (ONLINE/COD), specific customers.
- Admin CRUD + redemption report; cart/checkout UI; discount shown on emails and GST invoice.

**Phase 2 (later, same model):** Buy X Get Y, tiered offers (spend more save more), referral,
birthday/anniversary codes, cashback/store credit, budget caps ("stop after ₹50,000 given away").

---

## 4. Database design (Prisma, MySQL)

Add a new module `src/lib/promotions/` and these models. Field names are a recommendation;
keep them consistent once chosen.

```prisma
enum PromotionKind        { CODE AUTOMATIC }
enum DiscountClass        { PRODUCT ORDER SHIPPING }
enum DiscountValueType    { PERCENTAGE FIXED_AMOUNT FREE_SHIPPING }
enum PromotionStatus      { DRAFT ACTIVE PAUSED EXPIRED ARCHIVED }
enum PromotionTargetType  { ALL_PRODUCTS PRODUCTS CATEGORIES }
enum RedemptionStatus     { RESERVED CONFIRMED RELEASED REVERSED }

model Promotion {
  id                    String            @id @default(uuid())
  title                 String            // internal name, e.g. "Diwali 2026 - 15% hampers"
  customerMessage       String?           // shown to customer, e.g. "Diwali special: 15% off hampers"
  kind                  PromotionKind     // CODE needs a code; AUTOMATIC applies itself
  discountClass         DiscountClass
  valueType             DiscountValueType
  percentBasisPoints    Int?              // 15% = 1500 (no floats). Required for PERCENTAGE
  amountPaise           BigInt?           // flat amount. Required for FIXED_AMOUNT
  maxDiscountPaise      BigInt?           // cap for PERCENTAGE (e.g. max ₹1,000)

  // Targets: which lines receive the discount (PRODUCT class)
  targetType            PromotionTargetType @default(ALL_PRODUCTS)
  excludeDiscountedItems Boolean          @default(false) // skip items already below MRP
  includeCustomizationFees Boolean        @default(false) // engraving/gift-wrap fees eligible?

  // Conditions: whether the promotion can be used at all
  startsAt              DateTime
  endsAt                DateTime?
  minSubtotalPaise      BigInt?           // computed on ELIGIBLE lines after product discounts
  minQuantity           Int?
  paymentMethods        Json?             // ["RAZORPAY","COD"]; null = any
  firstOrderOnly        Boolean           @default(false)
  customerSegment       String?           // "ALL" | "SPECIFIC" | "NEW" (phase 2: segments)

  // Limits
  totalUsageLimit       Int?              // null = unlimited
  perCustomerLimit      Int?              @default(1)
  usageCount            Int               @default(0)   // CONFIRMED + RESERVED, maintained atomically
  budgetPaise           BigInt?           // phase 2: stop when total discount given reaches this
  discountGivenPaise    BigInt            @default(0)

  // Combination (Shopify-style)
  combinesWithProduct   Boolean           @default(false)
  combinesWithOrder     Boolean           @default(false)
  combinesWithShipping  Boolean           @default(true)
  priority              Int               @default(0)   // only used to break ties, see §5.4

  status                PromotionStatus   @default(DRAFT)
  version               Int               @default(1)   // bump on any rule change
  createdById           String?
  updatedById           String?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  codes                 PromotionCode[]
  targets               PromotionTarget[]
  customers             PromotionCustomer[]
  redemptions           PromotionRedemption[]

  @@index([status, startsAt, endsAt])
  @@index([kind, status])
}

model PromotionCode {
  id            String    @id @default(uuid())
  promotionId   String
  promotion     Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  code          String    @unique          // stored UPPERCASE, trimmed; unique across all promotions
  usageLimit    Int?                       // 1 for single-use unique codes
  usageCount    Int       @default(0)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  @@index([promotionId])
}

model PromotionTarget {
  id           String    @id @default(uuid())
  promotionId  String
  promotion    Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  mode         String    // "INCLUDE" | "EXCLUDE"
  productId    String?
  categoryId   String?
  @@index([promotionId])
  @@unique([promotionId, mode, productId, categoryId])
}

model PromotionCustomer {         // "specific customers only"
  promotionId  String
  promotion    Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  userId       String
  @@id([promotionId, userId])
}

model PromotionRedemption {
  id              String           @id @default(uuid())
  promotionId     String
  promotion       Promotion        @relation(fields: [promotionId], references: [id])
  promotionCodeId String?
  orderId         String
  customerKey     String           // see §7.3 (userId, else hash of normalised phone)
  status          RedemptionStatus
  discountPaise   BigInt
  promotionVersion Int
  reservedAt      DateTime         @default(now())
  expiresAt       DateTime?        // RESERVED only; mirrors order.reservationExpiresAt
  confirmedAt     DateTime?
  releasedAt      DateTime?
  releaseReason   String?
  @@unique([promotionId, orderId])
  @@index([promotionId, customerKey, status])
  @@index([status, expiresAt])
}

/// Immutable snapshot of what was applied to an order (drives invoice, emails, refunds).
model OrderDiscount {
  id               String   @id @default(uuid())
  orderId          String
  order            Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  promotionId      String
  promotionVersion Int
  code             String?          // what the customer typed (normalised)
  title            String           // snapshot of customerMessage/title at order time
  discountClass    DiscountClass
  valueType        DiscountValueType
  percentBasisPoints Int?
  amountPaise      BigInt?
  discountPaise    BigInt           // total from this promotion on this order
  createdAt        DateTime @default(now())
  @@index([orderId])
}
```

Changes to existing models:

```prisma
model Order {
  // ...existing
  promoCode            String?        // the code entered (normalised), for search/reports — the "separate column"
  discountTotalPaise   BigInt @default(0)   // already exists — now actually filled
  shippingDiscountPaise BigInt @default(0)
  discounts            OrderDiscount[]
}

model OrderItem {
  // ...existing
  discountPaise        BigInt @default(0)   // this line's share of all PRODUCT + ORDER discounts
  taxablePaise         BigInt?              // after discount (makes GST + refunds exact)
}

model Cart {
  // ...existing
  promoCode            String?              // only the code; never an amount
}
```

**Migration note (important for this project):** Hostinger deploys only run `prisma generate`.
New columns on `Order` / `OrderItem` will make *every* order query fail in production until the
migration is applied. Ship the migration with a deploy step that runs `npx prisma migrate deploy`
(or apply it manually in hPanel/phpMyAdmin) **before** the new code goes live.

---

## 5. The engine (`src/lib/promotions/engine.ts`)

One pure function used by preview, order creation and re-pricing:

```ts
evaluatePromotions(input: {
  lines: PricedLine[];          // from calculateCartPricing BEFORE tax: productId, categoryId,
                                // unitPricePaise, mrpPaise, qty, customizationPaise
  code?: string;                // raw user input
  customer: { userId?: string; phone?: string; email?: string; isFirstOrder: boolean };
  paymentMethod?: 'RAZORPAY' | 'COD';
  shippingPaise?: number;       // known only after owner sets the charge (§8.5)
  now: Date;
}): {
  applied: AppliedDiscount[];   // per promotion: id, version, class, amount, per-line allocation
  lineDiscounts: Map<lineIndex, paise>;
  orderDiscountPaise: number;
  shippingDiscountPaise: number;
  rejected?: { code: string; reason: RejectReason }; // for the typed code only
}
```

The engine reads promotions but **never writes**. Writing (reserve/confirm/release) is done by
`redemption.service.ts` (§7).

### 5.1 Validation order for a typed code

Stop at the first failure and return one reason code (map to a customer message, §9.3):

1. Normalise: `trim()`, uppercase, max 32 chars, `[A-Z0-9-]` only → else `INVALID`.
2. Code exists and `PromotionCode.isActive` → else `INVALID` (same message as unknown — don't
   reveal whether a code exists).
3. Promotion `status = ACTIVE` and `startsAt ≤ now < endsAt` → else `EXPIRED` / `NOT_STARTED`.
4. Code limit (`PromotionCode.usageCount < usageLimit`) and promotion limit
   (`usageCount < totalUsageLimit`) → else `USAGE_LIMIT_REACHED`.
5. Customer rules: specific-customer list, `firstOrderOnly`, `perCustomerLimit` (count
   RESERVED + CONFIRMED redemptions for this `customerKey`) → else `NOT_ELIGIBLE` /
   `ALREADY_USED`. Guests: see §7.3.
6. Payment method matches (if set) → else `PAYMENT_METHOD`. (Re-checked when the customer picks
   COD vs online.)
7. At least one **eligible line** (targets include/exclude, `excludeDiscountedItems`) → else
   `NO_ELIGIBLE_ITEMS`.
8. `minQuantity` and `minSubtotalPaise` on eligible lines → else `MIN_ORDER` (tell how much more
   to add: "Add ₹340 more to use DIWALI50").
9. Combination with already-applied automatic discounts (§5.4) → else `NOT_COMBINABLE`.
10. Compute discount (§5.2). If result is 0 → `NO_DISCOUNT`.

### 5.2 Calculating the amount

All in paise. Let `E` = sum of eligible line amounts (`unitPricePaise × qty`, plus
customization fees only if `includeCustomizationFees`).

- `PERCENTAGE`: `raw = floor(E × percentBasisPoints / 10000)`; `discount = min(raw, maxDiscountPaise ?? ∞)`.
- `FIXED_AMOUNT`: `discount = min(amountPaise, E)`.
- `FREE_SHIPPING`: `discount = shippingPaise` (or `min(amountPaise, shippingPaise)` for "₹50 off delivery").

Always `floor` the customer discount (never round up in the customer's favour by accident on
every line — use the allocation below).

### 5.3 Allocating to lines (needed for GST and refunds)

Spread a PRODUCT/ORDER discount across eligible lines **proportionally to line amount** using the
**largest-remainder method** so the parts add up exactly to the total:

```
share_i = floor(discount × amount_i / E)
remainder = discount − Σ share_i
give 1 paisa extra to the `remainder` lines with the largest fractional parts
(tie → higher amount, then lower line index)
cap: share_i ≤ amount_i − already_discounted_i
```

Store each line's share in `OrderItem.discountPaise`.

### 5.4 Multiple offers, stacking and priority

- At most **one PRODUCT/ORDER discount from a code** per order (phase 1).
- **Automatic** offers are evaluated too. If the customer's code and an automatic offer are both
  PRODUCT/ORDER class and either has `combinesWith… = false`, apply **only the one that saves the
  customer more** (that's what Shopify does and avoids "why did my code make it more expensive?").
  `priority` only breaks ties.
- SHIPPING discounts combine with others when both sides allow it (default yes).
- Apply order: PRODUCT discounts → ORDER discounts (on the remaining amount) → tax → SHIPPING.
- Global safety caps (config in Business Settings): **max discount % of eligible subtotal**
  (e.g. 70%) and **max discount per order** (e.g. ₹5,000). If a rule would exceed it, cap it and
  log `CAPPED`. This is the backstop against a typo like "500%" or "₹50000".

---

## 6. GST rules (India) — how discount meets tax

- A discount **given before or at the time of sale and shown on the invoice** reduces the taxable
  value (CGST Act s.15(3)(a)). So: `line taxable = line amount − line discount`, then tax at that
  line's own rate. This is why §5.3 allocation is mandatory — lines have different GST rates.
- For tax-inclusive products, discount the inclusive price first, then back out tax from the
  discounted amount.
- Invoice and confirmation email show per line: price, discount, taxable value, CGST/SGST/IGST;
  plus "Promo DIWALI50 − ₹X" in the summary.
- Free/discounted **delivery** reduces the delivery line, not the products.
- Fix in the same change: gift-wrap fee is currently untaxed — give it its own taxable line.
- Accountant should confirm the HSN/rate of delivery and gift-wrap lines.

---

## 7. Redemption lifecycle (where money leaks are stopped)

### 7.1 States

```
          create order (online/COD)           payment captured / COD accepted
 (none) ───────────────► RESERVED ───────────────────────────────► CONFIRMED
                            │                                          │
     payment failed/expired │ customer/owner cancels before pay        │ order cancelled/refunded after pay
     COD rejected           ▼                                          ▼
                         RELEASED                                   REVERSED
```

- RESERVED counts toward limits (so two people can't both get the last use).
- RELEASED/REVERSED give the use back (counter −1) — except **single-use unique codes are not
  re-issued after REVERSED** unless admin re-enables (prevents "order, refund, reuse").

### 7.2 Atomic reserve (inside the same DB transaction that creates the order)

```sql
-- promotion-level limit
UPDATE Promotion SET usageCount = usageCount + 1
 WHERE id = ? AND status = 'ACTIVE' AND (totalUsageLimit IS NULL OR usageCount < totalUsageLimit);
-- must affect exactly 1 row, else abort with USAGE_LIMIT_REACHED

-- code-level limit
UPDATE PromotionCode SET usageCount = usageCount + 1
 WHERE id = ? AND isActive = 1 AND (usageLimit IS NULL OR usageCount < usageLimit);

-- per-customer limit: SELECT COUNT(*) ... FOR UPDATE on (promotionId, customerKey, status IN RESERVED/CONFIRMED)
-- then INSERT PromotionRedemption(status RESERVED, expiresAt = order.reservationExpiresAt)
```

In Prisma: `tx.promotion.updateMany({ where: {...conditions}, data: { usageCount: { increment: 1 } } })`
and check `count === 1`. Never `findUnique` then `update`.

### 7.3 Who is "the same customer"? (`customerKey`)

- Logged in → `user:<userId>`.
- Guest → `phone:<sha256(normalised 10-digit mobile)>`. Phone is harder to fake than email.
- For `firstOrderOnly` / `perCustomerLimit`, check **both** the user id and the phone hash
  against past CONFIRMED redemptions and past paid orders. This blocks "new Gmail every time".

### 7.4 Hooks into existing code

| Existing step (file) | Promotion action |
|---|---|
| `POST /api/checkout/quote` (cart preview) | `evaluatePromotions` only; no reservation. Returns breakdown + reason. |
| `createOrder` in `src/lib/orders/order.service.ts` | Re-evaluate with server prices; reserve atomically in the order transaction; write `OrderDiscount`, `Order.promoCode`, per-line `discountPaise`. If the code is now invalid → create order **without** it and return a clear message (or reject — choose one, document it). |
| `updateOrderDeliveryCharge` (owner sets charge) | Recompute SHIPPING discounts; re-check `minSubtotal` is unaffected; update totals before the customer approval email. |
| `initiatePayment` (`payment.service.ts`) | Assert order's discount snapshot still valid (reservation not RELEASED/expired); amount = server grand total. |
| `verifyCallbackPayment` / Razorpay webhook capture | RESERVED → CONFIRMED (idempotent). Late payment on expired hold → reconciliation, keep RESERVED until resolved. |
| Payment failed / hold expired job / `customerProcessFinalAmount(REJECT)` / `rejectCodOrder` / cancel | RESERVED → RELEASED (counter −1). |
| `approveCodOrder` / customer approves COD | RESERVED → CONFIRMED. |
| Refund (`refund.service.ts`) | Full refund → REVERSED. Partial refund → refund **net of the line's allocated discount** (customer never gets back more than they paid). |

Add a scheduled cleanup (`/api/admin/promotions/release-expired`, or piggyback on the existing
reservation-release route) that releases RESERVED rows whose `expiresAt` passed.

---

## 8. Business scenarios to handle explicitly

1. **Price changed between cart and checkout** → re-evaluated at order creation; the customer
   sees the new total on the approval screen.
2. **Item removed so min order no longer met** → code drops off with the "add ₹X more" message.
3. **Code expires while the order waits for the owner's delivery charge** → the reservation made
   at order creation holds until the hold expires; the customer keeps the deal they were shown.
4. **COD vs online-only code** → re-validated when payment method changes and at order creation.
5. **Delivery charge is set later by the owner** (this store's flow) → free-delivery promos apply
   at that moment; the customer approval email shows "Delivery ₹80 − ₹80 (FREEDEL)".
6. **Customised items** → `includeCustomizationFees` decides whether engraving fees get money off.
7. **Already discounted (MRP > price)** → `excludeDiscountedItems` to avoid double discounting.
8. **Same code on two tabs at once** → second reservation fails per-customer check.
9. **Admin edits a live promotion** → see §10.2.

---

## 9. APIs

### 9.1 Customer

```
POST /api/checkout/quote          body: { items, destinationStateCode, promoCode?, paymentMethod? }
   → { lines[], itemsSubtotalPaise, discounts:[{title, code, amountPaise}], discountTotalPaise,
       shippingDiscountPaise, taxTotalPaise, grandTotalPaise, promo: { status, reason?, message } }

POST /api/checkout/orders         body: existing + { promoCode? }      (server re-validates + reserves)
```

No endpoint ever accepts `discountPaise` from the client. Rate-limit code checks:
`PROMO_APPLY` 10 attempts / 10 min per IP and per user (add to `RATE_LIMIT_PRESETS`).

### 9.2 Admin (ADMIN role; STAFF read-only)

```
GET    /api/admin/promotions?status=&q=
POST   /api/admin/promotions                       create (status DRAFT)
GET    /api/admin/promotions/:id                   incl. stats
PATCH  /api/admin/promotions/:id                   see edit rules §10.2
POST   /api/admin/promotions/:id/activate | pause | archive
POST   /api/admin/promotions/:id/codes/generate    { count, prefix, usageLimit:1 } → unique codes, CSV download
GET    /api/admin/promotions/:id/redemptions       orders, customers, discount, status
POST   /api/admin/promotions/preview               dry-run a cart against a draft promotion
```

### 9.3 Customer-facing messages (never reveal internals)

| Reason | Message |
|---|---|
| INVALID | "This code isn't valid." |
| EXPIRED / NOT_STARTED | "This offer has ended." / "This offer starts on 20 Oct." |
| USAGE_LIMIT_REACHED | "This offer is fully redeemed." |
| ALREADY_USED | "You've already used this code." |
| NOT_ELIGIBLE | "This code isn't available for your account." |
| PAYMENT_METHOD | "This code works with online payment only." |
| NO_ELIGIBLE_ITEMS | "This code doesn't apply to items in your bag." |
| MIN_ORDER | "Add ₹340 more to use DIWALI50." |
| NOT_COMBINABLE | "This code can't be combined with your current offer." |

---

## 10. Admin panel

### 10.1 Create / edit form (sections)

1. **Basics** — title, customer message, code (or "automatic"), generate unique codes.
2. **Discount** — type (% / ₹ / free delivery), value, max cap, class.
3. **Applies to** — all products / selected products / selected categories; exclude list;
   exclude already-discounted items; include customization fees.
4. **Conditions** — min order value, min qty, payment method, first order only, specific
   customers.
5. **Limits** — total uses, uses per customer.
6. **Schedule** — start / end (Asia/Kolkata).
7. **Combinations** — combine with product / order / shipping discounts.
8. **Preview** — pick sample products → see the exact discount and GST.
9. Live summary card: "15% off Gift Hampers, max ₹1,000, min ₹2,000, 1 use per customer,
   20–31 Oct, online only".

### 10.2 Edit rules (prevent silent changes)

- DRAFT: anything editable.
- ACTIVE with **no** redemptions: editable; bump `version`.
- ACTIVE **with** redemptions: only end date (extend/shorten), limits (increase), status, message.
  Changing value/targets/conditions → "Duplicate as new promotion" (old one paused). Past orders
  keep their `OrderDiscount` snapshot either way.
- Every create/edit/status change → `AuditLog` (`PROMOTION_CREATED`, `PROMOTION_UPDATED` with
  before/after JSON, `PROMOTION_ACTIVATED`, …). Optional: discounts above the safety cap need a
  second ADMIN to activate.

### 10.3 Reports

Per promotion: uses, unique customers, orders, revenue, discount given, average order value,
redemptions by status, top products. CSV export (reuse Reports tab patterns).

---

## 11. Customer UI

- Cart & checkout: code box → calls `/api/checkout/quote` → shows server result only.
- Show applied offers as chips with "Remove"; show automatic offers ("You saved ₹200 with
  Festive Saver").
- "Add ₹X more" nudge from `MIN_ORDER`.
- Order confirmation, approval screen, emails and GST invoice show discount lines and the code.
- Delete the hard-coded `applyCoupon` codes from `AppContext.tsx`.

---

## 12. Security & fraud checklist

- [ ] Client never sends amounts; server recomputes at quote, order, payment, capture.
- [ ] Atomic conditional updates for all counters; unique `(promotionId, orderId)`.
- [ ] Per-customer limit uses user id **and** phone hash; first-order checks past paid orders.
- [ ] Rate limit code attempts; same error for unknown/inactive codes (no code enumeration).
- [ ] Unique codes ≥ 10 random chars from an unambiguous alphabet (no 0/O, 1/I), not sequential.
- [ ] Global caps (max % and max ₹ per order) as a typo backstop.
- [ ] Discount ≤ eligible amount per line; total ≥ 0; refunds net of discount.
- [ ] RESERVED released on fail/expiry/cancel/reject; single-use codes not recycled after refund.
- [ ] ADMIN-only create/activate; STAFF read-only; full audit with before/after.
- [ ] Snapshot on order; editing/deleting a promotion never touches past orders.
- [ ] Log every apply attempt (code, customerKey, cart value, result, IP) for abuse review —
      store IP/device only as long as needed (privacy).

---

## 13. Tests that must pass before go-live

Unit (`src/test/promotions.test.ts`):
1. 15% with ₹1,000 cap on ₹10,000 eligible → ₹1,000.
2. Flat ₹500 on a ₹300 eligible subtotal → ₹300 (never negative).
3. Allocation across 3 lines with 5%, 12%, 18% GST sums exactly to the discount; tax per line correct.
4. Exclude list beats include list; `excludeDiscountedItems` skips MRP-discounted items.
5. Min order computed on eligible lines only.
6. Automatic ₹200 vs code 10% → picks the bigger saving when not combinable.
7. Free delivery applied only when shipping is set; never more than the shipping charge.
8. Expired / not started / paused / archived rejected with the right reason.

Integration (real DB):
9. **Race**: 20 parallel orders on a code with `totalUsageLimit = 5` → exactly 5 succeed.
10. **Per customer**: same user, two tabs → only one reservation.
11. Guest with new email but same phone → `ALREADY_USED`.
12. Payment fail / hold expiry / COD reject → RELEASED, counter back.
13. Capture via callback and webhook both → CONFIRMED once (idempotent).
14. Full refund → REVERSED; partial refund amount = paid share only.
15. Admin edits value of a promotion with redemptions → blocked; old order invoice unchanged.
16. Tampered request with `discountPaise` in body → ignored.
17. Razorpay amount equals server grand total after discount.

---

## 14. Build order

1. Remove fake client coupons (§0). Fix gift-wrap GST.
2. Prisma models + migration (+ deploy step for `migrate deploy`).
3. `engine.ts` (pure) + unit tests 1–8.
4. `redemption.service.ts` (reserve/confirm/release/reverse) + hooks in §7.4 + tests 9–17.
5. Extend `calculateCartPricing` to take the engine result: per-line discount before tax.
6. `/api/checkout/quote` + `/api/checkout/orders` accept `promoCode`.
7. Admin APIs + Admin "Offers & Coupons" screen (sidebar item already exists → point it here).
8. Cart/checkout UI, emails, GST invoice lines.
9. Reports + expired-reservation cleanup job.
10. Staging test with real Razorpay test mode; then production.

---

## 15. Review of the earlier draft (what changed and why)

The earlier draft (promotions / promotion_products / promotion_categories / promotion_users /
promotion_usage / cart.promo_code) is a good starting point. Changes made in this spec to close
money leaks:

| Draft | Problem | This spec |
|---|---|---|
| `promo_code` column on `promotions` | One code per promotion; no unique single-use codes | Separate `PromotionCode` table |
| "Increase usage count after payment success" | Between checkout and payment many people can use the last slot | **Reserve** atomically at order creation; confirm on payment; release on failure |
| `stackable` boolean + "highest priority wins" | Can make a customer pay more; unclear rules | Shopify-style classes + combine flags; pick best saving; priority only for ties |
| `percentage` field | Float risk | `percentBasisPoints` integer |
| No per-line discount | GST and partial refunds become wrong | Largest-remainder allocation + `OrderItem.discountPaise` |
| No order snapshot | Editing a promotion changes history | `OrderDiscount` snapshot + `version` |
| Per-user limit by user id only | New email = new customer | `customerKey` with phone hash |
| No refund handling | Customer refunded more than paid; codes recycled | REVERSED state, refunds net of discount |
| No caps | Admin typo gives away money | Global max % / max ₹ caps |
| Device/browser stored on every apply | Privacy + noise | Log essentials, short retention |
| Separate "Promotion Service" microservice | Overkill for this app | Separate **module** (`src/lib/promotions/`) inside the same Next.js app; same principle, no network hop |
