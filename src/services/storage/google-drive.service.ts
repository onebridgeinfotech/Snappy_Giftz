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
  zeroSilentReplacementsEnforced?: boolean;
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
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
}

export interface BusinessDriveFolderConfig {
  id: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Pre-existing 5 Google Drive folders supplied by the business owner.
 * The application MUST reliably use these exact folder IDs without creating parallel or replacement folders.
 */
export const BUSINESS_DRIVE_FOLDERS: Record<
  'root' | 'productImages' | 'customerPhotos' | 'orderAttachments' | 'invoices',
  BusinessDriveFolderConfig
> = {
  root: {
    id: '1tyIZoYxyduRYjEmJARsCc_d4LfAYyFQ8',
    name: 'SNAPPY_GIFTZ_STORAGE',
    description: 'Root storage folder in Google Drive',
    mimeType: 'application/vnd.google-apps.folder',
  },
  productImages: {
    id: '1auWYCCQJWgn28rk3JEexW8aKzZI5NhxL',
    name: 'Product_Images',
    description: 'Public catalog product photography and media assets',
    mimeType: 'application/vnd.google-apps.folder',
  },
  customerPhotos: {
    id: '1yJnAAnmaAKWcbg1DvvTbtf3KZ8LmOtr0',
    name: 'Customer_Personalization_Photos',
    description: 'Private customer artwork, photo prints, and personalization uploads',
    mimeType: 'application/vnd.google-apps.folder',
  },
  orderAttachments: {
    id: '1526s264h3zrZSaF_rG5Cgmfm7WirSQLL',
    name: 'Order_Attachments',
    description: 'Customer order attachments and damage claim evidence photos',
    mimeType: 'application/vnd.google-apps.folder',
  },
  invoices: {
    id: '1MBF1cmNf2-P6OcWxBAVP1S2qVPb0vX4s',
    name: 'Invoices',
    description: 'Audited GST tax invoice PDF documents',
    mimeType: 'application/vnd.google-apps.folder',
  },
};

/**
 * Thrown when one or more pre-configured Google Drive folders cannot be accessed under the drive.file scope.
 * The system enforces zero silent replacements: it throws loudly rather than creating duplicate folders.
 */
export class GoogleDriveFolderInaccessibleError extends Error {
  public folderKey: string;
  public folderId: string;
  public originalError?: any;

  constructor(folderKey: string, folderId: string, message: string, originalError?: any) {
    super(message);
    this.name = 'GoogleDriveFolderInaccessibleError';
    this.folderKey = folderKey;
    this.folderId = folderId;
    this.originalError = originalError;
  }
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
  getCredentials() {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri =
      process.env.GOOGLE_DRIVE_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://snappygiftz.com'}/api/integrations/google-drive/callback`;
    const developerKey = process.env.GOOGLE_PICKER_API_KEY || process.env.GOOGLE_API_KEY || '';

    return {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: redirectUri.trim(),
      developerKey: developerKey.trim(),
      isConfigured: Boolean(clientId.trim() && clientSecret.trim()),
    };
  }

