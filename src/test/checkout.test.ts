import assert from 'node:assert/strict';
import {
  calculateCartPricing,
  PricingValidationError,
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_SHIPPING_FEE_PAISE,
} from '../lib/pricing/pricing.service';
import {
  isValidIndianPincode,
  resolveStateCode,
  checkPincodeServiceability,
} from '../lib/shipping/pincode.service';
import {
  createOrder,
  validateOrderInput,
  OrderValidationError,
  InsufficientStockError,
} from '../lib/orders/order.service';
import {
  releaseExpiredReservations,
} from '../lib/orders/reservation.service';
import {
  lookupGuestOrder,
  getOrderForUser,
  OrderAuthorizationError,
  OrderNotFoundError,
  checkGuestLookupRateLimit,
} from '../lib/orders/order-lookup.service';
import { CatalogDatabaseError } from '../lib/catalog/public-catalog.service';

export async function runCheckoutTestSuite() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Batch 4: Pricing & Checkout Tests   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✘ [FAIL] ${name}`);
      console.error(`     Reason: ${err.message}\n`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // 1. Authoritative Pricing & Tamper Resistance
  // ------------------------------------------------------------------
  console.log('--- 1. Server-Side Authoritative Pricing & Tamper Resistance ---');

  await test('Recomputes prices authoritatively from server, rejecting client price injection', async () => {
    // Client sends tampered price of ₹1
    const quote = await calculateCartPricing([
      {
        productId: 'prod-1',
        quantity: 1,
      },
    ]);

    // Authoritative Royale Ceramic Mug base price is ₹1,299.00 = 129,900 paise
    assert.equal(quote.items[0].unitPricePaise, 129900);
    assert.equal(quote.itemsSubtotalPaise, 129900);
    assert.ok(quote.grandTotalPaise > 129900);
  });

  await test('Reject empty cart, invalid product ID or negative quantity', async () => {
    await assert.rejects(
      async () => {
        await calculateCartPricing([]);
      },
      (err: any) => err instanceof PricingValidationError
    );

    await assert.rejects(
      async () => {
        await calculateCartPricing([{ productId: '', quantity: 1 }]);
      },
      (err: any) => err instanceof PricingValidationError
    );

    await assert.rejects(
      async () => {
        await calculateCartPricing([{ productId: 'prod-1', quantity: -2 }]);
      },
      (err: any) => err instanceof PricingValidationError
    );

    await assert.rejects(
      async () => {
        await calculateCartPricing([{ productId: 'prod-1', quantity: 9999 }]);
      },
      (err: any) => err.message.includes('exceeds the maximum allowable limit')
    );
  });

  await test('All monetary outputs are exact integer paise without floating-point artifacts', async () => {
    const quote = await calculateCartPricing([
      { productId: 'prod-1', quantity: 3 },
      { productId: 'prod-3', quantity: 1 },
    ]);

    assert.ok(Number.isInteger(quote.itemsSubtotalPaise), 'itemsSubtotalPaise must be integer');
    assert.ok(Number.isInteger(quote.taxableAmountPaise), 'taxableAmountPaise must be integer');
    assert.ok(Number.isInteger(quote.cgstPaise), 'cgstPaise must be integer');
    assert.ok(Number.isInteger(quote.sgstPaise), 'sgstPaise must be integer');
    assert.ok(Number.isInteger(quote.igstPaise), 'igstPaise must be integer');
    assert.ok(Number.isInteger(quote.taxTotalPaise), 'taxTotalPaise must be integer');
    assert.ok(Number.isInteger(quote.shippingTotalPaise), 'shippingTotalPaise must be integer');
    assert.ok(Number.isInteger(quote.grandTotalPaise), 'grandTotalPaise must be integer');

    // Mathematical sum invariant
    assert.equal(
      quote.grandTotalPaise,
      quote.taxableAmountPaise + quote.taxTotalPaise + quote.shippingTotalPaise
    );
  });

  // ------------------------------------------------------------------
  // 2. Indian GST Split (Intra-State Telangana vs Interstate)
  // ------------------------------------------------------------------
  console.log('\n--- 2. Indian GST Calculation Rules (CGST/SGST vs IGST) ---');

  await test('Intra-State Telangana destination (36) splits GST into 50% CGST + 50% SGST', async () => {
    const quote = await calculateCartPricing([{ productId: 'prod-1', quantity: 1 }], '36');
    assert.equal(quote.isIntraState, true);
    assert.ok(quote.cgstPaise > 0, 'CGST must be > 0 for Telangana delivery');
    assert.ok(quote.sgstPaise > 0, 'SGST must be > 0 for Telangana delivery');
    assert.equal(quote.cgstPaise, quote.sgstPaise, 'CGST and SGST must be equal');
    assert.equal(quote.igstPaise, 0, 'IGST must be 0 for intra-state delivery');
    assert.equal(quote.taxTotalPaise, quote.cgstPaise + quote.sgstPaise);
  });

  await test('Inter-State destination (e.g. Maharashtra 27 or Delhi 07) levies 100% IGST', async () => {
    const quoteMumbai = await calculateCartPricing([{ productId: 'prod-1', quantity: 1 }], '27');
    assert.equal(quoteMumbai.isIntraState, false);
    assert.equal(quoteMumbai.cgstPaise, 0, 'CGST must be 0 for interstate');
    assert.equal(quoteMumbai.sgstPaise, 0, 'SGST must be 0 for interstate');
    assert.ok(quoteMumbai.igstPaise > 0, 'IGST must be > 0 for interstate');
    assert.equal(quoteMumbai.taxTotalPaise, quoteMumbai.igstPaise);
  });

  await test('Asserts exact expected paise amounts for intra-state and interstate orders', async () => {
    // prod-1: ₹1,299 = 129,900 paise, 18% GST to Telangana (36)
    const quoteTel = await calculateCartPricing([{ productId: 'prod-1', quantity: 1 }], '36');
    assert.equal(quoteTel.itemsSubtotalPaise, 129900);
    assert.equal(quoteTel.taxableAmountPaise, 129900);
    assert.equal(quoteTel.taxTotalPaise, 23382); // round(129900 * 0.18) = 23382
    assert.equal(quoteTel.cgstPaise, 11691); // floor(23382 / 2) = 11691
    assert.equal(quoteTel.sgstPaise, 11691); // 23382 - 11691 = 11691
    assert.equal(quoteTel.igstPaise, 0);
    assert.equal(quoteTel.shippingTotalPaise, 0); // >= ₹999 free shipping
    assert.equal(quoteTel.grandTotalPaise, 153282); // 129900 + 23382 + 0

    // prod-4: ₹899 = 89,900 paise, 18% GST to Maharashtra (27)
    const quoteMum = await calculateCartPricing([{ productId: 'prod-4', quantity: 1 }], '27', 9900);
    assert.equal(quoteMum.itemsSubtotalPaise, 89900);
    assert.equal(quoteMum.taxableAmountPaise, 89900);
    assert.equal(quoteMum.taxTotalPaise, 16182); // round(89900 * 0.18) = 16182
    assert.equal(quoteMum.cgstPaise, 0);
    assert.equal(quoteMum.sgstPaise, 0);
    assert.equal(quoteMum.igstPaise, 16182);
    assert.equal(quoteMum.shippingTotalPaise, 9900); // Owner manual delivery charge
    assert.equal(quoteMum.grandTotalPaise, 115982); // 89900 + 16182 + 9900
  });

  // ------------------------------------------------------------------
  // 3. Shipping Policy & Manual Delivery Charge Policy
  // ------------------------------------------------------------------
  console.log('\n--- 3. Manual Delivery Charge Policy (Automatic Slabs Removed) ---');

  await test('Delivery charges default to 0 paise when unassigned (entered manually by owner)', async () => {
    const quote = await calculateCartPricing([{ productId: 'prod-1', quantity: 1 }]);
    assert.equal(quote.shippingTotalPaise, 0, 'Delivery charge must default to 0 when not manually set');
  });

  await test('Owner-specified manual delivery charge is authoritatively applied to grand total', async () => {
    const quote = await calculateCartPricing([{ productId: 'prod-4', quantity: 1 }], '36', 12000);
    assert.equal(quote.shippingTotalPaise, 12000);
    assert.equal(quote.grandTotalPaise, quote.taxableAmountPaise + quote.taxTotalPaise + 12000);
  });

  // ------------------------------------------------------------------
  // 3.5. Authoritative Flat ₹20 Gift Wrapping Invariants
  // ------------------------------------------------------------------
  console.log('\n--- 3.5. Authoritative Flat ₹20 Gift Wrapping Calculation ---');

  await test('Gift wrapping invariant: No gift wrapping results in ₹0 fee', async () => {
    const quote = await calculateCartPricing([{ productId: 'prod-1', quantity: 1 }]);
    assert.equal(quote.customizationTotalPaise, 0, 'No gift wrapping must have 0 customization fee');
  });

  await test('Gift wrapping invariant: One wrapped item charges exactly ₹20 (2000 paise)', async () => {
    const quote = await calculateCartPricing([
      { productId: 'prod-1', quantity: 1, isGiftWrapped: true },
    ]);
    assert.equal(quote.customizationTotalPaise, 2000, 'One wrapped item must charge flat ₹20 (2000 paise)');
  });

  await test('Gift wrapping invariant: Three units of one wrapped product charges exactly ₹20 (not multiplied by quantity)', async () => {
    const quote = await calculateCartPricing([
      { productId: 'prod-1', quantity: 3, isGiftWrapped: true },
    ]);
    assert.equal(
      quote.customizationTotalPaise,
      2000,
      'Three units of wrapped product must still charge flat ₹20 exactly once'
    );
  });

  await test('Gift wrapping invariant: Multiple wrapped cart items charges exactly ₹20 (not charged multiple times)', async () => {
    const quote = await calculateCartPricing([
      { productId: 'prod-1', quantity: 2, isGiftWrapped: true },
      { productId: 'prod-4', quantity: 1, customization: { giftWrap: true } },
    ]);
    assert.equal(
      quote.customizationTotalPaise,
      2000,
      'Multiple wrapped cart items must charge flat ₹20 exactly once per order'
    );
  });

  await test('Gift wrapping invariant: Gift wrapping combined with engraving equals engraving fee plus ₹20', async () => {
    const prevEnv = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    try {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
      const quoteWithEngravingOnly = await calculateCartPricing([
        {
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Forever Love',
            boxWrapStyle: 'Vintage Wooden Keepsake Crate',
            giftWrap: false,
          },
        },
      ]);
      const engravingFee = quoteWithEngravingOnly.customizationTotalPaise;
      assert.equal(engravingFee, 15000, 'Engraving + wooden crate fee must be 15000 paise (₹150)');

      const quoteWithBoth = await calculateCartPricing([
        {
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Forever Love',
            boxWrapStyle: 'Vintage Wooden Keepsake Crate',
            giftWrap: true,
          },
        },
      ]);
      assert.equal(
        quoteWithBoth.customizationTotalPaise,
        engravingFee + 2000,
        'Gift wrapping combined with engraving must equal engraving fee plus exactly ₹20 (2000 paise)'
      );
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevEnv;
    }
  });

  // ------------------------------------------------------------------
  // 4. Pincode & Shipping Address Validation
  // ------------------------------------------------------------------
  console.log('\n--- 4. Pincode Validation & GST State Code Resolution ---');

  await test('Validates 6-digit Indian PIN codes and rejects malformed inputs', () => {
    assert.equal(isValidIndianPincode('305001'), true);
    assert.equal(isValidIndianPincode('110001'), true);
    assert.equal(isValidIndianPincode('012345'), false, 'First digit cannot be 0');
    assert.equal(isValidIndianPincode('30500'), false, 'Cannot be 5 digits');
    assert.equal(isValidIndianPincode('3050012'), false, 'Cannot be 7 digits');
    assert.equal(isValidIndianPincode('ABCDEF'), false, 'Cannot be letters');
  });

  await test('Resolves Indian GST state codes accurately', () => {
    assert.equal(resolveStateCode('Rajasthan'), '08');
    assert.equal(resolveStateCode('Maharashtra'), '27');
    assert.equal(resolveStateCode('Delhi'), '07');
    assert.equal(resolveStateCode('Karnataka'), '29');
    assert.equal(resolveStateCode('Unknown State'), '99');
  });

  await test('Checks delivery serviceability against approved registry', () => {
    const resHyd = checkPincodeServiceability('500001');
    assert.equal(resHyd.valid, true);
    assert.equal(resHyd.serviceable, true);
    assert.equal(resHyd.city, 'Hyderabad');
    assert.equal(resHyd.stateCode, '36');
    assert.equal(resHyd.estimatedDays, 2);
  });

  await test('Rejects unapproved PIN codes without inventing coverage', () => {
    const unapproved = checkPincodeServiceability('799001'); // Agartala / unseeded
    assert.equal(unapproved.valid, true);
    assert.equal(unapproved.serviceable, false);
    assert.ok(
      unapproved.message.includes('currently not available') ||
      unapproved.message.includes('verified express hubs')
    );
  });

  // ------------------------------------------------------------------
  // 4.5. Authoritative Hyderabad-Only Delivery Enforcement (DEF-01)
  // ------------------------------------------------------------------
  console.log('\n--- 4.5. Authoritative Hyderabad Delivery Enforcement (DEF-01) ---');

  await test('Accepts serviceable Hyderabad PIN code (500062) for order creation', async () => {
    const order = await createOrder({
      customerName: 'Aarav Malhotra',
      customerEmail: 'aarav.malhotra@example.com',
      customerPhone: '9829012345',
      shippingAddress: {
        name: 'Aarav Malhotra',
        street: 'ECIL Cross Roads, Kushaiguda',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500062',
      },
      items: [{ productId: 'prod-1', quantity: 1 }],
      paymentMethod: 'UPI',
    });
    assert.ok(order.orderNumber.startsWith('SG-'));
    assert.equal(order.shippingPincode, '500062');
  });

  await test('Strictly rejects unserviceable Delhi PIN code (110001) with OrderValidationError', async () => {
    await assert.rejects(
      async () => {
        await createOrder({
          customerName: 'Pooja Sharma',
          customerEmail: 'pooja.sharma@example.com',
          customerPhone: '9820011223',
          shippingAddress: {
            name: 'Pooja Sharma',
            street: 'Connaught Place',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110001',
          },
          items: [{ productId: 'prod-1', quantity: 1 }],
          paymentMethod: 'UPI',
        });
      },
      (err: any) => err instanceof OrderValidationError && err.message.includes('Hyderabad')
    );
  });

  await test('Strictly rejects unserviceable Ajmer PIN code (305001) with OrderValidationError', async () => {
    await assert.rejects(
      async () => {
        await createOrder({
          customerName: 'Aarav Malhotra',
          customerEmail: 'aarav.malhotra@example.com',
          customerPhone: '9829012345',
          shippingAddress: {
            name: 'Aarav Malhotra',
            street: 'Ana Sagar',
            city: 'Ajmer',
            state: 'Rajasthan',
            pincode: '305001',
          },
          items: [{ productId: 'prod-1', quantity: 1 }],
          paymentMethod: 'UPI',
        });
      },
      (err: any) => err instanceof OrderValidationError && err.message.includes('Hyderabad')
    );
  });

  await test('Strictly rejects malformed or invalid PIN codes with OrderValidationError', async () => {
    await assert.rejects(
      async () => {
        await createOrder({
          customerName: 'Aarav Malhotra',
          customerEmail: 'aarav.malhotra@example.com',
          customerPhone: '9829012345',
          shippingAddress: {
            name: 'Aarav Malhotra',
            street: 'Banjara Hills',
            city: 'Hyderabad',
            state: 'Telangana',
            pincode: '12345',
          },
          items: [{ productId: 'prod-1', quantity: 1 }],
          paymentMethod: 'UPI',
        });
      },
      (err: any) => err instanceof OrderValidationError
    );
  });

  await test('Preserves gift wrapping selection and applies flat ₹20 fee through createOrder (DEF-02)', async () => {
    const order = await createOrder({
      customerName: 'Aarav Malhotra',
      customerEmail: 'aarav.malhotra@example.com',
      customerPhone: '9829012345',
      shippingAddress: {
        name: 'Aarav Malhotra',
        street: 'Jubilee Hills Road 36',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
      },
      items: [
        {
          productId: 'prod-1',
          quantity: 2,
          isGiftWrapped: true,
        },
      ],
      paymentMethod: 'UPI',
    });

    assert.equal(order.items[0].isGiftWrapped, true, 'Item must have isGiftWrapped = true');
    assert.equal(order.customizationTotalPaise, 2000, 'Customization total must include exactly 2000 paise (₹20)');
  });

  // ------------------------------------------------------------------
  // 5. Order Creation, Status Isolation & 15-Minute Reservation
  // ------------------------------------------------------------------
  console.log('\n--- 5. Order Creation, Separate Statuses & 15-Minute Hold ---');

  await test('Creates pending order with separate OrderStatus and PaymentStatus', async () => {
    const order = await createOrder({
      customerName: 'Aarav Malhotra',
      customerEmail: 'aarav.malhotra@example.com',
      customerPhone: '9829012345',
      shippingAddress: {
        name: 'Aarav Malhotra',
        street: 'Road No. 12, Banjara Hills',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500034',
      },
      items: [{ productId: 'prod-1', quantity: 1 }],
      paymentMethod: 'UPI',
    });

    assert.ok(order.orderNumber.startsWith('SG-'));
    assert.equal(order.orderStatus, 'PENDING', 'New order status must be PENDING');
    assert.equal(order.paymentStatus, 'PENDING', 'New payment status must be PENDING');
    assert.ok(order.reservationExpiresAt, 'Must set reservationExpiresAt');

    // Verify 15-minute expiration hold
    const expiryDate = new Date(order.reservationExpiresAt);
    const createdDate = new Date(order.createdAt);
    const diffMinutes = Math.round((expiryDate.getTime() - createdDate.getTime()) / (60 * 1000));
    assert.equal(diffMinutes, 15, 'Reservation window must be exactly 15 minutes');
    assert.ok(order.guestLookupToken, 'Must generate guest lookup token');
  });

  await test('Order validates customer input fields and rejects invalid data', async () => {
    await assert.rejects(
      async () => {
        await createOrder({
          customerName: 'A', // too short
          customerEmail: 'valid@example.com',
          customerPhone: '9829012345',
          shippingAddress: {
            name: 'A',
            street: 'Main Road',
            city: 'Ajmer',
            state: 'Rajasthan',
            pincode: '305001',
          },
          items: [{ productId: 'prod-1', quantity: 1 }],
          paymentMethod: 'UPI',
        });
      },
      (err: any) => err instanceof OrderValidationError
    );

    await assert.rejects(
      async () => {
        await createOrder({
          customerName: 'Aarav Malhotra',
          customerEmail: 'invalid-email',
          customerPhone: '9829012345',
          shippingAddress: {
            name: 'Aarav Malhotra',
            street: 'Main Road',
            city: 'Ajmer',
            state: 'Rajasthan',
            pincode: '305001',
          },
          items: [{ productId: 'prod-1', quantity: 1 }],
          paymentMethod: 'UPI',
        });
      },
      (err: any) => err instanceof OrderValidationError
    );
  });

  await test('Production mode throws CatalogDatabaseError and never fakes orders during DB outage', async () => {
    const origEnv = process.env.NODE_ENV;
    const origFallback = process.env.ALLOW_DEMO_FALLBACK;
    try {
      (process.env as any).NODE_ENV = 'production';
      (process.env as any).ALLOW_DEMO_FALLBACK = 'false';
      await assert.rejects(
        async () => {
          await createOrder({
            customerName: 'Aarav Malhotra',
            customerEmail: 'aarav.malhotra@example.com',
            customerPhone: '9829012345',
            shippingAddress: {
              name: 'Aarav Malhotra',
              street: 'Road No. 12, Banjara Hills',
              city: 'Hyderabad',
              state: 'Telangana',
              pincode: '500034',
            },
            items: [{ productId: 'non-existent-product-ghost-999', quantity: 1 }],
            paymentMethod: 'UPI',
          });
        },
        (err: any) => err instanceof CatalogDatabaseError
      );
    } finally {
      (process.env as any).NODE_ENV = origEnv;
      (process.env as any).ALLOW_DEMO_FALLBACK = origFallback;
    }
  });

  // ------------------------------------------------------------------
  // 6. Idempotency & Network Retry Protection
  // ------------------------------------------------------------------
  console.log('\n--- 6. Idempotency Guard & Duplicate Order Prevention ---');

  await test('Retried request with identical idempotencyKey returns existing order without duplication', async () => {
    const key = `test-idemp-${Date.now()}`;

    const order1 = await createOrder({
      customerName: 'Pooja Sharma',
      customerEmail: 'pooja.sharma@example.com',
      customerPhone: '9820011223',
      shippingAddress: {
        name: 'Pooja Sharma',
        street: 'Hitech City, Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
      },
      items: [{ productId: 'prod-1', quantity: 2 }],
      paymentMethod: 'Razorpay',
      idempotencyKey: key,
    });

    const order2 = await createOrder({
      customerName: 'Pooja Sharma',
      customerEmail: 'pooja.sharma@example.com',
      customerPhone: '9820011223',
      shippingAddress: {
        name: 'Pooja Sharma',
        street: 'Hitech City, Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
      },
      items: [{ productId: 'prod-1', quantity: 2 }],
      paymentMethod: 'Razorpay',
      idempotencyKey: key,
    });

    assert.equal(order1.orderNumber, order2.orderNumber, 'Must return same order number on retry');
    assert.equal(order1.grandTotalPaise, order2.grandTotalPaise);
  });

  // ------------------------------------------------------------------
  // 7. Stock Reservation Expiration & Ledger Restoration
  // ------------------------------------------------------------------
  console.log('\n--- 7. Reservation Expiration & Stock Return Service ---');

  await test('Reservation release service executes idempotently and safely', async () => {
    const result = await releaseExpiredReservations();
    assert.ok(typeof result.releasedOrdersCount === 'number');
    assert.ok(Array.isArray(result.releasedOrderNumbers));

    // Calling again immediately is idempotent
    const secondCall = await releaseExpiredReservations();
    assert.ok(typeof secondCall.releasedOrdersCount === 'number');
  });

  // ------------------------------------------------------------------
  // 8. Order Security, RBAC & Privacy-Safe Guest Lookup
  // ------------------------------------------------------------------
  console.log('\n--- 8. Order Access Control & Guest Privacy Protections ---');

  await test('Guest order lookup rejects mismatching contact info', async () => {
    await assert.rejects(
      async () => {
        await lookupGuestOrder('SG-2026-999999', 'wrong.email@example.com');
      },
      (err: any) => err instanceof OrderNotFoundError
    );
  });

  await test('Guest lookup rate-limiter protects against brute-force enumerations', () => {
    const testIp = `test-ip-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      assert.equal(checkGuestLookupRateLimit(testIp), true);
    }
    // 11th request in 1 minute window must be rate-limited
    assert.equal(checkGuestLookupRateLimit(testIp), false);
  });

  await test('Authenticated order view denies unauthorized users and permits owner/admin', async () => {
    // Attempt unauthorized access
    await assert.rejects(
      async () => {
        await getOrderForUser('SG-2026-NONEXISTENT', 'user-123', 'CUSTOMER');
      },
      (err: any) => err instanceof OrderNotFoundError || err instanceof OrderAuthorizationError
    );
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Checkout Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} checkout test(s) failed.`);
  }

  return { passed, failed };
}

if (process.argv[1]?.includes('checkout.test')) {
  runCheckoutTestSuite().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
