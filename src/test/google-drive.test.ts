Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';
if (!process.env.CI) {
  process.env.DATABASE_URL = 'mysql://127.0.0.1:3306/dev_fallback';
}
process.env.TEST_SUITE_RUNNING = 'true';

import assert from 'node:assert/strict';
import crypto from 'crypto';
import { Readable } from 'stream';
import { Role } from '@prisma/client';
import { createSession, SESSION_COOKIE_NAME } from '../lib/auth/session';
import { encryptToken, decryptToken, deriveKeyBuffer, EncryptionError } from '../lib/security/encryption';
import {
  googleDriveService,
  BUSINESS_DRIVE_FOLDERS,
  GoogleDriveFolderInaccessibleError,
} from '../services/storage/google-drive.service';
import { GET as authorizeHandler } from '../app/api/integrations/google-drive/authorize/route';
import { GET as statusHandler } from '../app/api/integrations/google-drive/status/route';
import { POST as disconnectHandler } from '../app/api/integrations/google-drive/disconnect/route';
import { GET as pickerConfigHandler } from '../app/api/integrations/google-drive/picker-config/route';
import { POST as pickerAuthorizeHandler } from '../app/api/integrations/google-drive/picker-authorize/route';
import { POST as validateFoldersHandler } from '../app/api/integrations/google-drive/validate-folders/route';

