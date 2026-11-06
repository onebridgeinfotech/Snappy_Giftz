Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';

import assert from 'node:assert/strict';
import { INITIAL_PRODUCTS } from '../data/initialData';
import { getPublicProductBySlug, getPublicProducts, getPublicCategories, getPublicOccasions } from '../lib/catalog/public-catalog.service';

/**
 * SNAPPY GIFTZ — Shopping Catalog & Product Detail Test Suite
 */
async function runShoppingCatalogTests() {
  console.log('🧪 Starting Shopping Catalog & Product Detail Tests...\n');

  // Test 1: Initial catalog seeded products existence
  console.log('1. Verifying initial catalog products are loaded...');
  assert.ok(Array.isArray(INITIAL_PRODUCTS), 'INITIAL_PRODUCTS must be an array');
  assert.ok(INITIAL_PRODUCTS.length > 0, 'INITIAL_PRODUCTS must not be empty');
  console.log(`   ✓ Found ${INITIAL_PRODUCTS.length} curated products in seed data.`);

  // Test 2: Categories and filter taxonomies
  console.log('2. Verifying categories taxonomy...');
  const categories = await getPublicCategories();
  assert.ok(Array.isArray(categories), 'Categories must be an array');
  const catNames = categories.map((c: any) => typeof c === 'string' ? c : c.name || c.id);
  assert.ok(catNames.length >= 2, 'Must have at least 2 categories');
  console.log(`   ✓ Categories: ${catNames.join(', ')}`);

  // Test 3: Product slug generation and resolution
  console.log('3. Verifying slug-based product lookup...');
  const sampleProduct = INITIAL_PRODUCTS[0];
  const expectedSlug = sampleProduct.slug || sampleProduct.id;
  const resolved = await getPublicProductBySlug(expectedSlug);
  assert.ok(resolved, `Product with slug "${expectedSlug}" should be resolvable`);
  assert.equal(resolved.name, sampleProduct.name, 'Resolved product name must match seed name');
  assert.ok(resolved.basePricePaise > 0, 'Product must have positive basePricePaise');
  console.log(`   ✓ Resolved "${resolved.name}" via slug/id: ${expectedSlug}`);

  // Test 4: Product badges and stock status
  console.log('4. Verifying product badges and inventory status...');
  const badgedProducts = INITIAL_PRODUCTS.filter((p) => p.badge);
  assert.ok(badgedProducts.length > 0, 'At least one product should have a luxury badge');
  for (const prod of INITIAL_PRODUCTS) {
    assert.ok(typeof prod.stock === 'number' && prod.stock >= 0, `Product ${prod.name} must have non-negative stock`);
    assert.ok(prod.mrp >= prod.basePrice, `Product ${prod.name} MRP must be >= basePrice`);
  }
  console.log(`   ✓ Badges and stock validated across ${INITIAL_PRODUCTS.length} products.`);

  // Test 5: Search and category filtering logic
  console.log('5. Testing product filtering and searching...');
  const searchResults = await getPublicProducts({ search: 'pen', limit: 5 });
  assert.ok(searchResults.products.length > 0, 'Search for "pen" should return relevant items');
  console.log(`   ✓ Search for "pen" returned ${searchResults.products.length} matching products.`);

  // Test 6: Price sorting verification
  console.log('6. Testing price sorting ascending & descending...');
  const ascList = await getPublicProducts({ sort: 'price_asc', limit: 10 });
  for (let i = 0; i < ascList.products.length - 1; i++) {
    assert.ok(
      ascList.products[i].basePricePaise <= ascList.products[i + 1].basePricePaise,
      `Ascending price order violated: ${ascList.products[i].basePricePaise} > ${ascList.products[i + 1].basePricePaise}`
    );
  }
  const descList = await getPublicProducts({ sort: 'price_desc', limit: 10 });
  for (let i = 0; i < descList.products.length - 1; i++) {
    assert.ok(
      descList.products[i].basePricePaise >= descList.products[i + 1].basePricePaise,
      `Descending price order violated: ${descList.products[i].basePricePaise} < ${descList.products[i + 1].basePricePaise}`
    );
  }
  console.log('   ✓ Price sorting (ascending & descending) mathematically verified.');

  console.log('\n✅ All Shopping Catalog tests passed successfully (6/6).\n');
}

runShoppingCatalogTests().catch((err) => {
  console.error('❌ Shopping Catalog tests failed:', err);
  process.exit(1);
});
