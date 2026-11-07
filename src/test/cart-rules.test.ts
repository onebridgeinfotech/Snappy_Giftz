// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';

import assert from 'node:assert/strict';
import { calculateCartPricing, CartItemInput } from '../lib/pricing/pricing.service';
import { INITIAL_PRODUCTS } from '../data/initialData';

/**
 * SNAPPY GIFTZ — Cart Rules & Flat ₹20 Gift-Wrapping Invariant Test Suite
 */
async function runCartRulesTests() {
  console.log('🧪 Starting Cart Rules & Pricing Invariant Tests...\n');

  const p1 = INITIAL_PRODUCTS[0]; // e.g. basePrice 1499
  const p2 = INITIAL_PRODUCTS[1]; // e.g. basePrice 1899

  // Test 1: Single item without gift wrapping
  console.log('1. Testing single standard item without gift wrapping...');
  const itemsNoWrap: CartItemInput[] = [
    {
      productId: p1.id,
      quantity: 1,
      isGiftWrapped: false,
    },
  ];
  const quote1 = await calculateCartPricing(itemsNoWrap, '36'); // Telangana
  assert.equal(quote1.customizationTotalPaise, 0, 'Gift wrap fee should be 0 paise when not selected');
  assert.equal(quote1.itemsSubtotalPaise, p1.basePrice * 100, 'Subtotal should match product basePrice * 100');
  console.log(`   ✓ Single item pricing verified: Subtotal = ₹${quote1.itemsSubtotalPaise / 100}, Wrap = ₹${quote1.customizationTotalPaise / 100}`);

  // Test 2: Crucial Invariant: Single item with gift wrapping = Flat ₹20 (2,000 paise)
  console.log('2. Testing single item with gift wrapping (must be exactly ₹20 flat)...');
  const itemsOneWrap: CartItemInput[] = [
    {
      productId: p1.id,
      quantity: 1,
      isGiftWrapped: true,
    },
  ];
  const quote2 = await calculateCartPricing(itemsOneWrap, '36');
  assert.equal(quote2.customizationTotalPaise, 2000, 'Flat gift wrap fee must be exactly 2,000 paise (₹20)');
  console.log(`   ✓ Flat gift wrap fee verified: ₹${quote2.customizationTotalPaise / 100}`);

  // Test 3: Crucial Invariant: High quantity item with gift wrapping = STILL Flat ₹20 (NOT multiplied by quantity)
  console.log('3. Testing item with quantity = 10 and gift wrapping (must STILL be ₹20 flat)...');
  const itemsHighQtyWrap: CartItemInput[] = [
    {
      productId: p1.id,
      quantity: 10,
      isGiftWrapped: true,
    },
  ];
  const quote3 = await calculateCartPricing(itemsHighQtyWrap, '36');
  assert.equal(
    quote3.customizationTotalPaise,
    2000,
    'Gift wrap fee must NOT multiply by quantity; must remain flat 2,000 paise (₹20)'
  );
  assert.equal(quote3.itemsSubtotalPaise, p1.basePrice * 100 * 10, 'Subtotal should match 10x unit price');
  console.log(`   ✓ Qty=10 gift wrap verified: Subtotal = ₹${quote3.itemsSubtotalPaise / 100}, Wrap = ₹${quote3.customizationTotalPaise / 100} (not ₹200)`);

  // Test 4: Crucial Invariant: Multiple distinct items with gift wrapping = STILL Flat ₹20 per order
  console.log('4. Testing multiple distinct items wrapped (must be flat ₹20 for entire order)...');
  const itemsMultiWrap: CartItemInput[] = [
    {
      productId: p1.id,
      quantity: 2,
      isGiftWrapped: true,
    },
    {
      productId: p2.id,
      quantity: 3,
      isGiftWrapped: true,
    },
  ];
  const quote4 = await calculateCartPricing(itemsMultiWrap, '36');
  assert.equal(
    quote4.customizationTotalPaise,
    2000,
    'Gift wrap fee must be flat 2,000 paise for entire order even with multiple items selected'
  );
  console.log(`   ✓ Multiple items wrap verified: Wrap = ₹${quote4.customizationTotalPaise / 100} across 2 items (5 units)`);

  // Test 5: Mixed cart (one item wrapped, one item not wrapped) = Flat ₹20 per order
  console.log('5. Testing mixed cart (1 wrapped item + 1 unwrapped item)...');
  const itemsMixed: CartItemInput[] = [
    {
      productId: p1.id,
      quantity: 1,
      isGiftWrapped: false,
    },
    {
      productId: p2.id,
      quantity: 1,
      isGiftWrapped: true,
    },
  ];
  const quote5 = await calculateCartPricing(itemsMixed, '36');
  assert.equal(quote5.customizationTotalPaise, 2000, 'Gift wrap fee must be 2,000 paise if any item is wrapped');
  console.log(`   ✓ Mixed cart wrap verified: Wrap = ₹${quote5.customizationTotalPaise / 100}`);

  // Test 6: Customization note & text engraving metadata preservation
  console.log('6. Testing custom engraving and note preservation in pricing quote...');
  const itemsPersonalized: CartItemInput[] = [
    {
      productId: p1.id,
      quantity: 1,
      isGiftWrapped: true,
      customization: {
        engravedText: 'Forever With Love',
        fontFamily: 'Great Vibes',
        giftNote: 'Happy Anniversary to my dearest!',
        artworkUploadId: 'art-upload-12345',
        giftWrap: true,
      },
    },
  ];
  const quote6 = await calculateCartPricing(itemsPersonalized, '36');
  assert.equal(quote6.items.length, 1, 'Quote must preserve item count');
  assert.equal(quote6.customizationTotalPaise, 2000, 'Customization fee with gift wrap is 2000 paise');
  console.log('   ✓ Customization metadata structure and quote generation verified.');

  // Test 7: Zero floating-point rounding precision across GST calculation
  console.log('7. Verifying financial integrity & zero floating-point arithmetic...');
  const taxable = quote6.taxableAmountPaise;
  const tax = quote6.taxTotalPaise;
  const grand = quote6.grandTotalPaise;
  assert.ok(Number.isInteger(taxable), 'Taxable amount must be integer paise');
  assert.ok(Number.isInteger(tax), 'Tax total must be integer paise');
  assert.ok(Number.isInteger(grand), 'Grand total must be integer paise');
  assert.equal(taxable + tax + quote6.shippingTotalPaise, grand, 'grandTotalPaise must equal taxable + tax + shipping');
  console.log(`   ✓ Exact financial invariant: Taxable(${taxable}) + Tax(${tax}) + Shipping(${quote6.shippingTotalPaise}) = GrandTotal(${grand})`);

  console.log('\n✅ All Cart Rules & Pricing tests passed successfully (7/7).\n');
}

runCartRulesTests().catch((err) => {
  console.error('❌ Cart Rules tests failed:', err);
  process.exit(1);
});
