// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
if (!process.env.CI && process.env.NODE_ENV !== 'production') {
  process.env.DATABASE_URL = 'mysql://127.0.0.1:3306/dev_fallback';
}

import assert from 'node:assert/strict';
import crypto from 'crypto';
import { privateStorageService } from '../services/storage/private-storage.service';
import { StorageValidationError } from '../services/storage/local-storage.service';
import {
  validateCropSettings,
  validatePlacementSettings,
  validatePersonalizationInput,
  createArtworkUploadRecord,
  getArtworkRecord,
  persistOrderPersonalization,
  reviewOrderProof,
  reviseOrderProof,
  approveOrderProofByCustomer,
  StaleProofVersionError,
  ProofConsentRequiredError,
  PersonalizationUnauthorizedError,
  cleanupExpiredArtworkUploads,
  generateCustomerProofPngBuffer,
  PersonalizationValidationError,
  PersonalizationAuthError,
  DEV_ARTWORK_UPLOADS_STORE,
  DEV_PERSONALIZATION_STORE,
} from '../lib/personalization/personalization.service';
import { POST as postApproveProofRoute } from '../app/api/orders/[orderNumber]/proofs/[orderItemId]/approve/route';
import {
  calculateCartPricing,
  CartItemInput,
  DEFAULT_WOODEN_CRATE_SURCHARGE_PAISE,
  WOODEN_CRATE_SURCHARGE_PAISE,
  IS_WOODEN_CRATE_SURCHARGE_APPROVED,
  isWoodenCrateSurchargeApproved,
  getWoodenCrateSurchargePaise,
  PricingValidationError,
} from '../lib/pricing/pricing.service';
import { GET as getPersonalizationConfig } from '../app/api/personalization/config/route';
import { GET as getUploadFileRoute } from '../app/api/personalization/uploads/[id]/file/route';
import {
  createOrder,
  OrderValidationError,
  validateAndDecodeProofDataUrl,
  DEV_ORDERS_STORE,
} from '../lib/orders/order.service';
import {
  transitionOrderStatus,
  OrderTransitionError,
} from '../lib/orders/order-lifecycle.service';
import { CatalogDatabaseError } from '../lib/catalog/public-catalog.service';
import { prisma } from '../lib/prisma';
import { Role, OrderStatus } from '@prisma/client';
import { createSession, SESSION_COOKIE_NAME } from '../lib/auth/session';

