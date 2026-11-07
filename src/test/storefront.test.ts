// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import assert from 'node:assert/strict';
import {
  sanitizePublicQuery,
  getPublicProducts,
  getPublicProductBySlug,
  getPublicCategories,
  getPublicOccasions,
  CatalogDatabaseError,
  isStorefrontFallbackAllowed,
  PublicProduct,
} from '../lib/catalog/public-catalog.service';
import { generateMetadata } from '../app/products/[slug]/page';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { slugify } from '../lib/catalog/validation';

export async function runStorefrontTestSuite() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Batch 3: Storefront & SEO Tests     ');
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
  // 1. Query Parameter Validation & Sanitization
  // ------------------------------------------------------------------
  console.log('--- 1. Query Validation & Boundary Constraints ---');

  await test('Clamps negative or non-integer page numbers to 1', () => {
    const q1 = sanitizePublicQuery({ page: -5 });
    assert.equal(q1.page, 1);

    const q2 = sanitizePublicQuery({ page: 0 });
    assert.equal(q2.page, 1);

    const q3 = sanitizePublicQuery({ page: 'invalid' as any });
    assert.equal(q3.page, 1);
  });

  await test('Constrains page limit between 1 and 50 (defaults to 12)', () => {
    const qDefault = sanitizePublicQuery({});
    assert.equal(qDefault.limit, 12);

    const qMax = sanitizePublicQuery({ limit: 1000 });
    assert.equal(qMax.limit, 50);

    const qMin = sanitizePublicQuery({ limit: -10 });
    assert.equal(qMin.limit, 1);

    const qValid = sanitizePublicQuery({ limit: 24 });
    assert.equal(qValid.limit, 24);
  });

  await test('Trims and truncates search query strings to 100 characters', () => {
    const longString = 'a'.repeat(150);
    const q = sanitizePublicQuery({ search: `   ${longString}   ` });
    assert.equal(q.search?.length, 100);
    assert.equal(q.search, 'a'.repeat(100));
  });

  await test('Maps "All" category and occasion to undefined (no filter)', () => {
    const q = sanitizePublicQuery({ category: 'All', occasion: 'All' });
    assert.equal(q.category, undefined);
    assert.equal(q.occasion, undefined);
  });

  await test('Falls back to "featured" for unapproved sort values', () => {
    const q1 = sanitizePublicQuery({ sort: 'malicious_sql' as any });
    assert.equal(q1.sort, 'featured');

    const q2 = sanitizePublicQuery({ sort: 'price_asc' });
    assert.equal(q2.sort, 'price_asc');
  });

  // ------------------------------------------------------------------
  // 2. Public Catalog Visibility & Data Sanitization Rules
  // ------------------------------------------------------------------
  console.log('\n--- 2. Public Catalog Visibility & Sanitization ---');

  await test('Public catalog returns valid products with integer paise pricing', async () => {
    const res = await getPublicProducts({ limit: 5 });
    assert.ok(res.products.length > 0, 'Catalog should return products');
    for (const p of res.products) {
      assert.ok(Number.isInteger(p.basePricePaise), `basePricePaise for ${p.name} must be integer`);
      assert.ok(p.basePricePaise > 0, `basePricePaise for ${p.name} must be positive`);
      assert.ok(Number.isInteger(p.mrpPaise), `mrpPaise for ${p.name} must be integer`);
      assert.ok(p.mrpPaise >= p.basePricePaise, `mrpPaise must be >= basePricePaise`);
    }
  });

  await test('Public catalog never exposes internal storage keys, audit logs or private paths', async () => {
    const res = await getPublicProducts({ limit: 20 });
    for (const p of res.products as any[]) {
      assert.equal(p.storageKey, undefined, 'Public product must not expose storageKey');
      assert.equal(p.auditLogs, undefined, 'Public product must not expose auditLogs');
      assert.equal(p.userId, undefined, 'Public product must not expose internal userId');
      assert.equal(p.hsnCode, undefined, 'Public storefront should not expose internal tax HSN code');
      if (p.galleryImages) {
        for (const img of p.galleryImages) {
          assert.equal(img.storageKey, undefined, 'Public gallery images must not expose storageKey');
        }
      }
    }
  });

  // ------------------------------------------------------------------
  // 3. Search, Category, and Occasion Filtering Combinations
  // ------------------------------------------------------------------
  console.log('\n--- 3. Search & Multi-Filter Combinations ---');

  await test('Filters catalog by category correctly', async () => {
    const res = await getPublicProducts({ category: 'Personalized Gifts', limit: 50 });
    assert.ok(res.products.length > 0, 'Should find products for Personalized Gifts');
    for (const p of res.products) {
      const cat = typeof p.category === 'object' ? p.category.name : p.category;
      assert.equal(cat.toLowerCase(), 'personalized gifts');
    }
  });

  await test('Filters catalog by occasion correctly', async () => {
    const res = await getPublicProducts({ occasion: 'Diwali', limit: 50 });
    assert.ok(res.products.length > 0, 'Should find products for Diwali occasion');
    for (const p of res.products) {
      const hasDiwali = p.occasions.some((o) => o.toLowerCase() === 'diwali');
      assert.ok(hasDiwali, `Product ${p.name} should include Diwali occasion`);
    }
  });

  await test('Filters catalog by combined search and category', async () => {
    const res = await getPublicProducts({
      category: 'Personalized Gifts',
      search: 'Mug',
      limit: 50,
    });
    assert.ok(res.products.length > 0, 'Should find products for Personalized Gifts + Mug');
    for (const p of res.products) {
      const cat = typeof p.category === 'object' ? p.category.name : p.category;
      assert.equal(cat.toLowerCase(), 'personalized gifts');
      const matchesSearch =
        p.name.toLowerCase().includes('mug') ||
        (p.tagline && p.tagline.toLowerCase().includes('mug')) ||
        p.description.toLowerCase().includes('mug');
      assert.ok(matchesSearch, `Product ${p.name} must match search query "Mug"`);
    }
  });

  await test('Sorts products by price ascending', async () => {
    const res = await getPublicProducts({ sort: 'price_asc', limit: 50 });
    for (let i = 0; i < res.products.length - 1; i++) {
      assert.ok(
        res.products[i].basePricePaise <= res.products[i + 1].basePricePaise,
        `Expected ${res.products[i].basePricePaise} <= ${res.products[i + 1].basePricePaise}`
      );
    }
  });

  await test('Sorts products by price descending', async () => {
    const res = await getPublicProducts({ sort: 'price_desc', limit: 50 });
    for (let i = 0; i < res.products.length - 1; i++) {
      assert.ok(
        res.products[i].basePricePaise >= res.products[i + 1].basePricePaise,
        `Expected ${res.products[i].basePricePaise} >= ${res.products[i + 1].basePricePaise}`
      );
    }
  });

  // ------------------------------------------------------------------
  // 4. Pagination & Load-More Invariants
  // ------------------------------------------------------------------
  console.log('\n--- 4. Storefront Pagination & Boundary Invariants ---');

  await test('Paginates properly across multiple pages without overlap', async () => {
    const page1 = await getPublicProducts({ page: 1, limit: 3 });
    const page2 = await getPublicProducts({ page: 2, limit: 3 });

    assert.equal(page1.products.length, 3);
    assert.equal(page1.pagination.page, 1);
    assert.equal(page1.pagination.limit, 3);
    assert.ok(page1.pagination.totalCount >= 6);

    assert.equal(page2.products.length, 3);
    assert.equal(page2.pagination.page, 2);

    // Verify non-overlapping items
    const idsPage1 = new Set(page1.products.map((p) => p.id));
    for (const p of page2.products) {
      assert.ok(!idsPage1.has(p.id), `Page 2 item ${p.name} must not be present in Page 1`);
    }
  });

  await test('Returns empty list when requesting page beyond total pages', async () => {
    const res = await getPublicProducts({ page: 999, limit: 10 });
    assert.equal(res.products.length, 0);
    assert.equal(res.pagination.hasMore, false);
  });

  // ------------------------------------------------------------------
  // 5. Product Detail Lookup, SEO Metadata & OpenGraph
  // ------------------------------------------------------------------
  console.log('\n--- 5. SEO Metadata & Dynamic Product Route ---');

  await test('Retrieves public product by stable slug or ID', async () => {
    const product = await getPublicProductBySlug('royale-gold-rim-ceramic-mug-warmer-set');
    assert.ok(product, 'Should find royale-gold-rim-ceramic-mug-warmer-set by slug');
    assert.equal(product.slug, 'royale-gold-rim-ceramic-mug-warmer-set');
    assert.ok(product.images.length > 0);
  });

  await test('Returns null for missing or invalid product slug', async () => {
    const product = await getPublicProductBySlug('non-existent-product-slug-xyz');
    assert.equal(product, null, 'Must return null for unknown product slug');
  });

  await test('Generates Next.js SEO metadata with OpenGraph and canonical URL', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'royale-gold-rim-ceramic-mug-warmer-set' }),
    });

    assert.ok(meta.title?.toString().includes('Royale Gold-Rim Ceramic Mug'));
    assert.ok(meta.description);
    assert.equal(meta.alternates?.canonical, '/products/royale-gold-rim-ceramic-mug-warmer-set');
    assert.equal((meta.openGraph as any)?.type, 'website');
    assert.ok((meta.openGraph as any)?.images?.length > 0);
  });

  await test('Generates noindex robots metadata for missing products', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'missing-product-12345' }),
    });

    assert.equal(meta.title, 'Product Not Found | Snappy Gifts');
    assert.equal((meta.robots as any)?.index, false);
    assert.equal((meta.robots as any)?.follow, false);
  });

  // ------------------------------------------------------------------
  // 6. Robots & Sitemap Generation
  // ------------------------------------------------------------------
  console.log('\n--- 6. Robots & Sitemap Rules ---');

  await test('Robots configuration disallows administrative & private API routes', () => {
    const r = robots();
    assert.ok(r.rules, 'Robots must have rules defined');
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];

    assert.ok(disallow.includes('/api/admin/'), 'Must disallow /api/admin/');
    assert.ok(disallow.includes('/api/auth/'), 'Must disallow /api/auth/');
    assert.ok(disallow.includes('/api/b2b/'), 'Must disallow /api/b2b/');
    assert.ok(r.sitemap?.includes('/sitemap.xml'), 'Sitemap reference must be present');
  });

  await test('Sitemap generator includes homepage and product URLs', async () => {
    const map = await sitemap();
    assert.ok(map.length > 1, 'Sitemap should include homepage and products');
    assert.ok(map.some((entry) => entry.priority === 1.0), 'Homepage entry with 1.0 priority');
    assert.ok(map.some((entry) => entry.url.includes('/products/')), 'Product URLs present');
  });

  // ------------------------------------------------------------------
  // 7. Environment-Aware Fallback Policy & Database Failure Protection
  // ------------------------------------------------------------------
  console.log('\n--- 7. Environment-Aware Fallback Policy ---');

  await test('Fallback is allowed in default development/test environment', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_DEMO_FALLBACK;
    try {
      delete process.env.ALLOW_DEMO_FALLBACK;
      (process.env as any).NODE_ENV = 'development';
      assert.equal(isStorefrontFallbackAllowed(), true);

      (process.env as any).NODE_ENV = 'test';
      assert.equal(isStorefrontFallbackAllowed(), true);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.ALLOW_DEMO_FALLBACK = originalAllow;
    }
  });

  await test('Fallback is strictly forbidden in production unless explicitly configured', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_DEMO_FALLBACK;
    try {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO_FALLBACK;
      assert.equal(isStorefrontFallbackAllowed(), false, 'Must forbid demo fallback in production');

      process.env.ALLOW_DEMO_FALLBACK = 'true';
      assert.equal(isStorefrontFallbackAllowed(), true, 'ALLOW_DEMO_FALLBACK=true overrides production');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.ALLOW_DEMO_FALLBACK = originalAllow;
    }
  });

  await test('In production mode, getPublicProducts throws CatalogDatabaseError if DB is offline', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_DEMO_FALLBACK;
    try {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO_FALLBACK;

      await assert.rejects(
        async () => {
          await getPublicProducts({ limit: 5 });
        },
        (err: any) => {
          assert.ok(err instanceof CatalogDatabaseError, 'Must throw CatalogDatabaseError in production');
          assert.equal(err.message, 'Public catalog service is temporarily unavailable.');
          return true;
        }
      );
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.ALLOW_DEMO_FALLBACK = originalAllow;
    }
  });

  await test('In production mode, getPublicProductBySlug throws CatalogDatabaseError if DB is offline', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_DEMO_FALLBACK;
    try {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO_FALLBACK;

      await assert.rejects(
        async () => {
          await getPublicProductBySlug('royale-gold-rim-ceramic-mug-warmer-set');
        },
        (err: any) => {
          assert.ok(err instanceof CatalogDatabaseError, 'Must throw CatalogDatabaseError in production');
          return true;
        }
      );
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.ALLOW_DEMO_FALLBACK = originalAllow;
    }
  });

  // ------------------------------------------------------------------
  // 8. Public Categories, Occasions & Truthful SEO Structured Data
  // ------------------------------------------------------------------
  console.log('\n--- 8. Public Categories & SEO Structured Data Integrity ---');

  await test('Public categories service returns sanitized category records', async () => {
    const cats = await getPublicCategories();
    assert.ok(cats.length > 0, 'Categories must be returned');
    for (const c of cats) {
      assert.ok(c.id);
      assert.ok(c.name);
      assert.ok(c.slug);
      assert.equal((c as any).createdAt, undefined, 'Internal createdAt must not be exposed');
      assert.equal((c as any).updatedAt, undefined, 'Internal updatedAt must not be exposed');
    }
  });

  await test('Public occasions service returns sanitized occasion records', async () => {
    const occs = await getPublicOccasions();
    assert.ok(occs.length > 0, 'Occasions must be returned');
    for (const o of occs) {
      assert.ok(o.id);
      assert.ok(o.name);
      assert.ok(o.slug);
      assert.equal((o as any).createdAt, undefined, 'Internal createdAt must not be exposed');
      assert.equal((o as any).updatedAt, undefined, 'Internal updatedAt must not be exposed');
    }
  });

  await test('SEO metadata does not crash and returns fallback when DB throws in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_DEMO_FALLBACK;
    try {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO_FALLBACK;

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: 'some-product-slug' }),
      });
      assert.equal(meta.title, 'Product Unavailable | Snappy Gifts');
      assert.equal((meta.robots as any)?.index, false);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.ALLOW_DEMO_FALLBACK = originalAllow;
    }
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Storefront Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} storefront test(s) failed.`);
  }

  return { passed, failed };
}

if (process.argv[1]?.includes('storefront.test')) {
  runStorefrontTestSuite().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
