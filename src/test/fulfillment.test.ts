// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import assert from 'node:assert/strict';
import { Role, OrderStatus, PaymentStatus } from '@prisma/client';
import {
  ORDER_TRANSITION_MATRIX,
  isValidTrackingUrl,
  validateDispatchInput,
  listOrdersForAdmin,
  getAdminOrderDetails,
  transitionOrderStatus,
  recordOrderDispatch,
  confirmOrderDelivery,
  listOrdersForCustomer,
  DEV_SHIPMENTS_STORE,
  DEV_STATUS_HISTORY_STORE,
  OrderTransitionError,
  OrderFulfillmentError,
  OrderNotFoundError,
} from '../lib/orders/order-lifecycle.service';
import {
  DEV_ORDERS_STORE,
  SanitizedOrderResult,
} from '../lib/orders/order.service';
import {
  getOrderForUser,
  lookupGuestOrder,
  checkGuestLookupRateLimit,
  OrderAuthorizationError,
} from '../lib/orders/order-lookup.service';
import { hasRole } from '../lib/auth/rbac';

export async function runFulfillmentTestSuite() {
  console.log('====================================================');
  console.log(' Snappy Gifts — Batch 6: Fulfillment & Tracking Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function resetTestStores() {
    DEV_ORDERS_STORE.clear();
    DEV_SHIPMENTS_STORE.clear();
    DEV_STATUS_HISTORY_STORE.clear();
  }

  function seedTestOrder(overrides: Partial<SanitizedOrderResult> = {}): SanitizedOrderResult {
    const orderNumber = overrides.orderNumber || `SG-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const order: SanitizedOrderResult = {
      id: overrides.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderNumber,
      orderStatus: overrides.orderStatus || 'PENDING',
      paymentStatus: overrides.paymentStatus || 'PENDING',
      paymentMethod: overrides.paymentMethod || 'RAZORPAY',
      customerName: overrides.customerName || 'Rahul Sharma',
      customerEmail: overrides.customerEmail || 'rahul.sharma@example.in',
      customerPhone: overrides.customerPhone || '9876543210',
      destinationStateCode: overrides.destinationStateCode || '08',
      items: overrides.items || [
        {
          id: 'item-1',
          productName: 'Royal Rajasthan Brass Keepsake Box',
          sku: 'SG-RAJ-BOX-01',
          hsnCode: '74199990',
          taxRatePercent: 18,
          unitPricePaise: 249900,
          quantity: 1,
          subtotalPaise: 249900,
          customizationNote: 'Laser engrave: "With Best Compliments"',
        },
      ],
      itemsSubtotalPaise: overrides.itemsSubtotalPaise || 249900,
      taxTotalPaise: overrides.taxTotalPaise || 44982,
      cgstPaise: overrides.cgstPaise || 22491,
      sgstPaise: overrides.sgstPaise || 22491,
      igstPaise: overrides.igstPaise || 0,
      shippingTotalPaise: overrides.shippingTotalPaise || 0,
      grandTotalPaise: overrides.grandTotalPaise || 294882,
      reservationExpiresAt: overrides.reservationExpiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      guestLookupToken: overrides.guestLookupToken || 'token-xyz-123',
      createdAt: overrides.createdAt || new Date().toISOString(),
      shipment: overrides.shipment || null,
      ...(overrides as any),
    };

    DEV_ORDERS_STORE.set(orderNumber, order);
    return order;
  }

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      resetTestStores();
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
  // 1. Role-Based Authorization Guards
  // ------------------------------------------------------------------
  console.log('--- 1. Role-Based Authorization Guards ---');

  await test('Rejects CUSTOMER role from accessing admin fulfillment endpoints', () => {
    const isAllowedCustomer = hasRole(Role.CUSTOMER, [Role.ADMIN, Role.STAFF]);
    assert.strictEqual(isAllowedCustomer, false, 'CUSTOMER role must not have staff/admin permissions.');
  });

  await test('Allows STAFF role to access admin fulfillment endpoints', () => {
    const isAllowedStaff = hasRole(Role.STAFF, [Role.ADMIN, Role.STAFF]);
    assert.strictEqual(isAllowedStaff, true, 'STAFF role must be permitted.');
  });

  await test('Allows ADMIN role to access admin fulfillment endpoints implicitly', () => {
    const isAllowedAdmin = hasRole(Role.ADMIN, [Role.STAFF]);
    assert.strictEqual(isAllowedAdmin, true, 'ADMIN role has implicit access.');
  });

  // ------------------------------------------------------------------
  // 2. Order State Machine Transition Matrix
  // ------------------------------------------------------------------
  console.log('--- 2. Order State Machine Transitions ---');

  await test('Permits valid lifecycle transitions in sequence', async () => {
    // 1. PENDING (paid) -> CONFIRMED
    const ord = seedTestOrder({
      orderStatus: 'PENDING',
      paymentStatus: 'CAPTURED',
    });

    const confirmed = await transitionOrderStatus(
      ord.orderNumber,
      OrderStatus.CONFIRMED,
      'staff@snappygifts.in',
      'Payment verified via callback.'
    );
    assert.strictEqual(confirmed.orderStatus, 'CONFIRMED');

    // 2. CONFIRMED -> IN_CUSTOMIZATION
    const inCustom = await transitionOrderStatus(
      ord.orderNumber,
      OrderStatus.IN_CUSTOMIZATION,
      'artisan@snappygifts.in',
      'Artwork approved; laser engraving started.'
    );
    assert.strictEqual(inCustom.orderStatus, 'IN_CUSTOMIZATION');

    // 3. IN_CUSTOMIZATION -> QUALITY_CHECK
    const inQC = await transitionOrderStatus(
      ord.orderNumber,
      OrderStatus.QUALITY_CHECK,
      'qc@snappygifts.in',
      'Engraving completed; sent to inspection.'
    );
    assert.strictEqual(inQC.orderStatus, 'QUALITY_CHECK');

    // 4. QUALITY_CHECK -> DISPATCHED (via dispatch endpoint)
    const dispatched = await recordOrderDispatch(
      ord.orderNumber,
      {
        carrierPartner: 'BlueDart Express',
        awbNumber: 'BLUEDART-882910',
        trackingUrl: 'https://www.bluedart.com/tracking/BLUEDART-882910',
        notes: 'Handed over to courier hub.',
        invoicePhysicalSignatureConfirmed: true,
      },
      'dispatch@snappygifts.in'
    );
    assert.strictEqual(dispatched.orderStatus, 'DISPATCHED');
    assert.strictEqual(dispatched.shipments[0].carrierPartner, 'BlueDart Express');
    assert.strictEqual(dispatched.shipments[0].awbNumber, 'BLUEDART-882910');

    // 5. DISPATCHED -> DELIVERED
    const delivered = await confirmOrderDelivery(
      ord.orderNumber,
      { notes: 'Delivered to recipient with signature.' },
      'logistics@snappygifts.in'
    );
    assert.strictEqual(delivered.orderStatus, 'DELIVERED');
  });

  await test('Permits non-customized orders to bypass customization directly to QUALITY_CHECK', async () => {
    const ord = seedTestOrder({
      orderStatus: 'CONFIRMED',
      paymentStatus: 'CAPTURED',
    });

    const qc = await transitionOrderStatus(
      ord.orderNumber,
      OrderStatus.QUALITY_CHECK,
      'warehouse@snappygifts.in',
      'Ready-made product; moving directly to packaging QC.'
    );
    assert.strictEqual(qc.orderStatus, 'QUALITY_CHECK');
  });

  await test('Permits QUALITY_CHECK rework loop back to IN_CUSTOMIZATION if QC fails', async () => {
    const ord = seedTestOrder({
      orderStatus: 'QUALITY_CHECK',
      paymentStatus: 'CAPTURED',
    });

    const reworked = await transitionOrderStatus(
      ord.orderNumber,
      OrderStatus.IN_CUSTOMIZATION,
      'qc@snappygifts.in',
      'Surface finish defect detected; rejected back for refinishing.'
    );
    assert.strictEqual(reworked.orderStatus, 'IN_CUSTOMIZATION');
  });

  await test('Rejects illegal status skip: PENDING directly to DISPATCHED', async () => {
    const ord = seedTestOrder({
      orderStatus: 'PENDING',
      paymentStatus: 'CAPTURED',
    });

    await assert.rejects(
      async () => {
        await transitionOrderStatus(ord.orderNumber, OrderStatus.DISPATCHED, 'staff@snappygifts.in');
      },
      (err: any) => {
        assert(err instanceof OrderTransitionError);
        assert(err.message.includes('Cannot transition order from "PENDING" to "DISPATCHED"'));
        return true;
      }
    );
  });

  await test('Rejects confirming unpaid order in PENDING status', async () => {
    const ord = seedTestOrder({
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING', // Unpaid!
      paymentMethod: 'RAZORPAY',
    });

    await assert.rejects(
      async () => {
        await transitionOrderStatus(ord.orderNumber, OrderStatus.CONFIRMED, 'staff@snappygifts.in');
      },
      (err: any) => {
        assert(err instanceof OrderTransitionError);
        assert(err.message.includes('Payment must be CAPTURED before confirmation'));
        return true;
      }
    );
  });

  // ------------------------------------------------------------------
  // 3. Decoupling of Payment and Fulfilment State
  // ------------------------------------------------------------------
  console.log('--- 3. Payment State Decoupling ---');

  await test('Fulfilment transition preserves paymentStatus unmodified', async () => {
    const ord = seedTestOrder({
      orderStatus: 'CONFIRMED',
      paymentStatus: 'CAPTURED',
    });

    const updated = await transitionOrderStatus(
      ord.orderNumber,
      OrderStatus.IN_CUSTOMIZATION,
      'artisan@snappygifts.in'
    );

    assert.strictEqual(updated.paymentStatus, 'CAPTURED', 'Payment status must remain CAPTURED.');
    assert.strictEqual(updated.orderStatus, 'IN_CUSTOMIZATION');
  });

  await test('Dispatching order does not alter paymentStatus', async () => {
    const ord = seedTestOrder({
      orderStatus: 'QUALITY_CHECK',
      paymentStatus: 'CAPTURED',
    });

    const dispatched = await recordOrderDispatch(
      ord.orderNumber,
      {
        carrierPartner: 'Delhivery',
        awbNumber: 'DLV-1982736',
        invoicePhysicalSignatureConfirmed: true,
      },
      'dispatch@snappygifts.in'
    );

    assert.strictEqual(dispatched.paymentStatus, 'CAPTURED');
    assert.strictEqual(dispatched.orderStatus, 'DISPATCHED');
  });

  // ------------------------------------------------------------------
  // 4. Courier & Tracking URL Validation
  // ------------------------------------------------------------------
  console.log('--- 4. Courier & Tracking URL Validation ---');

  await test('Rejects dispatch without carrier partner name', () => {
    assert.throws(
      () => {
        validateDispatchInput({
          carrierPartner: '',
          awbNumber: 'AWB-123456',
        });
      },
      (err: any) => {
        assert(err instanceof OrderFulfillmentError);
        assert(err.message.includes('Carrier name is required'));
        return true;
      }
    );
  });

  await test('Rejects dispatch without AWB tracking number', () => {
    assert.throws(
      () => {
        validateDispatchInput({
          carrierPartner: 'BlueDart',
          awbNumber: '',
        });
      },
      (err: any) => {
        assert(err instanceof OrderFulfillmentError);
        assert(err.message.includes('Valid AWB / Tracking number is required'));
        return true;
      }
    );
  });

  await test('Accepts valid HTTPS and HTTP tracking URLs', () => {
    assert.strictEqual(isValidTrackingUrl('https://www.bluedart.com/track/12345'), true);
    assert.strictEqual(isValidTrackingUrl('http://delhivery.com/tracking?awb=999'), true);
    assert.strictEqual(isValidTrackingUrl('https://track.dtdc.com/shipments/SG881'), true);
  });

  await test('Rejects malicious or invalid tracking URL schemes', () => {
    assert.strictEqual(isValidTrackingUrl('javascript:alert(1)'), false, 'Must reject javascript: scheme');
    assert.strictEqual(isValidTrackingUrl('data:text/html,<script>alert(1)</script>'), false, 'Must reject data: scheme');
    assert.strictEqual(isValidTrackingUrl('file:///etc/passwd'), false, 'Must reject file: scheme');
    assert.strictEqual(isValidTrackingUrl('/relative/path/tracking'), false, 'Must reject relative path');
    assert.strictEqual(isValidTrackingUrl('not-a-valid-url'), false, 'Must reject malformed text');
    assert.strictEqual(isValidTrackingUrl('ftp://ftp.tracker.com/awb'), false, 'Must reject FTP scheme');
  });

  await test('Rejects dispatch execution when invalid tracking URL is supplied', async () => {
    const ord = seedTestOrder({
      orderStatus: 'QUALITY_CHECK',
      paymentStatus: 'CAPTURED',
    });

    await assert.rejects(
      async () => {
        await recordOrderDispatch(
          ord.orderNumber,
          {
            carrierPartner: 'BlueDart',
            awbNumber: 'BLUEDART-12345',
            trackingUrl: 'javascript:stealCredentials()',
          },
          'staff@snappygifts.in'
        );
      },
      (err: any) => {
        assert(err instanceof OrderFulfillmentError);
        assert(err.message.includes('Invalid tracking URL'));
        return true;
      }
    );
  });

  // ------------------------------------------------------------------
  // 5. Delivery Confirmation Requirements
  // ------------------------------------------------------------------
  console.log('--- 5. Delivery Confirmation ---');

  await test('Rejects delivery confirmation if order is not DISPATCHED first', async () => {
    const ord = seedTestOrder({
      orderStatus: 'QUALITY_CHECK',
      paymentStatus: 'CAPTURED',
    });

    await assert.rejects(
      async () => {
        await confirmOrderDelivery(ord.orderNumber, {}, 'staff@snappygifts.in');
      },
      (err: any) => {
        assert(err instanceof OrderTransitionError);
        assert(err.message.includes('Orders must be DISPATCHED or OUT_FOR_DELIVERY first'));
        return true;
      }
    );
  });

  await test('Confirms delivery for dispatched order and updates shipment status', async () => {
    const ord = seedTestOrder({
      orderStatus: 'DISPATCHED',
      paymentStatus: 'CAPTURED',
      shipment: {
        carrierPartner: 'BlueDart',
        awbNumber: 'BD-998877',
        trackingUrl: 'https://bluedart.com/track',
        dispatchStatus: 'DISPATCHED',
        dispatchedAt: new Date().toISOString(),
        deliveredAt: null,
      },
    });

    const delivered = await confirmOrderDelivery(
      ord.orderNumber,
      { notes: 'Signed delivery receipt #RC-441.' },
      'courier-partner'
    );

    assert.strictEqual(delivered.orderStatus, 'DELIVERED');
    assert.strictEqual(delivered.shipments[0].dispatchStatus, 'DELIVERED');
    assert(delivered.shipments[0].deliveredAt, 'Delivered timestamp must be recorded.');
  });

  // ------------------------------------------------------------------
  // 6. Audit History & Traceability
  // ------------------------------------------------------------------
  console.log('--- 6. Status Audit History Logging ---');

  await test('Logs audit history record with actor, previous state, new state, notes and timestamp', async () => {
    const ord = seedTestOrder({
      orderStatus: 'CONFIRMED',
      paymentStatus: 'CAPTURED',
    });

    await transitionOrderStatus(
      ord.orderNumber,
      OrderStatus.IN_CUSTOMIZATION,
      'artisan.vikram@snappygifts.in',
      'Beginning laser personalization on sandalwood base.'
    );

    const history = DEV_STATUS_HISTORY_STORE.get(ord.orderNumber);
    assert(history && history.length > 0, 'Audit history must be recorded.');
    const log = history[history.length - 1];

    assert.strictEqual(log.fromStatus, 'CONFIRMED');
    assert.strictEqual(log.toStatus, 'IN_CUSTOMIZATION');
    assert.strictEqual(log.changedBy, 'artisan.vikram@snappygifts.in');
    assert.strictEqual(log.notes, 'Beginning laser personalization on sandalwood base.');
    assert(log.createdAt, 'Timestamp must be logged.');
  });

  // ------------------------------------------------------------------
  // 7. Customer Privacy & Ownership
  // ------------------------------------------------------------------
  console.log('--- 7. Customer Privacy & Ownership ---');

  await test('Customer order history strictly returns only orders owned by the authenticated userId', async () => {
    const userA = 'user-uuid-aaa';
    const userB = 'user-uuid-bbb';

    seedTestOrder({
      orderNumber: 'SG-USER-A-01',
      userId: userA,
      customerEmail: 'user.a@example.com',
    } as any);

    seedTestOrder({
      orderNumber: 'SG-USER-A-02',
      userId: userA,
      customerEmail: 'user.a@example.com',
    } as any);

    seedTestOrder({
      orderNumber: 'SG-USER-B-01',
      userId: userB,
      customerEmail: 'user.b@example.com',
    } as any);

    const resultA = await listOrdersForCustomer(userA);
    assert.strictEqual(resultA.orders.length, 2, 'User A should only see their 2 orders.');
    assert.strictEqual(resultA.orders.every((o: any) => o.orderNumber.startsWith('SG-USER-A')), true);

    const resultB = await listOrdersForCustomer(userB);
    assert.strictEqual(resultB.orders.length, 1, 'User B should only see their 1 order.');
    assert.strictEqual(resultB.orders[0].orderNumber, 'SG-USER-B-01');
  });

  await test('Never leaks internal staff notes in customer order view', async () => {
    const user = 'user-uuid-secret';
    const ord = seedTestOrder({
      orderNumber: 'SG-SECRET-01',
      userId: user,
      customerEmail: 'secret@example.com',
    } as any);

    // Record internal staff note
    DEV_STATUS_HISTORY_STORE.set(ord.orderNumber, [
      {
        id: 'h1',
        fromStatus: 'CONFIRMED',
        toStatus: 'IN_CUSTOMIZATION',
        changedBy: 'internal-staff@snappygifts.in',
        notes: 'CONFIDENTIAL: High priority VIP client order.',
      },
    ]);

    const customerOrders = await listOrdersForCustomer(user);
    const customerOrder = customerOrders.orders[0];

    assert.strictEqual((customerOrder as any).statusHistory, undefined, 'Customer view must not include statusHistory.');
    assert.strictEqual((customerOrder as any).notes, undefined, 'Customer view must not leak internal notes.');
  });

  await test('Guest order lookup rejects mismatching contact info', async () => {
    const ord = seedTestOrder({
      orderNumber: 'SG-GUEST-99',
      customerEmail: 'customer@domain.in',
      customerPhone: '9829012345',
    });

    await assert.rejects(
      async () => {
        await lookupGuestOrder(ord.orderNumber, 'wrong.email@other.in');
      },
      (err: any) => {
        assert(err.message.includes('No order found matching the provided reference and contact details'));
        return true;
      }
    );
  });

  await test('Guest lookup rate-limiting prevents brute-force guessing of order numbers', () => {
    const testIp = 'test-client-ip-bruteforce-guard';
    // Consume 10 allowed attempts
    for (let i = 0; i < 10; i++) {
      const allowed = checkGuestLookupRateLimit(testIp);
      assert.strictEqual(allowed, true);
    }
    // 11th attempt must be blocked
    const blocked = checkGuestLookupRateLimit(testIp);
    assert.strictEqual(blocked, false, 'Rate limiter must block 11th attempt within window.');
  });

  // ------------------------------------------------------------------
  // 8. Terminal States & Idempotency
  // ------------------------------------------------------------------
  console.log('--- 8. Terminal States & Idempotency ---');

  await test('Rejects transitioning out of terminal state DELIVERED', async () => {
    const ord = seedTestOrder({
      orderStatus: 'DELIVERED',
      paymentStatus: 'CAPTURED',
    });

    await assert.rejects(
      async () => {
        await transitionOrderStatus(ord.orderNumber, OrderStatus.DISPATCHED, 'staff@snappygifts.in');
      },
      (err: any) => {
        assert(err instanceof OrderTransitionError);
        assert(err.message.includes('Terminal state'));
        return true;
      }
    );
  });

  await test('Rejects transitioning out of terminal state CANCELLED', async () => {
    const ord = seedTestOrder({
      orderStatus: 'CANCELLED',
      paymentStatus: 'FAILED',
    });

    await assert.rejects(
      async () => {
        await transitionOrderStatus(ord.orderNumber, OrderStatus.CONFIRMED, 'staff@snappygifts.in');
      },
      (err: any) => {
        assert(err instanceof OrderTransitionError);
        assert(err.message.includes('Terminal state'));
        return true;
      }
    );
  });

  await test('Status update to the current status succeeds idempotently without duplicate records', async () => {
    const ord = seedTestOrder({
      orderStatus: 'CONFIRMED',
      paymentStatus: 'CAPTURED',
    });

    const result = await transitionOrderStatus(
      ord.orderNumber,
      OrderStatus.CONFIRMED,
      'staff@snappygifts.in',
      'Duplicate idempotent call.'
    );

    assert.strictEqual(result.orderStatus, 'CONFIRMED');
    const history = DEV_STATUS_HISTORY_STORE.get(ord.orderNumber) || [];
    assert.strictEqual(history.length, 0, 'No extra audit history created for identical state.');
  });

  // ------------------------------------------------------------------
  // 9. Admin Order Filtering & Search
  // ------------------------------------------------------------------
  console.log('--- 9. Admin Order Listing, Filtering & Search ---');

  await test('Filters admin order list by orderStatus', async () => {
    seedTestOrder({ orderNumber: 'SG-ORD-PENDING', orderStatus: 'PENDING' });
    seedTestOrder({ orderNumber: 'SG-ORD-CONFIRMED', orderStatus: 'CONFIRMED' });
    seedTestOrder({ orderNumber: 'SG-ORD-DISPATCHED', orderStatus: 'DISPATCHED' });

    const result = await listOrdersForAdmin({ orderStatus: OrderStatus.DISPATCHED });
    assert.strictEqual(result.orders.length, 1);
    assert.strictEqual(result.orders[0].orderNumber, 'SG-ORD-DISPATCHED');
  });

  await test('Searches admin orders by AWB number', async () => {
    seedTestOrder({
      orderNumber: 'SG-ORD-AWB-TEST',
      orderStatus: 'DISPATCHED',
      shipment: {
        carrierPartner: 'BlueDart',
        awbNumber: 'BD-UNIQUE-AWB-9988',
        trackingUrl: null,
        dispatchStatus: 'DISPATCHED',
        dispatchedAt: new Date().toISOString(),
        deliveredAt: null,
      },
    });

    const result = await listOrdersForAdmin({ search: 'UNIQUE-AWB' });
    assert.strictEqual(result.orders.length, 1);
    assert.strictEqual(result.orders[0].orderNumber, 'SG-ORD-AWB-TEST');
  });

  console.log('\n====================================================');
  console.log(`  Batch 6 Fulfillment Suite: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`Batch 6 Fulfillment suite failed: ${failed} test(s) failed.`);
  }

  return { passed, failed };
}

// Direct execution
if (process.argv[1]?.endsWith('fulfillment.test.ts')) {
  runFulfillmentTestSuite().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