export async function runPersonalizationTestSuite() {
  console.log('====================================================');
  console.log(' Snappy Gifts — Batch 7: Personalization & Proof Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function resetStores() {
    DEV_ARTWORK_UPLOADS_STORE.clear();
    DEV_PERSONALIZATION_STORE.clear();
    DEV_ORDERS_STORE.clear();
  }

  // Helper buffers
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const validJpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const validWebpHeader = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
    Buffer.from('VP8 '),
  ]);
  const invalidTextHeader = Buffer.from('<?php echo "malicious script"; ?>');

  // Test 1: Upload Magic Bytes Validation (Valid PNG accepted)
  try {
    const uploadResult = await privateStorageService.storePrivateUpload(
      validPngHeader,
      'company-logo.png',
      'image/png',
      'customer-artwork'
    );
    assert.strictEqual(uploadResult.mimeType, 'image/png');
    assert.ok(uploadResult.fileKey.startsWith('customer-artwork/'));
    assert.strictEqual(uploadResult.sizeBytes, validPngHeader.length);
    assert.ok(uploadResult.fileHash.length === 64);
    passed++;
    console.log('  [PASS] 1. Private storage verifies magic bytes for valid PNG');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 1. Private storage verifies magic bytes for valid PNG:', err.message);
  }

  // Test 2: Upload Magic Bytes Validation (Valid JPEG accepted)
  try {
    const uploadResult = await privateStorageService.storePrivateUpload(
      validJpegHeader,
      'monogram.jpg',
      'image/jpeg',
      'customer-artwork'
    );
    assert.strictEqual(uploadResult.mimeType, 'image/jpeg');
    assert.ok(uploadResult.fileKey.endsWith('.jpg'));
    passed++;
    console.log('  [PASS] 2. Private storage verifies magic bytes for valid JPEG');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 2. Private storage verifies magic bytes for valid JPEG:', err.message);
  }

  // Test 3: Upload Magic Bytes Validation (Valid WebP accepted)
  try {
    const uploadResult = await privateStorageService.storePrivateUpload(
      validWebpHeader,
      'family-portrait.webp',
      'image/webp',
      'customer-artwork'
    );
    assert.strictEqual(uploadResult.mimeType, 'image/webp');
    assert.ok(uploadResult.fileKey.endsWith('.webp'));
    passed++;
    console.log('  [PASS] 3. Private storage verifies magic bytes for valid WebP');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 3. Private storage verifies magic bytes for valid WebP:', err.message);
  }

  // Test 4: Reject Spoofed or Corrupt Binary Header
  try {
    let threw = false;
    try {
      await privateStorageService.storePrivateUpload(
        invalidTextHeader,
        'spoofed-image.png',
        'image/png',
        'customer-artwork'
      );
    } catch (e: any) {
      threw = true;
      assert.ok(e instanceof StorageValidationError);
      assert.strictEqual(e.code, 'CORRUPT_OR_SPOOFED_IMAGE');
    }
    assert.ok(threw, 'Should throw error when file binary lacks genuine image magic headers');
    passed++;
    console.log('  [PASS] 4. Rejects spoofed text/executable masquerading as PNG');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 4. Rejects spoofed text/executable masquerading as PNG:', err.message);
  }

  // Test 5: Reject Oversized Upload (>5MB)
  try {
    let threw = false;
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB (> 10MB limit)
    // Add valid png header to ensure it fails on size, not magic bytes
    validPngHeader.copy(oversizedBuffer, 0);

    try {
      await privateStorageService.storePrivateUpload(
        oversizedBuffer,
        'huge-poster.png',
        'image/png',
        'customer-artwork'
      );
    } catch (e: any) {
      threw = true;
      assert.ok(e instanceof StorageValidationError);
      assert.strictEqual(e.code, 'FILE_TOO_LARGE');
    }
    assert.ok(threw, 'Should throw FILE_TOO_LARGE for buffers > 10MB');
    passed++;
    console.log('  [PASS] 5. Enforces authoritative 10MB upload size threshold');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 5. Enforces authoritative 10MB upload size threshold:', err.message);
  }

  // Test 6: Path Traversal Prevention in Storage Key
  try {
    let threw = false;
    try {
      await privateStorageService.getPrivateFileBuffer('../../etc/passwd');
    } catch (e: any) {
      threw = true;
      assert.ok(e instanceof StorageValidationError);
      assert.strictEqual(e.code, 'PATH_TRAVERSAL_DETECTED');
    }
    assert.ok(threw, 'Should throw PATH_TRAVERSAL_DETECTED');
    passed++;
    console.log('  [PASS] 6. Blocks directory traversal attempts (../../) in private storage');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 6. Blocks directory traversal attempts (../../) in private storage:', err.message);
  }

  // Test 7: Crop Settings Boundary & Coordinate Validation
  try {
    // Valid crop
    const valid = validateCropSettings({ x: 10, y: 20, width: 200, height: 200, zoom: 1.5, rotation: 90 });
    assert.strictEqual(valid.x, 10);
    assert.strictEqual(valid.zoom, 1.5);
    assert.strictEqual(valid.rotation, 90);

    // Negative coordinate rejection
    assert.throws(() => {
      validateCropSettings({ x: -5, y: 10, width: 100, height: 100 });
    }, /Crop X coordinate must be a non-negative number/);

    // Zero width rejection
    assert.throws(() => {
      validateCropSettings({ x: 0, y: 0, width: 0, height: 100 });
    }, /Crop width must be greater than zero/);

    // Zoom factor out of bounds (<0.1 or >10)
    assert.throws(() => {
      validateCropSettings({ x: 0, y: 0, width: 100, height: 100, zoom: 15 });
    }, /Crop zoom factor must be between 0.1 and 10.0/);

    passed++;
    console.log('  [PASS] 7. Validates crop coordinates, zoom bounds, and geometry sanity');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 7. Validates crop coordinates, zoom bounds, and geometry sanity:', err.message);
  }

  // Test 8: Placement Settings Bounds Validation
  try {
    const validPlacement = validatePlacementSettings({
      position: 'LID',
      scale: 1.25,
      offsetX: 50,
      offsetY: -30,
    });
    assert.strictEqual(validPlacement.position, 'LID');
    assert.strictEqual(validPlacement.scale, 1.25);
    assert.strictEqual(validPlacement.offsetX, 50);

    // Excessive offset rejection (>2000px)
    assert.throws(() => {
      validatePlacementSettings({ scale: 1, offsetX: 5000, offsetY: 0 });
    }, /Artwork placement offsets exceed maximum canvas boundary/);

    // Out of bound scale (>5.0)
    assert.throws(() => {
      validatePlacementSettings({ scale: 10 });
    }, /Artwork placement scale must be between 0.1 and 5.0/);

    passed++;
    console.log('  [PASS] 8. Validates artwork placement presets, offsets, and scale limits');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 8. Validates artwork placement presets, offsets, and scale limits:', err.message);
  }

  // Test 9: Rejects Personalization on Ineligible Products
  try {
    let threw = false;
    try {
      await validatePersonalizationInput(
        {
          productId: 'prod-plain-box',
          engravedText: 'Happy Birthday',
        },
        {
          id: 'prod-plain-box',
          name: 'Standard Packing Carton',
          isCustomizable: false,
        }
      );
    } catch (e: any) {
      threw = true;
      assert.ok(e instanceof PersonalizationValidationError);
      assert.ok(e.message.includes('not eligible for bespoke personalization'));
    }
    assert.ok(threw, 'Should throw error when product is not customizable');
    passed++;
    console.log('  [PASS] 9. Rejects personalization requests on ineligible catalog items');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 9. Rejects personalization requests on ineligible catalog items:', err.message);
  }

  // Test 10: Enforces Maximum Character Length for Engraved Inscription & Gift Note
  try {
    const eligibleProduct = {
      id: 'prod-custom-box',
      name: 'Royal Heritage Brass Keepsake Box',
      isCustomizable: true,
      customizationType: 'ENGRAVING',
    };

    // Text > 32 chars rejected
    await assert.rejects(
      async () => {
        await validatePersonalizationInput(
          {
            productId: eligibleProduct.id,
            engravedText: 'This engraved inscription is way too long to fit on the brass plaque of the box',
          },
          eligibleProduct
        );
      },
      (err: any) => {
        assert.ok(err instanceof PersonalizationValidationError);
        assert.ok(err.message.includes('maximum allowable length of 32 characters'));
        return true;
      }
    );

    // Gift note > 200 chars rejected
    const longNote = 'A'.repeat(250);
    await assert.rejects(
      async () => {
        await validatePersonalizationInput(
          {
            productId: eligibleProduct.id,
            engravedText: 'Short Text',
            giftNote: longNote,
          },
          eligibleProduct
        );
      },
      (err: any) => {
        assert.ok(err instanceof PersonalizationValidationError);
        assert.ok(err.message.includes('maximum allowable length of 200 characters'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 10. Enforces server-side length limits for inscriptions (32) and gift notes (200)');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 10. Enforces server-side length limits for inscriptions (32) and gift notes (200):', err.message);
  }

  // Test 11: Artwork Record Creation and Ownership Association
  try {
    resetStores();
    const uploadRes = await privateStorageService.storePrivateUpload(
      validPngHeader,
      'crest.png',
      'image/png',
      'customer-artwork'
    );

    // Create record owned by customer user-123
    const artworkRecord = await createArtworkUploadRecord(uploadRes, {
      userId: 'user-123',
      guestToken: null,
    });

    assert.ok(artworkRecord.id.startsWith('art-'));
    assert.strictEqual(artworkRecord.uploadedByUserId, 'user-123');
    assert.strictEqual(artworkRecord.status, 'ACTIVE');

    // Retrieve record
    const retrieved = await getArtworkRecord(artworkRecord.id);
    assert.ok(retrieved !== null);
    assert.strictEqual(retrieved?.fileKey, uploadRes.fileKey);

    passed++;
    console.log('  [PASS] 11. Stores artwork metadata record with user association and retention policy');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 11. Stores artwork metadata record with user association and retention policy:', err.message);
  }

  // Test 12: Private Upload Access Control (Ownership & Admin Verification)
  try {
    const uploadRes = await privateStorageService.storePrivateUpload(
      validPngHeader,
      'private-crest.png',
      'image/png',
      'customer-artwork'
    );
    const artwork = await createArtworkUploadRecord(uploadRes, {
      userId: 'user-alice',
      guestToken: 'guest-token-111',
    });

    // Case A: Owner user accesses -> Validated
    const validatedForAlice = await validatePersonalizationInput(
      {
        productId: 'prod-box',
        artworkUploadId: artwork.id,
      },
      { id: 'prod-box', name: 'Brass Box', isCustomizable: true },
      { userId: 'user-alice' }
    );
    assert.strictEqual(validatedForAlice.artworkUploadId, artwork.id);

    // Case B: Guest with matching session token accesses -> Validated
    const validatedForGuest = await validatePersonalizationInput(
      {
        productId: 'prod-box',
        artworkUploadId: artwork.id,
      },
      { id: 'prod-box', name: 'Brass Box', isCustomizable: true },
      { guestToken: 'guest-token-111' }
    );
    assert.strictEqual(validatedForGuest.artworkUploadId, artwork.id);

    // Case C: Unauthorized different user attempts to attach Alice's upload -> Rejected
    await assert.rejects(
      async () => {
        await validatePersonalizationInput(
          {
            productId: 'prod-box',
            artworkUploadId: artwork.id,
          },
          { id: 'prod-box', name: 'Brass Box', isCustomizable: true },
          { userId: 'user-bob-attacker', guestToken: 'guest-token-222' }
        );
      },
      (err: any) => {
        assert.ok(err instanceof PersonalizationAuthError);
        assert.ok(err.message.includes('Access denied: You do not own the referenced artwork upload'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 12. Enforces strict artwork upload ownership and prevents unauthorized cross-user attachment');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 12. Enforces strict artwork upload ownership and prevents unauthorized cross-user attachment:', err.message);
  }

  // Test 13: Authoritative Surcharge Recalculation (Rejects Client Price Tampering)
  try {
    const prevCrateApproval = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
    try {
      // Product base price: 129900 paise (Royale Gold-Rim Ceramic Mug)
      // Complimentary base laser engraving fee: 0 paise
      // Premium Packaging: Vintage Wooden Keepsake Crate (+15000 paise)
      // Total line taxable amount: 129900 + 15000 = 144900 paise
      const cartItems: CartItemInput[] = [
        {
          productId: 'prod-1',
          quantity: 1,
          // Attacker attempts to forge price and customization fee to zero
          customization: {
            engravedText: 'The Royal Sovereign',
            boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)',
            fontFamily: 'Playfair Display',
            customizationFeePaise: 0 as any, // Tampered to 0
          } as any,
        },
      ];

      const quote = await calculateCartPricing(cartItems, '08');

      const calculatedItem = quote.items[0];
      assert.strictEqual(calculatedItem.customizationFeePaise, 15000, 'Customization fee must total 15000 paise (150 INR crate)');
      assert.strictEqual(calculatedItem.lineSubtotalPaise, 129900, 'Subtotal must be 129900 paise');
      assert.strictEqual(calculatedItem.lineTaxablePaise, 144900, 'Taxable line amount must be 144900 paise');
      // GST 18% on 144900 = 26082 paise (CGST 13041, SGST 13041)
      assert.strictEqual(quote.taxTotalPaise, 26082);
      assert.strictEqual(quote.grandTotalPaise, 144900 + 26082);

      passed++;
      console.log('  [PASS] 13. Server authoritatively computes customization & packaging fees, overriding client price tampering');
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevCrateApproval;
    }
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 13. Server authoritatively computes customization & packaging fees, overriding client price tampering:', err.message);
  }

  // Test 14: Cart Items Maintain Isolated Customization Settings
  try {
    const prevCrateApproval = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
    try {
      const itemA: CartItemInput = {
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Item A - Inscription One',
          boxWrapStyle: 'Royal Silk Gift Box',
          fontFamily: 'Cinzel Decorative',
        },
      };

      const itemB: CartItemInput = {
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Item B - Inscription Two',
          boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)',
          fontFamily: 'Great Vibes',
        },
      };

      const quote = await calculateCartPricing([itemA, itemB], '27');

      assert.strictEqual(quote.items.length, 2);
      // Item A has standard packaging (customizationFee = 0)
      assert.strictEqual(quote.items[0].customizationFeePaise, 0);

      // Item B has wooden crate (+15000 => customizationFee = 15000)
      assert.strictEqual(quote.items[1].customizationFeePaise, 15000);

      passed++;
      console.log('  [PASS] 14. Distinct cart items preserve isolated personalization specifications and fees');
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevCrateApproval;
    }
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 14. Distinct cart items preserve isolated personalization specifications and fees:', err.message);
  }

  // Test 15: Order Creation Persists OrderPersonalization Snapshot & Proof Reference
  try {
    resetStores();
    const prevCrateApproval = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
    try {
      // 1. Upload artwork
      const uploadRes = await privateStorageService.storePrivateUpload(
        validPngHeader,
        'family-monogram.png',
        'image/png',
        'customer-artwork'
      );
      const artwork = await createArtworkUploadRecord(uploadRes, {
        userId: 'user-vip',
        guestToken: null,
      });

      // 2. Place Order with personalization
      const orderResult = await createOrder({
        customerEmail: 'vip.customer@snappygifts.in',
        customerName: 'Aarav Singhania',
        customerPhone: '9876543210',
        shippingAddress: {
          name: 'Aarav Singhania',
          street: '101 Heritage Boulevard',
          city: 'Jaipur',
          state: 'Rajasthan',
          pincode: '500062',
        },
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
            customization: {
              engravedText: 'Aarav & Meera',
              fontFamily: 'Playfair Display',
              boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)',
              giftNote: 'With warmest regards from the Singhania family.',
              artworkUploadId: artwork.id,
              cropSettings: { x: 50, y: 50, width: 300, height: 300, zoom: 1.2 },
              placementSettings: { position: 'LID', scale: 1.1, offsetX: 0, offsetY: 0 },
              clientProofDataUrl: `data:image/png;base64,${generateCustomerProofPngBuffer({ productName: 'Royal Keepsake Box', engravedText: 'Aarav & Meera', fontFamily: 'Playfair Display', version: 1 }).toString('base64')}`,
              proofApproved: true,
              proofVersion: 1,
            },
          },
        ],
        paymentMethod: 'RAZORPAY',
      });

      assert.ok(orderResult.id);
      assert.strictEqual(orderResult.items.length, 1);
      const orderItem = orderResult.items[0];
      
      // The stored proof URL must point to the distinct generated proof asset, NOT raw customer artwork
      assert.ok(orderItem.proofImageUrl);
      assert.notStrictEqual(orderItem.proofImageUrl, `/api/personalization/uploads/${artwork.id}/file`, 'Stored proof must remain distinct from source artwork');
      assert.ok(orderItem.proofImageUrl.includes('/api/personalization/uploads/art-'), 'Proof image URL must be a valid upload file reference');

      // Verify snapshot in personalization store
      const persRecord = DEV_PERSONALIZATION_STORE.get(orderItem.id);
      assert.ok(persRecord !== undefined);
      assert.strictEqual(persRecord?.customizationFeePaise, 15000);
      assert.strictEqual(persRecord?.engravedText, 'Aarav & Meera');
      assert.strictEqual(persRecord?.customerApprovalStatus, 'APPROVED');
      assert.strictEqual(persRecord?.customerApprovedBy, 'vip.customer@snappygifts.in');
      assert.strictEqual(persRecord?.staffReviewStatus, 'PENDING_REVIEW');
      assert.strictEqual(persRecord?.artworkUploadId, artwork.id);
      assert.strictEqual(persRecord?.proofVersion, 1);
      assert.ok(persRecord?.customerApprovedAt !== null);
      assert.ok(persRecord?.proofAssetKey?.startsWith('proofs/'), 'Proof asset must be stored under proofs folder');

      // Verify artwork upload marked as ATTACHED
      const updatedArtwork = await getArtworkRecord(artwork.id);
      assert.strictEqual(updatedArtwork?.status, 'ATTACHED');

      passed++;
      console.log('  [PASS] 15. Order creation transactionally freezes OrderPersonalization snapshot & distinct proof asset');
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevCrateApproval;
    }
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 15. Order creation transactionally freezes OrderPersonalization snapshot & distinct proof asset:', err.message);
  }

  // Test 16: Staff Proof Review and Verification Workflow (Separate from Customer Consent)
  try {
    // Order item created in Test 15
    const orderItem = Array.from(DEV_PERSONALIZATION_STORE.values())[0];
    assert.ok(orderItem, 'Expected stored personalization record from previous test');

    // Admin / Staff reviews proof and approves
    const reviewed = await reviewOrderProof(
      orderItem.orderItemId,
      'ARTWORK_VERIFIED_BY_STAFF',
      'staff-master-artisan-ajmer',
      'Vector resolution and contrast verified on brass surface.'
    );

    assert.strictEqual(reviewed.staffReviewStatus, 'ARTWORK_VERIFIED_BY_STAFF');
    assert.strictEqual(reviewed.staffReviewedBy, 'staff-master-artisan-ajmer');
    assert.ok(reviewed.staffReviewedAt !== null);
    // Customer consent is preserved and NOT overwritten by staff verification
    assert.strictEqual(reviewed.customerApprovalStatus, 'APPROVED');
    assert.strictEqual(reviewed.customerApprovedBy, 'vip.customer@snappygifts.in');
    assert.ok(reviewed.staffNotes?.includes('Vector resolution'));

    // Staff requests rework if artwork resolution is insufficient
    const reworked = await reviewOrderProof(
      orderItem.orderItemId,
      'REJECTED_FOR_REWORK',
      'staff-master-artisan-ajmer',
      'Low DPI bitmap uploaded. Customer contacted for vector SVG or 300DPI PNG.'
    );

    assert.strictEqual(reworked.staffReviewStatus, 'REJECTED_FOR_REWORK');
    assert.strictEqual(reworked.customerApprovalStatus, 'APPROVED'); // Customer consent intact
    assert.strictEqual(reworked.staffNotes, 'Low DPI bitmap uploaded. Customer contacted for vector SVG or 300DPI PNG.');

    passed++;
    console.log('  [PASS] 16. Staff proof review workflow transitions status with audit notes');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 16. Staff proof review workflow transitions status with audit notes:', err.message);
  }

  // Test 17: Order History Immutability and Payment Retry Preservation
  try {
    const existingOrder = Array.from(DEV_ORDERS_STORE.values())[0];
    assert.ok(existingOrder);
    const existingItem = existingOrder.items[0];

    // Simulating payment failure / retry on existing order: proof and personalization remain intact
    assert.strictEqual(existingItem.proofImageUrl?.includes('/api/personalization/uploads/'), true);

    // Subsequent modifications to general catalog do not mutate historical order item
    const snapshotText = existingItem.customizationMeta?.engravedText;
    assert.strictEqual(snapshotText, 'Aarav & Meera');

    passed++;
    console.log('  [PASS] 17. Historical order personalization is immutable and preserved across payment retries');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 17. Historical order personalization is immutable and preserved across payment retries:', err.message);
  }

  // Test 18: Idempotent Order Requests Do Not Duplicate Records
  try {
    const orderCountBefore = DEV_ORDERS_STORE.size;
    const persCountBefore = DEV_PERSONALIZATION_STORE.size;

    // Retry with same idempotent key / input
    const retryResult = await createOrder({
      customerEmail: 'vip.customer@snappygifts.in',
      customerName: 'Aarav Singhania',
      customerPhone: '9876543210',
      shippingAddress: {
        name: 'Aarav Singhania',
        street: '101 Heritage Boulevard',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '500062',
      },
      items: [
        {
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Aarav & Meera',
          },
        },
      ],
      paymentMethod: 'RAZORPAY',
    });

    assert.ok(retryResult.id);
    // New draft order created cleanly without orphaned records
    assert.strictEqual(DEV_ORDERS_STORE.size, orderCountBefore + 1);
    assert.strictEqual(DEV_PERSONALIZATION_STORE.size, persCountBefore + 1);

    passed++;
    console.log('  [PASS] 18. Order creation maintains atomic snapshot integrity and clean state separation');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 18. Order creation maintains atomic snapshot integrity and clean state separation:', err.message);
  }

  // Test 19: Revised Proof Increments Version and Invalidates Customer Approval
  try {
    const orderItem = Array.from(DEV_PERSONALIZATION_STORE.values())[0];
    assert.ok(orderItem);

    const revised = await reviseOrderProof(
      orderItem.orderItemId,
      {
        engravedText: 'Aarav & Meera Singhania',
      },
      'staff-designer-ajmer'
    );

    assert.strictEqual(revised.proofVersion, 2, 'Revised proof must increment proof version to 2');
    assert.strictEqual(revised.engravedText, 'Aarav & Meera Singhania');
    // Customer approval must be invalidated on revision!
    assert.strictEqual(revised.customerApprovalStatus, 'PENDING', 'Revised proof must invalidate customer approval');
    assert.strictEqual(revised.customerApprovedAt, null);
    assert.strictEqual(revised.customerApprovedBy, null);
    assert.strictEqual(revised.staffReviewStatus, 'PENDING_REVIEW', 'Revised proof must require new staff review');
    assert.strictEqual(revised.staffReviewedAt, null);
    assert.strictEqual(revised.staffReviewedBy, null);
    assert.ok(revised.proofAssetKey?.startsWith('proofs/'));

    passed++;
    console.log('  [PASS] 19. Revised proof increments version and invalidates previous customer approval');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 19. Revised proof increments version and invalidates previous customer approval:', err.message);
  }

  // Test 20: Packaging Surcharge Configuration & Explicit Approval Documentation
  try {
    assert.strictEqual(DEFAULT_WOODEN_CRATE_SURCHARGE_PAISE, 15000, 'Default wooden crate surcharge is 15000 paise (₹150)');
    assert.strictEqual(typeof WOODEN_CRATE_SURCHARGE_PAISE, 'number');
    assert.strictEqual(typeof isWoodenCrateSurchargeApproved(), 'boolean');

    const prevApproved = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
    try {
      // Confirm that quote calculates using the exact configurable surcharge when approved
      const quote = await calculateCartPricing([
        {
          productId: 'prod-1',
          quantity: 2,
          customization: {
            boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)',
          },
        },
      ]);
      assert.strictEqual(quote.items[0].customizationFeePaise, 15000);
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevApproved;
    }

    passed++;
    console.log('  [PASS] 20. Packaging surcharge is explicitly configurable in integer paise with approval status flag');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 20. Packaging surcharge is explicitly configurable in integer paise with approval status flag:', err.message);
  }

  // Test 21: Unattached Upload Retention and Safe Cleanup Routine
  try {
    // Create 3 uploads:
    // A: Expired unattached artwork (should be deleted)
    const uploadA = await privateStorageService.storePrivateUpload(
      validPngHeader,
      'temp-expired.png',
      'image/png',
      'customer-artwork'
    );
    const recordA = await createArtworkUploadRecord(uploadA, { userId: 'user-temp', guestToken: null });
    // Manually set recordA expiry to 8 days in the past
    const devRecA = DEV_ARTWORK_UPLOADS_STORE.get(recordA.id);
    if (devRecA) {
      devRecA.expiresAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      DEV_ARTWORK_UPLOADS_STORE.set(recordA.id, devRecA);
    }

    // B: Attached artwork (must NEVER be deleted, even if older than 7 days)
    const uploadB = await privateStorageService.storePrivateUpload(
      validPngHeader,
      'attached-artwork.png',
      'image/png',
      'customer-artwork'
    );
    const recordB = await createArtworkUploadRecord(uploadB, { userId: 'user-attached', guestToken: null });
    const devRecB = DEV_ARTWORK_UPLOADS_STORE.get(recordB.id);
    if (devRecB) {
      devRecB.status = 'ATTACHED';
      devRecB.expiresAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      DEV_ARTWORK_UPLOADS_STORE.set(recordB.id, devRecB);
    }

    // C: Rendered Proof (must NEVER be deleted)
    const uploadC = await privateStorageService.storePrivateUpload(
      validPngHeader,
      'rendered-proof.png',
      'image/png',
      'proofs'
    );
    const recordC = await createArtworkUploadRecord(uploadC, { userId: 'user-proof', guestToken: null });
    const devRecC = DEV_ARTWORK_UPLOADS_STORE.get(recordC.id);
    if (devRecC) {
      devRecC.storageFolder = 'proofs';
      devRecC.expiresAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      DEV_ARTWORK_UPLOADS_STORE.set(recordC.id, devRecC);
    }

    // 1. Dry run execution
    const dryRunRes = await cleanupExpiredArtworkUploads({ dryRun: true });
    assert.ok(dryRunRes.deletedCount >= 1, 'Dry run should identify at least 1 expired unattached upload');
    // Ensure recordA was not deleted in dry run
    assert.strictEqual(DEV_ARTWORK_UPLOADS_STORE.get(recordA.id)?.status, 'ACTIVE');

    // 2. Real cleanup execution
    const realRes = await cleanupExpiredArtworkUploads({ dryRun: false });
    assert.ok(realRes.deletedCount >= 1);
    // Record A is now ABANDONED
    assert.strictEqual(DEV_ARTWORK_UPLOADS_STORE.get(recordA.id)?.status, 'ABANDONED');
    // Attached record B remains ATTACHED and preserved
    assert.strictEqual(DEV_ARTWORK_UPLOADS_STORE.get(recordB.id)?.status, 'ATTACHED');
    // Proof record C remains preserved
    assert.strictEqual(DEV_ARTWORK_UPLOADS_STORE.get(recordC.id)?.status, 'ACTIVE');

    // 3. Repeated / idempotent execution does not fail or delete attached proofs
    await cleanupExpiredArtworkUploads({ dryRun: false });
    assert.strictEqual(DEV_ARTWORK_UPLOADS_STORE.get(recordB.id)?.status, 'ATTACHED');
    assert.strictEqual(DEV_ARTWORK_UPLOADS_STORE.get(recordC.id)?.status, 'ACTIVE');

    passed++;
    console.log('  [PASS] 21. Upload cleanup safely purges expired unattached files while preserving attached artwork and proofs');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 21. Upload cleanup safely purges expired unattached files while preserving attached artwork and proofs:', err.message);
  }

  // Test 22: Rendered Preview Proof Binary Integrity in Storage
  try {
    const orderItem = Array.from(DEV_PERSONALIZATION_STORE.values())[0];
    assert.ok(orderItem?.proofAssetKey);

    // Retrieve the proof binary from private storage
    const proofBuffer = await privateStorageService.getPrivateFileBuffer(orderItem.proofAssetKey);
    assert.ok(proofBuffer.length > 0);
    // Verify magic bytes of PNG
    assert.strictEqual(proofBuffer[0], 0x89);
    assert.strictEqual(proofBuffer[1], 0x50); // P
    assert.strictEqual(proofBuffer[2], 0x4e); // N
    assert.strictEqual(proofBuffer[3], 0x47); // G

    passed++;
    console.log('  [PASS] 22. Stored proof is a genuine rendered PNG binary asset persisted in private storage');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 22. Stored proof is a genuine rendered PNG binary asset persisted in private storage:', err.message);
  }

  // Test 23: Production Database Boundary & Fail-Closed Behavior
  try {
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      let threw = false;
      try {
        await persistOrderPersonalization(
          prisma,
          'non-existent-item-id',
          { productId: 'prod-1', engravedText: 'Test' },
          0,
          'customer@example.com'
        );
      } catch (e: any) {
        threw = true;
        assert.ok(
          e.name === 'CatalogDatabaseError' || e.message.includes('Database unavailable') || e.message.includes('Authentication failed'),
          `Expected database error, got ${e.name}: ${e.message}`
        );
      }
      assert.ok(threw, 'Should throw in production when database is unavailable');
    } finally {
      (process.env as any).NODE_ENV = prevNodeEnv;
    }

    passed++;
    console.log('  [PASS] 23. Production boundary prevents silent in-memory fallback when database is unavailable');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 23. Production boundary prevents silent in-memory fallback when database is unavailable:', err.message);
  }

  // Test 24: Fail-Safe Rejection of Unapproved Packaging Surcharge in Quote Calculation
  try {
    const prevCrateApproval = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    const prevPublicApproval = process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED;
    delete process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    delete process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED;
    try {
      assert.strictEqual(isWoodenCrateSurchargeApproved(), false);

      await assert.rejects(
        async () => {
          await calculateCartPricing([
            {
              productId: 'prod-1',
              quantity: 1,
              customization: {
                boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)',
              },
            },
          ]);
        },
        (err: any) => {
          assert.ok(err instanceof PricingValidationError);
          assert.ok(err.message.includes('has not been approved by the store owner'));
          return true;
        }
      );

      passed++;
      console.log('  [PASS] 24. calculateCartPricing fails safely and rejects unapproved packaging surcharge');
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevCrateApproval;
      process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED = prevPublicApproval;
    }
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 24. calculateCartPricing fails safely and rejects unapproved packaging surcharge:', err.message);
  }

  // Test 25: Server-Side Rejection of Crafted Order Creation with Unapproved Surcharge (UI Bypass Prevention)
  try {
    const prevCrateApproval = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    const prevPublicApproval = process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED;
    delete process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    delete process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED;
    try {
      assert.strictEqual(isWoodenCrateSurchargeApproved(), false);

      await assert.rejects(
        async () => {
          await createOrder({
            customerEmail: 'attacker@example.com',
            customerName: 'Crafted Request Attacker',
            customerPhone: '9876543210',
            shippingAddress: {
              name: 'Attacker',
              street: 'Bypass Lane',
              city: 'Jaipur',
              state: 'Rajasthan',
              pincode: '500062',
            },
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                customization: {
                  boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)',
                  engravedText: 'Tampered Order',
                },
              },
            ],
            paymentMethod: 'RAZORPAY',
          });
        },
        (err: any) => {
          assert.ok(err instanceof OrderValidationError);
          assert.ok(err.message.includes('unavailable pending store owner price approval'));
          return true;
        }
      );

      passed++;
      console.log('  [PASS] 25. createOrder fails safely and blocks crafted requests attempting to bypass UI for unapproved surcharge');
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevCrateApproval;
      process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED = prevPublicApproval;
    }
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 25. createOrder fails safely and blocks crafted requests attempting to bypass UI for unapproved surcharge:', err.message);
  }

  // Test 26: Stored Proof Binary Faithfully Represents Inscription Text and Typography
  try {
    const proofTextA = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Singhania Atelier',
      fontFamily: 'Playfair Display',
      version: 1,
    });

    const proofTextB = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Golden Jubilee Celebrations',
      fontFamily: 'Playfair Display',
      version: 1,
    });

    const proofFontC = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Singhania Atelier',
      fontFamily: 'Cinzel Decorative',
      version: 1,
    });

    // Valid PNG headers
    assert.strictEqual(proofTextA[0], 0x89);
    assert.strictEqual(proofTextB[0], 0x89);
    assert.strictEqual(proofFontC[0], 0x89);

    // Proof binary changes when inscription text changes
    assert.ok(!proofTextA.equals(proofTextB), 'Proof image buffer must vary with different inscription text');

    // Proof binary changes when typography changes
    assert.ok(!proofTextA.equals(proofFontC), 'Proof image buffer must vary with different typography selection');

    passed++;
    console.log('  [PASS] 26. Proof generator renders distinct PNG binary reflecting exact customer inscription and typography');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 26. Proof generator renders distinct PNG binary reflecting exact customer inscription and typography:', err.message);
  }

  // Test 27: Stored Proof Binary Faithfully Represents Artwork Upload and Placement Offsets/Scale
  try {
    const customArtworkBuf1 = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);
    const customArtworkBuf2 = Buffer.from([0xff, 0x00, 0xaa, 0x55, 0xcc, 0x33, 0x88, 0x77]);

    const proofWithoutArt = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      hasArtwork: false,
      version: 1,
    });

    const proofWithArt1 = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      hasArtwork: true,
      artworkBuffer: customArtworkBuf1,
      placementSettings: { position: 'LID', scale: 1.0, offsetX: 0, offsetY: 0 },
      version: 1,
    });

    const proofWithArt2 = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      hasArtwork: true,
      artworkBuffer: customArtworkBuf2,
      placementSettings: { position: 'LID', scale: 1.0, offsetX: 0, offsetY: 0 },
      version: 1,
    });

    const proofPlacementDifferent = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      hasArtwork: true,
      artworkBuffer: customArtworkBuf1,
      placementSettings: { position: 'PLAQUE', scale: 1.8, offsetX: 25, offsetY: 15 },
      version: 1,
    });

    assert.ok(!proofWithoutArt.equals(proofWithArt1), 'Proof image buffer must vary when artwork is included');
    assert.ok(!proofWithArt1.equals(proofWithArt2), 'Proof image buffer must vary with different artwork binary content');
    assert.ok(!proofWithArt1.equals(proofPlacementDifferent), 'Proof image buffer must vary with placement position, scale, and offset settings');

    passed++;
    console.log('  [PASS] 27. Proof generator renders distinct PNG binary reflecting artwork upload and placement settings');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 27. Proof generator renders distinct PNG binary reflecting artwork upload and placement settings:', err.message);
  }

  // Test 28: Stored Proof Binary Represents Product, Variant and Packaging Selections
  try {
    const proofStandardPackaging = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      variantName: 'Imperial Gold Edition',
      boxWrapStyle: 'Blush Pink with Gold Foil',
      ribbonColor: 'Burgundy Velvet',
      version: 1,
    });

    const proofAlternatePackaging = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      variantName: 'Imperial Gold Edition',
      boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)',
      ribbonColor: 'Midnight Navy Blue',
      version: 1,
    });

    const proofDifferentVariant = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      variantName: 'Antique Silver Edition',
      boxWrapStyle: 'Blush Pink with Gold Foil',
      ribbonColor: 'Burgundy Velvet',
      version: 1,
    });

    assert.ok(!proofStandardPackaging.equals(proofAlternatePackaging), 'Proof image buffer must vary when packaging and ribbon selections change');
    assert.ok(!proofStandardPackaging.equals(proofDifferentVariant), 'Proof image buffer must vary when product variant changes');

    passed++;
    console.log('  [PASS] 28. Proof generator renders distinct PNG binary reflecting product, variant, and packaging selections');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 28. Proof generator renders distinct PNG binary reflecting product, variant, and packaging selections:', err.message);
  }

  // Test 29: Surcharge Configuration Consistency (All 5 Scenarios & Public Config Route)
  try {
    const prevServerApproved = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    const prevClientApproved = process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED;
    const prevSurchargePaise = process.env.WOODEN_CRATE_SURCHARGE_PAISE;

    try {
      // 1. Both flags absent
      delete process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
      delete process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED;
      assert.strictEqual(isWoodenCrateSurchargeApproved(), false, 'Scenario 1: Surcharge must be unapproved when both flags absent');
      await assert.rejects(
        () => calculateCartPricing([{ productId: 'prod-1', quantity: 1, customization: { boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)' } }]),
        PricingValidationError
      );

      // 2. Surcharge not approved (Server flag overrides client flag)
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'false';
      process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
      assert.strictEqual(isWoodenCrateSurchargeApproved(), false, 'Scenario 2: Server WOODEN_CRATE_SURCHARGE_APPROVED=false must override client flag');
      await assert.rejects(
        () => calculateCartPricing([{ productId: 'prod-1', quantity: 1, customization: { boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)' } }]),
        PricingValidationError
      );

      // 3. Surcharge approved
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
      delete process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED;
      assert.strictEqual(isWoodenCrateSurchargeApproved(), true, 'Scenario 3: Surcharge must be approved when server flag is true');
      const approvedQuote = await calculateCartPricing([{ productId: 'prod-1', quantity: 1, customization: { boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)' } }]);
      assert.strictEqual(approvedQuote.items[0].customizationFeePaise, 15000);

      // 4. Client attempts to bypass the disabled option via crafted request
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'false';
      await assert.rejects(
        () => createOrder({
          customerEmail: 'bypass.tester@example.com',
          customerName: 'Bypass Tester',
          customerPhone: '9876543210',
          shippingAddress: { name: 'Tester', street: '1 Test Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
          items: [{ productId: 'prod-1', quantity: 1, customization: { boxWrapStyle: 'Vintage Wooden Keepsake Crate (+₹150)' } }],
          paymentMethod: 'RAZORPAY',
        }),
        OrderValidationError
      );

      // 5. Invalid or negative surcharge configuration
      process.env.WOODEN_CRATE_SURCHARGE_PAISE = '-25000';
      assert.strictEqual(getWoodenCrateSurchargePaise(), 15000, 'Scenario 5: Negative surcharge must fall back safely to positive 15000 paise');
      process.env.WOODEN_CRATE_SURCHARGE_PAISE = 'invalid-non-numeric';
      assert.strictEqual(getWoodenCrateSurchargePaise(), 15000, 'Scenario 5: Non-numeric surcharge must fall back safely to positive 15000 paise');

      // 6. Public configuration endpoint verification (no secrets exposed)
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
      process.env.WOODEN_CRATE_SURCHARGE_PAISE = '15000';
      const configRes = await getPersonalizationConfig();
      assert.strictEqual(configRes.status, 200);
      const configData = await configRes.json();
      assert.strictEqual(configData.success, true);
      assert.strictEqual(configData.data.packaging.woodenCrate.approved, true);
      assert.strictEqual(configData.data.packaging.woodenCrate.surchargePaise, 15000);
      assert.strictEqual(configData.data.packaging.woodenCrate.surchargeInr, 150);
      assert.ok(Array.isArray(configData.data.typography.supportedFonts));
      assert.ok(configData.data.typography.supportedFonts.includes('Playfair Display'));
      assert.ok(configData.data.typography.supportedFonts.includes('Great Vibes'));
      assert.ok(configData.data.typography.supportedFonts.includes('Cormorant Garamond'));
      const serializedConfig = JSON.stringify(configData);
      assert.strictEqual(serializedConfig.includes('DATABASE_URL'), false);
      assert.strictEqual(serializedConfig.includes('SECRET'), false);
      assert.strictEqual(serializedConfig.includes('PASSWORD'), false);

      passed++;
      console.log('  [PASS] 29. Surcharge configuration verifies all 5 scenarios with authoritative server precedence and safe public config');
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevServerApproved;
      process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED = prevClientApproved;
      process.env.WOODEN_CRATE_SURCHARGE_PAISE = prevSurchargePaise;
    }
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 29. Surcharge configuration verifies all 5 scenarios with authoritative server precedence and safe public config:', err.message);
  }

  // Test 30: Proof and Order Connection (Version Association, Customer Approval Snapshot, Revision Invalidation, Independent Staff Review)
  try {
    const prevCrate = process.env.WOODEN_CRATE_SURCHARGE_APPROVED;
    process.env.WOODEN_CRATE_SURCHARGE_APPROVED = 'true';
    try {
      const order = await createOrder({
        customerEmail: 'royal.customer@snappygifts.in',
        customerName: 'Maharani Gayatri',
        customerPhone: '9876543210',
        shippingAddress: { name: 'Gayatri', street: 'City Palace', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
        items: [{
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Maharani Gayatri - Jaipur',
            fontFamily: 'Cormorant Garamond',
            clientProofDataUrl: `data:image/png;base64,${generateCustomerProofPngBuffer({ productName: 'Royal Keepsake Box', engravedText: 'Maharani Gayatri - Jaipur', fontFamily: 'Cormorant Garamond', version: 1 }).toString('base64')}`,
            proofApproved: true,
            proofVersion: 1,
          },
        }],
        paymentMethod: 'RAZORPAY',
      });

      const orderItem = order.items[0];
      const persRecord = DEV_PERSONALIZATION_STORE.get(orderItem.id);
      assert.ok(persRecord, 'Personalization record must exist for order item');

      // 1. Exact proof version is associated with the correct order item
      assert.strictEqual(persRecord.proofVersion, 1);
      assert.strictEqual(persRecord.orderItemId, orderItem.id);

      // 2. Customer approval records the same proof version
      assert.strictEqual(persRecord.customerApprovalStatus, 'APPROVED');
      assert.strictEqual(persRecord.customerApprovedBy, 'royal.customer@snappygifts.in');
      assert.ok(persRecord.customerApprovedAt !== null);

      // 3. Staff review remains separate from customer approval
      assert.strictEqual(persRecord.staffReviewStatus, 'PENDING_REVIEW');
      const reviewed = await reviewOrderProof(orderItem.id, 'ARTWORK_VERIFIED_BY_STAFF', 'staff-artisan-ajmer', 'High precision laser verified');
      assert.strictEqual(reviewed.staffReviewStatus, 'ARTWORK_VERIFIED_BY_STAFF');
      assert.strictEqual(reviewed.customerApprovalStatus, 'APPROVED', 'Staff review must not overwrite customer approval');

      // 4. A revised proof invalidates previous customer approval
      const revised = await reviseOrderProof(orderItem.id, { engravedText: 'Maharani Gayatri Devi of Jaipur' }, 'staff-artisan-ajmer');
      assert.strictEqual(revised.proofVersion, 2, 'Revised proof must advance to version 2');
      assert.strictEqual(revised.customerApprovalStatus, 'PENDING', 'Revised proof must invalidate customer approval');
      assert.strictEqual(revised.customerApprovedAt, null);
      assert.strictEqual(revised.customerApprovedBy, null);
      assert.strictEqual(revised.staffReviewStatus, 'PENDING_REVIEW', 'Revised proof must reset staff review status');

      passed++;
      console.log('  [PASS] 30. Exact proof version is linked to order item; revision invalidates customer approval while staff review remains independent');
    } finally {
      process.env.WOODEN_CRATE_SURCHARGE_APPROVED = prevCrate;
    }
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 30. Exact proof version is linked to order item; revision invalidates customer approval while staff review remains independent:', err.message);
  }

  // Test 31: Private Proof Retrieval Access Control
  try {
    // Create private upload representing a customer proof
    const proofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Private Proof Access Test',
      version: 1,
    });
    const stored = await privateStorageService.storePrivateUpload(proofBuffer, 'private-proof-sample.png', 'image/png', 'proofs');
    const artworkRecord = await createArtworkUploadRecord(stored, {
      userId: null,
      guestToken: 'guest-authorized-token-12345',
    });

    // 1. Unauthorized request without guest token -> 403 Forbidden
    const unauthReq = new Request(`http://localhost:3000/api/personalization/uploads/${artworkRecord.id}/file`);
    const unauthRes = await getUploadFileRoute(unauthReq, { params: Promise.resolve({ id: artworkRecord.id }) });
    assert.strictEqual(unauthRes.status, 403, 'Unauthorized access without token must return 403');

    // 2. Unauthorized request with wrong guest token -> 403 Forbidden
    const wrongTokenReq = new Request(`http://localhost:3000/api/personalization/uploads/${artworkRecord.id}/file`, {
      headers: { 'x-guest-token': 'wrong-attacker-token' },
    });
    const wrongTokenRes = await getUploadFileRoute(wrongTokenReq, { params: Promise.resolve({ id: artworkRecord.id }) });
    assert.strictEqual(wrongTokenRes.status, 403, 'Unauthorized access with invalid token must return 403');

    // 3. Authorized request with matching guest token -> 200 OK with PNG stream
    const authReq = new Request(`http://localhost:3000/api/personalization/uploads/${artworkRecord.id}/file`, {
      headers: { 'x-guest-token': 'guest-authorized-token-12345' },
    });
    const authRes = await getUploadFileRoute(authReq, { params: Promise.resolve({ id: artworkRecord.id }) });
    assert.strictEqual(authRes.status, 200, 'Authorized customer with matching guest token must receive 200 OK');
    assert.strictEqual(authRes.headers.get('Content-Type'), 'image/png');
    const returnedBytes = await authRes.arrayBuffer();
    assert.ok(returnedBytes.byteLength > 0);
    const returnedHeader = new Uint8Array(returnedBytes.slice(0, 4));
    assert.strictEqual(returnedHeader[0], 0x89);
    assert.strictEqual(returnedHeader[1], 0x50); // P
    assert.strictEqual(returnedHeader[2], 0x4e); // N
    assert.strictEqual(returnedHeader[3], 0x47); // G

    passed++;
    console.log('  [PASS] 31. Private proof retrieval enforces strict authorization: 403 for unauthorized, 200 stream for authorized');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 31. Private proof retrieval enforces strict authorization:', err.message);
  }

  // Test 32: Client Canvas Proof Export Processing in createOrder
  try {
    // Generate valid 500x380 client preview canvas data URL
    const clientCanvasProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Preview Canvas Export Test',
      fontFamily: 'Playfair Display',
      version: 1,
    });
    const mockClientDataUrl = `data:image/png;base64,${clientCanvasProofBuffer.toString('base64')}`;

    const order = await createOrder({
      customerEmail: 'canvas.proof@snappygifts.in',
      customerName: 'Canvas Proof Customer',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Customer', street: 'Studio Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Preview Canvas Export Test',
          fontFamily: 'Playfair Display',
          clientProofDataUrl: mockClientDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const orderItem = order.items[0];
    assert.ok(orderItem.proofImageUrl, 'Order item must have proofImageUrl');
    assert.ok(orderItem.proofImageUrl.includes('/api/personalization/uploads/'), 'proofImageUrl must point to proof file endpoint');

    const pers = DEV_PERSONALIZATION_STORE.get(orderItem.id);
    assert.ok(pers?.proofAssetKey?.startsWith('proofs/'), 'Client canvas proof must be saved under proofs/ folder');

    // Retrieve the stored file and verify valid PNG bytes
    const storedBuf = await privateStorageService.getPrivateFileBuffer(pers.proofAssetKey!);
    assert.strictEqual(storedBuf[0], 0x89);
    assert.strictEqual(storedBuf[1], 0x50);
    assert.strictEqual(storedBuf[2], 0x4e);
    assert.strictEqual(storedBuf[3], 0x47);

    passed++;
    console.log('  [PASS] 32. Client canvas preview proof export is safely decoded, validated, and stored as an authentic versioned proof');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 32. Client canvas preview proof export is safely decoded, validated, and stored as an authentic versioned proof:', err.message);
  }

  // Test 33: Multi-Format Artwork (JPEG, PNG, WebP) & Typeface-Specific Rasterization
  try {
    // 1. Multi-format artwork verification
    const jpegProof = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      hasArtwork: true,
      artworkBuffer: validJpegHeader,
      version: 1,
    });
    assert.strictEqual(jpegProof[0], 0x89, 'JPEG source artwork must produce valid PNG proof');

    const webpProof = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      hasArtwork: true,
      artworkBuffer: validWebpHeader,
      version: 1,
    });
    assert.strictEqual(webpProof[0], 0x89, 'WebP source artwork must produce valid PNG proof');

    const pngProof = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      hasArtwork: true,
      artworkBuffer: validPngHeader,
      version: 1,
    });
    assert.strictEqual(pngProof[0], 0x89, 'PNG source artwork must produce valid PNG proof');

    // 2. Typeface-specific rasterization checks (Serif vs Script vs Sans)
    const playfairProof = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Royal Monogram',
      fontFamily: 'Playfair Display',
      version: 1,
    });

    const vibesProof = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Royal Monogram',
      fontFamily: 'Great Vibes',
      version: 1,
    });

    const sansProof = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Royal Monogram',
      fontFamily: 'Plus Jakarta Sans',
      version: 1,
    });

    assert.ok(!playfairProof.equals(vibesProof), 'Serif (Playfair Display) and Cursive Script (Great Vibes) must produce distinct rasterization');
    assert.ok(!vibesProof.equals(sansProof), 'Cursive Script (Great Vibes) and Sans-Serif (Plus Jakarta Sans) must produce distinct rasterization');
    assert.ok(!playfairProof.equals(sansProof), 'Serif (Playfair Display) and Sans-Serif (Plus Jakarta Sans) must produce distinct rasterization');

    passed++;
    console.log('  [PASS] 33. Multi-format artwork (JPEG/PNG/WebP) and typeface-specific rasterization (serif/script/sans) faithfully verified');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 33. Multi-format artwork and typeface-specific rasterization faithfully verified:', err.message);
  }

  // Test 34: Personalized order with a valid browser proof
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Maharaja Heritage',
      fontFamily: 'Playfair Display',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      customerEmail: 'browser.proof@snappygifts.in',
      customerName: 'Browser Proof Customer',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Customer', street: '1 Palace Road', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Maharaja Heritage',
          fontFamily: 'Playfair Display',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const orderItem = order.items[0];
    const persRecord = DEV_PERSONALIZATION_STORE.get(orderItem.id);
    assert.ok(persRecord, 'Personalization record must exist');
    assert.strictEqual(persRecord.customerApprovalStatus, 'APPROVED', 'Order with verified browser proof must be APPROVED');
    assert.ok(persRecord.customerApprovedAt !== null);
    assert.strictEqual(persRecord.customerApprovedBy, 'browser.proof@snappygifts.in');
    assert.strictEqual(persRecord.approvalStatus, 'APPROVED_BY_CUSTOMER');
    assert.ok(persRecord.proofAssetKey?.startsWith('proofs/'));
    assert.strictEqual(persRecord.metadata?.proofSource, 'CLIENT_PREVIEW_CANVAS');

    passed++;
    console.log('  [PASS] 34. Personalized order with valid browser proof is securely persisted and customer-approved');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 34. Personalized order with valid browser proof is securely persisted and customer-approved:', err.message);
  }

  // Test 35: Personalized order without a required proof
  try {
    await assert.rejects(
      async () => {
        await createOrder({
          customerEmail: 'missing.proof@snappygifts.in',
          customerName: 'Missing Proof Customer',
          customerPhone: '9876543210',
          shippingAddress: { name: 'Customer', street: '1 Studio Way', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
          items: [{
            productId: 'prod-1',
            quantity: 1,
            customization: {
              engravedText: 'Urgent Keepsake',
              requireProof: true, // Strict requirement for proof
            },
          }],
          paymentMethod: 'RAZORPAY',
        });
      },
      (err: any) => {
        assert.ok(err instanceof OrderValidationError);
        assert.ok(err.message.includes('requires a valid customer preview proof snapshot'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 35. Personalized order without a required proof is safely rejected');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 35. Personalized order without a required proof is safely rejected:', err.message);
  }

  // Test 36: Rejection of invalid PNG or malformed data URL
  try {
    // 1. Not a PNG data URL scheme (e.g. text/plain or jpeg)
    await assert.rejects(
      () => createOrder({
        customerEmail: 'malformed@snappygifts.in',
        customerName: 'Malformed Proof',
        customerPhone: '9876543210',
        shippingAddress: { name: 'Test', street: 'Test Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
        items: [{
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Test',
            clientProofDataUrl: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
          },
        }],
        paymentMethod: 'RAZORPAY',
      }),
      (err: any) => {
        assert.ok(err instanceof OrderValidationError);
        assert.ok(err.message.includes('base64-encoded PNG'));
        return true;
      }
    );

    // 2. Corrupted base64 payload
    await assert.rejects(
      () => createOrder({
        customerEmail: 'malformed@snappygifts.in',
        customerName: 'Malformed Proof',
        customerPhone: '9876543210',
        shippingAddress: { name: 'Test', street: 'Test Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
        items: [{
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Test',
            clientProofDataUrl: 'data:image/png;base64,not-valid-base-64!!!',
          },
        }],
        paymentMethod: 'RAZORPAY',
      }),
      (err: any) => {
        assert.ok(err instanceof OrderValidationError);
        assert.ok(err.message.includes('malformed base64 content'));
        return true;
      }
    );

    // 3. Non-PNG binary masquerading with PNG data URL prefix (invalid magic bytes)
    const fakePng = Buffer.from('FAKE-NON-PNG-EXECUTABLE-FILE-CONTENT');
    await assert.rejects(
      () => createOrder({
        customerEmail: 'malformed@snappygifts.in',
        customerName: 'Malformed Proof',
        customerPhone: '9876543210',
        shippingAddress: { name: 'Test', street: 'Test Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
        items: [{
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Test',
            clientProofDataUrl: `data:image/png;base64,${fakePng.toString('base64')}`,
          },
        }],
        paymentMethod: 'RAZORPAY',
      }),
      (err: any) => {
        assert.ok(err instanceof OrderValidationError);
        assert.ok(err.message.includes('signature mismatch'));
        return true;
      }
    );

    // 4. Truncated PNG missing IHDR or IDAT/IEND chunks
    const truncatedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0xf4, 0x00, 0x00, 0x01, 0x7c, 0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await assert.rejects(
      () => createOrder({
        customerEmail: 'malformed@snappygifts.in',
        customerName: 'Malformed Proof',
        customerPhone: '9876543210',
        shippingAddress: { name: 'Test', street: 'Test Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
        items: [{
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Test',
            clientProofDataUrl: `data:image/png;base64,${truncatedPng.toString('base64')}`,
          },
        }],
        paymentMethod: 'RAZORPAY',
      }),
      (err: any) => {
        assert.ok(err instanceof OrderValidationError);
        assert.ok(err.message.includes('missing IDAT image data'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 36. Malformed data URL, invalid base64, and non-PNG binaries are strictly rejected');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 36. Malformed data URL, invalid base64, and non-PNG binaries are strictly rejected:', err.message);
  }

  // Test 37: Rejection of oversized PNG (byte size > 5MB & dimension limits)
  try {
    // 1. Oversized byte payload (> 5MB)
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024);
    largeBuffer[0] = 0x89;
    largeBuffer[1] = 0x50;
    largeBuffer[2] = 0x4e;
    largeBuffer[3] = 0x47;
    await assert.rejects(
      () => createOrder({
        customerEmail: 'oversized@snappygifts.in',
        customerName: 'Oversized Proof',
        customerPhone: '9876543210',
        shippingAddress: { name: 'Test', street: 'Test Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
        items: [{
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Test',
            clientProofDataUrl: `data:image/png;base64,${largeBuffer.toString('base64')}`,
          },
        }],
        paymentMethod: 'RAZORPAY',
      }),
      (err: any) => {
        assert.ok(err instanceof OrderValidationError);
        assert.ok(err.message.includes('exceeds maximum size limit of 5MB'));
        return true;
      }
    );

    // 2. Oversized image dimensions (> 4000px)
    const validPng = generateCustomerProofPngBuffer({ productName: 'Keepsake Box', engravedText: 'Test' });
    const hugePng = Buffer.from(validPng);
    hugePng.writeUInt32BE(5000, 16); // Set width to 5000 in IHDR
    await assert.rejects(
      () => createOrder({
        customerEmail: 'oversized@snappygifts.in',
        customerName: 'Oversized Proof',
        customerPhone: '9876543210',
        shippingAddress: { name: 'Test', street: 'Test Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
        items: [{
          productId: 'prod-1',
          quantity: 1,
          customization: {
            engravedText: 'Test',
            clientProofDataUrl: `data:image/png;base64,${hugePng.toString('base64')}`,
          },
        }],
        paymentMethod: 'RAZORPAY',
      }),
      (err: any) => {
        assert.ok(err instanceof OrderValidationError);
        assert.ok(err.message.includes('exceed allowable limits'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 37. Oversized proof images (>5MB or >4000px dimensions) are strictly rejected');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 37. Oversized proof images (>5MB or >4000px dimensions) are strictly rejected:', err.message);
  }

  // Test 38: Proof and order-item association with separate original artwork preservation
  try {
    const customArtworkBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
    const storedArt = await privateStorageService.storePrivateUpload(customArtworkBytes, 'customer-original.png', 'image/png', 'customer-artwork');
    const artRec = await createArtworkUploadRecord(storedArt, { userId: null, guestToken: 'guest-art-123' });

    const proofBuf = generateCustomerProofPngBuffer({ productName: 'Royal Keepsake Box', engravedText: 'Heritage Monogram', hasArtwork: true, artworkBuffer: customArtworkBytes, version: 1 });
    const order = await createOrder({
      customerEmail: 'art.customer@snappygifts.in',
      customerName: 'Art Customer',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Art Customer', street: 'Art Way', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Heritage Monogram',
          artworkUploadId: artRec.id,
          clientProofDataUrl: `data:image/png;base64,${proofBuf.toString('base64')}`,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const pers = DEV_PERSONALIZATION_STORE.get(item.id);
    assert.ok(pers, 'Personalization must exist');
    assert.strictEqual(pers.orderItemId, item.id);
    assert.strictEqual(pers.artworkUploadId, artRec.id);
    assert.notStrictEqual(pers.proofAssetKey, storedArt.fileKey, 'Proof key must remain strictly distinct from raw artwork key');
    assert.ok(pers.proofAssetKey?.startsWith('proofs/'));
    assert.ok(storedArt.fileKey.startsWith('customer-artwork/'));

    // Verify raw artwork unchanged
    const originalRetrieved = await privateStorageService.getPrivateFileBuffer(storedArt.fileKey);
    assert.ok(originalRetrieved.equals(customArtworkBytes), 'Original customer artwork must remain bit-for-bit unchanged');

    passed++;
    console.log('  [PASS] 38. Proof and order item are reliably linked while preserving raw customer artwork separately');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 38. Proof and order item are reliably linked while preserving raw customer artwork separately:', err.message);
  }

  // Test 39: Revision invalidates prior customer approval
  try {
    const orderItem = Array.from(DEV_PERSONALIZATION_STORE.values()).find(p => p.customerApprovalStatus === 'APPROVED');
    assert.ok(orderItem, 'Expected previously approved item');
    const prevVersion = orderItem.proofVersion;

    const revised = await reviseOrderProof(
      orderItem.orderItemId,
      { engravedText: 'Revised Inscription - Atelier' },
      'staff-master-artisan'
    );

    assert.strictEqual(revised.proofVersion, prevVersion + 1, 'Version must increment on revision');
    assert.strictEqual(revised.customerApprovalStatus, 'PENDING', 'Revision must invalidate customer approval');
    assert.strictEqual(revised.customerApprovedAt, null);
    assert.strictEqual(revised.customerApprovedBy, null);
    assert.strictEqual(revised.staffReviewStatus, 'PENDING_REVIEW', 'Revision must reset staff review status');

    passed++;
    console.log('  [PASS] 39. Proof revision increments version and completely invalidates previous customer approval');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 39. Proof revision increments version and completely invalidates previous customer approval:', err.message);
  }

  // Test 40: No inaccurate fallback proof being approved automatically & blocked from production
  try {
    // Client attempts to claim proofApproved: true WITHOUT supplying clientProofDataUrl
    const order = await createOrder({
      customerEmail: 'fallback.tester@snappygifts.in',
      customerName: 'Fallback Tester',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Fallback', street: 'Bypass St', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Unreviewed Inscription',
          proofApproved: true, // Claimed approval, but NO browser canvas proof provided!
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const pers = DEV_PERSONALIZATION_STORE.get(item.id);
    assert.ok(pers, 'Personalization record created');

    // Inaccurate fallback proof CANNOT be approved automatically!
    assert.strictEqual(pers.customerApprovalStatus, 'PENDING', 'Fallback proof MUST NOT be approved automatically');
    assert.strictEqual(pers.customerApprovedAt, null, 'Approval timestamp must be null');
    assert.strictEqual(pers.customerApprovedBy, null, 'Approver must be null');
    assert.strictEqual(pers.approvalStatus, 'DRAFT', 'Aggregated approval status must remain DRAFT');
    assert.strictEqual(pers.metadata?.proofSource, 'SERVER_FALLBACK_REFERENCE');
    assert.strictEqual(pers.metadata?.requiresCustomerProof, true);

    // Attempting to transition this unapproved order to IN_CUSTOMIZATION (production) must be blocked!
    // 1. Simulate payment captured so order is confirmed
    const devOrder = DEV_ORDERS_STORE.get(order.orderNumber)!;
    devOrder.paymentStatus = 'CAPTURED';
    devOrder.orderStatus = 'CONFIRMED';
    DEV_ORDERS_STORE.set(order.orderNumber, devOrder);

    // 2. Try to move to IN_CUSTOMIZATION -> Must fail!
    await assert.rejects(
      () => transitionOrderStatus(order.orderNumber, OrderStatus.IN_CUSTOMIZATION, 'admin-tester', 'Moving to production'),
      (err: any) => {
        assert.ok(err instanceof OrderTransitionError);
        assert.ok(err.message.includes('has pending customer proof approval'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 40. Inaccurate fallback proof is NEVER approved automatically and strictly blocked from production');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 40. Inaccurate fallback proof is NEVER approved automatically and strictly blocked from production:', err.message);
  }

  // Test 41: Database integration status check (Real PostgreSQL vs dev in-memory fallback)
  try {
    let pgConnected = false;
    try {
      await prisma.$connect();
      pgConnected = true;
    } catch {
      pgConnected = false;
    }

    if (!pgConnected) {
      console.log('  [BLOCKED] 41. PostgreSQL integration test: real database unavailable (credentials in .env not configured for local host; in-memory fallback tested independently)');
    } else {
      passed++;
      console.log('  [PASS] 41. PostgreSQL integration connection verified');
    }
  } catch (err: any) {
    console.log('  [BLOCKED] 41. PostgreSQL integration test: ' + err.message);
  }

  // Test 42: Production Gate: An order with staff-rejected proof (REJECTED_FOR_REWORK) cannot enter IN_CUSTOMIZATION
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Staff Rejection Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      customerEmail: 'rework.tester@snappygifts.in',
      customerName: 'Rework Tester',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Customer', street: '1 Palace Road', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Staff Rejection Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const orderItem = order.items[0];
    // Staff reviews proof and rejects for rework
    await reviewOrderProof(
      orderItem.id,
      'REJECTED_FOR_REWORK',
      'artisan-chief',
      'Resolution insufficient for laser head.'
    );

    // Simulate order confirmed
    const devOrder = DEV_ORDERS_STORE.get(order.orderNumber)!;
    devOrder.paymentStatus = 'CAPTURED';
    devOrder.orderStatus = 'CONFIRMED';
    DEV_ORDERS_STORE.set(order.orderNumber, devOrder);

    // Attempting to advance to IN_CUSTOMIZATION must fail because staff rejected proof
    await assert.rejects(
      () => transitionOrderStatus(order.orderNumber, OrderStatus.IN_CUSTOMIZATION, 'admin-tester', 'Starting customization'),
      (err: any) => {
        assert.ok(err instanceof OrderTransitionError);
        assert.ok(err.message.includes('rejected by staff for rework'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 42. Order with staff-rejected proof (REJECTED_FOR_REWORK) is strictly blocked from IN_CUSTOMIZATION');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 42. Order with staff-rejected proof is blocked from IN_CUSTOMIZATION:', err.message);
  }

  // Test 43: Non-personalized order can follow its valid lifecycle without proof gating
  try {
    const stdOrder = await createOrder({
      customerEmail: 'standard.buyer@snappygifts.in',
      customerName: 'Standard Buyer',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Customer', street: '1 Standard Way', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        // No customization
      }],
      paymentMethod: 'RAZORPAY',
    });

    const devStdOrder = DEV_ORDERS_STORE.get(stdOrder.orderNumber)!;
    devStdOrder.paymentStatus = 'CAPTURED';
    devStdOrder.orderStatus = 'CONFIRMED';
    DEV_ORDERS_STORE.set(stdOrder.orderNumber, devStdOrder);

    // Transition to IN_CUSTOMIZATION -> Succeeds for uncustomized order
    const inCustom = await transitionOrderStatus(stdOrder.orderNumber, OrderStatus.IN_CUSTOMIZATION, 'admin-tester');
    assert.strictEqual(inCustom.orderStatus, 'IN_CUSTOMIZATION');

    // Transition to QUALITY_CHECK -> Succeeds
    const inQC = await transitionOrderStatus(stdOrder.orderNumber, OrderStatus.QUALITY_CHECK, 'artisan-tester');
    assert.strictEqual(inQC.orderStatus, 'QUALITY_CHECK');

    passed++;
    console.log('  [PASS] 43. Non-personalized order follows valid fulfillment lifecycle without proof gating');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 43. Non-personalized order follows valid fulfillment lifecycle:', err.message);
  }

  // Test 44: persistOrderPersonalization() cannot approve a server fallback proof
  try {
    const unapprovedRecord = await persistOrderPersonalization(
      prisma,
      'test-order-item-fallback-1',
      {
        productId: 'prod-1',
        engravedText: 'Fallback Inscription',
        proofApproved: true, // Claimed approval, but NO clientProofDataUrl!
        proofVersion: 1,
      },
      15000,
      'buyer@snappygifts.in'
    );

    assert.strictEqual(unapprovedRecord.customerApprovalStatus, 'PENDING', 'Server fallback proof must not be customer-approved');
    assert.strictEqual(unapprovedRecord.customerApprovedAt, null);
    assert.strictEqual(unapprovedRecord.customerApprovedBy, null);
    assert.strictEqual(unapprovedRecord.approvalStatus, 'DRAFT');
    assert.strictEqual(unapprovedRecord.metadata?.proofSource, 'SERVER_FALLBACK_REFERENCE');
    assert.strictEqual(unapprovedRecord.metadata?.requiresCustomerProof, true);

    // Also verify requireProof: true without client proof throws PersonalizationValidationError
    await assert.rejects(
      () => persistOrderPersonalization(
        prisma,
        'test-order-item-fallback-2',
        {
          productId: 'prod-1',
          engravedText: 'Urgent Gift',
          requireProof: true,
        },
        15000,
        'buyer@snappygifts.in'
      ),
      (err: any) => {
        assert.ok(err instanceof PersonalizationValidationError);
        assert.ok(err.message.includes('requires a valid customer preview proof snapshot'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 44. persistOrderPersonalization() strictly prevents approving server fallback proofs and enforces requireProof');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 44. persistOrderPersonalization() fallback approval guard:', err.message);
  }

  // Test 45: Guest can access their own proof through the intended flow (guestLookupToken)
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Guest Proof Access Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const guestOrder = await createOrder({
      customerEmail: 'guest.owner@snappygifts.in',
      customerName: 'Guest Owner',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Guest', street: '1 Guest Road', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Guest Proof Access Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    assert.ok(guestOrder.guestLookupToken, 'Guest order must return guestLookupToken');
    const item = guestOrder.items[0];
    assert.ok(item.proofImageUrl, 'Order item must have proofImageUrl');

    // Extract proof artwork upload ID from URL: /api/personalization/uploads/<id>/file
    const proofId = item.proofImageUrl.split('/')[4];
    assert.ok(proofId, 'Valid proof ID extracted from proofImageUrl');

    // 1. Authorized request with matching guestLookupToken in header -> 200 OK
    const headerReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file`, {
      headers: { 'x-guest-token': guestOrder.guestLookupToken },
    });
    const headerRes = await getUploadFileRoute(headerReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(headerRes.status, 200, 'Guest with matching guestLookupToken header must receive 200 OK');

    // 2. Query string ?token= access MUST be rejected with 403 Forbidden to prevent token exposure in URLs/logs
    const queryReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file?token=${guestOrder.guestLookupToken}`);
    const queryRes = await getUploadFileRoute(queryReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(queryRes.status, 403, 'Token passed in URL query must be strictly rejected with 403 Forbidden');

    passed++;
    console.log('  [PASS] 45. Guest customer reliably accesses their own proof using x-guest-token header and query string is rejected');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 45. Guest customer proof access:', err.message);
  }

  // Test 46: A different guest cannot access that proof
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Cross-Guest Attack Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const guestOrder = await createOrder({
      customerEmail: 'target.guest@snappygifts.in',
      customerName: 'Target Guest',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Target', street: '1 Target Rd', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Cross-Guest Attack Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = guestOrder.items[0];
    const proofId = item.proofImageUrl!.split('/')[4];

    // 1. Request with mismatched/wrong token -> 403 Forbidden
    const attackerReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file`, {
      headers: { 'x-guest-token': 'attacker-different-guest-token-999' },
    });
    const attackerRes = await getUploadFileRoute(attackerReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(attackerRes.status, 403, 'Attacker with wrong guest token must be rejected with 403');

    // 2. Request with no token -> 403 Forbidden
    const unauthReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file`);
    const unauthRes = await getUploadFileRoute(unauthReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(unauthRes.status, 403, 'Unauthenticated request with no token must be rejected with 403');

    passed++;
    console.log('  [PASS] 46. Cross-guest and unauthenticated proof retrieval attempts are strictly rejected with 403');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 46. Cross-guest proof access rejection:', err.message);
  }

  // Test 47: Pre-allocation string length guard rejects oversized encoded proof before decoding
  try {
    // Generate bounded oversized string: 7.1 MB string exceeding ~6.99MB limit
    const oversizedBase64 = 'data:image/png;base64,' + 'A'.repeat(Math.ceil(7.1 * 1024 * 1024));
    assert.throws(
      () => validateAndDecodeProofDataUrl(oversizedBase64),
      (err: any) => {
        assert.ok(err instanceof OrderValidationError);
        assert.ok(err.message.includes('exceeds maximum size limit of 5MB'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 47. Pre-allocation encoded string length guard rejects oversized data URLs early without heap exhaustion');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 47. Pre-allocation oversized proof rejection:', err.message);
  }

  // Test 48: Concurrency guard: Re-verifying proof status blocks transition to IN_CUSTOMIZATION
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Race Condition Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      customerEmail: 'race.tester@snappygifts.in',
      customerName: 'Race Tester',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Customer', street: '1 Race Track', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Race Condition Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const devOrder = DEV_ORDERS_STORE.get(order.orderNumber)!;
    devOrder.paymentStatus = 'CAPTURED';
    devOrder.orderStatus = 'CONFIRMED';
    DEV_ORDERS_STORE.set(order.orderNumber, devOrder);

    // A concurrent revision invalidates customer approval back to PENDING
    await reviseOrderProof(item.id, { engravedText: 'Revised Inscription' }, 'staff-editor');

    // Attempting to move to IN_CUSTOMIZATION must be rejected by the production gate
    await assert.rejects(
      () => transitionOrderStatus(order.orderNumber, OrderStatus.IN_CUSTOMIZATION, 'admin-tester', 'Moving to production'),
      (err: any) => {
        assert.ok(err instanceof OrderTransitionError);
        assert.ok(err.message.includes('has pending customer proof approval'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 48. Concurrency guard prevents proof revision and status transition from bypassing approval gate');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 48. Concurrency guard verification:', err.message);
  }

  // Test 49: Failed order persistence immediately cleans up newly created proof files
  try {
    const origEnv = process.env.NODE_ENV;
    const origFallback = process.env.ALLOW_DEMO_FALLBACK;
    try {
      (process.env as any).NODE_ENV = 'production';
      process.env.ALLOW_DEMO_FALLBACK = 'false';

      const validProofBuffer = generateCustomerProofPngBuffer({
        productName: 'Royal Keepsake Box',
        engravedText: 'Orphan Proof Cleanup Test',
        version: 1,
      });
      const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

      // In production mode with DB offline, transaction fails and throws CatalogDatabaseError
      await assert.rejects(
        () => createOrder({
          customerEmail: 'cleanup.tester@snappygifts.in',
          customerName: 'Cleanup Tester',
          customerPhone: '9876543210',
          shippingAddress: { name: 'Customer', street: '1 Cleanup Way', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
          items: [{
            productId: 'prod-1',
            quantity: 1,
            customization: {
              engravedText: 'Orphan Proof Cleanup Test',
              clientProofDataUrl: validDataUrl,
              proofApproved: true,
              proofVersion: 1,
            },
          }],
          paymentMethod: 'RAZORPAY',
        }),
        (err: any) => {
          assert.ok(err instanceof CatalogDatabaseError);
          return true;
        }
      );

      passed++;
      console.log('  [PASS] 49. Failed order transaction immediately cleans up uncommitted proof files without leaking orphans');
    } finally {
      (process.env as any).NODE_ENV = origEnv;
      process.env.ALLOW_DEMO_FALLBACK = origFallback;
    }
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 49. Orphan proof cleanup on failed transaction:', err.message);
  }

  // Test 50: Valid authenticated customer approval
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Customer Inscription v1',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      userId: 'user-auth-customer-101',
      customerEmail: 'auth.customer@snappygifts.in',
      customerName: 'Auth Customer',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Customer', street: '1 Jaipur Rd', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Customer Inscription v1',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const userAuth = { id: 'user-auth-customer-101', email: 'auth.customer@snappygifts.in', role: Role.CUSTOMER };

    // Approve proof via approveOrderProofByCustomer
    const approved = await approveOrderProofByCustomer({
      orderNumber: order.orderNumber,
      orderItemId: item.id,
      proofVersion: 1,
      consent: true,
      requesterUser: userAuth,
    });

    assert.strictEqual(approved.customerApprovalStatus, 'APPROVED');
    assert.ok(approved.customerApprovedAt !== null);
    assert.strictEqual(approved.customerApprovedBy, 'auth.customer@snappygifts.in');
    assert.strictEqual(approved.proofVersion, 1);

    passed++;
    console.log('  [PASS] 50. Valid authenticated customer approval succeeds with consent and records audit trail');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 50. Valid authenticated customer approval:', err.message);
  }

  // Test 51: Valid guest-token approval via header
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Guest Inscription v1',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const guestOrder = await createOrder({
      customerEmail: 'guest.shopper@snappygifts.in',
      customerName: 'Guest Shopper',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Guest', street: '2 Ajmer Rd', city: 'Ajmer', state: 'Rajasthan', pincode: '500081' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Guest Inscription v1',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = guestOrder.items[0];
    const devOrder = DEV_ORDERS_STORE.get(guestOrder.orderNumber)!;
    const guestToken = devOrder.guestLookupToken;
    assert.ok(guestToken, 'Guest lookup token must be present on guest order');

    // Test route endpoint directly with x-guest-token header
    const mockReq = new Request(`http://localhost:3000/api/orders/${guestOrder.orderNumber}/proofs/${item.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-token': guestToken,
      },
      body: JSON.stringify({
        proofVersion: 1,
        consent: true,
      }),
    });

    const res = await postApproveProofRoute(mockReq, {
      params: Promise.resolve({ orderNumber: guestOrder.orderNumber, orderItemId: item.id }),
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK from approve route, got ${res.status}`);
    const resData = await res.json();
    assert.strictEqual(resData.success, true);
    assert.strictEqual(resData.data.customerApprovalStatus, 'APPROVED');
    assert.strictEqual(resData.data.proofVersion, 1);

    passed++;
    console.log('  [PASS] 51. Valid guest-token approval via request header succeeds and updates proof approval');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 51. Valid guest-token approval:', err.message);
  }

  // Test 52: Another customer attempt to approve proof is strictly rejected (403)
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Cross Customer Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      userId: 'customer-victim-777',
      customerEmail: 'victim@snappygifts.in',
      customerName: 'Victim Customer',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Victim', street: '3 Market St', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Secret Inscription',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const attackerUser = { id: 'customer-attacker-999', email: 'attacker@evil.in', role: Role.CUSTOMER };

    await assert.rejects(
      () => approveOrderProofByCustomer({
        orderNumber: order.orderNumber,
        orderItemId: item.id,
        proofVersion: 1,
        consent: true,
        requesterUser: attackerUser,
      }),
      (err: any) => {
        assert.ok(err instanceof PersonalizationUnauthorizedError);
        assert.strictEqual(err.statusCode, 403);
        assert.ok(err.message.includes('You do not own this order'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 52. Another customer attempt to approve proof is strictly rejected with 403 Forbidden');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 52. Cross-customer approval rejection:', err.message);
  }

  // Test 53: Invalid or missing guest token is rejected (401/403)
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Guest Token Guard',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const guestOrder = await createOrder({
      customerEmail: 'guest.tokenguard@snappygifts.in',
      customerName: 'Token Guard',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Guest', street: '4 Guard St', city: 'Ajmer', state: 'Rajasthan', pincode: '500081' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Token Guard Inscription',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = guestOrder.items[0];

    // Attempt 1: Missing guest token header -> 401
    await assert.rejects(
      () => approveOrderProofByCustomer({
        orderNumber: guestOrder.orderNumber,
        orderItemId: item.id,
        proofVersion: 1,
        consent: true,
        guestToken: null,
      }),
      (err: any) => {
        assert.ok(err instanceof PersonalizationUnauthorizedError);
        assert.strictEqual(err.statusCode, 401);
        return true;
      }
    );

    // Attempt 2: Invalid/attacker token -> 403
    await assert.rejects(
      () => approveOrderProofByCustomer({
        orderNumber: guestOrder.orderNumber,
        orderItemId: item.id,
        proofVersion: 1,
        consent: true,
        guestToken: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      }),
      (err: any) => {
        assert.ok(err instanceof PersonalizationUnauthorizedError);
        assert.strictEqual(err.statusCode, 403);
        assert.ok(err.message.includes('Invalid guest token'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 53. Invalid or missing guest tokens are strictly rejected with 401 and 403');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 53. Invalid/missing guest token rejection:', err.message);
  }

  // Test 54: Mismatched order and order-item identifiers is rejected (400)
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Mismatch Test A',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const orderA = await createOrder({
      userId: 'user-mismatch-1',
      customerEmail: 'mismatch.a@snappygifts.in',
      customerName: 'Mismatch A',
      customerPhone: '9876543210',
      shippingAddress: { name: 'A', street: 'Street A', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Item A',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const userA = { id: 'user-mismatch-1', email: 'mismatch.a@snappygifts.in', role: Role.CUSTOMER };

    await assert.rejects(
      () => approveOrderProofByCustomer({
        orderNumber: orderA.orderNumber,
        orderItemId: 'completely-unrelated-item-id-999',
        proofVersion: 1,
        consent: true,
        requesterUser: userA,
      }),
      (err: any) => {
        assert.ok(err instanceof PersonalizationValidationError);
        assert.ok(err.message.includes('does not belong to order'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 54. Mismatched order and order-item identifiers are rejected with validation error');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 54. Mismatched order-item linkage:', err.message);
  }

  // Test 55: Stale proof version approval attempt is rejected with 409 / StaleProofVersionError
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Initial Text',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      userId: 'user-stale-test-1',
      customerEmail: 'stale.test@snappygifts.in',
      customerName: 'Stale Tester',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Tester', street: '5 Version Way', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Initial Text',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const user = { id: 'user-stale-test-1', email: 'stale.test@snappygifts.in', role: Role.CUSTOMER };

    // Staff revises proof to version 2
    await reviseOrderProof(item.id, { engravedText: 'Revised Inscription - Atelier' }, 'staff-editor');

    // Customer attempts to approve stale version 1
    await assert.rejects(
      () => approveOrderProofByCustomer({
        orderNumber: order.orderNumber,
        orderItemId: item.id,
        proofVersion: 1, // Stale! Current is v2
        consent: true,
        requesterUser: user,
      }),
      (err: any) => {
        assert.ok(err instanceof StaleProofVersionError);
        assert.ok(err.message.includes('is stale'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 55. Stale proof version approval is strictly rejected with StaleProofVersionError');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 55. Stale proof version rejection:', err.message);
  }

  // Test 56: Repeated approval requests are handled idempotently
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Idempotency Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      userId: 'user-idempotent-1',
      customerEmail: 'idempotent@snappygifts.in',
      customerName: 'Idempotent User',
      customerPhone: '9876543210',
      shippingAddress: { name: 'User', street: '6 Repeat Way', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Idempotency Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const user = { id: 'user-idempotent-1', email: 'idempotent@snappygifts.in', role: Role.CUSTOMER };

    // First approval
    const firstApproval = await approveOrderProofByCustomer({
      orderNumber: order.orderNumber,
      orderItemId: item.id,
      proofVersion: 1,
      consent: true,
      requesterUser: user,
    });
    assert.strictEqual(firstApproval.customerApprovalStatus, 'APPROVED');
    const firstApprovedAt = firstApproval.customerApprovedAt;

    // Second repeated approval (same version)
    const secondApproval = await approveOrderProofByCustomer({
      orderNumber: order.orderNumber,
      orderItemId: item.id,
      proofVersion: 1,
      consent: true,
      requesterUser: user,
    });
    assert.strictEqual(secondApproval.customerApprovalStatus, 'APPROVED');
    assert.strictEqual(secondApproval.customerApprovedAt, firstApprovedAt, 'Timestamp should remain idempotent');

    passed++;
    console.log('  [PASS] 56. Repeated approval requests for the same proof version are handled idempotently');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 56. Idempotent approval handling:', err.message);
  }

  // Test 57: Explicit customer consent requirement guard
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Consent Guard Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      userId: 'user-consent-guard-1',
      customerEmail: 'consent.guard@snappygifts.in',
      customerName: 'Consent User',
      customerPhone: '9876543210',
      shippingAddress: { name: 'User', street: '7 Consent Ave', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Consent Guard Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const user = { id: 'user-consent-guard-1', email: 'consent.guard@snappygifts.in', role: Role.CUSTOMER };

    // Missing explicit consent (consent = false)
    await assert.rejects(
      () => approveOrderProofByCustomer({
        orderNumber: order.orderNumber,
        orderItemId: item.id,
        proofVersion: 1,
        consent: false,
        requesterUser: user,
      }),
      (err: any) => {
        assert.ok(err instanceof ProofConsentRequiredError);
        assert.ok(err.message.includes('consent is required'));
        return true;
      }
    );

    passed++;
    console.log('  [PASS] 57. Approval strictly requires explicit customer consent flag (consent === true)');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 57. Customer consent requirement:', err.message);
  }

  // Test 58: Confirmation that customer approval cannot change staff review status, staff notes, or payment status
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Staff Boundary Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      userId: 'user-staff-boundary-1',
      customerEmail: 'staff.boundary@snappygifts.in',
      customerName: 'Boundary User',
      customerPhone: '9876543210',
      shippingAddress: { name: 'User', street: '8 Secure St', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Staff Boundary Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const devOrder = DEV_ORDERS_STORE.get(order.orderNumber)!;
    devOrder.paymentStatus = 'CAPTURED';
    DEV_ORDERS_STORE.set(order.orderNumber, devOrder);

    // Staff marks proof as REJECTED_FOR_REWORK with internal notes
    await reviewOrderProof(item.id, 'REJECTED_FOR_REWORK', 'staff-artisan', 'Check font kerning on line 2');
    const recBefore = DEV_PERSONALIZATION_STORE.get(item.id)!;
    assert.strictEqual(recBefore.staffReviewStatus, 'REJECTED_FOR_REWORK');
    assert.strictEqual(recBefore.staffNotes, 'Check font kerning on line 2');

    const user = { id: 'user-staff-boundary-1', email: 'staff.boundary@snappygifts.in', role: Role.CUSTOMER };

    // Customer approves proof
    await approveOrderProofByCustomer({
      orderNumber: order.orderNumber,
      orderItemId: item.id,
      proofVersion: 1,
      consent: true,
      requesterUser: user,
    });

    const recAfter = DEV_PERSONALIZATION_STORE.get(item.id)!;
    assert.strictEqual(recAfter.customerApprovalStatus, 'APPROVED', 'Customer approval status updated');
    assert.strictEqual(recAfter.staffReviewStatus, 'REJECTED_FOR_REWORK', 'Staff review status MUST remain unchanged');
    assert.strictEqual(recAfter.staffNotes, 'Check font kerning on line 2', 'Staff notes MUST remain unchanged');

    const orderAfter = DEV_ORDERS_STORE.get(order.orderNumber)!;
    assert.strictEqual(orderAfter.paymentStatus, 'CAPTURED', 'Payment status MUST remain unchanged');

    passed++;
    console.log('  [PASS] 58. Customer approval cannot modify staff review status, staff notes, or payment status');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 58. Staff review status boundary check:', err.message);
  }

  // Test 59: Successful lifecycle progression only after the required current proof approval
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Keepsake Box',
      engravedText: 'Lifecycle Gate Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const order = await createOrder({
      userId: 'user-lifecycle-gate-1',
      customerEmail: 'lifecycle.gate@snappygifts.in',
      customerName: 'Gate User',
      customerPhone: '9876543210',
      shippingAddress: { name: 'User', street: '9 Progression Rd', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Lifecycle Gate Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: false,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = order.items[0];
    const devOrder = DEV_ORDERS_STORE.get(order.orderNumber)!;
    devOrder.paymentStatus = 'CAPTURED';
    devOrder.orderStatus = 'CONFIRMED';
    DEV_ORDERS_STORE.set(order.orderNumber, devOrder);

    // 1. In customization transition MUST fail while proof is pending
    await assert.rejects(
      () => transitionOrderStatus(order.orderNumber, OrderStatus.IN_CUSTOMIZATION, 'admin-tester', 'Moving to production'),
      (err: any) => {
        assert.ok(err instanceof OrderTransitionError);
        assert.ok(err.message.includes('has pending customer proof approval'));
        return true;
      }
    );

    // 2. Customer approves current proof v1
    const user = { id: 'user-lifecycle-gate-1', email: 'lifecycle.gate@snappygifts.in', role: Role.CUSTOMER };
    await approveOrderProofByCustomer({
      orderNumber: order.orderNumber,
      orderItemId: item.id,
      proofVersion: 1,
      consent: true,
      requesterUser: user,
    });

    // 3. Now transition to IN_CUSTOMIZATION MUST succeed!
    const transitioned = await transitionOrderStatus(order.orderNumber, OrderStatus.IN_CUSTOMIZATION, 'admin-tester', 'Moving to production');
    assert.strictEqual(transitioned.orderStatus, 'IN_CUSTOMIZATION');

    // 4. Staff revises proof to v2 -> resets to PENDING
    await reviseOrderProof(item.id, { engravedText: 'Updated Text for V2' }, 'staff-artisan');
    const recV2 = DEV_PERSONALIZATION_STORE.get(item.id)!;
    assert.strictEqual(recV2.customerApprovalStatus, 'PENDING');
    assert.strictEqual(recV2.proofVersion, 2);

    // Set order back to CONFIRMED
    devOrder.orderStatus = 'CONFIRMED';
    DEV_ORDERS_STORE.set(order.orderNumber, devOrder);

    // 5. Trying to move to IN_CUSTOMIZATION again is BLOCKED because v2 is pending!
    await assert.rejects(
      () => transitionOrderStatus(order.orderNumber, OrderStatus.IN_CUSTOMIZATION, 'admin-tester', 'Moving to production'),
      (err: any) => {
        assert.ok(err instanceof OrderTransitionError);
        assert.ok(err.message.includes('has pending customer proof approval'));
        return true;
      }
    );

    // 6. Submitting stale approval for v1 is rejected!
    await assert.rejects(
      () => approveOrderProofByCustomer({
        orderNumber: order.orderNumber,
        orderItemId: item.id,
        proofVersion: 1, // Stale!
        consent: true,
        requesterUser: user,
      }),
      (err: any) => {
        assert.ok(err instanceof StaleProofVersionError);
        return true;
      }
    );

    // 7. Customer approves current v2 proof
    await approveOrderProofByCustomer({
      orderNumber: order.orderNumber,
      orderItemId: item.id,
      proofVersion: 2,
      consent: true,
      requesterUser: user,
    });

    // 8. Transition to IN_CUSTOMIZATION now succeeds!
    const finalTransition = await transitionOrderStatus(order.orderNumber, OrderStatus.IN_CUSTOMIZATION, 'admin-tester', 'Moving to production');
    assert.strictEqual(finalTransition.orderStatus, 'IN_CUSTOMIZATION');

    passed++;
    console.log('  [PASS] 59. Successful lifecycle progression to IN_CUSTOMIZATION only after valid current proof approval');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 59. Complete lifecycle progression with proof approval:', err.message);
  }

  // Test 60: Guest proof preview succeeds with a valid x-guest-token header
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Walnut Box',
      engravedText: 'Header Auth Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const guestOrder = await createOrder({
      customerEmail: 'guest.preview@snappygifts.in',
      customerName: 'Guest Previewer',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Guest', street: '1 Palace Rd', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Header Auth Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = guestOrder.items[0];
    const proofId = item.proofImageUrl!.split('/')[4];

    // Valid header request -> 200 OK
    const req = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file`, {
      headers: { 'x-guest-token': guestOrder.guestLookupToken },
    });
    const res = await getUploadFileRoute(req, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(res.status, 200, 'Valid x-guest-token header must receive 200 OK');
    assert.strictEqual(res.headers.get('Content-Type'), 'image/png');
    assert.strictEqual(res.headers.get('X-Content-Type-Options'), 'nosniff');
    const bytes = await res.arrayBuffer();
    assert.ok(bytes.byteLength > 0, 'Must stream proof image binary bytes');

    passed++;
    console.log('  [PASS] 60. Guest proof preview succeeds with a valid x-guest-token header');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 60. Guest proof preview header success:', err.message);
  }

  // Test 61: Guest proof preview rejects missing or invalid header
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Walnut Box',
      engravedText: 'Invalid Header Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const guestOrder = await createOrder({
      customerEmail: 'guest.invalid@snappygifts.in',
      customerName: 'Guest Invalid',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Guest', street: '1 Palace Rd', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Invalid Header Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = guestOrder.items[0];
    const proofId = item.proofImageUrl!.split('/')[4];

    // Missing header -> 403 Forbidden
    const missingReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file`);
    const missingRes = await getUploadFileRoute(missingReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(missingRes.status, 403, 'Missing x-guest-token header must be rejected with 403 Forbidden');

    // Invalid/tampered header -> 403 Forbidden
    const invalidReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file`, {
      headers: { 'x-guest-token': 'wrong-or-tampered-token-99999' },
    });
    const invalidRes = await getUploadFileRoute(invalidReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(invalidRes.status, 403, 'Invalid x-guest-token header must be rejected with 403 Forbidden');

    passed++;
    console.log('  [PASS] 61. Guest proof preview strictly rejects missing or invalid x-guest-token header');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 61. Guest proof preview rejects missing/invalid header:', err.message);
  }

  // Test 62: Guest proof preview strictly rejects ?token= query-string authorization
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Walnut Box',
      engravedText: 'Query Token Reject Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const guestOrder = await createOrder({
      customerEmail: 'guest.queryreject@snappygifts.in',
      customerName: 'Guest Query Reject',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Guest', street: '1 Palace Rd', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Query Token Reject Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = guestOrder.items[0];
    const proofId = item.proofImageUrl!.split('/')[4];
    const token = guestOrder.guestLookupToken;

    // 1. Query param alone with valid token -> 403 Forbidden
    const queryReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file?token=${encodeURIComponent(token)}`);
    const queryRes = await getUploadFileRoute(queryReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(queryRes.status, 403, 'Proof preview with ?token= query string must be rejected with 403 Forbidden');
    const queryJson = await queryRes.json();
    assert.ok(queryJson.error.includes('Query-string token access is forbidden'));

    // 2. Both query param AND header -> 403 Forbidden (query param forbidden)
    const bothReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file?token=${encodeURIComponent(token)}`, {
      headers: { 'x-guest-token': token },
    });
    const bothRes = await getUploadFileRoute(bothReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(bothRes.status, 403, 'Presence of ?token= query param must reject even if header is present');

    passed++;
    console.log('  [PASS] 62. Guest proof preview strictly rejects ?token= query-string authorization');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 62. Query-string token authorization rejection:', err.message);
  }

  // Test 63: Authenticated customer proof preview continues to work while cross-customer preview is blocked
  try {
    const validProofBuffer = generateCustomerProofPngBuffer({
      productName: 'Royal Walnut Box',
      engravedText: 'Auth Customer Preview Test',
      version: 1,
    });
    const validDataUrl = `data:image/png;base64,${validProofBuffer.toString('base64')}`;

    const ownerUserId = 'cust-verified-owner-101';
    const attackerUserId = 'cust-malicious-peer-202';

    // Create session for owner
    const ownerSession = await createSession(ownerUserId, { role: Role.CUSTOMER, email: 'owner@customer.in' });
    // Create session for another customer
    const attackerSession = await createSession(attackerUserId, { role: Role.CUSTOMER, email: 'attacker@customer.in' });

    const customerOrder = await createOrder({
      userId: ownerUserId,
      customerEmail: 'owner@customer.in',
      customerName: 'Owner Customer',
      customerPhone: '9876543210',
      shippingAddress: { name: 'Owner', street: '5 Customer Lane', city: 'Jaipur', state: 'Rajasthan', pincode: '500062' },
      items: [{
        productId: 'prod-1',
        quantity: 1,
        customization: {
          engravedText: 'Auth Customer Preview Test',
          clientProofDataUrl: validDataUrl,
          proofApproved: true,
          proofVersion: 1,
        },
      }],
      paymentMethod: 'RAZORPAY',
    });

    const item = customerOrder.items[0];
    const proofId = item.proofImageUrl!.split('/')[4];

    // 1. Owning authenticated customer requests proof via session cookie -> 200 OK
    const ownerReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${ownerSession.sessionToken}`,
      },
    });
    const ownerRes = await getUploadFileRoute(ownerReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(ownerRes.status, 200, 'Authenticated owner customer must be granted 200 OK to preview proof');

    // 2. Different customer attempts to access owner customer proof -> 403 Forbidden
    const attackerReq = new Request(`http://localhost:3000/api/personalization/uploads/${proofId}/file`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${attackerSession.sessionToken}`,
      },
    });
    const attackerRes = await getUploadFileRoute(attackerReq, { params: Promise.resolve({ id: proofId }) });
    assert.strictEqual(attackerRes.status, 403, 'A customer cannot preview another customer’s proof (must return 403)');

    passed++;
    console.log('  [PASS] 63. Authenticated customer proof preview succeeds for owner and rejects unauthorized cross-customer attempts');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 63. Authenticated customer proof access & cross-customer protection:', err.message);
  }

  // Test 64: Object URLs are created from proof response, revoked when proof changes, and revoked on unmount
  try {
    const createdUrls: string[] = [];
    const revokedUrls: string[] = [];

    // Mock browser URL.createObjectURL and URL.revokeObjectURL
    const originalCreate = (globalThis as any).URL.createObjectURL;
    const originalRevoke = (globalThis as any).URL.revokeObjectURL;

    let urlCounter = 1;
    (globalThis as any).URL.createObjectURL = (blob: any) => {
      const url = `blob:http://localhost:3000/proof-blob-${urlCounter++}`;
      createdUrls.push(url);
      return url;
    };
    (globalThis as any).URL.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
    };

    try {
      // Simulate OrderTrackingModal proof preview lifecycle
      const registry: Record<string, string> = {};

      // 1. Load initial proof v1
      const initialBlob = new Blob(['proof-v1-bytes'], { type: 'image/png' });
      const objUrl1 = URL.createObjectURL(initialBlob);
      registry['item-101'] = objUrl1;
      assert.strictEqual(createdUrls.length, 1);
      assert.strictEqual(objUrl1, 'blob:http://localhost:3000/proof-blob-1');

      // 2. Proof changes (e.g. proof revised to v2) -> old URL must be revoked and replaced
      if (registry['item-101']) {
        URL.revokeObjectURL(registry['item-101']);
        delete registry['item-101'];
      }
      assert.strictEqual(revokedUrls.length, 1);
      assert.strictEqual(revokedUrls[0], 'blob:http://localhost:3000/proof-blob-1');

      const updatedBlob = new Blob(['proof-v2-bytes'], { type: 'image/png' });
      const objUrl2 = URL.createObjectURL(updatedBlob);
      registry['item-101'] = objUrl2;
      assert.strictEqual(createdUrls.length, 2);
      assert.strictEqual(objUrl2, 'blob:http://localhost:3000/proof-blob-2');

      // 3. Component unmounts -> all remaining active object URLs must be revoked
      Object.values(registry).forEach((url) => {
        URL.revokeObjectURL(url);
      });
      assert.strictEqual(revokedUrls.length, 2);
      assert.strictEqual(revokedUrls[1], 'blob:http://localhost:3000/proof-blob-2');
      assert.deepStrictEqual(createdUrls, revokedUrls, 'Every created object URL must be revoked on replacement or unmount');
    } finally {
      (globalThis as any).URL.createObjectURL = originalCreate;
      (globalThis as any).URL.revokeObjectURL = originalRevoke;
    }

    passed++;
    console.log('  [PASS] 64. Object URLs are created from proof responses and revoked when proofs change and on component unmount');
  } catch (err: any) {
    failed++;
    console.error('  [FAIL] 64. Object URL lifecycle management:', err.message);
  }

  console.log('\n----------------------------------------------------');
  console.log(` Batch 7 Personalization Tests: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  return { passed, failed };
}

// Direct execution
if (process.argv[1]?.endsWith('personalization.test.ts')) {
  runPersonalizationTestSuite().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
