// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';
import { hasRole } from '../lib/auth/rbac';
import {
  DEV_ORGANIZATIONS_STORE,
  DEV_CORPORATE_RFQS_STORE,
  DEV_CORPORATE_QUOTES_STORE,
  DEV_CORPORATE_ORDER_GROUPS_STORE,
  DEV_CORPORATE_MEMBERS_STORE,
  resetCorporateDevStores,
} from '../lib/corporate/corporate.service';
import { calculateCartPricing } from '../lib/pricing/pricing.service';
import { INITIAL_PRODUCTS } from '../data/initialData';

export async function runCorporateTestSuite() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Corporate B2B Decommissioning Suite');
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

  // Reset stores for test execution
  resetCorporateDevStores();

  // ------------------------------------------------------------------
  // 1. Prisma Schema & Client Verification
  // ------------------------------------------------------------------
  console.log('--- 1. Corporate Database Models Absence ---');

  await test('Prisma client has removed Organization model', () => {
    assert.strictEqual((prisma as any).organization, undefined);
  });

  await test('Prisma client has removed CorporateMembership model', () => {
    assert.strictEqual((prisma as any).corporateMembership, undefined);
  });

  await test('Prisma client has removed CorporateAddress model', () => {
    assert.strictEqual((prisma as any).corporateAddress, undefined);
  });

  await test('Prisma client has removed CorporateRFQ and CorporateRFQItem models', () => {
    assert.strictEqual((prisma as any).corporateRFQ, undefined);
    assert.strictEqual((prisma as any).corporateRFQItem, undefined);
  });

  await test('Prisma client has removed CorporateQuote and CorporateQuoteItem models', () => {
    assert.strictEqual((prisma as any).corporateQuote, undefined);
    assert.strictEqual((prisma as any).corporateQuoteItem, undefined);
  });

  await test('Prisma client has removed CorporatePriceAgreement and CorporatePriceTier models', () => {
    assert.strictEqual((prisma as any).corporatePriceAgreement, undefined);
    assert.strictEqual((prisma as any).corporatePriceTier, undefined);
  });

  await test('Prisma client has removed CorporateOrderGroup and CorporateDeliveryAllocation models', () => {
    assert.strictEqual((prisma as any).corporateOrderGroup, undefined);
    assert.strictEqual((prisma as any).corporateDeliveryAllocation, undefined);
  });

  await test('Prisma client has removed Quotation model', () => {
    assert.strictEqual((prisma as any).quotation, undefined);
  });

  // ------------------------------------------------------------------
  // 2. Role Enum & RBAC Verification
  // ------------------------------------------------------------------
  console.log('\n--- 2. Consumer-Only RBAC & Obsolete Role Rejection ---');

  await test('Role enum contains only CUSTOMER, STAFF, ADMIN', () => {
    const roles = Object.keys(Role);
    assert.deepStrictEqual(roles.sort(), ['ADMIN', 'CUSTOMER', 'STAFF']);
  });

  await test('Role enum has cleanly purged B2B_CLIENT', () => {
    assert.strictEqual((Role as any).B2B_CLIENT, undefined);
  });

  await test('Obsolete B2B_CLIENT role is rejected by RBAC access checks', () => {
    assert.strictEqual(hasRole('B2B_CLIENT' as any, [Role.ADMIN, Role.STAFF]), false);
    assert.strictEqual(hasRole('B2B_CLIENT' as any, [Role.CUSTOMER]), false);
  });

  await test('CUSTOMER role permitted for consumer storefront operations only', () => {
    assert.strictEqual(hasRole(Role.CUSTOMER, [Role.CUSTOMER]), true);
    assert.strictEqual(hasRole(Role.CUSTOMER, [Role.ADMIN, Role.STAFF]), false);
  });

  await test('STAFF role permitted for fulfillment and ops but denied superadmin deletion', () => {
    assert.strictEqual(hasRole(Role.STAFF, [Role.ADMIN, Role.STAFF]), true);
    assert.strictEqual(hasRole(Role.STAFF, [Role.ADMIN]), false);
  });

  await test('ADMIN role has complete administrative authority', () => {
    assert.strictEqual(hasRole(Role.ADMIN, [Role.ADMIN]), true);
    assert.strictEqual(hasRole(Role.ADMIN, [Role.ADMIN, Role.STAFF]), true);
  });

  // ------------------------------------------------------------------
  // 3. Inactive Corporate Dev Stores & Pure Consumer Catalog
  // ------------------------------------------------------------------
  console.log('\n--- 3. Corporate Inactivity & Pure Consumer Operations ---');

  await test('Corporate dev stores are empty and unpopulated', () => {
    assert.strictEqual(DEV_ORGANIZATIONS_STORE.size, 0);
    assert.strictEqual(DEV_CORPORATE_RFQS_STORE.size, 0);
    assert.strictEqual(DEV_CORPORATE_QUOTES_STORE.size, 0);
    assert.strictEqual(DEV_CORPORATE_ORDER_GROUPS_STORE.size, 0);
    assert.strictEqual(DEV_CORPORATE_MEMBERS_STORE.size, 0);
  });

  await test('Consumer cart pricing calculates without corporate price agreements or volume tiers', async () => {
    const quote = await calculateCartPricing(
      [
        {
          productId: INITIAL_PRODUCTS[0].id,
          quantity: 2,
        },
      ],
      '36'
    );

    assert.ok(quote.grandTotalPaise > 0);
    assert.strictEqual(quote.items.length, 1);
    assert.strictEqual(quote.destinationStateCode, '36');
    assert.ok(quote.cgstPaise > 0);
    assert.ok(quote.sgstPaise > 0);
    assert.strictEqual(quote.igstPaise, 0);
  });

  await test('Consumer order items with customization calculate standard bespoke fees without RFQ', async () => {
    const quote = await calculateCartPricing(
      [
        {
          productId: INITIAL_PRODUCTS[0].id,
          quantity: 1,
          customization: {
            personalizationType: 'TEXT_ENGRAVING',
            engravedText: 'Forever With Love',
          },
        },
      ],
      '36'
    );

    assert.ok(quote.customizationTotalPaise >= 0);
    assert.strictEqual(quote.grandTotalPaise, quote.itemsSubtotalPaise + quote.customizationTotalPaise + quote.taxTotalPaise + quote.shippingTotalPaise);
  });

  console.log(`\nCorporate Decommissioning Suite Summary: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}
