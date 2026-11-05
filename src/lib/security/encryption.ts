import crypto from 'crypto';

export class EncryptionError extends Error {
  code: string;
  constructor(message: string, code: string = 'ENCRYPTION_ERROR') {
    super(message);
    this.name = 'EncryptionError';
    this.code = code;
  }
}

/**
 * Normalizes an arbitrary secret into a 32-byte Buffer suitable for AES-256-GCM.
 * Supports:
 * - 44-character Base64 string (32 bytes)
 * - 64-character Hex string (32 bytes)
 * - Raw string / passphrase (SHA-256 hashed into 32 bytes)
 */
export function deriveKeyBuffer(keyInput?: string): Buffer {
  const secret = keyInput || process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY;

  if (!secret || secret.trim().length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new EncryptionError(
        'Critical Security Error: GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY is required in production.',
        'MISSING_ENCRYPTION_KEY'
      );
    }
    // Safe deterministic development fallback key
    return crypto.createHash('sha256').update('snappy-gifts-dev-storage-encryption-key-fallback').digest();
  }

  const trimmed = secret.trim();

  // 1. Check if 44-character Base64 (Standard 32-byte key)
  if (trimmed.length === 44 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) return buf;
  }

  // 2. Check if 64-character Hex (Standard 32-byte key)
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, 'hex');
    if (buf.length === 32) return buf;
  }

  // 3. Fallback: derive 32 bytes using SHA-256
  return crypto.createHash('sha256').update(trimmed).digest();
}

/**
 * Encrypts plain text using AES-256-GCM with a unique 12-byte IV per invocation.
 * Output format: `ivHex:authTagHex:cipherTextHex`
 */
export function encryptToken(plainText: string, customKey?: string): string {
  if (typeof plainText !== 'string' || plainText.length === 0) {
    throw new EncryptionError('Plain text payload must be a non-empty string.', 'INVALID_PAYLOAD');
  }

  const keyBuffer = deriveKeyBuffer(customKey);
  // NIST SP 800-38D recommends 12-byte (96-bit) IV for GCM
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * Verifies the 16-byte authentication tag to guarantee integrity and authenticity.
 */
export function decryptToken(encryptedPayload: string, customKey?: string): string {
  if (typeof encryptedPayload !== 'string' || !encryptedPayload.includes(':')) {
    throw new EncryptionError('Invalid encrypted payload format.', 'MALFORMED_PAYLOAD');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new EncryptionError('Encrypted payload must contain IV, AuthTag, and Ciphertext.', 'MALFORMED_PAYLOAD');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  if (ivHex.length !== 24 || authTagHex.length !== 32) {
    throw new EncryptionError('Invalid IV or AuthTag length for AES-256-GCM.', 'INVALID_CIPHER_COMPONENTS');
  }

  const keyBuffer = deriveKeyBuffer(customKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const cipherBuffer = Buffer.from(cipherHex, 'hex');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    throw new EncryptionError(
      'Authentication tag verification failed. Ciphertext may have been tampered with or incorrect key used.',
      'AUTHENTICATION_FAILED'
    );
  }
}
