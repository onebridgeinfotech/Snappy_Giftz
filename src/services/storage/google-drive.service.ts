import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { encryptToken, decryptToken, deriveKeyBuffer } from '@/lib/security/encryption';
import { verifyImageMagicBytes, StorageValidationError } from './local-storage.service';

export interface GoogleDriveConfigStatus {
  isConfigured: boolean;
  isConnected: boolean;
  accountEmail?: string | null;
  rootFolderId?: string | null;
  productImagesFolderId?: string | null;
  customerPhotosFolderId?: string | null;
  orderAttachmentsFolderId?: string | null;
  invoicesFolderId?: string | null;
  connectedAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
}

export interface GoogleDriveUploadInput {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  folderType: 'product' | 'customer' | 'attachment' | 'invoice';
}

export interface GoogleDriveUploadResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string;
  webViewLink?: string;
  webContentLink?: string;
}

// In-memory fallback state for when database is offline or unmigrated in dev/test
interface DriveIntegrationRecord {
  id: string;
  isConnected: boolean;
  accountEmail: string | null;
  encryptedRefreshToken: string | null;
  encryptedAccessToken: string | null;
  accessTokenExpiresAt: Date | null;
  rootFolderId: string | null;
  productImagesFolderId: string | null;
  customerPhotosFolderId: string | null;
  orderAttachmentsFolderId: string | null;
  invoicesFolderId: string | null;
  connectedBy: string | null;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

let devDriveIntegrationState: DriveIntegrationRecord = {
  id: 'default',
  isConnected: false,
  accountEmail: null,
  encryptedRefreshToken: null,
  encryptedAccessToken: null,
  accessTokenExpiresAt: null,
  rootFolderId: null,
  productImagesFolderId: null,
  customerPhotosFolderId: null,
  orderAttachmentsFolderId: null,
  invoicesFolderId: null,
  connectedBy: null,
  connectedAt: null,
  lastSyncedAt: null,
  lastError: null,
};

export class GoogleDriveService {
  private readonly ROOT_FOLDER_NAME = 'SNAPPY_GIFTZ_STORAGE';
  private readonly FOLDER_PRODUCT_IMAGES = 'Product_Images';
  private readonly FOLDER_CUSTOMER_PHOTOS = 'Customer_Personalization_Photos';
  private readonly FOLDER_ORDER_ATTACHMENTS = 'Order_Attachments';
  private readonly FOLDER_INVOICES = 'Invoices';

  /**
   * Resolves the configured OAuth2 credentials.
   * Prioritizes GOOGLE_DRIVE_* specific variables, cleanly falling back to general GOOGLE_* variables.
   */
  private getCredentials() {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri =
      process.env.GOOGLE_DRIVE_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://snappygiftz.com'}/api/integrations/google-drive/callback`;

    return {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: redirectUri.trim(),
      isConfigured: Boolean(clientId.trim() && clientSecret.trim()),
    };
  }

  /**
   * Creates an instance of google.auth.OAuth2.
   */
  createOAuth2Client(customRedirectUri?: string) {
    const creds = this.getCredentials();
    return new google.auth.OAuth2(
      creds.clientId,
      creds.clientSecret,
      customRedirectUri || creds.redirectUri
    );
  }

  /**
   * Generates a cryptographically signed OAuth state to prevent CSRF attacks.
   * Contains adminUserId, random nonce, and 15-minute expiration timestamp.
   */
  generateSignedState(adminUserId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const payload = `${adminUserId}:${timestamp}:${nonce}`;
    const hmacKey = deriveKeyBuffer();
    const signature = crypto.createHmac('sha256', hmacKey).update(payload).digest('hex');

    return Buffer.from(`${payload}:${signature}`).toString('base64url');
  }

  /**
   * Verifies and extracts the payload from a signed OAuth state.
   * Enforces 15-minute expiration window and HMAC signature verification.
   */
  verifySignedState(stateToken: string): { valid: boolean; adminUserId?: string; error?: string } {
    try {
      const decoded = Buffer.from(stateToken, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 4) {
        return { valid: false, error: 'Malformed OAuth state token.' };
      }

      const [adminUserId, timestampStr, nonce, signature] = parts;
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) {
        return { valid: false, error: 'Invalid state timestamp.' };
      }

      // Check 15-minute expiration window
      const fifteenMinutesMs = 15 * 60 * 1000;
      if (Date.now() - timestamp > fifteenMinutesMs) {
        return { valid: false, error: 'OAuth state token has expired. Please initiate connection again.' };
      }

      // Recompute and verify HMAC signature with constant-time comparison
      const payload = `${adminUserId}:${timestampStr}:${nonce}`;
      const hmacKey = deriveKeyBuffer();
      const expectedSignature = crypto.createHmac('sha256', hmacKey).update(payload).digest('hex');

      const bufA = Buffer.from(signature, 'hex');
      const bufB = Buffer.from(expectedSignature, 'hex');
      if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
        return { valid: false, error: 'OAuth state cryptographic signature verification failed.' };
      }