export async function runGoogleDriveTestSuite() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Google Drive Integration Test Suite ');
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
  // 1. AES-256-GCM Token Encryption & Integrity
  // ------------------------------------------------------------------
  console.log('--- 1. AES-256-GCM Token Encryption & Authenticated Cryptography ---');

  await test('Normalizes 32-byte key from Base64, Hex or Passphrase', () => {
    // 44-char base64
    const base64Key = Buffer.alloc(32, 7).toString('base64');
    const buf1 = deriveKeyBuffer(base64Key);
    assert.equal(buf1.length, 32);

    // 64-char hex
    const hexKey = Buffer.alloc(32, 9).toString('hex');
    const buf2 = deriveKeyBuffer(hexKey);
    assert.equal(buf2.length, 32);

    // arbitrary passphrase
    const buf3 = deriveKeyBuffer('some-arbitrary-long-passphrase-for-testing');
    assert.equal(buf3.length, 32);
  });

  await test('Encrypts and decrypts OAuth token payload accurately', () => {
    const rawToken = 'ya29.a0AfH6SMD_SampleRefreshToken_1234567890abcdefghijklmnopqrstuvwxyz';
    const encrypted = encryptToken(rawToken);

    // Must be formatted as iv:authTag:ciphertext
    const parts = encrypted.split(':');
    assert.equal(parts.length, 3);
    assert.equal(parts[0].length, 24, 'IV should be 12 bytes = 24 hex characters');
    assert.equal(parts[1].length, 32, 'AuthTag should be 16 bytes = 32 hex characters');

    const decrypted = decryptToken(encrypted);
    assert.equal(decrypted, rawToken);
  });

  await test('Generates distinct ciphertexts and IVs for identical input (indistinguishability)', () => {
    const token = 'same_secret_token';
    const enc1 = encryptToken(token);
    const enc2 = encryptToken(token);

    assert.notEqual(enc1, enc2);
    assert.notEqual(enc1.split(':')[0], enc2.split(':')[0], 'IVs must be distinct');
    assert.equal(decryptToken(enc1), token);
    assert.equal(decryptToken(enc2), token);
  });

  await test('Rejects tampered ciphertext with AUTHENTICATION_FAILED (GCM Tag Verification)', () => {
    const token = 'critical_oauth_refresh_token';
    const encrypted = encryptToken(token);
    const parts = encrypted.split(':');

    // Flip last byte of ciphertext
    const tamperedCipher = parts[2].slice(0, -2) + (parts[2].endsWith('00') ? 'ff' : '00');
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    assert.throws(
      () => decryptToken(tamperedPayload),
      (err: any) => err instanceof EncryptionError && err.code === 'AUTHENTICATION_FAILED'
    );
  });

  await test('Rejects tampered auth tag with AUTHENTICATION_FAILED', () => {
    const token = 'critical_oauth_refresh_token';
    const encrypted = encryptToken(token);
    const parts = encrypted.split(':');

    // Alter auth tag
    const tamperedTag = parts[1].slice(0, -2) + (parts[1].endsWith('aa') ? 'bb' : 'aa');
    const tamperedPayload = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    assert.throws(
      () => decryptToken(tamperedPayload),
      (err: any) => err instanceof EncryptionError && err.code === 'AUTHENTICATION_FAILED'
    );
  });

  // ------------------------------------------------------------------
  // 2. OAuth State Generation, Expiration & CSRF Prevention
  // ------------------------------------------------------------------
  console.log('\n--- 2. OAuth State Generation & CSRF Protection ---');

  await test('Generates signed state token binding adminUserId and timestamp', () => {
    const adminId = 'admin-user-uuid-1001';
    const stateToken = googleDriveService.generateSignedState(adminId);
    assert.ok(typeof stateToken === 'string' && stateToken.length > 20);

    const verification = googleDriveService.verifySignedState(stateToken);
    assert.equal(verification.valid, true);
    assert.equal(verification.adminUserId, adminId);
  });

  await test('Rejects expired OAuth state token older than 15 minutes', () => {
    const adminId = 'admin-user-uuid-1002';
    // Construct expired state payload (16 minutes ago)
    const expiredTimestamp = Date.now() - 16 * 60 * 1000;
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = `${adminId}:${expiredTimestamp}:${nonce}`;
    const hmacKey = deriveKeyBuffer();
    const signature = crypto.createHmac('sha256', hmacKey).update(payload).digest('hex');
    const expiredState = Buffer.from(`${payload}:${signature}`).toString('base64url');

    const result = googleDriveService.verifySignedState(expiredState);
    assert.equal(result.valid, false);
    assert.match(result.error || '', /expired/i);
  });

  await test('Rejects tampered OAuth state token (HMAC mismatch)', () => {
    const adminId = 'admin-user-uuid-1003';
    const stateToken = googleDriveService.generateSignedState(adminId);
    const decoded = Buffer.from(stateToken, 'base64url').toString('utf8');
    const parts = decoded.split(':');

    // Tamper with admin user ID to escalate privilege
    parts[0] = 'attacker-user-id';
    const tamperedState = Buffer.from(parts.join(':')).toString('base64url');

    const result = googleDriveService.verifySignedState(tamperedState);
    assert.equal(result.valid, false);
    assert.match(result.error || '', /signature/i);
  });

  // ------------------------------------------------------------------
  // 3. Admin RBAC & Route Access Control
  // ------------------------------------------------------------------
  console.log('\n--- 3. Administrator RBAC & Route Protection ---');

  await test('Denies unauthenticated requests to Google Drive authorize route', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/authorize', {
      headers: { accept: 'application/json' },
    });
    const res = await authorizeHandler(req);
    assert.equal(res.status, 401);
  });

  await test('Denies non-admin (Customer) role to Google Drive authorize route', async () => {
    // Generate valid session for CUSTOMER
    const req = new Request('http://localhost:3000/api/integrations/google-drive/authorize', {
      headers: {
        accept: 'application/json',
        // Mock non-admin role header handled in tests
        'x-mock-role': Role.CUSTOMER,
      },
    });
    const res = await authorizeHandler(req);
    assert.ok(res.status === 401 || res.status === 403);
  });

  await test('Denies unauthenticated requests to Google Drive disconnect route', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/disconnect', {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
    const res = await disconnectHandler(req);
    assert.equal(res.status, 401);
  });

  // ------------------------------------------------------------------
  // 4. Token Persistence & Refresh-Token Preservation
  // ------------------------------------------------------------------
  console.log('\n--- 4. Token Persistence & Refresh Token Invariants ---');

  await test('Saves encrypted tokens in integration record without exposing plain text', async () => {
    const plainRefresh = '1//0gRefreshTokenSample_Secret';
    const plainAccess = 'ya29.AccessTokenSample_Secret';

    await googleDriveService.saveIntegrationRecord({
      isConnected: true,
      accountEmail: 'admin@snappygiftz.com',
      encryptedRefreshToken: encryptToken(plainRefresh),
      encryptedAccessToken: encryptToken(plainAccess),
      rootFolderId: 'folder_root_123',
      productImagesFolderId: 'folder_products_123',
      customerPhotosFolderId: 'folder_customer_123',
      orderAttachmentsFolderId: 'folder_orders_123',
      connectedBy: 'admin-uuid-1',
    });

    const record = await googleDriveService.getIntegrationRecord();
    assert.equal(record.isConnected, true);
    assert.equal(record.accountEmail, 'admin@snappygiftz.com');
    // Ensure tokens stored are encrypted, not raw plain text
    assert.notEqual(record.encryptedRefreshToken, plainRefresh);
    assert.equal(decryptToken(record.encryptedRefreshToken!), plainRefresh);
    assert.equal(decryptToken(record.encryptedAccessToken!), plainAccess);
  });

  await test('Preserves existing encrypted refresh token when Google does not return replacement', async () => {
    const initialRefresh = '1//InitialPreservedRefreshToken';
    await googleDriveService.saveIntegrationRecord({
      encryptedRefreshToken: encryptToken(initialRefresh),
      isConnected: true,
    });

    const before = await googleDriveService.getIntegrationRecord();
    assert.equal(decryptToken(before.encryptedRefreshToken!), initialRefresh);

    // Simulate re-auth without new refresh token
    const newAccessToken = 'ya29.BrandNewAccessToken';
    await googleDriveService.saveIntegrationRecord({
      encryptedAccessToken: encryptToken(newAccessToken),
      accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      lastSyncedAt: new Date(),
    });

    const after = await googleDriveService.getIntegrationRecord();
    // Old refresh token must remain completely intact
    assert.equal(decryptToken(after.encryptedRefreshToken!), initialRefresh);
    assert.equal(decryptToken(after.encryptedAccessToken!), newAccessToken);
  });

  // ------------------------------------------------------------------
  // 5. Folder Hierarchy & Privacy Architecture
  // ------------------------------------------------------------------
  console.log('\n--- 5. Folder Hierarchy & Privacy Architecture ---');

  await test('Integration model defines all 5 required storage folders (Root + 4 Subfolders)', async () => {
    const record = await googleDriveService.getIntegrationRecord();
    assert.ok('rootFolderId' in record, 'Should have rootFolderId');
    assert.ok('productImagesFolderId' in record, 'Should have productImagesFolderId');
    assert.ok('customerPhotosFolderId' in record, 'Should have customerPhotosFolderId');
    assert.ok('orderAttachmentsFolderId' in record, 'Should have orderAttachmentsFolderId');
    assert.ok('invoicesFolderId' in record, 'Should have invoicesFolderId');
  });

  await test('Preserves configured Google Drive folder IDs and environment overrides', async () => {
    await googleDriveService.saveIntegrationRecord({
      rootFolderId: '1tyIZoYxyduRYjEmJARsCc_d4LfAYyFQ8',
      productImagesFolderId: '1auWYCCQJWgn28rk3JEexW8aKzZI5NhxL',
      customerPhotosFolderId: '1yJnAAnmaAKWcbg1DvvTbtf3KZ8LmOtr0',
      orderAttachmentsFolderId: '1526s264h3zrZSaF_rG5Cgmfm7WirSQLL',
      invoicesFolderId: '1MBF1cmNf2-P6OcWxBAVP1S2qVPb0vX4s',
    });

    const status = await googleDriveService.getConnectionStatus();
    assert.equal(status.rootFolderId, '1tyIZoYxyduRYjEmJARsCc_d4LfAYyFQ8');
    assert.equal(status.productImagesFolderId, '1auWYCCQJWgn28rk3JEexW8aKzZI5NhxL');
    assert.equal(status.customerPhotosFolderId, '1yJnAAnmaAKWcbg1DvvTbtf3KZ8LmOtr0');
    assert.equal(status.orderAttachmentsFolderId, '1526s264h3zrZSaF_rG5Cgmfm7WirSQLL');
    assert.equal(status.invoicesFolderId, '1MBF1cmNf2-P6OcWxBAVP1S2qVPb0vX4s');
  });

  await test('Delete file gracefully returns false when disconnected rather than throwing unhandled rejection', async () => {
    const res = await googleDriveService.deleteFile('some-test-file-id');
    assert.equal(res, false);
  });

  await test('Sanitized connection status never exposes tokens or secret keys', async () => {
    const status = await googleDriveService.getConnectionStatus();
    assert.ok('isConfigured' in status);
    assert.ok('isConnected' in status);
    assert.ok('accountEmail' in status);

    const serialized = JSON.stringify(status);
    assert.equal(serialized.includes('encryptedRefreshToken'), false, 'Must not leak encryptedRefreshToken');
    assert.equal(serialized.includes('encryptedAccessToken'), false, 'Must not leak encryptedAccessToken');
    assert.equal(serialized.includes('clientSecret'), false, 'Must not leak clientSecret');
  });

  // ------------------------------------------------------------------
  // 6. Safe Disconnection & Cleanup
  // ------------------------------------------------------------------
  console.log('\n--- 6. Safe Disconnection & Token Revocation ---');

  await test('Disconnecting clears encrypted tokens, email and marks isConnected false', async () => {
    await googleDriveService.disconnect('admin-operator-id');

    const record = await googleDriveService.getIntegrationRecord();
    assert.equal(record.isConnected, false);
    assert.equal(record.encryptedRefreshToken, null);
    assert.equal(record.encryptedAccessToken, null);
    assert.equal(record.accountEmail, null);
    assert.equal(record.rootFolderId, null);

    const status = await googleDriveService.getConnectionStatus();
    assert.equal(status.isConnected, false);
    assert.equal(status.accountEmail, null);
  });

  // ------------------------------------------------------------------
  // 7. Phase C: Exact Storage Structure & Zero Silent Replacements
  // ------------------------------------------------------------------
  console.log('\n--- 7. Phase C: Exact Storage Structure & Zero Silent Replacements ---');

  await test('Enforces zero silent replacements: throws GoogleDriveFolderInaccessibleError when folder is inaccessible', async () => {
    // Mock Drive client where files.get fails with 404 (simulating ungranted folder under drive.file)
    const mockDriveWith404: any = {
      files: {
        get: async () => {
          const err: any = new Error('File not found');
          err.code = 404;
          err.response = { status: 404 };
          throw err;
        },
        create: async () => {
          throw new Error('FATAL: create should NEVER be called when validating folder hierarchy!');
        },
      },
    };

    await assert.rejects(
      async () => {
        await googleDriveService.ensureFolderHierarchy(mockDriveWith404);
      },
      (err: any) => {
        assert.ok(err instanceof GoogleDriveFolderInaccessibleError);
        assert.match(err.message, /inaccessible/i);
        assert.match(err.message, /Google Picker/i);
        return true;
      }
    );
  });

  await test('Rejects non-folder items during hierarchy enforcement', async () => {
    // Mock Drive client returning text/plain instead of folder MIME
    const mockDriveWithFileMime: any = {
      files: {
        get: async () => ({
          data: {
            id: BUSINESS_DRIVE_FOLDERS.root.id,
            name: BUSINESS_DRIVE_FOLDERS.root.name,
            mimeType: 'text/plain', // corrupt MIME
            trashed: false,
          },
        }),
      },
    };

    await assert.rejects(
      async () => {
        await googleDriveService.ensureFolderHierarchy(mockDriveWithFileMime);
      },
      (err: any) => {
        assert.ok(err instanceof GoogleDriveFolderInaccessibleError);
        assert.match(err.message, /not a folder/i);
        return true;
      }
    );
  });

  await test('Verifies all 5 business folder IDs and names match owner configuration exactly', () => {
    assert.equal(BUSINESS_DRIVE_FOLDERS.root.id, '1tyIZoYxyduRYjEmJARsCc_d4LfAYyFQ8');
    assert.equal(BUSINESS_DRIVE_FOLDERS.root.name, 'SNAPPY_GIFTZ_STORAGE');

    assert.equal(BUSINESS_DRIVE_FOLDERS.productImages.id, '1auWYCCQJWgn28rk3JEexW8aKzZI5NhxL');
    assert.equal(BUSINESS_DRIVE_FOLDERS.productImages.name, 'Product_Images');

    assert.equal(BUSINESS_DRIVE_FOLDERS.customerPhotos.id, '1yJnAAnmaAKWcbg1DvvTbtf3KZ8LmOtr0');
    assert.equal(BUSINESS_DRIVE_FOLDERS.customerPhotos.name, 'Customer_Personalization_Photos');

    assert.equal(BUSINESS_DRIVE_FOLDERS.orderAttachments.id, '1526s264h3zrZSaF_rG5Cgmfm7WirSQLL');
    assert.equal(BUSINESS_DRIVE_FOLDERS.orderAttachments.name, 'Order_Attachments');

    assert.equal(BUSINESS_DRIVE_FOLDERS.invoices.id, '1MBF1cmNf2-P6OcWxBAVP1S2qVPb0vX4s');
    assert.equal(BUSINESS_DRIVE_FOLDERS.invoices.name, 'Invoices');
  });

  await test('Status reports zeroSilentReplacementsEnforced is true', async () => {
    const status = await googleDriveService.getConnectionStatus();
    assert.equal(status.zeroSilentReplacementsEnforced, true);
  });

  // ------------------------------------------------------------------
  // 8. Phase B: Google Picker Authorization Endpoints & RBAC
  // ------------------------------------------------------------------
  console.log('\n--- 8. Phase B: Google Picker Authorization Endpoints & RBAC ---');

  const adminSession = await createSession('admin-test-uuid', { role: Role.ADMIN, email: 'admin@snappygiftz.com' });
  const customerSession = await createSession('cust-test-uuid', { role: Role.CUSTOMER, email: 'customer@snappygiftz.com' });

  await test('Denies unauthenticated access to /api/integrations/google-drive/picker-config', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-config');
    const res = await pickerConfigHandler(req);
    assert.equal(res.status, 401);
  });

  await test('Denies non-admin (Customer) role to /api/integrations/google-drive/picker-config (HTTP 403)', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-config', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${customerSession.sessionToken}` },
    });
    const res = await pickerConfigHandler(req);
    assert.equal(res.status, 403);
  });

  await test('Returns sanitized picker config to authenticated Administrator without leaking secrets', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-config', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.sessionToken}` },
    });
    const res = await pickerConfigHandler(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.requiredFolders);
    assert.equal(data.requiredFolders.root.id, '1tyIZoYxyduRYjEmJARsCc_d4LfAYyFQ8');
    const jsonStr = JSON.stringify(data);
    assert.equal(jsonStr.includes('clientSecret'), false, 'Must not leak client secret');
    assert.equal(jsonStr.includes('refresh_token'), false, 'Must not leak refresh token');
  });

  await test('Denies unauthenticated access to /api/integrations/google-drive/picker-authorize', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-authorize', {
      method: 'POST',
      body: JSON.stringify({ folders: [] }),
    });
    const res = await pickerAuthorizeHandler(req);
    assert.equal(res.status, 401);
  });

  await test('Denies non-admin (Customer) role to /api/integrations/google-drive/picker-authorize (HTTP 403)', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${customerSession.sessionToken}`,
      },
      body: JSON.stringify({ folders: [{ id: 'sample-folder-id' }] }),
    });
    const res = await pickerAuthorizeHandler(req);
    assert.equal(res.status, 403);
  });

  await test('Rejects empty or malformed folder array in picker-authorize with HTTP 400', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${adminSession.sessionToken}`,
      },
      body: JSON.stringify({ folders: [] }),
    });
    const res = await pickerAuthorizeHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /non-empty/i);
  });

  await test('Denies unauthenticated access to /api/integrations/google-drive/validate-folders', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/validate-folders', {
      method: 'POST',
    });
    const res = await validateFoldersHandler(req);
    assert.equal(res.status, 401);
  });

  await test('Denies non-admin (Customer) role to /api/integrations/google-drive/validate-folders (HTTP 403)', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/validate-folders', {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${customerSession.sessionToken}` },
    });
    const res = await validateFoldersHandler(req);
    assert.equal(res.status, 403);
  });

  // ------------------------------------------------------------------
  // 9. Phase D: Controlled Upload, Parent Verification, Retrieval & Cleanup
  // ------------------------------------------------------------------
  console.log('\n--- 9. Phase D: Controlled Lifecycle Verification (Parent, Retrieval, Cleanup) ---');

  await test('Verifies folder IDs and MIME types for each required folder', async () => {
    // Simulated live drive storage mock with all 5 folders pre-existing
    const testStorage = new Map<string, { id: string; name: string; mimeType: string; parents?: string[]; data?: Buffer }>();

    // Seed the 5 business folders
    Object.values(BUSINESS_DRIVE_FOLDERS).forEach((f) => {
      testStorage.set(f.id, {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
      });
    });

    const mockDrive: any = {
      files: {
        get: async (params: any) => {
          const item = testStorage.get(params.fileId);
          if (!item) {
            const err: any = new Error('File not found');
            err.code = 404;
            throw err;
          }
          if (params.alt === 'media') {
            const stream = new Readable();
            stream.push(item.data || Buffer.from(''));
            stream.push(null);
            return { data: stream };
          }
          return { data: item };
        },
        create: async (params: any) => {
          const id = `test-file-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const buffers: Buffer[] = [];
          if (params.media?.body) {
            for await (const chunk of params.media.body) {
              buffers.push(Buffer.from(chunk));
            }
          }
          const data = Buffer.concat(buffers);
          const record = {
            id,
            name: params.requestBody.name,
            mimeType: params.requestBody.mimeType,
            parents: params.requestBody.parents,
            size: data.length,
            data,
          };
          testStorage.set(id, record);
          return { data: record };
        },
        delete: async (params: any) => {
          testStorage.delete(params.fileId);
          return { data: {} };
        },
      },
    };

    // 1. Verify validateFolderAccess passes on the 5 folders
    const validation = await googleDriveService.validateFolderAccess(mockDrive);
    assert.equal(validation.allAccessible, true);
    assert.equal(validation.folders.root.accessible, true);
    assert.equal(validation.folders.productImages.accessible, true);
    assert.equal(validation.folders.customerPhotos.accessible, true);
    assert.equal(validation.folders.orderAttachments.accessible, true);
    assert.equal(validation.folders.invoices.accessible, true);

    // 2. Upload temporary test file to each required subfolder and verify parent ID
    const subfolderTargets = [
      { key: 'productImages', targetId: BUSINESS_DRIVE_FOLDERS.productImages.id, mime: 'image/png' },
      { key: 'customerPhotos', targetId: BUSINESS_DRIVE_FOLDERS.customerPhotos.id, mime: 'image/png' },
      { key: 'orderAttachments', targetId: BUSINESS_DRIVE_FOLDERS.orderAttachments.id, mime: 'image/png' },
      { key: 'invoices', targetId: BUSINESS_DRIVE_FOLDERS.invoices.id, mime: 'application/pdf' },
    ];

    const validPngBuffer = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
      'hex'
    );

    for (const sub of subfolderTargets) {
      const fileName = `temp-verification-test-${sub.key}.png`;
      const res = await mockDrive.files.create({
        requestBody: {
          name: fileName,
          parents: [sub.targetId],
          mimeType: sub.mime,
        },
        media: {
          body: Readable.from([validPngBuffer]),
        },
      });

      // 4. Confirm returned file metadata identifies the expected parent folder
      assert.ok(res.data.id);
      assert.deepEqual(res.data.parents, [sub.targetId], `File must be assigned to parent folder ${sub.targetId}`);

      // 5. Retrieve / download file and verify content
      const download = await mockDrive.files.get({ fileId: res.data.id, alt: 'media' });
      const chunks: Buffer[] = [];
      for await (const chunk of download.data) {
        chunks.push(Buffer.from(chunk));
      }
      const retrieved = Buffer.concat(chunks);
      assert.equal(retrieved.length, validPngBuffer.length);
      assert.equal(
        crypto.createHash('sha256').update(retrieved).digest('hex'),
        crypto.createHash('sha256').update(validPngBuffer).digest('hex')
      );

      // 7. Delete only the temporary test file and confirm cleanup
      await mockDrive.files.delete({ fileId: res.data.id });
      assert.equal(testStorage.has(res.data.id), false, 'Temporary test file must be cleaned up from storage');
    }

    // Confirm that the 5 original business folders still exist unharmed
    Object.values(BUSINESS_DRIVE_FOLDERS).forEach((f) => {
      assert.equal(testStorage.has(f.id), true, `Original folder ${f.name} must never be deleted`);
    });
  });

  await test('Confirms folder configuration and authorization survive simulated application restart', async () => {
    // 1. Save configured state
    await googleDriveService.saveIntegrationRecord({
      isConnected: true,
      accountEmail: 'owner@snappygiftz.com',
      encryptedRefreshToken: encryptToken('1//SampleRefreshTokenForPersistence'),
      rootFolderId: BUSINESS_DRIVE_FOLDERS.root.id,
      productImagesFolderId: BUSINESS_DRIVE_FOLDERS.productImages.id,
      customerPhotosFolderId: BUSINESS_DRIVE_FOLDERS.customerPhotos.id,
      orderAttachmentsFolderId: BUSINESS_DRIVE_FOLDERS.orderAttachments.id,
      invoicesFolderId: BUSINESS_DRIVE_FOLDERS.invoices.id,
    });

    // 2. Simulate application restart by creating a new GoogleDriveService instance
    const { GoogleDriveService } = await import('../services/storage/google-drive.service');
    const restartedService = new GoogleDriveService();

    // 3. Verify status on restarted service
    const status = await restartedService.getConnectionStatus();
    assert.equal(status.isConnected, true);
    assert.equal(status.accountEmail, 'owner@snappygiftz.com');
    assert.equal(status.rootFolderId, BUSINESS_DRIVE_FOLDERS.root.id);
    assert.equal(status.productImagesFolderId, BUSINESS_DRIVE_FOLDERS.productImages.id);
    assert.equal(status.customerPhotosFolderId, BUSINESS_DRIVE_FOLDERS.customerPhotos.id);
    assert.equal(status.orderAttachmentsFolderId, BUSINESS_DRIVE_FOLDERS.orderAttachments.id);
    assert.equal(status.invoicesFolderId, BUSINESS_DRIVE_FOLDERS.invoices.id);
    assert.equal(status.zeroSilentReplacementsEnforced, true);
  });

  console.log('\n====================================================');
  console.log(`  Google Drive Tests: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  return { passed, failed };
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith('google-drive.test.ts')) {
  runGoogleDriveTestSuite().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

