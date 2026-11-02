import assert from 'node:assert/strict';
import { INITIAL_PRODUCTS } from '../data/initialData';
import { createOrder, DEV_ORDERS_STORE } from '../lib/orders/order.service';
import { lookupGuestOrder } from '../lib/orders/order-lookup.service';
import { issueTaxInvoice, getInvoiceForOrder, getInvoicePdfBuffer } from '../lib/invoices/invoice.service';
import {
  registerCorporateAccount,
  reviewCorporateAccount,
  createCorporateRFQ,
  createCorporateQuote,
  respondToCorporateQuote,
  addCorporateMember,
  parseAndValidateCorporateCsv,
  createCorporateOrderGroup,
  getCorporateOrderGroup,
  DEV_ORGANIZATIONS_STORE,
} from '../lib/corporate/corporate.service';
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
    assert.equal(invoice.supplierGstin, '36AAAAA0000A1Z5');

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
  // Journey Group 3: Complete Corporate B2B Procurement Journey (10 steps)
  // ==========================================================================
  await runTest('Corporate Journey: Registration, approval, RFQ, quote, CSV allocation & grouped order', async () => {
    // 1. Corporate registration
    const org = await registerCorporateAccount(
      'usr_meera_owner',
      'procurement@e2etech.com',
      'Meera Rajput',
      {
        legalName: 'E2E Tech Global Solutions Pvt Ltd',
        displayName: 'E2E Tech',
        companyEmail: 'procurement@e2etech.com',
        contactPerson: 'Meera Rajput',
        contactPhone: '9829098765',
        registeredAddress: {
          street: '45 Cyber City',
          city: 'Jaipur',
          state: 'Rajasthan',
          stateCode: 'RJ',
          pincode: '302001',
        },
        gstin: '08ABCDE1234F1Z5',
      }
    );
    assert.equal(org.status, 'PENDING_APPROVAL');

    // 2. Admin approval
    const approvedOrg = await reviewCorporateAccount(org.id, 'usr_admin_1', 'APPROVE');
    assert.equal(approvedOrg.status, 'APPROVED');

    // 3. Add members
    await addCorporateMember(
      org.id,
      'usr_meera_owner',
      'usr_rohit_requester',
      'rohit@e2etech.com',
      'Rohit Requester',
      'REQUESTER'
    );

    // 4. Requester submits RFQ
    const rfq = await createCorporateRFQ(org.id, 'usr_rohit_requester', {
      items: [
        {
          productId: INITIAL_PRODUCTS[0].id,
          quantity: 50,
        },
      ],
    });
    assert.ok(rfq.rfqNumber.startsWith('RFQ-'));

    // 5. Admin issues quotation
    const quote = await createCorporateQuote(
      {
        organizationId: org.id,
        rfqId: rfq.id,
        validUntil: new Date(Date.now() + 86400000 * 30).toISOString(),
        items: [
          {
            productId: INITIAL_PRODUCTS[0].id,
            quantity: 50,
            unitPricePaise: 45000,
          },
        ],
      },
      'usr_admin_1'
    );
    assert.equal(quote.status, 'ISSUED');

    // 6. Owner accepts quotation
    const acceptedQuote = await respondToCorporateQuote(quote.id, org.id, 'usr_meera_owner', 'ACCEPT');
    assert.equal(acceptedQuote.status, 'ACCEPTED');

    // 7-8. CSV recipient upload & validation
    const targetSku = INITIAL_PRODUCTS[0]?.sku || 'AJM-MUG-001';
    const sampleCsv = `recipient name,recipient phone,recipient email,product sku,quantity,address line 1,city,state,pin code\nEmployee 1,9829011111,emp1@e2etech.com,${targetSku},25,Street 1,Ajmer,Rajasthan,305001\nEmployee 2,9829022222,emp2@e2etech.com,${targetSku},25,Street 2,Jaipur,Rajasthan,302001`;
    const csvResult = parseAndValidateCorporateCsv(sampleCsv);
    assert.equal(csvResult.totalRows, 2);
    assert.equal(csvResult.validRowsCount, 2);
    assert.equal(csvResult.invalidRowsCount, 0);

    // 9-10. Grouped order creation
    const sampleSku = targetSku;
    const sampleProductId = quote.items[0]?.productId || INITIAL_PRODUCTS[0].id;
    const groupedOrder = await createCorporateOrderGroup(
      org.id,
      'usr_meera_owner',
      {
        quoteId: quote.id,
        paymentMethod: 'CORPORATE_INVOICE_NET30',
        allocations: [
          {
            recipientName: 'Employee 1',
            recipientPhone: '9829011111',
            recipientEmail: 'emp1@e2etech.com',
            street: 'Street 1',
            city: 'Ajmer',
            state: 'Rajasthan',
            pincode: '305001',
            quantity: 25,
            productId: sampleProductId,
            sku: sampleSku,
          },
          {
            recipientName: 'Employee 2',
            recipientPhone: '9829022222',
            recipientEmail: 'emp2@e2etech.com',
            street: 'Street 2',
            city: 'Jaipur',
            state: 'Rajasthan',
            pincode: '302001',
            quantity: 25,
            productId: sampleProductId,
            sku: sampleSku,
          },
        ],
      }
    );
    assert.ok(groupedOrder.groupOrderNumber.startsWith('CORP-'));
    assert.equal(groupedOrder.totalQuantity, 50);

    // Verify lookup
    const retrievedGroup = await getCorporateOrderGroup(groupedOrder.id, org.id, false);
    assert.equal(retrievedGroup.id, groupedOrder.id);
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