  /**
   * Resolves the 5 target Google Drive folder IDs.
   * Prioritizes explicit environment variable overrides, then persisted integration record,
   * cleanly defaulting to the 5 folders supplied by the business owner.
   */
  getConfiguredFolderIds(cachedFolders?: Partial<DriveIntegrationRecord>): {
    rootFolderId: string;
    productImagesFolderId: string;
    customerPhotosFolderId: string;
    orderAttachmentsFolderId: string;
    invoicesFolderId: string;
  } {
    return {
      rootFolderId: (
        process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
        process.env.GOOGLE_DRIVE_FOLDER_ID ||
        cachedFolders?.rootFolderId ||
        BUSINESS_DRIVE_FOLDERS.root.id
      ).trim(),
      productImagesFolderId: (
        process.env.GOOGLE_DRIVE_PRODUCT_IMAGES_FOLDER_ID ||
        process.env.GOOGLE_DRIVE_PRODUCT_FOLDER_ID ||
        cachedFolders?.productImagesFolderId ||
        BUSINESS_DRIVE_FOLDERS.productImages.id
      ).trim(),
      customerPhotosFolderId: (
        process.env.GOOGLE_DRIVE_CUSTOMER_PHOTOS_FOLDER_ID ||
        process.env.GOOGLE_DRIVE_CUSTOMER_FOLDER_ID ||
        cachedFolders?.customerPhotosFolderId ||
        BUSINESS_DRIVE_FOLDERS.customerPhotos.id
      ).trim(),
      orderAttachmentsFolderId: (
        process.env.GOOGLE_DRIVE_ORDER_ATTACHMENTS_FOLDER_ID ||
        cachedFolders?.orderAttachmentsFolderId ||
        BUSINESS_DRIVE_FOLDERS.orderAttachments.id
      ).trim(),
      invoicesFolderId: (
        process.env.GOOGLE_DRIVE_INVOICES_FOLDER_ID ||
        cachedFolders?.invoicesFolderId ||
        BUSINESS_DRIVE_FOLDERS.invoices.id
      ).trim(),
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
    const configuredIds = this.getConfiguredFolderIds(existing);
    let lastError: string | null = null;
    let rootFolderId = configuredIds.rootFolderId;
    let productImagesFolderId = configuredIds.productImagesFolderId;
    let customerPhotosFolderId = configuredIds.customerPhotosFolderId;
    let orderAttachmentsFolderId = configuredIds.orderAttachmentsFolderId;
    let invoicesFolderId = configuredIds.invoicesFolderId;

    try {
      const folders = await this.ensureFolderHierarchy(drive, existing);
      rootFolderId = folders.rootFolderId;
      productImagesFolderId = folders.productImagesFolderId;
      customerPhotosFolderId = folders.customerPhotosFolderId;
      orderAttachmentsFolderId = folders.orderAttachmentsFolderId;
      invoicesFolderId = folders.invoicesFolderId;
    } catch (folderErr: any) {
      if (folderErr instanceof GoogleDriveFolderInaccessibleError) {
        lastError = `Google Drive connected, but pre-existing folders require Google Picker authorization: ${folderErr.message}`;
        console.warn('[GoogleDriveService] Folders require Picker authorization:', lastError);
      } else {
        lastError = `Folder verification failed: ${folderErr.message}`;
      }
    }

    // 5. Persist connection and encrypted credentials
    const updated = await this.saveIntegrationRecord({
      isConnected: true,
      accountEmail,
      encryptedRefreshToken,
      encryptedAccessToken,
      accessTokenExpiresAt,
      rootFolderId,
      productImagesFolderId,
      customerPhotosFolderId,
      orderAttachmentsFolderId,
      invoicesFolderId,
      connectedBy: adminUserId,
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
      lastError,
    });

    return updated;
  }

  /**
   * Validates access to the 5 configured Google Drive folders without creating parallel or duplicate folders.
   * Tests each folder ID directly using drive.files.get under the drive.file scope.
   */
  async validateFolderAccess(
    drive: drive_v3.Drive,
    cachedFolders?: Partial<DriveIntegrationRecord>
  ): Promise<{
    allAccessible: boolean;
    folders: {
      root: { id: string; name: string; accessible: boolean; error?: string };
      productImages: { id: string; name: string; accessible: boolean; error?: string };
      customerPhotos: { id: string; name: string; accessible: boolean; error?: string };
      orderAttachments: { id: string; name: string; accessible: boolean; error?: string };
      invoices: { id: string; name: string; accessible: boolean; error?: string };
    };
  }> {
    const ids = this.getConfiguredFolderIds(cachedFolders);
    const targets = [
      { key: 'root' as const, id: ids.rootFolderId, expectedName: BUSINESS_DRIVE_FOLDERS.root.name },
      { key: 'productImages' as const, id: ids.productImagesFolderId, expectedName: BUSINESS_DRIVE_FOLDERS.productImages.name },
      { key: 'customerPhotos' as const, id: ids.customerPhotosFolderId, expectedName: BUSINESS_DRIVE_FOLDERS.customerPhotos.name },
      { key: 'orderAttachments' as const, id: ids.orderAttachmentsFolderId, expectedName: BUSINESS_DRIVE_FOLDERS.orderAttachments.name },
      { key: 'invoices' as const, id: ids.invoicesFolderId, expectedName: BUSINESS_DRIVE_FOLDERS.invoices.name },
    ];

    const results: any = {};
    let allAccessible = true;

    for (const target of targets) {
      try {
        const res = await drive.files.get({
          fileId: target.id,
          fields: 'id, name, mimeType, trashed, capabilities(canAddChildren)',
        });

        if (!res.data.id || res.data.trashed) {
          allAccessible = false;
          results[target.key] = {
            id: target.id,
            name: target.expectedName,
            accessible: false,
            error: res.data.trashed ? 'Folder is in Google Drive trash' : 'Folder not found',
          };
        } else if (res.data.mimeType !== 'application/vnd.google-apps.folder') {
          allAccessible = false;
          results[target.key] = {
            id: target.id,
            name: target.expectedName,
            accessible: false,
            error: `Item is not a folder (MIME type: ${res.data.mimeType})`,
          };
        } else {
          results[target.key] = {
            id: res.data.id,
            name: res.data.name || target.expectedName,
            accessible: true,
          };
        }
      } catch (err: any) {
        allAccessible = false;
        const status = err.response?.status || err.code || (err.status ? parseInt(err.status, 10) : 500);
        results[target.key] = {
          id: target.id,
          name: target.expectedName,
          accessible: false,
          error: status === 404
            ? `Not found or not authorized under drive.file scope (HTTP 404). Authorize via Google Picker.`
            : status === 403
            ? `Insufficient permissions under drive.file scope (HTTP 403). Authorize via Google Picker.`
            : (err.message || 'Error checking folder access'),
        };
      }
    }

    return { allAccessible, folders: results };
  }

  /**
   * Strictly verifies the configured 5-folder hierarchy without creating parallel or replacement folders.
   * Throws GoogleDriveFolderInaccessibleError if any folder is missing or inaccessible.
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
    const check = await this.validateFolderAccess(drive, cachedFolders);
    const ids = this.getConfiguredFolderIds(cachedFolders);

    if (!check.allAccessible) {
      const inaccessible = Object.entries(check.folders).find(([_, f]) => !f.accessible);
      const [key, details] = inaccessible || ['unknown', { id: 'unknown', name: 'unknown', error: 'Inaccessible' }];
      throw new GoogleDriveFolderInaccessibleError(
        key,
        details.id,
        `Google Drive folder "${details.name}" (ID: ${details.id}) is inaccessible: ${details.error}. The system strictly enforces the business owner's pre-configured folders and will NOT create duplicate or replacement folders. Please authorize this folder via Google Picker in the Admin Settings tab.`
      );
    }

    return {
      rootFolderId: ids.rootFolderId,
      productImagesFolderId: ids.productImagesFolderId,
      customerPhotosFolderId: ids.customerPhotosFolderId,
      orderAttachmentsFolderId: ids.orderAttachmentsFolderId,
      invoicesFolderId: ids.invoicesFolderId,
    };
  }

  /**
   * Validates and records folders explicitly selected and authorized by an administrator via Google Picker.
   * Verifies each folder ID and MIME type on the server using drive.files.get.
   */
  async authorizeFoldersViaPicker(
    folders: Array<{ id: string; name?: string; type?: string }>
  ): Promise<{
    verifiedCount: number;
    folders: Record<string, { id: string; name: string; verified: boolean }>;
  }> {
    if (!folders || !Array.isArray(folders) || folders.length === 0) {
      throw new Error('No folders provided for authorization.');
    }

    const { drive } = await this.getAuthenticatedDriveClient(false);
    const record = await this.getIntegrationRecord();

    const verifiedMap: Record<string, { id: string; name: string; verified: boolean }> = {};
    const updates: Partial<DriveIntegrationRecord> = {};

    for (const item of folders) {
      if (!item.id || typeof item.id !== 'string') continue;
      try {
        const res = await drive.files.get({
          fileId: item.id,
          fields: 'id, name, mimeType, trashed, capabilities(canAddChildren), parents',
        });

        if (!res.data.id || res.data.trashed) {
          throw new Error(`Folder "${item.name || item.id}" was not found or is in trash.`);
        }
        if (res.data.mimeType !== 'application/vnd.google-apps.folder') {
          throw new Error(`Item "${res.data.name || item.id}" is not a folder (MIME type: ${res.data.mimeType}).`);
        }

        const folderName = res.data.name || item.name || '';
        const folderId = res.data.id;
        const parents = (res.data.parents as string[]) || [];
        const expectedRootId = updates.rootFolderId || record.rootFolderId || BUSINESS_DRIVE_FOLDERS.root.id;

        // Map to appropriate role by type, name, or configured ID with strict validation
        if (
          item.type === 'root' ||
          folderId === BUSINESS_DRIVE_FOLDERS.root.id ||
          folderName === BUSINESS_DRIVE_FOLDERS.root.name
        ) {
          updates.rootFolderId = folderId;
          verifiedMap.root = { id: folderId, name: folderName, verified: true };
        } else if (
          item.type === 'productImages' ||
          folderId === BUSINESS_DRIVE_FOLDERS.productImages.id ||
          folderName === BUSINESS_DRIVE_FOLDERS.productImages.name
        ) {
          updates.productImagesFolderId = folderId;
          verifiedMap.productImages = { id: folderId, name: folderName, verified: true };
        } else if (
          item.type === 'customerPhotos' ||
          folderId === BUSINESS_DRIVE_FOLDERS.customerPhotos.id ||
          folderName === BUSINESS_DRIVE_FOLDERS.customerPhotos.name
        ) {
          updates.customerPhotosFolderId = folderId;
          verifiedMap.customerPhotos = { id: folderId, name: folderName, verified: true };
        } else if (
          item.type === 'orderAttachments' ||
          folderId === BUSINESS_DRIVE_FOLDERS.orderAttachments.id ||
          folderName === BUSINESS_DRIVE_FOLDERS.orderAttachments.name
        ) {
          updates.orderAttachmentsFolderId = folderId;
          verifiedMap.orderAttachments = { id: folderId, name: folderName, verified: true };
        } else if (
          item.type === 'invoices' ||
          folderId === BUSINESS_DRIVE_FOLDERS.invoices.id ||
          folderName === BUSINESS_DRIVE_FOLDERS.invoices.name
        ) {
          updates.invoicesFolderId = folderId;
          verifiedMap.invoices = { id: folderId, name: folderName, verified: true };
        } else {
          // Untyped and unmatched arbitrary folder ID rejected for security
          throw new Error(
            `Folder "${folderName}" (${folderId}) does not match any of the 5 pre-configured business storage folders.`
          );
        }
      } catch (err: any) {
        throw new Error(`Failed to verify Google Drive folder "${item.name || item.id}": ${err.message}`);
      }
    }

    updates.lastSyncedAt = new Date();
    await this.saveIntegrationRecord(updates);

    // Re-check overall access
    const updatedRecord = await this.getIntegrationRecord();
    const validation = await this.validateFolderAccess(drive, updatedRecord);
    if (validation.allAccessible) {
      await this.saveIntegrationRecord({ lastError: null });
    }

    return {
      verifiedCount: Object.keys(verifiedMap).length,
      folders: verifiedMap,
    };
  }

  /**
   * Retrieves an authenticated Google Drive client with automatic token refresh.
   * If enforceHierarchy is true, strictly validates folder access and throws if inaccessible.
   */
  async getAuthenticatedDriveClient(enforceHierarchy: boolean = true): Promise<{
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
    const configuredFolders = this.getConfiguredFolderIds(record);

    if (enforceHierarchy) {
      const validatedFolders = await this.ensureFolderHierarchy(drive, record);
      return { drive, folders: validatedFolders };
    }

    return {
      drive,
      folders: configuredFolders,
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
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, parents',
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
      parents: (res.data.parents as string[]) || [targetFolderId],
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
    const ids = this.getConfiguredFolderIds(record);

    return {
      isConfigured: creds.isConfigured,
      isConnected: Boolean(record.isConnected && record.encryptedRefreshToken),
      accountEmail: record.accountEmail,
      rootFolderId: record.rootFolderId || ids.rootFolderId,
      productImagesFolderId: record.productImagesFolderId || ids.productImagesFolderId,
      customerPhotosFolderId: record.customerPhotosFolderId || ids.customerPhotosFolderId,
      orderAttachmentsFolderId: record.orderAttachmentsFolderId || ids.orderAttachmentsFolderId,
      invoicesFolderId: record.invoicesFolderId || ids.invoicesFolderId,
      connectedAt: record.connectedAt ? record.connectedAt.toISOString() : null,
      lastSyncedAt: record.lastSyncedAt ? record.lastSyncedAt.toISOString() : null,
      lastError: record.lastError,
      zeroSilentReplacementsEnforced: true,
    };
  }
}

export const googleDriveService = new GoogleDriveService();

