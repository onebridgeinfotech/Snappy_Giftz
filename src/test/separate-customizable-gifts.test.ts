// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';

import assert from 'node:assert/strict';
import { INITIAL_PRODUCTS } from '../data/initialData';
import {
  getPublicProductBySlug,
  getPublicProducts,
  getPublicCategories,
} from '../lib/catalog/public-catalog.service';
import { validateProductInput } from '../lib/catalog/validation';

/**
 * SNAPPY GIFTZ — Separate Customizable Gifts Test Suite
 * Verifies the separation of Regular Gifts and Customizable Gifts across
 * data models, public catalog APIs, validation schemas, and storefront partitioning.
 */
async function runSeparateCustomizableGiftsTests() {
  console.log('🧪 Starting Separate Customizable Gifts Tests...\n');

  // Test 1: Seed data explicit productType and 0 overlap
  console.log('1. Verifying seed data has explicit productType and zero overlap...');
  assert.ok(Array.isArray(INITIAL_PRODUCTS), 'INITIAL_PRODUCTS must be an array');
  assert.ok(INITIAL_PRODUCTS.length > 0, 'INITIAL_PRODUCTS must not be empty');

  const regularSeed = INITIAL_PRODUCTS.filter((p) => p.productType === 'REGULAR');
  const customizableSeed = INITIAL_PRODUCTS.filter((p) => p.productType === 'CUSTOMIZABLE');

  assert.ok(regularSeed.length > 0, 'Must have at least one regular gift');
  assert.ok(customizableSeed.length > 0, 'Must have at least one customizable gift');
  assert.equal(
    regularSeed.length + customizableSeed.length,
    INITIAL_PRODUCTS.length,
    'Every product must be strictly REGULAR or CUSTOMIZABLE'
  );

  // Invariant: isCustomizable must strictly align with productType
  for (const p of regularSeed) {
    assert.equal(p.isCustomizable, false, `Regular product "${p.name}" must have isCustomizable: false`);
  }
  for (const p of customizableSeed) {
    assert.equal(p.isCustomizable, true, `Customizable product "${p.name}" must have isCustomizable: true`);
  }

  // Check no item IDs exist in both lists
  const regIds = new Set(regularSeed.map((p) => p.id));
  for (const p of customizableSeed) {
    assert.ok(!regIds.has(p.id), `Product ${p.id} must not exist in both Regular and Customizable`);
  }
  console.log(`   ✓ Validated ${INITIAL_PRODUCTS.length} seed products: ${customizableSeed.length} Customizable, ${regularSeed.length} Regular with zero overlap.\n`);

  // Test 2: Public catalog service querying by productType
  console.log('2. Testing getPublicProducts filtering by productType...');
  
  // 2a. Query all products
  const allProductsRes = await getPublicProducts({ limit: 50 });
  assert.ok(allProductsRes.products.length > 0, 'Should return catalog products');

  // 2b. Query only REGULAR products
  const regularRes = await getPublicProducts({ productType: 'REGULAR', limit: 50 });
  assert.ok(regularRes.products.length > 0, 'Must return regular products');
  for (const p of regularRes.products) {
    assert.equal(p.productType, 'REGULAR', `Expected productType REGULAR for "${p.name}", got ${p.productType}`);
    assert.equal(p.isCustomizable, false, `Expected isCustomizable false for "${p.name}"`);
  }
  console.log(`   ✓ getPublicProducts({ productType: 'REGULAR' }) returned ${regularRes.products.length} regular products.`);

  // 2c. Query only CUSTOMIZABLE products
  const customRes = await getPublicProducts({ productType: 'CUSTOMIZABLE', limit: 50 });
  assert.ok(customRes.products.length > 0, 'Must return customizable products');
  for (const p of customRes.products) {
    assert.equal(p.productType, 'CUSTOMIZABLE', `Expected productType CUSTOMIZABLE for "${p.name}", got ${p.productType}`);
    assert.equal(p.isCustomizable, true, `Expected isCustomizable true for "${p.name}"`);
  }
  console.log(`   ✓ getPublicProducts({ productType: 'CUSTOMIZABLE' }) returned ${customRes.products.length} customizable products.`);

  // 2d. Invariant check: Sum of partitioned query counts equals total
  assert.equal(
    regularRes.products.length + customRes.products.length,
    allProductsRes.products.length,
    'Sum of regular and customizable products must match total catalog items'
  );
  console.log(`   ✓ Partition invariant holds: ${regularRes.products.length} + ${customRes.products.length} = ${allProductsRes.products.length}\n`);

  // Test 3: getPublicProductBySlug returns productType
  console.log('3. Testing getPublicProductBySlug returns productType correctly...');
  const customizableSample = customizableSeed[0];
  const customResolved = await getPublicProductBySlug(customizableSample.slug || customizableSample.id);
  assert.ok(customResolved, 'Should resolve customizable product');
  assert.equal(customResolved.productType, 'CUSTOMIZABLE');
  assert.equal(customResolved.isCustomizable, true);
  console.log(`   ✓ Customizable product "${customResolved.name}" resolved with productType: ${customResolved.productType}`);

  const regularSample = regularSeed[0];
  const regularResolved = await getPublicProductBySlug(regularSample.slug || regularSample.id);
  assert.ok(regularResolved, 'Should resolve regular product');
  assert.equal(regularResolved.productType, 'REGULAR');
  assert.equal(regularResolved.isCustomizable, false);
  console.log(`   ✓ Regular product "${regularResolved.name}" resolved with productType: ${regularResolved.productType}\n`);

  // Test 4: Product input validation schema for productType
  console.log('4. Testing validation schema for productType in Create & Update inputs...');
  
  // Valid REGULAR input
  const validRegular = validateProductInput({
    name: 'Standard Luxury Leather Wallet',
    description: 'Artisanal top-grain leather wallet crafted by master artisans.',
    basePricePaise: 199900,
    mrpPaise: 299900,
    categoryId: 'cat-accessories',
    hsnCode: '69120010',
    productType: 'REGULAR',
    isCustomizable: false,
  });
  assert.ok(validRegular.valid, `Valid REGULAR product input must succeed: ${validRegular.errors.join(', ')}`);
  assert.equal(validRegular.errors.length, 0);

  // Valid CUSTOMIZABLE input
  const validCustom = validateProductInput({
    name: 'Engraved Luxury Leather Wallet',
    description: 'Artisanal wallet with monogram gold foil embossing.',
    basePricePaise: 249900,
    mrpPaise: 349900,
    categoryId: 'cat-accessories',
    hsnCode: '69120010',
    productType: 'CUSTOMIZABLE',
    isCustomizable: true,
  });
  assert.ok(validCustom.valid, `Valid CUSTOMIZABLE product input must succeed: ${validCustom.errors.join(', ')}`);
  assert.equal(validCustom.errors.length, 0);

  // Invalid productType
  const invalidType = validateProductInput({
    name: 'Invalid Type Item',
    description: 'Testing invalid type handling with at least ten characters.',
    basePricePaise: 199900,
    mrpPaise: 299900,
    categoryId: 'cat-accessories',
    hsnCode: '69120010',
    // @ts-expect-error intentionally testing runtime validation failure
    productType: 'UNSUPPORTED_TYPE',
  });
  assert.equal(invalidType.valid, false, 'Invalid productType must be rejected by validator');
  assert.ok(
    invalidType.errors.some((e) => e.includes('REGULAR') && e.includes('CUSTOMIZABLE')),
    'Validator error message must mention valid options'
  );
  console.log('   ✓ Input validator strictly permits only REGULAR or CUSTOMIZABLE and rejects invalid inputs.\n');

  // Test 5: Storefront Partitioning Logic Emulation
  console.log('5. Testing Storefront Partitioning Logic Emulation...');
  const mockStorefrontProducts = [...INITIAL_PRODUCTS];
  const sectionBCustomizable = mockStorefrontProducts.filter(
    (p) => p.productType === 'CUSTOMIZABLE' || p.isCustomizable === true
  );
  const sectionARegular = mockStorefrontProducts.filter(
    (p) => p.productType === 'REGULAR' || (!p.productType && !p.isCustomizable)
  );

  // Assert neither partition leaks into the other
  const customCardIds = new Set(sectionBCustomizable.map((p) => p.id));
  const regularCardIds = new Set(sectionARegular.map((p) => p.id));

  for (const id of customCardIds) {
    assert.ok(!regularCardIds.has(id), `Section B item ${id} found in Section A!`);
  }
  for (const id of regularCardIds) {
    assert.ok(!customCardIds.has(id), `Section A item ${id} found in Section B!`);
  }
  assert.equal(
    sectionBCustomizable.length + sectionARegular.length,
    mockStorefrontProducts.length,
    'Storefront partitioning must account for 100% of products with zero leakage'
  );
  console.log(`   ✓ Storefront partition confirmed: 0 overlap between Section B (Make It Personal: ${sectionBCustomizable.length}) and Section A (Regular Gifts: ${sectionARegular.length}).\n`);

  console.log('🎉 All Separate Customizable Gifts Tests Passed Successfully!\n');
}

runSeparateCustomizableGiftsTests().catch((err) => {
  console.error('❌ Separate Customizable Gifts Test failed:', err);
  process.exit(1);
});
