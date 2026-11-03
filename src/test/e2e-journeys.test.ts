import assert from 'node:assert/strict';
import { INITIAL_PRODUCTS } from '../data/initialData';
import { createOrder, DEV_ORDERS_STORE } from '../lib/orders/order.service';
import { lookupGuestOrder } from '../lib/orders/order-lookup.service';
import { issueTaxInvoice, getInvoiceForOrder, getInvoicePdfBuffer } from '../lib/invoices/invoice.service';
import { approveCodOrder, recordCodCollection } from '../lib/payments/cod.service';
import { checkHyderabadServiceability, calculateAuthoritativeDeliveryFee } from '../lib/delivery/delivery.service';
import {
  getAdminOverviewMetrics,
  listAdminUsers,
  getStoreConfig,
  updateStoreConfig,
  generateSalesReport,
  generateOrdersReport,
  generateInventoryReport,
  generateTaxReport,
  getSystemHealthOverview,
} from '../lib/admin/admin.service';

export async function runE2EJourneysTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('--- Batch 11: End-to-End User Journeys Verification Suite ---');
  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void | Promise<void>) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result
          .then(() => {
            console.log(`  ✓ ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  ✗ ${name}: ${err.message}`);
            failed++;
          });
      }
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  // ==========================================================================
  // Journey Group 1: Complete Customer Gifting Journey (18 steps)
  // ==========================================================================
  await runTest('Customer Journey: Browse catalog, configure gift, place order & verify invoice', async () => {
    // 1-5. Browse products and verify variants
    assert.ok(INITIAL_PRODUCTS.length >= 1);
    const product = INITIAL_PRODUCTS[0];
    assert.ok(product.id);
    assert.ok(product.name);

    // 6-7. Create cart item and place order
    const orderInput = {
      customerName: 'Aarav Sharma',
      customerEmail: 'aarav.sharma@example.com',
      customerPhone: '9829012345',
      shippingAddress: {
        name: 'Aarav Sharma',
        street: '12 Pushkar Road',
        city: 'Ajmer',
        state: 'Rajasthan',
        pincode: '305001',
      },
      items: [
        {
          productId: product.id,
          quantity: 2,
        },
      ],
      paymentMethod: 'ONLINE_UPI',
    };

    const order = await createOrder(orderInput);
    assert.ok(order.orderNumber.startsWith('SG-'));
    assert.equal(order.paymentStatus, 'PENDING');

    // 11-12. Simulate payment capture
    const storedOrder = DEV_ORDERS_STORE.get(order.orderNumber);
    assert.ok(storedOrder);
    storedOrder.paymentStatus = 'CAPTURED';
    storedOrder.orderStatus = 'CONFIRMED';
    DEV_ORDERS_STORE.set(order.orderNumber, storedOrder);

    // 14. Guest order tracking
    const lookedUp = await lookupGuestOrder(order.orderNumber, 'aarav.sharma@example.com');
    assert.equal(lookedUp.orderNumber, order.orderNumber);
    assert.equal(lookedUp.orderStatus, 'CONFIRMED');

    // 17-18. Issue tax invoice and verify PDF buffer
    const invoice = await issueTaxInvoice(order.orderNumber);
    assert.ok(invoice.invoiceNumber.includes('/'));
    assert.ok(invoice.supplierGstin === '08AAAAA0000A1Z5' || invoice.supplierGstin === '36AAAAA0000A1Z5' || invoice.supplierGstin === (process.env.SELLER_GSTIN || null) || invoice.supplierGstin === null);

    const pdfBuffer = await getInvoicePdfBuffer(invoice);
    assert.ok(pdfBuffer.length > 500);
    // PDF Magic bytes: %PDF- (0x25 0x50 0x44 0x46)
    assert.equal(pdfBuffer.subarray(0, 4).toString('ascii'), '%PDF');
  });

  // ==========================================================================
  // Journey Group 2: Complete Admin Operations Journey (16 steps)
  // ==========================================================================
  await runTest('Admin Journey: Metrics, users, store settings, reports & health audit', async () => {
    // 1-2. Dashboard metrics
    const metrics = await getAdminOverviewMetrics();
    assert.ok(metrics.kpis);
    assert.ok(typeof metrics.kpis.capturedRevenuePaise === 'number');

    // 3-4. List users
    const usersList = await listAdminUsers({ page: 1, limit: 10 });
    assert.ok(usersList.data.length >= 0);

    // 12. Store settings update
    const currentConfig = await getStoreConfig();
    assert.ok(currentConfig.supportEmail);
    const adminActor = { id: 'usr_admin_1', email: 'admin@snappygifts.in', role: 'ADMIN' };
    const updated = await updateStoreConfig(
      {
        supportPhone: '+91 145 2999999',
        standardShippingFeePaise: 25000,
      },
      adminActor
    );
    assert.equal(updated.standardShippingFeePaise, 25000);

    // 13-14. Generate and download reports
    const salesReport = await generateSalesReport();
    assert.ok(salesReport.csv.includes('Order Number'));

    const inventoryReport = await generateInventoryReport();
    assert.ok(inventoryReport.csv.includes('SKU'));

    // 15-16. System Health
    const health = await getSystemHealthOverview();
    assert.ok(health.database);
    assert.ok(health.environmentSecurity);
  });

  // ==========================================================================
  // Journey Group 3: Complete Consumer COD & Hyderabad Delivery Journey
  // ==========================================================================
  await runTest('Consumer COD Journey: PIN check, COD order placement, staff review & cash collection', async () => {
    // 1. Pincode serviceability check for Hyderabad
    const pinCheck = await checkHyderabadServiceability('500001');
    assert.strictEqual(pinCheck.serviceable, true);
    assert.strictEqual(pinCheck.city, 'Hyderabad');

    // 2. Delivery fee calculation
    const feeInfo = await calculateAuthoritativeDeliveryFee(150000);
    assert.ok(feeInfo.feePaise >= 0);

    // 3. Create consumer COD order
    const codOrder = await createOrder({
      customerName: 'Sanjay Reddy',
      customerEmail: 'sanjay.reddy@example.com',
      customerPhone: '9849012345',
      shippingAddress: {
        name: 'Sanjay Reddy',
        street: 'Plot 42, Jubilee Hills Road No 36',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500001',
      },
      items: [
        {
          productId: INITIAL_PRODUCTS[0].id,
          quantity: 2,
        },
      ],
      paymentMethod: 'COD',
      idempotencyKey: 'idem-cod-e2e-001',
    });

    assert.ok(codOrder.orderNumber.startsWith('SG-'));
    assert.strictEqual(codOrder.orderStatus, 'PENDING_COD_CONFIRMATION');
    assert.strictEqual(codOrder.paymentMethod, 'COD');
    assert.strictEqual(codOrder.paymentStatus, 'PENDING');

    // 4. Staff approves COD order
    const approved = await approveCodOrder(codOrder.id, 'admin_staff_1');
    assert.strictEqual(approved.orderStatus, 'CONFIRMED');

    // 5. Delivery agent collects physical cash and issues receipt
    const collected = await recordCodCollection({
      orderId: codOrder.id,
      amountCollectedPaise: codOrder.grandTotalPaise,
      collector: 'EXECUTIVE-HYD-04',
      collectionMethod: 'CASH',
      receiptNumber: 'REC-CASH-99881',
      notes: 'Doorstep cash received in full',
    });
    assert.strictEqual(collected.orderStatus, 'DELIVERED');
    assert.strictEqual(collected.paymentStatus, 'PAID');
    assert.ok(collected.collectionReceipt);
  });

  console.log('----------------------------------------------------');
  console.log(`E2E Journeys Test Suite: ${passed} passed, ${failed} failed\n`);

  return { passed, failed };
}

if (process.argv[1]?.includes('e2e-journeys.test')) {
  runE2EJourneysTestSuite()
    .then((results) => {
      if (results.failed > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}