      return { valid: true, adminUserId };
    } catch (err: any) {
      return { valid: false, error: 'Failed to verify OAuth state token: ' + err.message };
    }
  }

  /**
   * Generates Google OAuth authorization URL for Admin consent.
   */
  generateAuthUrl(adminUserId: string, customRedirectUri?: string): string {
    const creds = this.getCredentials();
    if (!creds.isConfigured) {
      throw new Error('Google Drive Client ID and Client Secret must be configured in environment variables.');
    }

    const oauth2Client = this.createOAuth2Client(customRedirectUri);
    const state = this.generateSignedState(adminUserId);

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Mandate consent to guarantee refresh_token delivery
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });
  }

  /**
   * Retrieves the integration record from MySQL, falling back to in-memory store if DB is offline.
   */
  async getIntegrationRecord(): Promise<DriveIntegrationRecord> {
    try {
      const record = await (prisma as any).googleDriveIntegration.findUnique({
        where: { id: 'default' },
      });
      if (record) return record;
    } catch {
      // Fallback for offline or unmigrated DB
    }
    return { ...devDriveIntegrationState };
  }

  /**
   * Updates the integration record in MySQL and mirrors in in-memory fallback.
   */
  async saveIntegrationRecord(data: Partial<DriveIntegrationRecord>): Promise<DriveIntegrationRecord> {
    devDriveIntegrationState = {
      ...devDriveIntegrationState,
      ...data,
      updatedAt: new Date(),
    } as DriveIntegrationRecord;

    try {
      const record = await (prisma as any).googleDriveIntegration.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          isConnected: data.isConnected ?? false,
          accountEmail: data.accountEmail ?? null,
          encryptedRefreshToken: data.encryptedRefreshToken ?? null,
          encryptedAccessToken: data.encryptedAccessToken ?? null,
          accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
          rootFolderId: data.rootFolderId ?? null,
          productImagesFolderId: data.productImagesFolderId ?? null,
          customerPhotosFolderId: data.customerPhotosFolderId ?? null,
          orderAttachmentsFolderId: data.orderAttachmentsFolderId ?? null,
          invoicesFolderId: data.invoicesFolderId ?? null,
          connectedBy: data.connectedBy ?? null,
          connectedAt: data.connectedAt ?? new Date(),
          lastSyncedAt: data.lastSyncedAt ?? new Date(),
          lastError: data.lastError ?? null,
        },
        update: {
          ...data,
          updatedAt: new Date(),
        },
      });
      return record;
    } catch {
      // Return mirrored memory record if DB throws
      return { ...devDriveIntegrationState };
    }
  }

  /**
   * Processes OAuth callback: exchanges authorization code, encrypts tokens,
   * derives user email, initializes Drive folder hierarchy, and persists state.
   */
  async handleCallback(code: string, adminUserId: string, customRedirectUri?: string): Promise<DriveIntegrationRecord> {
    const oauth2Client = this.createOAuth2Client(customRedirectUri);

    // 1. Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token) {
      throw new Error('Google OAuth token exchange failed: No access token received.');
    }

    // 2. Refresh Token Handling:
    // If a new refresh token is issued, encrypt it. If not (re-auth), preserve existing encrypted refresh token.
    const existing = await this.getIntegrationRecord();
    let encryptedRefreshToken = existing.encryptedRefreshToken;

    if (tokens.refresh_token) {
      encryptedRefreshToken = encryptToken(tokens.refresh_token);
    } else if (!encryptedRefreshToken) {
      throw new Error(
        'Google OAuth did not return a refresh token, and no existing token was found. Please disconnect and re-consent with prompt=consent.'
      );
    }

    const encryptedAccessToken = encryptToken(tokens.access_token);
    const accessTokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

    // Set credentials on client for immediate use
    oauth2Client.setCredentials(tokens);

    // 3. Retrieve connected Google account email
    let accountEmail: string | null = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      accountEmail = userInfo.data.email || null;
    } catch (err) {
      console.warn('[GoogleDriveService] Failed to retrieve account email from userinfo:', err);
    }

    // 4. Initialize and verify folder hierarchy in Google Drive
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const folders = await this.ensureFolderHierarchy(drive, existing);

    // 5. Persist connection and encrypted credentials
    const updated = await this.saveIntegrationRecord({
      isConnected: true,
      accountEmail,
      encryptedRefreshToken,
      encryptedAccessToken,
      accessTokenExpiresAt,
      rootFolderId: folders.rootFolderId,
      productImagesFolderId: folders.productImagesFolderId,
      customerPhotosFolderId: folders.customerPhotosFolderId,
      orderAttachmentsFolderId: folders.orderAttachmentsFolderId,
      invoicesFolderId: folders.invoicesFolderId,
      connectedBy: adminUserId,
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      lastError: null,
    });

    return updated;
  }

  /**
   * Ensures the required 4-subfolder hierarchy exists within SNAPPY_GIFTZ_STORAGE on Google Drive.
   * Prioritizes explicit environment variable overrides (GOOGLE_DRIVE_*_FOLDER_ID) and cached IDs.
   */
  async ensureFolderHierarchy(
    drive: drive_v3.Drive,
    cachedFolders?: Partial<DriveIntegrationRecord>
  ): Promise<{
    rootFolderId: string;
    productImagesFolderId: string;
    customerPhotosFolderId: string;
    orderAttachmentsFolderId: string;
    invoicesFolderId: string;
  }> {
    // 1. Ensure Root Folder: SNAPPY_GIFTZ_STORAGE
    let rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || cachedFolders?.rootFolderId;
    if (rootFolderId) {
      const exists = await this.checkFileExists(drive, rootFolderId);
      if (!exists) rootFolderId = undefined;
    }
    if (!rootFolderId) {
      rootFolderId = await this.findOrCreateFolder(drive, this.ROOT_FOLDER_NAME);
    }

    // 2. Ensure Subfolder: Product_Images
    let productImagesFolderId = process.env.GOOGLE_DRIVE_PRODUCT_IMAGES_FOLDER_ID || cachedFolders?.productImagesFolderId;
    if (productImagesFolderId) {
      const exists = await this.checkFileExists(drive, productImagesFolderId);
      if (!exists) productImagesFolderId = undefined;
    }
    if (!productImagesFolderId) {
      productImagesFolderId = await this.findOrCreateFolder(drive, this.FOLDER_PRODUCT_IMAGES, rootFolderId);
    }

    // 3. Ensure Subfolder: Customer_Personalization_Photos
    let customerPhotosFolderId = process.env.GOOGLE_DRIVE_CUSTOMER_PHOTOS_FOLDER_ID || cachedFolders?.customerPhotosFolderId;
    if (customerPhotosFolderId) {
      const exists = await this.checkFileExists(drive, customerPhotosFolderId);
      if (!exists) customerPhotosFolderId = undefined;
    }
    if (!customerPhotosFolderId) {
      customerPhotosFolderId = await this.findOrCreateFolder(drive, this.FOLDER_CUSTOMER_PHOTOS, rootFolderId);
    }

    // 4. Ensure Subfolder: Order_Attachments
    let orderAttachmentsFolderId = process.env.GOOGLE_DRIVE_ORDER_ATTACHMENTS_FOLDER_ID || cachedFolders?.orderAttachmentsFolderId;
    if (orderAttachmentsFolderId) {
      const exists = await this.checkFileExists(drive, orderAttachmentsFolderId);
      if (!exists) orderAttachmentsFolderId = undefined;
    }
    if (!orderAttachmentsFolderId) {
      orderAttachmentsFolderId = await this.findOrCreateFolder(drive, this.FOLDER_ORDER_ATTACHMENTS, rootFolderId);
    }

    // 5. Ensure Subfolder: Invoices
    let invoicesFolderId = process.env.GOOGLE_DRIVE_INVOICES_FOLDER_ID || cachedFolders?.invoicesFolderId;
    if (invoicesFolderId) {
      const exists = await this.checkFileExists(drive, invoicesFolderId);
      if (!exists) invoicesFolderId = undefined;
    }
    if (!invoicesFolderId) {
      invoicesFolderId = await this.findOrCreateFolder(drive, this.FOLDER_INVOICES, rootFolderId);
    }

    return {
      rootFolderId,
      productImagesFolderId,
      customerPhotosFolderId,
      orderAttachmentsFolderId,
      invoicesFolderId,
    };
  }

  /**
   * Helper to verify if a file/folder ID exists in Google Drive and is not trashed.
   */
  private async checkFileExists(drive: drive_v3.Drive, fileId: string): Promise<boolean> {
    try {
      const res = await drive.files.get({ fileId, fields: 'id, trashed' });
      return Boolean(res.data.id && !res.data.trashed);
    } catch {
      return false;
    }
  }

  /**
   * Finds an existing non-trashed folder by name and parent, or creates it.
   */
  private async findOrCreateFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId?: string
  ): Promise<string> {
    const parentQuery = parentId ? `'${parentId}' in parents and ` : `'root' in parents and `;
    const q = `${parentQuery}mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;

    try {
      const listRes = await drive.files.list({
        q,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
        return listRes.data.files[0].id;
      }
    } catch (err) {
      console.warn(`[GoogleDriveService] files.list query for folder "${folderName}" failed, attempting creation:`, err);
    }

    // Create folder
    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      },
      fields: 'id',
    });

    if (!createRes.data.id) {
      throw new Error(`Failed to create Google Drive folder "${folderName}".`);
    }

    return createRes.data.id;
  }

  /**
   * Retrieves an authenticated Google Drive client with automatic token refresh.
   */
  async getAuthenticatedDriveClient(): Promise<{
    drive: drive_v3.Drive;
    folders: {
      rootFolderId: string;
      productImagesFolderId: string;
      customerPhotosFolderId: string;
      orderAttachmentsFolderId: string;
      invoicesFolderId: string;
    };
  }> {
    const record = await this.getIntegrationRecord();
    if (!record.isConnected || !record.encryptedRefreshToken) {
      throw new Error('Google Drive integration is not connected. Administrator authorization required.');
    }

    const refreshToken = decryptToken(record.encryptedRefreshToken);
    const oauth2Client = this.createOAuth2Client();

    // Check access token validity
    let accessToken: string | null = null;
    const now = Date.now();
    const expiry = record.accessTokenExpiresAt ? new Date(record.accessTokenExpiresAt).getTime() : 0;

    // Refresh if within 5 minutes of expiration or already expired
    if (!record.encryptedAccessToken || expiry - now < 5 * 60 * 1000) {
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        accessToken = credentials.access_token || null;
        if (accessToken) {
          const encryptedAccessToken = encryptToken(accessToken);
          const accessTokenExpiresAt = credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : new Date(Date.now() + 3600 * 1000);

          await this.saveIntegrationRecord({
            encryptedAccessToken,
            accessTokenExpiresAt,
            lastSyncedAt: new Date(),
          });
        }
      } catch (err: any) {
        await this.saveIntegrationRecord({
          lastError: `Token refresh failed: ${err.message}`,
        });
        throw new Error(`Google Drive token refresh failed: ${err.message}`);
      }
    } else {
      accessToken = decryptToken(record.encryptedAccessToken);
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Validate folder IDs
    if (
      !record.rootFolderId ||
      !record.productImagesFolderId ||
      !record.customerPhotosFolderId ||
      !record.orderAttachmentsFolderId ||
      !record.invoicesFolderId
    ) {
      const folders = await this.ensureFolderHierarchy(drive, record);
      await this.saveIntegrationRecord(folders);
      return { drive, folders };
    }

    return {
      drive,
      folders: {
        rootFolderId: record.rootFolderId,
        productImagesFolderId: record.productImagesFolderId,
        customerPhotosFolderId: record.customerPhotosFolderId,
        orderAttachmentsFolderId: record.orderAttachmentsFolderId,
        invoicesFolderId: record.invoicesFolderId,
      },
    };
  }

  /**
   * Uploads a file buffer directly to the authorized Google Drive folder.
   * Enforces 10MB limit and validates image magic bytes for image uploads.
   * Strictly keeps customer photos and attachments private without public permissions.
   */
  async uploadFile(input: GoogleDriveUploadInput): Promise<GoogleDriveUploadResult> {
    const { fileBuffer, fileName, mimeType, folderType } = input;

    // 1. Size constraint: 10 MB maximum
    const MAX_ALLOWED_BYTES = 10 * 1024 * 1024;
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new StorageValidationError('File buffer cannot be empty', 'EMPTY_FILE');
    }
    if (fileBuffer.length > MAX_ALLOWED_BYTES) {
      throw new StorageValidationError(
        `File size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 10 MB.`,
        'FILE_TOO_LARGE'
      );
    }

    // 2. Validate magic bytes if image
    if (mimeType.startsWith('image/')) {
      const magicCheck = verifyImageMagicBytes(fileBuffer);
      if (!magicCheck.valid) {
        throw new StorageValidationError(
          'File contents do not match genuine image binary signature (magic bytes mismatch)',
          'CORRUPT_OR_SPOOFED_IMAGE'
        );
      }
    }

    // 3. Acquire authenticated drive client
    const { drive, folders } = await this.getAuthenticatedDriveClient();

    let targetFolderId: string;
    switch (folderType) {
      case 'product':
        targetFolderId = folders.productImagesFolderId;
        break;
      case 'customer':
        targetFolderId = folders.customerPhotosFolderId;
        break;
      case 'invoice':
        targetFolderId = folders.invoicesFolderId;
        break;
      case 'attachment':
      default:
        targetFolderId = folders.orderAttachmentsFolderId;
        break;
    }

    // 4. Sanitize file name
    const sanitizedFileName = (fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');

    // 5. Upload via drive.files.create with readable stream
    const readable = new Readable();
    readable.push(fileBuffer);
    readable.push(null);

    const res = await drive.files.create({
      requestBody: {
        name: `${Date.now()}-${sanitizedFileName}`,
        parents: [targetFolderId],
        mimeType,
      },
      media: {
        mimeType,
        body: readable,
      },
      fields: 'id, name, mimeType, size, webViewLink, webContentLink',
    });

    if (!res.data.id) {
      throw new Error('Google Drive upload succeeded but no file ID was returned.');
    }

    return {
      fileId: res.data.id,
      fileName: res.data.name || sanitizedFileName,
      mimeType: res.data.mimeType || mimeType,
      sizeBytes: res.data.size ? parseInt(res.data.size, 10) : fileBuffer.length,
      folderId: targetFolderId,
      webViewLink: res.data.webViewLink || undefined,
      webContentLink: res.data.webContentLink || undefined,
    };
  }

  /**
   * Retrieves an authorized binary stream for a private Google Drive file.
   */
  async getFileStream(fileId: string): Promise<Readable> {
    const { drive } = await this.getAuthenticatedDriveClient();
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return res.data as Readable;
  }

  /**
   * Deletes a file from Google Drive by file ID.
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const { drive } = await this.getAuthenticatedDriveClient();
      await drive.files.delete({ fileId });
      return true;
    } catch (err) {
      console.warn('[GoogleDriveService] Delete file failed for fileId:', fileId, err);
      return false;
    }
  }

  /**
   * Safely disconnects Google Drive: attempts remote token revocation with Google,
   * clears encrypted tokens, and marks integration disconnected.
   */
  async disconnect(adminUserId: string): Promise<void> {
    const record = await this.getIntegrationRecord();

    if (record.encryptedRefreshToken) {
      try {
        const refreshToken = decryptToken(record.encryptedRefreshToken);
        const oauth2Client = this.createOAuth2Client();
        await oauth2Client.revokeToken(refreshToken);
      } catch (err) {
        console.warn('[GoogleDriveService] Token revocation with Google failed or token already revoked:', err);
      }
    }

    await this.saveIntegrationRecord({
      isConnected: false,
      accountEmail: null,
      encryptedRefreshToken: null,
      encryptedAccessToken: null,
      accessTokenExpiresAt: null,
      rootFolderId: null,
      productImagesFolderId: null,
      customerPhotosFolderId: null,
      orderAttachmentsFolderId: null,
      invoicesFolderId: null,
      connectedBy: adminUserId,
      lastSyncedAt: new Date(),
      lastError: null,
    });
  }

  /**
   * Returns a sanitized, non-sensitive connection status object for UI presentation.
   * Strictly avoids exposing tokens, client secrets, or encryption keys.
   */
  async getConnectionStatus(): Promise<GoogleDriveConfigStatus> {
    const creds = this.getCredentials();
    const record = await this.getIntegrationRecord();

    return {
      isConfigured: creds.isConfigured,
      isConnected: Boolean(record.isConnected && record.encryptedRefreshToken),
      accountEmail: record.accountEmail,
      rootFolderId: record.rootFolderId,
      productImagesFolderId: record.productImagesFolderId,
      customerPhotosFolderId: record.customerPhotosFolderId,
      orderAttachmentsFolderId: record.orderAttachmentsFolderId,
      invoicesFolderId: record.invoicesFolderId,
      connectedAt: record.connectedAt ? record.connectedAt.toISOString() : null,
      lastSyncedAt: record.lastSyncedAt ? record.lastSyncedAt.toISOString() : null,
      lastError: record.lastError,
    };
  }
}

export const googleDriveService = new GoogleDriveService();

