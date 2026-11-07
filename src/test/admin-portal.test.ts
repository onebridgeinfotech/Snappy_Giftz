// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';
process.env.DATABASE_URL = 'mysql://127.0.0.1:3306/dev_fallback';

import assert from 'node:assert/strict';
import { getAdminOverviewMetrics } from '../lib/admin/admin.service';
import { DEV_ORDERS_STORE } from '../lib/orders/order.service';
import {
  registerDamageClaim,
  getDamageReports,
  getDamageReportById,
  reviewDamageReport,
  DEV_DAMAGE_REPORTS_STORE,
} from '../lib/damage-reports/damage-report.service';
import {
  customerProcessFinalAmount,
  resolveOrderApprovalStage,
} from '../lib/orders/order-approval.service';
import { updateOrderDeliveryCharge } from '../lib/delivery/delivery.service';
import { confirmOrderDelivery } from '../lib/orders/order-lifecycle.service';
import { getPublicProductBySlug } from '../lib/catalog/public-catalog.service';
import { INITIAL_PRODUCTS } from '../data/initialData';

export async function runAdminPortalTestSuite() {
  console.log('====================================================');
  console.log('   Snappy Gifts — Phase 3: Admin Portal & Logistics   ');
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

  // Clear test state
  DEV_DAMAGE_REPORTS_STORE.clear();

  // ----------------------------------------------------
  // SECTION 1: EXTENDED KPI OVERVIEW METRICS
  // ----------------------------------------------------
  await test('Admin Overview: returns verified counts for owner review, customer approval, and COD', async () => {
    // Seed an order awaiting owner review (delivery charge not yet set)
    DEV_ORDERS_STORE.set('ORD-REV-001', {
      id: 'ord_rev_001',
      orderNumber: 'ORD-REV-001',
      userId: 'usr_test_1',
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
      itemsSubtotalPaise: 150000,
      customizationTotalPaise: 0,
      giftWrapTotalPaise: 2000,
      shippingTotalPaise: 0, // No delivery charge set yet!
      deliveryChargeAssigned: false,
      customerApprovedAt: null,
      taxTotalPaise: 27000,
      grandTotalPaise: 179000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [{ id: 'item_1', productName: 'Artisan Clock', quantity: 1, unitPricePaise: 150000, subtotalPaise: 150000 }],
      shippingAddress: { street: '123 Main St', city: 'Hyderabad', state: 'Telangana', pincode: '500062' },
    } as any);

    // Seed an order awaiting customer approval
    DEV_ORDERS_STORE.set('ORD-APP-001', {
      id: 'ord_app_001',
      orderNumber: 'ORD-APP-001',
      userId: 'usr_test_2',
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'RAZORPAY',
      itemsSubtotalPaise: 200000,
      customizationTotalPaise: 0,
      giftWrapTotalPaise: 0,
      shippingTotalPaise: 15000, // Delivery fee set!
      deliveryChargeAssigned: true,
      deliveryChargeCustomerApproved: false,
      customerApprovedAt: null, // Customer has NOT approved yet!
      taxTotalPaise: 38700,
      grandTotalPaise: 253700,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [{ id: 'item_2', productName: 'Luxury Box', quantity: 1, unitPricePaise: 200000, subtotalPaise: 200000 }],
      shippingAddress: { street: '456 Hill Rd', city: 'Hyderabad', state: 'Telangana', pincode: '500062' },
    } as any);

    const metrics = await getAdminOverviewMetrics();
    assert.ok(metrics.kpis);
    assert.strictEqual(typeof metrics.kpis.ordersAwaitingOwnerReview, 'number');
    assert.strictEqual(typeof metrics.kpis.ordersAwaitingCustomerApproval, 'number');
    assert.strictEqual(typeof metrics.kpis.codTotalOrders, 'number');
    assert.strictEqual(typeof metrics.kpis.pendingDamageReportsCount, 'number');
    assert.ok(metrics.kpis.ordersAwaitingOwnerReview >= 1);
    assert.ok(metrics.kpis.ordersAwaitingCustomerApproval >= 1);
    assert.ok(metrics.kpis.codTotalOrders >= 1);
  });

  // ----------------------------------------------------
  // SECTION 2: DAMAGE REPORTS WORKFLOW (24-HR POST-DELIVERY)
  // ----------------------------------------------------
  await test('Damage Reports: successfully registers claim for order delivered within 24 hours', async () => {
    const recentDelivery = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

    const claim = await registerDamageClaim({
      claimId: 'CLM-TEST-001',
      orderNumber: 'ORD-DEL-001',
      customerName: 'Aarav Patel',
      customerEmail: 'aarav@example.com',
      customerPhone: '+91 98765 43210',
      description: 'The glass frame has a deep crack along the front bezel upon unboxing.',
      photoUrls: ['https://storage.snappygiftz.com/claims/proof-001.jpg'],
      requestedResolution: 'REPLACEMENT',
      submittedAt: new Date().toISOString(),
      deliveredAt: recentDelivery,
      elapsedHoursAtSubmission: 2,
    });

    assert.ok(claim.claimId);
    assert.strictEqual(claim.orderNumber, 'ORD-DEL-001');
    assert.strictEqual(claim.status, 'PENDING_OWNER_REVIEW');
    assert.strictEqual(claim.requestedResolution, 'REPLACEMENT');
  });

  await test('Damage Reports: admin can list, inspect and review claim determinations', async () => {
    const reports = await getDamageReports();
    assert.ok(reports.length >= 1);

    const pendingClaim = reports[0];
    const retrieved = await getDamageReportById(pendingClaim.claimId);
    assert.strictEqual(retrieved?.claimId, pendingClaim.claimId);

    // Admin reviews claim: APPROVE_REPLACEMENT
    const reviewed = await reviewDamageReport(pendingClaim.claimId, {
      reviewerEmail: 'owner@snappygiftz.com',
      action: 'APPROVE_REPLACEMENT',
      ownerNotes: 'Verified deep glass crack from transit impact. Approved replacement crafting.',
    } as any);

    assert.strictEqual(reviewed.status, 'APPROVED_REPLACEMENT');
    assert.ok(reviewed.reviewedAt);
  });

  // ----------------------------------------------------
  // SECTION 3: OWNER MANUAL DELIVERY CHARGE WORKFLOW
  // ----------------------------------------------------
  await test('Owner Delivery Fee: sets charge in paise and transitions order to AWAITING_CUSTOMER_APPROVAL', async () => {
    DEV_ORDERS_STORE.set('ORD-FEE-001', {
      id: 'ord_fee_001',
      orderNumber: 'ORD-FEE-001',
      userId: 'usr_fee_1',
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'RAZORPAY',
      itemsSubtotalPaise: 250000,
      customizationTotalPaise: 30000,
      giftWrapTotalPaise: 2000,
      shippingTotalPaise: 0,
      deliveryChargeAssigned: false,
      taxTotalPaise: 50760,
      grandTotalPaise: 332760,
      customerApprovedAt: null,
      createdAt: new Date().toISOString(),
      items: [{ id: 'item_fee_1', productName: 'Custom Gold Bar', quantity: 1 }],
      shippingAddress: { street: 'Road No 1', city: 'Secunderabad', state: 'Telangana', pincode: '500062' },
    } as any);

    // Initial stage is ORDER_AWAITING_OWNER_REVIEW
    const initialStage = resolveOrderApprovalStage(DEV_ORDERS_STORE.get('ORD-FEE-001'));
    assert.strictEqual(initialStage, 'ORDER_AWAITING_OWNER_REVIEW');

    // Owner sets delivery charge of ₹150 (15,000 paise)
    const updated = await updateOrderDeliveryCharge('ord_fee_001', 15000, 'staff_owner@snappygiftz.com');
    assert.strictEqual(updated.shippingTotalPaise, 15000);

    // Mark deliveryChargeAssigned on the dev order
    updated.deliveryChargeAssigned = true;
    DEV_ORDERS_STORE.set('ORD-FEE-001', updated);

    // Stage is now AWAITING_CUSTOMER_APPROVAL
    const postFeeStage = resolveOrderApprovalStage(updated);
    assert.strictEqual(postFeeStage, 'AWAITING_CUSTOMER_APPROVAL');

    // Customer approves revised grand total
    const approvalResult = await customerProcessFinalAmount('ORD-FEE-001', 'APPROVE', 'usr_fee_1');
    assert.strictEqual(approvalResult.success, true);
    assert.strictEqual(approvalResult.stage, 'CUSTOMER_APPROVED');

    const updatedOrder = DEV_ORDERS_STORE.get('ORD-FEE-001');
    assert.ok(updatedOrder);
    const postApprovalStage = resolveOrderApprovalStage(updatedOrder);
    assert.strictEqual(postApprovalStage, 'CUSTOMER_APPROVED');
  });

  // ----------------------------------------------------
  // SECTION 4: COD INVARIANT (STOCK DEDUCTION ON DELIVERED ONLY)
  // ----------------------------------------------------
  await test('COD Invariant: stock is NOT decremented upon placement/approval, decremented ONLY when DELIVERED', async () => {
    // Check initial stock for product prod-1
    const targetProduct = INITIAL_PRODUCTS.find((p) => p.id === 'prod-1')!;
    const initialStock = targetProduct.stock;

    DEV_ORDERS_STORE.set('ORD-COD-INV', {
      id: 'ord_cod_inv',
      orderNumber: 'ORD-COD-INV',
      userId: 'usr_cod_1',
      orderStatus: 'DISPATCHED', // Already placed & dispatched; stock NOT yet decremented
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
      itemsSubtotalPaise: 100000,
      customizationTotalPaise: 0,
      giftWrapTotalPaise: 0,
      shippingTotalPaise: 10000,
      customerApprovedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      items: [{ id: 'cod_item_1', productId: 'prod-1', productName: 'Royale Gold-Rim Ceramic Mug & Warmer Set', quantity: 2 }],
      shippingAddress: { street: 'A S Rao Nagar', city: 'Hyderabad', state: 'Telangana', pincode: '500062' },
      shipment: { carrierPartner: 'Shadowfax', awbNumber: 'SFX-998822', dispatchStatus: 'IN_TRANSIT' },
    } as any);

    // Confirm Delivery as Admin/Staff
    const delivered = await confirmOrderDelivery('ORD-COD-INV', {}, 'staff@snappygiftz.com');
    assert.strictEqual(delivered.orderStatus, 'DELIVERED');

    // Verify stock is now decremented by item quantity (2)
    assert.strictEqual(targetProduct.stock, initialStock - 2, 'Stock must be decremented by 2 upon COD delivery confirmation');
  });

  console.log(`\nPortal Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Allow direct CLI execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('admin-portal.test.ts')) {
  runAdminPortalTestSuite().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
