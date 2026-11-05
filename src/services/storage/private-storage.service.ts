import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { verifyImageMagicBytes, StorageValidationError } from './local-storage.service';
import { googleDriveService } from './google-drive.service';

export interface PrivateUploadResult {
  fileKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  googleDriveFileId?: string;
}

const MAX_ARTWORK_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class PrivateStorageService {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    // Private storage is located in storage/private outside the public web root
    this.baseDir = customBaseDir || path.join(process.cwd(), 'storage', 'private');
  }

  /**
   * Authoritatively validates and stores private customer artwork / proof binaries.
   * Never stores customer uploads in publicly reachable directories.
   */
  async storePrivateUpload(
    fileBuffer: Buffer,
    fileName: string,
    declaredMime: string,
    folder: 'proofs' | 'logos' | 'customer-artwork' = 'customer-artwork'
  ): Promise<PrivateUploadResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new StorageValidationError('Uploaded file buffer cannot be empty', 'EMPTY_FILE');
    }

    // 1. Enforce strict size threshold
    if (fileBuffer.length > MAX_ARTWORK_SIZE_BYTES) {
      throw new StorageValidationError(
        `File size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 10 MB.`,
        'FILE_TOO_LARGE'
      );
    }

    // 2. Magic bytes verification (independent of client-supplied extension or MIME header)
    const magicCheck = verifyImageMagicBytes(fileBuffer);
    if (!magicCheck.valid || !magicCheck.detectedMime) {
      throw new StorageValidationError(
        'File signature mismatch. The uploaded file does not match genuine JPEG, PNG, or WebP binary headers.',
        'CORRUPT_OR_SPOOFED_IMAGE'
      );
    }

    const detectedMime = magicCheck.detectedMime;
    if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
      throw new StorageValidationError(
        `File format "${detectedMime}" is not supported for personalization artwork. Supported formats: JPEG, PNG, WebP.`,
        'UNSUPPORTED_FORMAT'
      );
    }

    // 3. Compute SHA-256 binary hash for integrity & deduplication verification
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 4. Generate unguessable, cryptographically unique storage identifier
    const ext = detectedMime === 'image/png' ? '.png' : detectedMime === 'image/webp' ? '.webp' : '.jpg';
    const randomEntropy = crypto.randomBytes(16).toString('hex');
    const safeKey = `${folder}/${Date.now()}-${randomEntropy}${ext}`;

    // 5. Strict path traversal mitigation
    const resolvedBase = path.resolve(this.baseDir);
    const targetPath = path.join(this.baseDir, safeKey);
    const resolvedTarget = path.resolve(targetPath);

    if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
      throw new StorageValidationError('Invalid file key: path traversal detected.', 'PATH_TRAVERSAL_DETECTED');
    }

    // 6. Write to private directory
    const targetDir = path.dirname(resolvedTarget);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(resolvedTarget, fileBuffer);

    // Sanitize original filename (remove path components)
    const sanitizedOriginalName = path.basename(fileName || 'artwork' + ext).replace(/[^a-zA-Z0-9._-]/g, '_');

    // 7. Optional sync to Google Drive if connected
    let googleDriveFileId: string | undefined;
    try {
      const gDriveStatus = await googleDriveService.getConnectionStatus();
      if (gDriveStatus.isConnected) {
        const driveFolderType = folder === 'customer-artwork' ? 'customer' : 'attachment';
        const driveUpload = await googleDriveService.uploadFile({
          fileBuffer,
          fileName: sanitizedOriginalName,
          mimeType: detectedMime,
          folderType: driveFolderType,
        });
        googleDriveFileId = driveUpload.fileId;
      }
    } catch (gDriveErr) {
      // Soft-fail: Google Drive background sync should not block customer flow
      console.warn('[PrivateStorageService] Google Drive sync skipped/failed:', gDriveErr);
    }

    return {
      fileKey: safeKey,
      originalFilename: sanitizedOriginalName,
      mimeType: detectedMime,
      sizeBytes: fileBuffer.length,
      fileHash,
      googleDriveFileId,
    };
  }

  /**
   * Retrieves a private file buffer with strict path traversal verification.
   */
  async getPrivateFileBuffer(fileKey: string): Promise<Buffer> {
    if (fileKey.startsWith('gdrive:')) {
      const fileId = fileKey.replace('gdrive:', '').trim();
      const stream = await googleDriveService.getFileStream(fileId);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    const cleanKey = fileKey.replace(/\\/g, '/');
    const resolvedBase = path.resolve(this.baseDir);
    const targetPath = path.join(this.baseDir, cleanKey);
    const resolvedTarget = path.resolve(targetPath);

    if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
      throw new StorageValidationError('Access denied: path traversal detected.', 'PATH_TRAVERSAL_DETECTED');
    }

    try {
      return await fs.readFile(resolvedTarget);
    } catch {
      throw new StorageValidationError(`Private artwork file not found for key: ${cleanKey}`, 'FILE_NOT_FOUND');
    }
  }

  /**
   * Authoritatively validates and stores private PDF documents (tax invoices, packing slips).
   * Verifies %PDF- magic bytes, calculates SHA-256 hash, and stores in private non-public directory.
   */
  async storePrivateDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string = 'application/pdf',
    folder: 'invoices' | 'packing-slips' = 'invoices'
  ): Promise<PrivateUploadResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new StorageValidationError('Document buffer cannot be empty', 'EMPTY_FILE');
    }

    const MAX_DOC_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
    if (fileBuffer.length > MAX_DOC_SIZE_BYTES) {
      throw new StorageValidationError('Document size exceeds the 15 MB limit', 'FILE_TOO_LARGE');
    }

    // Verify %PDF- header magic bytes: 0x25, 0x50, 0x44, 0x46
    const isPdf =
      fileBuffer.length >= 4 &&
      fileBuffer[0] === 0x25 &&
      fileBuffer[1] === 0x50 &&
      fileBuffer[2] === 0x44 &&
      fileBuffer[3] === 0x46;

    if (!isPdf || mimeType !== 'application/pdf') {
      throw new StorageValidationError(
        'Document signature mismatch. File does not match valid %PDF header.',
        'CORRUPT_OR_SPOOFED_DOCUMENT'
      );
    }

    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const randomEntropy = crypto.randomBytes(16).toString('hex');
    const safeKey = `${folder}/${Date.now()}-${randomEntropy}.pdf`;

    const resolvedBase = path.resolve(this.baseDir);
    const targetPath = path.join(this.baseDir, safeKey);
    const resolvedTarget = path.resolve(targetPath);

    if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
      throw new StorageValidationError('Invalid file key: path traversal detected.', 'PATH_TRAVERSAL_DETECTED');
    }

    const targetDir = path.dirname(resolvedTarget);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(resolvedTarget, fileBuffer);

    const sanitizedOriginalName = path.basename(fileName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');

    let googleDriveFileId: string | undefined;
    try {
      const gDriveStatus = await googleDriveService.getConnectionStatus();
      if (gDriveStatus.isConnected) {
        const driveFolderType = folder === 'invoices' ? 'invoice' : 'attachment';
        const driveUpload = await googleDriveService.uploadFile({
          fileBuffer,
          fileName: sanitizedOriginalName,
          mimeType: 'application/pdf',
          folderType: driveFolderType,
        });
        googleDriveFileId = driveUpload.fileId;
      }
    } catch (gDriveErr) {
      console.warn('[PrivateStorageService] Google Drive document sync skipped/failed:', gDriveErr);
    }

    return {
      fileKey: safeKey,
      originalFilename: sanitizedOriginalName,
      mimeType: 'application/pdf',
      sizeBytes: fileBuffer.length,
      fileHash,
      googleDriveFileId,
    };
  }

  /**
   * Safely deletes a private file (local disk or Google Drive).
   */
  async deletePrivateFile(fileKey: string): Promise<boolean> {
    try {
      if (fileKey.startsWith('gdrive:')) {
        const fileId = fileKey.replace('gdrive:', '').trim();
        return await googleDriveService.deleteFile(fileId);
      }
      const cleanKey = fileKey.replace(/\\/g, '/');
      const resolvedBase = path.resolve(this.baseDir);
      const targetPath = path.join(this.baseDir, cleanKey);
      const resolvedTarget = path.resolve(targetPath);

      if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
        return false;
      }

      await fs.unlink(resolvedTarget);
      return true;
    } catch {
      return false;
    }
  }
}

export const privateStorageService = new PrivateStorageService();

