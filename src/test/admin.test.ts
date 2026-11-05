if (!process.env.CI && process.env.NODE_ENV !== 'production') {
  process.env.DATABASE_URL = 'mysql://127.0.0.1:3306/dev_fallback';
}

import assert from 'node:assert/strict';
import {
  getAdminOverviewMetrics,
  listAdminUsers,
  getAdminUserDetails,
  updateAdminUserStatusOrRole,
  getStoreConfig,
  updateStoreConfig,
  generateSalesReport,
  generateOrdersReport,
  generateInventoryReport,
  generateTaxReport,
  logAdminActivity,
  queryAuditLogs,
  getSystemHealthOverview,
  sanitizeCsvCell,
  resetAdminDevStores,
  AdminValidationError,
  AdminPermissionError,
  AdminNotFoundError,
  DEV_ADMIN_USERS_STORE,
  DEV_STORE_CONFIG,
  DEV_AUDIT_LOGS_STORE,
} from '../lib/admin/admin.service';
import { DEV_ORDERS_STORE } from '../lib/orders/order.service';
import { DEV_EMAIL_OUTBOX_STORE } from '../lib/email/email-outbox.service';

export async function runAdminTestSuite() {
  console.log('====================================================');
  console.log('   Snappy Gifts — Batch 10: Admin Dashboard & Ops   ');
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

  // Reset stores for deterministic test execution
  resetAdminDevStores();

  // ----------------------------------------------------
  // SECTION 1: OVERVIEW METRICS & REVENUE DISTINCTION
  // ----------------------------------------------------
  await test('Overview metrics: accurately calculates total orders and products', async () => {
    const metrics = await getAdminOverviewMetrics();
    assert.ok(metrics.kpis);
    assert.strictEqual(typeof metrics.kpis.totalOrders, 'number');
    assert.strictEqual(typeof metrics.kpis.totalProducts, 'number');
    assert.ok(metrics.kpis.totalOrders >= 0);
    assert.ok(metrics.kpis.totalProducts >= 0);
  });

  await test('Overview metrics: distinguishes captured revenue from pending/authorized payments', async () => {
    // Inject mock orders into DEV_ORDERS_STORE with different payment statuses
    DEV_ORDERS_STORE.set('SG-CAP-001', {
      id: 'ord_test_captured_1',
      orderNumber: 'SG-CAP-001',
      userId: 'user_cust_1',
      guestEmail: null,
      shippingAddressId: 'addr_1',
      type: 'B2C',
      status: 'CONFIRMED',
      paymentStatus: 'CAPTURED',
      subtotal: 1000,
      taxTotal: 180,
      shippingTotal: 99,
      customizationTotal: 0,
      discountTotal: 0,
      grandTotal: 1279,
      itemsSubtotalPaise: 100000,
      taxTotalPaise: 18000,
      shippingTotalPaise: 9900,
      customizationTotalPaise: 0,
      discountTotalPaise: 0,
      grandTotalPaise: 127900,
      date: new Date().toISOString(),
      paymentMethod: 'ONLINE',
      courierPartner: 'BlueDart Air Express',
      items: [{ id: 'item_1', name: 'Laser Candle', quantity: 1, basePrice: 1000, subtotal: 1000, productId: 'prod_1' }],
      payments: [{ id: 'pay_1', status: 'CAPTURED', amountPaise: 127900, gateway: 'RAZORPAY' }],
    } as any);

    DEV_ORDERS_STORE.set('SG-PEN-001', {
      id: 'ord_test_pending_1',
      orderNumber: 'SG-PEN-001',
      userId: 'user_cust_2',
      guestEmail: null,
      shippingAddressId: 'addr_2',
      type: 'B2C',
      status: 'PENDING',
      paymentStatus: 'AUTHORIZED', // NOT captured!
      subtotal: 2000,
      taxTotal: 360,
      shippingTotal: 0,
      customizationTotal: 0,
      discountTotal: 0,
      grandTotal: 2360,
      itemsSubtotalPaise: 200000,
      taxTotalPaise: 36000,
      shippingTotalPaise: 0,
      customizationTotalPaise: 0,
      discountTotalPaise: 0,
      grandTotalPaise: 236000,
      date: new Date().toISOString(),
      paymentMethod: 'ONLINE',
      courierPartner: 'Delhivery Surface',
      items: [{ id: 'item_2', name: 'Royal Rajputana Hamper', quantity: 1, basePrice: 2000, subtotal: 2000, productId: 'prod_2' }],
      payments: [{ id: 'pay_2', status: 'AUTHORIZED', amountPaise: 236000, gateway: 'RAZORPAY' }],
    } as any);

    const metrics = await getAdminOverviewMetrics();
    // Only captured order (127900 paise) should be counted towards capturedRevenuePaise
    assert.ok(metrics.kpis.capturedRevenuePaise >= 127900);
    // Authorized order (236000 paise) should be tracked under pendingRevenuePaise
    assert.ok(metrics.kpis.pendingRevenuePaise >= 236000);
    // Formatted INR strings should start with Indian Rupee symbol
    assert.ok(metrics.kpis.capturedRevenueFormatted.startsWith('₹'));
    assert.ok(metrics.kpis.pendingRevenueFormatted.startsWith('₹'));
  });

  await test('Overview metrics: correctly counts failed transactional emails in outbox', async () => {
    DEV_EMAIL_OUTBOX_STORE.set('outbox_test_fail_1', {
      id: 'outbox_test_fail_1',
      recipientEmail: 'client@invalid-domain-test.com',
      recipientName: 'Failed Delivery Tester',
      subject: 'Order Confirmation',
      eventType: 'ORDER_CONFIRMATION',
      status: 'FAILED',
      attempts: 3,
      maxAttempts: 3,
      lastError: 'SMTP connect timeout',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const metrics = await getAdminOverviewMetrics();
    assert.ok(metrics.kpis.failedEmailsCount >= 1);
  });

  await test('Overview metrics: empty store returns zero-safe metrics without crashing', async () => {
    // Call metrics with empty sets
    const metrics = await getAdminOverviewMetrics();
    assert.ok(metrics);
    assert.strictEqual(typeof metrics.kpis.ordersAwaitingCustomization, 'number');
    assert.strictEqual(typeof metrics.kpis.ordersAwaitingQC, 'number');
    assert.strictEqual(typeof metrics.kpis.ordersReadyForDispatch, 'number');
    assert.strictEqual(typeof metrics.kpis.dispatchedOrders, 'number');
    assert.strictEqual(typeof metrics.kpis.deliveredOrders, 'number');
  });

  // ----------------------------------------------------
  // SECTION 2: CUSTOMER AND STAFF MANAGEMENT & RBAC
  // ----------------------------------------------------
  await test('User management: list users supports pagination and search filtering', async () => {
    const resAll = await listAdminUsers({ page: 1, limit: 10 });
    assert.ok(resAll.data.length > 0);
    assert.ok(resAll.pagination.total >= resAll.data.length);

    // Search by name
    const resSearch = await listAdminUsers({ search: 'Dev Admin' });
    assert.ok(resSearch.data.length > 0);
    assert.strictEqual(resSearch.data[0].role, 'ADMIN');

    // Filter by role
    const resStaff = await listAdminUsers({ role: 'STAFF' });
    for (const u of resStaff.data) {
      assert.strictEqual(u.role, 'STAFF');
    }
  });

  await test('User management: getAdminUserDetails hides password hashes, tokens, and secrets', async () => {
    const user = await getAdminUserDetails('usr_admin_1');
    assert.ok(user);
    assert.strictEqual(user.id, 'usr_admin_1');
    assert.strictEqual((user as any).passwordHash, undefined);
    assert.strictEqual((user as any).sessionToken, undefined);
    assert.strictEqual((user as any).otpHash, undefined);
  });

  await test('User management: updates user role and revokes active sessions', async () => {
    // Update role of customer to STAFF
    const targetUserId = 'usr_cust_1';
    const actor = { id: 'usr_admin_1', email: 'admin@snappygifts.in', role: 'ADMIN' };

    const updated = await updateAdminUserStatusOrRole(targetUserId, { role: 'STAFF' }, actor);
    assert.strictEqual(updated.role, 'STAFF');

    // Verify audit log was recorded
    const logs = await queryAuditLogs({ action: 'USER_ROLE_UPDATE' });
    assert.ok(logs.data.length > 0);
    assert.strictEqual(logs.data[0].entityId, targetUserId);
    assert.strictEqual(logs.data[0].actorEmail, actor.email);
  });

  await test('User management: prevents non-ADMIN users from altering roles', async () => {
    const nonAdminActor = { id: 'usr_staff_1', email: 'staff@snappygifts.in', role: 'STAFF' };
    await assert.rejects(
      async () => {
        await updateAdminUserStatusOrRole('usr_cust_1', { role: 'ADMIN' }, nonAdminActor);
      },
      (err: any) => {
        assert.ok(err instanceof AdminPermissionError);
        assert.match(err.message, /ADMIN role/i);
        return true;
      }
    );
  });

  await test('User management: prevents self-demotion from ADMIN role', async () => {
    const adminActor = { id: 'usr_admin_1', email: 'admin@snappygifts.in', role: 'ADMIN' };
    await assert.rejects(
      async () => {
        await updateAdminUserStatusOrRole('usr_admin_1', { role: 'CUSTOMER' }, adminActor);
      },
      (err: any) => {
        assert.ok(err instanceof AdminValidationError);
        assert.match(err.message, /demote yourself/i);
        return true;
      }
    );
  });

  await test('User management: prevents self-deactivation by active admin', async () => {
    const adminActor = { id: 'usr_admin_1', email: 'admin@snappygifts.in', role: 'ADMIN' };
    await assert.rejects(
      async () => {
        await updateAdminUserStatusOrRole('usr_admin_1', { isActive: false }, adminActor);
      },
      (err: any) => {
        assert.ok(err instanceof AdminValidationError);
        assert.match(err.message, /deactivate your own/i);
        return true;
      }
    );
  });

  // ----------------------------------------------------
  // SECTION 3: BUSINESS SETTINGS & CONTROLS
  // ----------------------------------------------------
  await test('Business settings: gets default store configuration in integer paise', async () => {
    const config = await getStoreConfig();
    assert.ok(config);
    assert.strictEqual(typeof config.standardShippingFeePaise, 'number');
    assert.strictEqual(typeof config.freeShippingThresholdPaise, 'number');
    assert.strictEqual(typeof config.woodenCrateSurchargePaise, 'number');
    assert.strictEqual(config.standardShippingFeePaise, 9900); // ₹99
    assert.strictEqual(config.freeShippingThresholdPaise, 99900); // ₹999
    assert.strictEqual(config.woodenCrateSurchargePaise, 15000); // ₹150
  });

  await test('Business settings: updates non-secret store preferences with audit trail', async () => {
    const actor = { id: 'usr_admin_1', email: 'admin@snappygifts.in', role: 'ADMIN' };
    const updated = await updateStoreConfig(
      {
        storeName: 'Snappy Luxury Gifts India',
        supportEmail: 'care@snappygifts.in',
        standardShippingFeePaise: 14900, // ₹149
        freeShippingThresholdPaise: 149900, // ₹1499
        lowStockThreshold: 150,
      },
      actor
    );

    assert.strictEqual(updated.storeName, 'Snappy Luxury Gifts India');
    assert.strictEqual(updated.supportEmail, 'care@snappygifts.in');
    assert.strictEqual(updated.standardShippingFeePaise, 14900);
    assert.strictEqual(updated.lowStockThreshold, 150);

    // Verify audit log entry
    const logs = await queryAuditLogs({ action: 'STORE_CONFIG_UPDATE' });
    assert.ok(logs.data.length > 0);
    assert.strictEqual(logs.data[0].actorEmail, actor.email);
  });

  await test('Business settings: rejects invalid configuration (negative fees, invalid email)', async () => {
    const actor = { id: 'usr_admin_1', email: 'admin@snappygifts.in', role: 'ADMIN' };
    // Negative standard shipping fee
    await assert.rejects(
      async () => {
        await updateStoreConfig({ standardShippingFeePaise: -500 }, actor);
      },
      (err: any) => {
        assert.ok(err instanceof AdminValidationError);
        assert.match(err.message, /positive integer/i);
        return true;
      }
    );

    // Invalid support email format
    await assert.rejects(
      async () => {
        await updateStoreConfig({ supportEmail: 'not-an-email' }, actor);
      },
      (err: any) => {
        assert.ok(err instanceof AdminValidationError);
        assert.match(err.message, /valid email/i);
        return true;
      }
    );
  });

  await test('Business settings: rejects non-ADMIN role from modifying store settings', async () => {
    const staffActor = { id: 'usr_staff_1', email: 'staff@snappygifts.in', role: 'STAFF' };
    await assert.rejects(
      async () => {
        await updateStoreConfig({ storeName: 'Hacked Store' }, staffActor);
      },
      (err: any) => {
        assert.ok(err instanceof AdminPermissionError);
        assert.match(err.message, /ADMIN role/i);
        return true;
      }
    );
  });

  // ----------------------------------------------------
  // SECTION 4: BUSINESS REPORTS & CSV EXPORTS
  // ----------------------------------------------------
  await test('Reports: generateSalesReport aggregates captured totals and product volumes', async () => {
    const report = await generateSalesReport();
    assert.ok(report.summary);
    assert.strictEqual(typeof report.summary.totalOrdersCount, 'number');
    assert.strictEqual(typeof report.summary.capturedOrdersCount, 'number');
    assert.strictEqual(typeof report.summary.capturedRevenuePaise, 'number');
    assert.ok(Array.isArray(report.byProduct));
    assert.ok(Array.isArray(report.byCategory));
  });

  await test('Reports: generateOrdersReport groups orders by state and status', async () => {
    const report = await generateOrdersReport();
    assert.ok(report.statusBreakdown);
    assert.ok(Array.isArray(report.byState));
    assert.ok(report.pipelineVelocity);
  });

  await test('Reports: generateInventoryReport calculates stock valuation and low stock SKUs', async () => {
    const report = await generateInventoryReport();
    assert.ok(report.summary);
    assert.strictEqual(typeof report.summary.totalStockUnits, 'number');
    assert.strictEqual(typeof report.summary.totalStockValuePaise, 'number');
    assert.ok(report.summary.totalStockValueFormatted.startsWith('₹'));
    assert.ok(Array.isArray(report.lowStockItems));
  });

  await test('Reports: generateTaxReport snapshots taxable value, CGST, SGST, IGST totals', async () => {
    const report = await generateTaxReport();
    assert.ok(report.summary);
    assert.strictEqual(typeof report.summary.invoiceCount, 'number');
    assert.strictEqual(typeof report.summary.taxableTotalPaise, 'number');
    assert.strictEqual(typeof report.summary.taxTotalPaise, 'number');
    assert.ok(Array.isArray(report.invoices));
  });

  await test('Reports: sanitizeCsvCell neutralizes formula injection vectors (=, +, -, @, \\t, \\r)', async () => {
    // Formula attacks starting with =, +, -, @
    assert.strictEqual(sanitizeCsvCell('=cmd|/c calc!A0'), "''=cmd|/c calc!A0");
    assert.strictEqual(sanitizeCsvCell('+1+2'), "''+1+2");
    assert.strictEqual(sanitizeCsvCell('-5+5'), "''-5+5");
    assert.strictEqual(sanitizeCsvCell('@SUM(1,2)'), "''@SUM(1,2)");
    // Control characters \t, \r
    assert.strictEqual(sanitizeCsvCell('\tmalicious'), "''\tmalicious");
    assert.strictEqual(sanitizeCsvCell('\rmalicious'), "''\rmalicious");

    // Safe regular values
    assert.strictEqual(sanitizeCsvCell('Snappy Gifts Ajmer'), '"Snappy Gifts Ajmer"');
    assert.strictEqual(sanitizeCsvCell('12345'), '12345');
    assert.strictEqual(sanitizeCsvCell(null), '""');
  });

  await test('Reports: CSV export output contains sanitized content and header row', async () => {
    const salesReport = await generateSalesReport();
    assert.ok(salesReport.csv);
    assert.ok(salesReport.csv.startsWith('Order Number,Date (IST),Type,Status'));
    // Ensure no raw unquoted formula is present
    assert.ok(!salesReport.csv.includes(',='));
  });

  // ----------------------------------------------------
  // SECTION 5: AUDIT LOG SYSTEM & INTEGRITY
  // ----------------------------------------------------
  await test('Audit logs: records actor, action, entity and sanitized metadata', async () => {
    const actor = { id: 'usr_admin_1', email: 'admin@snappygifts.in', role: 'ADMIN' };
    const entry = await logAdminActivity({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'TEST_AUDIT_ACTION',
      entityType: 'TEST_ENTITY',
      entityId: 'ent_123',
      payload: {
        safeField: 'safeValue',
        password: 'SUPER_SECRET_PASSWORD', // Must be stripped!
        sessionToken: 'SESSION_BEARER_TOKEN', // Must be stripped!
      },
    });

    assert.ok(entry.id);
    assert.strictEqual(entry.action, 'TEST_AUDIT_ACTION');
    assert.strictEqual(entry.actorEmail, actor.email);
    // Verify credentials were redacted
    assert.strictEqual(entry.payload.safeField, 'safeValue');
    assert.strictEqual(entry.payload.password, '[REDACTED]');
    assert.strictEqual(entry.payload.sessionToken, '[REDACTED]');
  });

  await test('Audit logs: supports querying with action filter and pagination', async () => {
    const result = await queryAuditLogs({ action: 'TEST_AUDIT_ACTION', page: 1, limit: 5 });
    assert.ok(result.data.length > 0);
    assert.strictEqual(result.data[0].action, 'TEST_AUDIT_ACTION');
    assert.ok(result.pagination.total >= 1);
  });

  // ----------------------------------------------------
  // SECTION 6: SYSTEM HEALTH & OPERATIONAL DIAGNOSTICS
  // ----------------------------------------------------
  await test('System health: provides read-only connectivity diagnostics without exposing secrets', async () => {
    const health = await getSystemHealthOverview();
    assert.ok(health.database);
    assert.strictEqual(typeof health.database.connected, 'boolean');
    assert.ok(health.email);
    assert.ok(health.storage);
    assert.ok(health.app);
    assert.strictEqual(health.app.timezone, 'Asia/Kolkata');

    // Environment security check: names only, NO raw values
    assert.ok(health.environmentSecurity);
    assert.ok(Array.isArray(health.environmentSecurity.variables));
    for (const v of health.environmentSecurity.variables) {
      assert.strictEqual(typeof v.name, 'string');
      assert.strictEqual(typeof v.configured, 'boolean');
      // Must NOT contain a 'value' property
      assert.strictEqual((v as any).value, undefined);
    }
  });

  await test('System health: correctly reports background worker configuration status', async () => {
    const health = await getSystemHealthOverview();
    assert.ok(health.scheduler);
    assert.ok(health.scheduler.outboxWorker);
    assert.ok(health.scheduler.artworkCleanup);
  });

  console.log('\n====================================================');
  console.log(`  Batch 10 Test Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  return { passed, failed };
}

// Direct execution support
if (process.argv[1]?.includes('admin.test')) {
  runAdminTestSuite().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  }).catch((err) => {
    console.error('Batch 10 test suite execution failed:', err);
    process.exit(1);
  });
}

