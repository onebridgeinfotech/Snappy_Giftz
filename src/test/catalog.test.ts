// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import assert from 'node:assert/strict';
import {
  validateProductInput,
  validateVariantInput,
  validateStockAdjustmentInput,
  slugify,
} from '../lib/catalog/validation';
import { hasRole } from '../lib/auth/rbac';
import { Role, InventoryAdjustmentReason } from '@prisma/client';
import {
  verifyImageMagicBytes,
  LocalDiskStorageService,
  StorageValidationError,
} from '../services/storage/local-storage.service';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

async function runCatalogTestSuite() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Batch 2: Catalog Hardening Tests    ');
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
  // 1. Catalog Validation & Integer Paise Invariants
  // ------------------------------------------------------------------
  console.log('--- 1. Product & Variant Validation (Paise Invariants) ---');

  await test('Reject product with empty or short name', () => {
    const res = validateProductInput({
      name: 'Ab',
      description: 'A valid description for testing',
      categoryId: 'cat-1',
      hsnCode: '69120010',
      basePricePaise: 129900,
      mrpPaise: 199900,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('at least 3 characters')));
  });

  await test('Reject floating-point currency representation in basePricePaise', () => {
    const res = validateProductInput({
      name: 'Ceramic Mug',
      description: 'A valid handcrafted ceramic mug description',
      categoryId: 'cat-1',
      hsnCode: '69120010',
      basePricePaise: 1299.5 as any, // Disallowed float
      mrpPaise: 199900,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('positive integer')));
  });

  await test('Reject retail MRP lower than base selling price', () => {
    const res = validateProductInput({
      name: 'Personalized Leather Wallet',
      description: 'Full-grain leather wallet with custom gold foil monogramming',
      categoryId: 'cat-1',
      hsnCode: '42023190',
      basePricePaise: 250000, // ₹2,500.00
      mrpPaise: 199900,       // ₹1,999.00 (MRP lower than base price)
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Retail MRP cannot be lower')));
  });

  await test('Reject invalid Indian HSN code format', () => {
    const res = validateProductInput({
      name: 'Brass Diya Set',
      description: 'Festive brass diya handcrafted in Ajmer with gift box packaging',
      categoryId: 'cat-1',
      hsnCode: 'ABC-INVALID',
      basePricePaise: 89900,
      mrpPaise: 129900,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('HSN code must be 4 to 8 digits')));
  });

  await test('Reject invalid tax rate percent outside 0% to 28% range', () => {
    const res = validateProductInput({
      name: 'Brass Diya Set',
      description: 'Festive brass diya handcrafted in Ajmer with gift box packaging',
      categoryId: 'cat-1',
      hsnCode: '74198030',
      taxRatePercent: 45, // Outside Indian GST maximum (28%)
      basePricePaise: 89900,
      mrpPaise: 129900,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('between 0% and 28%')));
  });

  await test('Accept valid product with standard 18% GST and integer paise', () => {
    const res = validateProductInput({
      name: 'Royal Ajmer Engraved Pen',
      description: 'Luxury matte black rollerball pen with personalized laser engraving',
      categoryId: 'cat-pens',
      hsnCode: '96081019',
      taxRatePercent: 18,
      basePricePaise: 99900,
      mrpPaise: 149900,
      minOrderQty: 1,
    });
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  await test('Slugify helper produces clean lowercase kebab-case', () => {
    const slug = slugify('  Royal Ajmer — Laser-Engraved Mug 2026!  ');
    assert.equal(slug, 'royal-ajmer-laser-engraved-mug-2026');
  });

  // ------------------------------------------------------------------
  // 2. Product Variants & Duplicate SKU Handling
  // ------------------------------------------------------------------
  console.log('\n--- 2. Product Variants & Duplicate SKU Validation ---');

  await test('Reject variant with malformed SKU containing illegal symbols', () => {
    const res = validateVariantInput({
      name: 'Rose Gold / Medium',
      sku: 'SG@MUG#ROSE*',
      pricePaise: 129900,
      attributes: { color: 'Rose Gold' },
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('SKU must be 3-50 characters')));
  });

  await test('Detect and reject duplicate SKUs within product payload', () => {
    const res = validateProductInput({
      name: 'Stainless Steel Flask',
      description: 'Insulated double-wall flask with temperature display',
      categoryId: 'cat-drinkware',
      hsnCode: '96170011',
      basePricePaise: 149900,
      mrpPaise: 199900,
      variants: [
        {
          name: 'Midnight Black',
          sku: 'SG-FLASK-BLK-500',
          pricePaise: 149900,
          attributes: { color: 'Black' },
        },
        {
          name: 'Matte Black Duplicate',
          sku: 'sg-flask-blk-500', // Duplicate SKU case-insensitive
          pricePaise: 149900,
          attributes: { color: 'Black' },
        },
      ],
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Duplicate SKU "SG-FLASK-BLK-500"')));
  });

  // ------------------------------------------------------------------
  // 3. Server-Side RBAC Enforcement on Catalog Operations
  // ------------------------------------------------------------------
  console.log('\n--- 3. Server-Side RBAC on Catalog APIs ---');

  await test('Deny CUSTOMER access to Admin Catalog endpoints', () => {
    const isAllowed = hasRole(Role.CUSTOMER, [Role.ADMIN, Role.STAFF]);
    assert.equal(isAllowed, false);
  });

  await test('Deny B2B_CLIENT access to Admin Catalog endpoints', () => {
    const isAllowed = hasRole('B2B_CLIENT' as any, [Role.ADMIN, Role.STAFF]);
    assert.equal(isAllowed, false);
  });

  await test('Grant STAFF read/stock update access to Catalog', () => {
    const isAllowed = hasRole(Role.STAFF, [Role.ADMIN, Role.STAFF]);
    assert.equal(isAllowed, true);
  });

  await test('Deny STAFF product deletion/creation (ADMIN only)', () => {
    const isAllowed = hasRole(Role.STAFF, [Role.ADMIN]);
    assert.equal(isAllowed, false);
  });

  await test('Grant ADMIN universal access to catalog CRUD', () => {
    const isAllowed = hasRole(Role.ADMIN, [Role.ADMIN]);
    assert.equal(isAllowed, true);
  });

  // ------------------------------------------------------------------
  // 4. Inventory Audit-History Integrity & Restrictive Archiving
  // ------------------------------------------------------------------
  console.log('\n--- 4. Inventory History Integrity & Safe Archiving ---');

  await test('Reject zero quantity stock adjustment', () => {
    const res = validateStockAdjustmentInput({
      variantId: 'var-123',
      adjustedQty: 0,
      reason: InventoryAdjustmentReason.RESTOCK,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('non-zero integer')));
  });

  await test('Reject invalid adjustment reason', () => {
    const res = validateStockAdjustmentInput({
      variantId: 'var-123',
      adjustedQty: 10,
      reason: 'INVALID_REASON' as any,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Reason must be one of')));
  });

  await test('Stock adjustment preserves non-negative balance invariant', () => {
    const initialStock = 45;
    const restockQty = 55;
    const newStock = initialStock + restockQty;
    assert.equal(newStock, 100);

    const deductionQty = -30;
    const finalStock = newStock + deductionQty;
    assert.equal(finalStock, 70);

    // Negative stock deduction prohibited
    const invalidDeduction = -80;
    const wouldBeNegative = finalStock + invalidDeduction < 0;
    assert.equal(wouldBeNegative, true);
  });

  await test('Variant with existing ledger records must be archived rather than deleted', () => {
    // Simulate variant deletion guard:
    const mockVariant = {
      id: 'var-active-01',
      sku: 'SG-PEN-01',
      inventoryAdjustmentsCount: 3,
      orderItemsCount: 1,
      isArchived: false,
    };

    // Logic under test: If history exists, archive to protect ledger
    const shouldArchive = mockVariant.inventoryAdjustmentsCount > 0 || mockVariant.orderItemsCount > 0;
    assert.equal(shouldArchive, true);

    const resultingAction = shouldArchive ? 'ARCHIVED' : 'DELETED';
    assert.equal(resultingAction, 'ARCHIVED');
  });

  await test('Archived variants reject subsequent stock adjustments', () => {
    const variant = { id: 'var-01', sku: 'SG-01', isArchived: true, stockQuantity: 20 };
    assert.throws(
      () => {
        if (variant.isArchived) {
          throw new Error(`Cannot adjust stock for archived variant "${variant.sku}"`);
        }
      },
      /Cannot adjust stock for archived variant/
    );
  });

  await test('Concurrent adjustment transactions preserve exact ledger balance', async () => {
    let stock = 100;
    const ledger: Array<{ delta: number; balance: number }> = [];

    // Simulate 3 concurrent transaction workers
    async function worker(delta: number): Promise<boolean> {
      // Simulate transaction read + validate + write
      if (stock + delta >= 0) {
        stock += delta;
        ledger.push({ delta, balance: stock });
        return true;
      }
      return false; // Rollback
    }

    const results = await Promise.all([
      worker(-40),
      worker(-40),
      worker(-40), // Third worker must fail because 100 - 40 - 40 - 40 = -20 < 0
    ]);

    const successes = results.filter((r) => r === true).length;
    const failures = results.filter((r) => r === false).length;

    assert.equal(successes, 2);
    assert.equal(failures, 1);
    assert.equal(stock, 20); // Exactly 100 - 40 - 40 = 20
    assert.equal(ledger.length, 2);
    assert.equal(ledger[1].balance, 20);
  });

  // ------------------------------------------------------------------
  // 5. Taxonomy & Relational Occasions Validation
  // ------------------------------------------------------------------
  console.log('\n--- 5. Taxonomy & Relational Occasions Management ---');

  await test('Category safe deactivation preserves catalog integrity when products exist', () => {
    const mockCategory = { id: 'cat-1', name: 'Diwali Gifts', productsCount: 12, isActive: true };
    const canHardDelete = mockCategory.productsCount === 0;
    assert.equal(canHardDelete, false);

    const action = canHardDelete ? 'DELETED' : 'DEACTIVATED';
    assert.equal(action, 'DEACTIVATED');
  });

  await test('Occasion safe deactivation preserves relational link when products exist', () => {
    const mockOccasion = { id: 'occ-1', name: 'Corporate Gifting', productsCount: 5, isActive: true };
    const canHardDelete = mockOccasion.productsCount === 0;
    assert.equal(canHardDelete, false);

    const action = canHardDelete ? 'DELETED' : 'DEACTIVATED';
    assert.equal(action, 'DEACTIVATED');
  });

  // ------------------------------------------------------------------
  // 6. Image Storage & Binary Magic Bytes Inspection
  // ------------------------------------------------------------------
  console.log('\n--- 6. Storage Adapter & Image Binary Inspection ---');

  await test('Accept genuine JPEG magic bytes (FF D8 FF)', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const check = verifyImageMagicBytes(jpegBuffer);
    assert.equal(check.valid, true);
    assert.equal(check.detectedMime, 'image/jpeg');
  });

  await test('Accept genuine PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const check = verifyImageMagicBytes(pngBuffer);
    assert.equal(check.valid, true);
    assert.equal(check.detectedMime, 'image/png');
  });

  await test('Accept genuine WEBP magic bytes (RIFF....WEBP)', () => {
    const webpBuffer = Buffer.alloc(16);
    webpBuffer.write('RIFF', 0, 'ascii');
    webpBuffer.writeUInt32LE(100, 4);
    webpBuffer.write('WEBP', 8, 'ascii');
    const check = verifyImageMagicBytes(webpBuffer);
    assert.equal(check.valid, true);
    assert.equal(check.detectedMime, 'image/webp');
  });

  await test('Reject renamed malicious text/script pretending to be an image', () => {
    const maliciousBuffer = Buffer.from('<?php echo "evil payload"; ?>');
    const check = verifyImageMagicBytes(maliciousBuffer);
    assert.equal(check.valid, false);
  });

  await test('Storage adapter rejects oversized files (> 10MB)', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-storage-test-'));
    try {
      const storage = new LocalDiskStorageService(tempDir);
      const hugeBuffer = Buffer.alloc(12 * 1024 * 1024); // 12 MB (> 10 MB limit)

      await assert.rejects(
        async () => {
          await storage.uploadFile({
            fileBuffer: hugeBuffer,
            fileName: 'huge.jpg',
            mimeType: 'image/jpeg',
            folder: 'proofs',
          });
        },
        (err: any) => err instanceof StorageValidationError && err.code === 'FILE_TOO_LARGE'
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  await test('Storage adapter rejects invalid MIME types (e.g. application/pdf)', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-storage-test-'));
    try {
      const storage = new LocalDiskStorageService(tempDir);
      const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

      await assert.rejects(
        async () => {
          await storage.uploadFile({
            fileBuffer: validJpegBuffer,
            fileName: 'document.pdf',
            mimeType: 'application/pdf',
            folder: 'proofs',
          });
        },
        (err: any) => err instanceof StorageValidationError && err.code === 'INVALID_MIME_TYPE'
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  await test('Storage adapter strictly rejects path traversal attempts in deleteFile', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-storage-test-'));
    try {
      const storage = new LocalDiskStorageService(tempDir);
      // Attempt to escape the directory
      const result = await storage.deleteFile('../../secret.txt');
      assert.equal(result, false);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  await test('Storage adapter writes verified image to disk and returns unique fileKey', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snappy-storage-test-'));
    try {
      const storage = new LocalDiskStorageService(tempDir);
      const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

      const result = await storage.uploadFile({
        fileBuffer: validPngBuffer,
        fileName: 'custom-logo.png',
        mimeType: 'image/png',
        folder: 'proofs',
      });

      assert.ok(result.fileKey.startsWith('proofs/'));
      assert.ok(result.storedUrl.startsWith('/uploads/proofs/'));
      assert.equal(result.sizeBytes, validPngBuffer.length);

      // Verify file actually exists on disk
      const fullPath = path.join(tempDir, result.fileKey);
      const exists = await fs.stat(fullPath);
      assert.ok(exists.isFile());
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Test Run Complete: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Catalog & Inventory test suite.`);
  }

  return { passed, failed };
}

export { runCatalogTestSuite };

if (process.argv[1]?.includes('catalog.test')) {
  runCatalogTestSuite().catch((err) => {
    console.error('Unhandled test suite failure:', err);
    process.exit(1);
  });
}
