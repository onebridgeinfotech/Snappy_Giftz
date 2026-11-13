/**
 * Secure File Storage Adapter Interface
 * Implementations: Local Disk (Local Dev), S3 / Cloudflare R2 (Production).
 * Customer uploads (monogram proofs, logos) must be kept private and non-public.
 */

export interface UploadFileInput {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  folder: 'proofs' | 'logos' | 'invoices' | 'media';
}

export interface UploadFileResult {
  fileKey: string;
  storedUrl: string;
  sizeBytes: number;
}

export interface StorageAdapter {
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  getSignedDownloadUrl(fileKey: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(fileKey: string): Promise<boolean>;
}
