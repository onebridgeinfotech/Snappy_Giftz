import assert from 'node:assert/strict';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import { encryptToken, decryptToken, deriveKeyBuffer, EncryptionError } from '../lib/security/encryption';
import { googleDriveService } from '../services/storage/google-drive.service';
import { GET as authorizeHandler } from '../app/api/integrations/google-drive/authorize/route';
import { GET as statusHandler } from '../app/api/integrations/google-drive/status/route';
import { POST as disconnectHandler } from '../app/api/integrations/google-drive/disconnect/route';

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

