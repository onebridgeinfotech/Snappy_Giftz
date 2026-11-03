import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { StorageAdapter, UploadFileInput, UploadFileResult } from '../adapters/storage.adapter';

export class StorageValidationError extends Error {
  constructor(message: string, public code: string = 'STORAGE_VALIDATION_ERROR') {
    super(message);
    this.name = 'StorageValidationError';
  }
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Validate image buffer headers against known magic numbers.
 * Protects against renamed malicious payloads (.exe -> .jpg).
 */
export function verifyImageMagicBytes(buffer: Buffer): { valid: boolean; detectedMime?: string } {
  if (!buffer || buffer.length < 12) {
    return { valid: false };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // WEBP: RIFF....WEBP
  const riffHeader = buffer.subarray(0, 4).toString('ascii');
  const webpHeader = buffer.subarray(8, 12).toString('ascii');
  if (riffHeader === 'RIFF' && webpHeader === 'WEBP') {
    return { valid: true, detectedMime: 'image/webp' };
  }

  return { valid: false };
}

export class LocalDiskStorageService implements StorageAdapter {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(process.cwd(), 'public', 'uploads');
  }

  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const { fileBuffer, fileName, mimeType, folder } = input;

    // 1. File size check
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new StorageValidationError(
        `File size (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB`,
        'FILE_TOO_LARGE'
      );
    }

    // 2. MIME type check
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new StorageValidationError(
        `MIME type "${mimeType}" is not allowed. Allowed types: image/jpeg, image/png, image/webp`,
        'INVALID_MIME_TYPE'
      );
    }

    // 3. Magic bytes verification
    const magicCheck = verifyImageMagicBytes(fileBuffer);
    if (!magicCheck.valid) {
      throw new StorageValidationError(
        'File contents do not match genuine image binary signature (magic bytes mismatch)',
        'CORRUPT_OR_SPOOFED_IMAGE'
      );
    }

    // 4. Sanitize file name and generate cryptographically unique key
    const ext = path.extname(fileName).toLowerCase() || (magicCheck.detectedMime === 'image/png' ? '.png' : magicCheck.detectedMime === 'image/webp' ? '.webp' : '.jpg');
    const randomHash = crypto.randomBytes(16).toString('hex');
    const safeKey = `${folder}/${Date.now()}-${randomHash}${ext}`;

    const targetPath = path.join(this.baseDir, safeKey);
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(this.baseDir);

    // Prevent path traversal
    if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
      throw new StorageValidationError('Invalid file path: path traversal detected', 'PATH_TRAVERSAL_DETECTED');
    }

    const targetDir = path.dirname(resolvedTarget);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(resolvedTarget, fileBuffer);

    return {
      fileKey: safeKey,
      storedUrl: `/uploads/${safeKey}`,
      sizeBytes: fileBuffer.length,
    };
  }

  async getSignedDownloadUrl(fileKey: string, _expiresInSeconds = 3600): Promise<string> {
    // For local development disk storage, public URL is returned
    return `/uploads/${fileKey}`;
  }

  async deleteFile(fileKey: string): Promise<boolean> {
    try {
      const targetPath = path.join(this.baseDir, fileKey);
      const resolvedTarget = path.resolve(targetPath);
      const resolvedBase = path.resolve(this.baseDir);

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

export const localStorageService = new LocalDiskStorageService();
