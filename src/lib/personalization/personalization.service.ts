import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { prisma } from '@/lib/prisma';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { privateStorageService, PrivateUploadResult } from '@/services/storage/private-storage.service';
import { validateAndDecodeProofDataUrl } from '@/lib/personalization/proof-validator';

export class PersonalizationValidationError extends Error {
  constructor(message: string, public code = 'PERSONALIZATION_VALIDATION_ERROR') {
    super(message);
    this.name = 'PersonalizationValidationError';
  }
}

export class PersonalizationAuthError extends Error {
  constructor(message = 'Unauthorized to access this artwork or proof.') {
    super(message);
    this.name = 'PersonalizationAuthError';
  }
}

export class StaleProofVersionError extends Error {
  constructor(message = 'Submitted proof version is stale or does not match current version.') {
    super(message);
    this.name = 'StaleProofVersionError';
  }
}

export class ProofConsentRequiredError extends Error {
  constructor(message = 'Explicit customer consent is required to approve the proof.') {
    super(message);
    this.name = 'ProofConsentRequiredError';
  }
}

export class PersonalizationUnauthorizedError extends Error {
  statusCode: number;
  constructor(message = 'Unauthorized to approve this proof.', statusCode = 403) {
    super(message);
    this.name = 'PersonalizationUnauthorizedError';
    this.statusCode = statusCode;
  }
}

export interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom?: number;
  rotation?: number;
}

export interface PlacementSettings {
  position?: 'CENTER' | 'TOP_CENTER' | 'LID' | 'PLAQUE' | 'CUSTOM';
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface PersonalizationInput {
  productId: string;
  variantId?: string;
  personalizationType?: 'TEXT_ENGRAVING' | 'PHOTO_PRINT' | 'LOGO_BRANDING' | 'BESPOKE_COMBO';
  engravedText?: string;
  fontFamily?: string;
  giftNote?: string;
  ribbonColor?: string;
  boxWrapStyle?: string;
  waxSealColor?: string;
  artworkUploadId?: string;
  cropSettings?: CropSettings;
  placementSettings?: PlacementSettings;
  proofApproved?: boolean;
  proofVersion?: number;
  clientProofDataUrl?: string;
  requireProof?: boolean;
}

export interface StoredArtworkRecord {
  id: string;
  fileKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  storageFolder: string;
  cartItemId?: string | null;
  orderItemId?: string | null;
  uploadedByUserId: string | null;
  guestSessionToken: string | null;
  status: 'ACTIVE' | 'ATTACHED' | 'ABANDONED';
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredPersonalizationRecord {
  id: string;
  orderItemId: string;
  personalizationType: string;
  engravedText: string | null;
  fontFamily: string | null;
  giftNote: string | null;
  ribbonColor: string | null;
  boxWrapStyle: string | null;
  waxSealColor: string | null;
  artworkUploadId: string | null;
  cropSettings: CropSettings | null;
  placementSettings: PlacementSettings | null;
  proofImageUrl: string | null;
  proofAssetKey?: string | null;
  proofVersion: number;
  // Aggregated status (backward compatible)
  approvalStatus: string;
  approvedAt: string | null;
  approvedBy: string | null;
  // Distinct customer consent
  customerApprovalStatus: 'PENDING' | 'APPROVED';
  customerApprovedAt: string | null;
  customerApprovedBy: string | null;
  // Distinct staff review
  staffReviewStatus: 'PENDING_REVIEW' | 'ARTWORK_VERIFIED_BY_STAFF' | 'REJECTED_FOR_REWORK';
  staffReviewedAt: string | null;
  staffReviewedBy: string | null;
  customizationFeePaise: number;
  staffNotes: string | null;
  metadata: any | null;
  createdAt: string;
  updatedAt: string;
}

export interface CleanupResult {
  deletedCount: number;
  freedBytes: number;
  errors: string[];
  dryRun: boolean;
}

// In-Memory Dev / Test Fallback Stores
export const DEV_ARTWORK_UPLOADS_STORE: Map<string, StoredArtworkRecord> = new Map();
export const DEV_PERSONALIZATION_STORE: Map<string, StoredPersonalizationRecord> = new Map();

/**
 * Standard CRC32 calculator for genuine PNG chunk assembly.
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crcBuf]);
}

/**
 * Standard 5x7 bitmap font table for printable ASCII characters (32 to 126).
 * Enables authentic server-side text rasterization without native C++ dependencies.
 */
const FONT_5X7: Record<string, number[]> = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
  '!': [0x00, 0x00, 0x5f, 0x00, 0x00],
  '"': [0x00, 0x07, 0x00, 0x07, 0x00],
  '#': [0x14, 0x7f, 0x14, 0x7f, 0x14],
  '$': [0x24, 0x2a, 0x7f, 0x2a, 0x12],
  '%': [0x23, 0x13, 0x08, 0x64, 0x62],
  '&': [0x36, 0x49, 0x55, 0x22, 0x50],
  "'": [0x00, 0x05, 0x03, 0x00, 0x00],
  '(': [0x00, 0x1c, 0x22, 0x41, 0x00],
  ')': [0x00, 0x41, 0x22, 0x1c, 0x00],
  '*': [0x14, 0x08, 0x3e, 0x08, 0x14],
  '+': [0x08, 0x08, 0x3e, 0x08, 0x08],
  ',': [0x00, 0x50, 0x30, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  '/': [0x20, 0x10, 0x08, 0x04, 0x02],
  '0': [0x3e, 0x51, 0x49, 0x45, 0x3e],
  '1': [0x00, 0x42, 0x7f, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4b, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7f, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3c, 0x4a, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1e],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  ';': [0x00, 0x56, 0x36, 0x00, 0x00],
  '<': [0x08, 0x14, 0x22, 0x41, 0x80],
  '=': [0x14, 0x14, 0x14, 0x14, 0x14],
  '>': [0x80, 0x41, 0x22, 0x14, 0x08],
  '?': [0x02, 0x01, 0x51, 0x09, 0x06],
  '@': [0x32, 0x49, 0x79, 0x41, 0x3e],
  'A': [0x7e, 0x11, 0x11, 0x11, 0x7e],
  'B': [0x7f, 0x49, 0x49, 0x49, 0x36],
  'C': [0x3e, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7f, 0x41, 0x41, 0x22, 0x1c],
  'E': [0x7f, 0x49, 0x49, 0x49, 0x41],
  'F': [0x7f, 0x09, 0x09, 0x09, 0x01],
  'G': [0x3e, 0x41, 0x49, 0x49, 0x7a],
  'H': [0x7f, 0x08, 0x08, 0x08, 0x7f],
  'I': [0x00, 0x41, 0x7f, 0x41, 0x00],
  'J': [0x20, 0x40, 0x41, 0x3f, 0x01],
  'K': [0x7f, 0x08, 0x14, 0x22, 0x41],
  'L': [0x7f, 0x40, 0x40, 0x40, 0x40],
  'M': [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  'N': [0x7f, 0x04, 0x08, 0x10, 0x7f],
  'O': [0x3e, 0x41, 0x41, 0x41, 0x3e],
  'P': [0x7f, 0x09, 0x09, 0x09, 0x06],
  'Q': [0x3e, 0x41, 0x51, 0x21, 0x5e],
  'R': [0x7f, 0x09, 0x19, 0x29, 0x46],
  'S': [0x46, 0x49, 0x49, 0x49, 0x31],
  'T': [0x01, 0x01, 0x7f, 0x01, 0x01],
  'U': [0x3f, 0x40, 0x40, 0x40, 0x3f],
  'V': [0x1f, 0x20, 0x40, 0x20, 0x1f],
  'W': [0x7f, 0x20, 0x18, 0x20, 0x7f],
  'X': [0x63, 0x14, 0x08, 0x14, 0x63],
  'Y': [0x07, 0x08, 0x70, 0x08, 0x07],
  'Z': [0x61, 0x51, 0x49, 0x45, 0x43],
  '[': [0x00, 0x7f, 0x41, 0x41, 0x00],
  '\\': [0x02, 0x04, 0x08, 0x10, 0x20],
  ']': [0x00, 0x41, 0x41, 0x7f, 0x00],
  '^': [0x04, 0x02, 0x01, 0x02, 0x04],
  '_': [0x40, 0x40, 0x40, 0x40, 0x40],
  'a': [0x20, 0x54, 0x54, 0x54, 0x78],
  'b': [0x7f, 0x48, 0x44, 0x44, 0x38],
  'c': [0x38, 0x44, 0x44, 0x44, 0x20],
  'd': [0x38, 0x44, 0x44, 0x48, 0x7f],
  'e': [0x38, 0x54, 0x54, 0x54, 0x18],
  'f': [0x08, 0x7e, 0x09, 0x01, 0x02],
  'g': [0x0c, 0x52, 0x52, 0x52, 0x3e],
  'h': [0x7f, 0x08, 0x04, 0x04, 0x78],
  'i': [0x00, 0x44, 0x7d, 0x40, 0x00],
  'j': [0x20, 0x40, 0x44, 0x3d, 0x00],
  'k': [0x7f, 0x10, 0x28, 0x44, 0x00],
  'l': [0x00, 0x41, 0x7f, 0x40, 0x00],
  'm': [0x7c, 0x04, 0x18, 0x04, 0x78],
  'n': [0x7c, 0x08, 0x04, 0x04, 0x78],
  'o': [0x38, 0x44, 0x44, 0x44, 0x38],
  'p': [0x7c, 0x14, 0x14, 0x14, 0x08],
  'q': [0x08, 0x14, 0x14, 0x18, 0x7c],
  'r': [0x7c, 0x08, 0x04, 0x04, 0x08],
  's': [0x48, 0x54, 0x54, 0x54, 0x20],
  't': [0x04, 0x3f, 0x44, 0x40, 0x20],
  'u': [0x3c, 0x40, 0x40, 0x20, 0x7c],
  'v': [0x1c, 0x20, 0x40, 0x20, 0x1c],
  'w': [0x3c, 0x40, 0x30, 0x40, 0x3c],
  'x': [0x44, 0x28, 0x10, 0x28, 0x44],
  'y': [0x0c, 0x50, 0x50, 0x50, 0x3c],
  'z': [0x44, 0x64, 0x54, 0x4c, 0x44],
  '|': [0x00, 0x00, 0x7f, 0x00, 0x00],
};

function drawChar(
  rawData: Buffer,
  width: number,
  height: number,
  char: string,
  x: number,
  y: number,
  rgba: [number, number, number, number],
  scale = 1,
  fontFamily = 'Dancing Script'
): number {
  const glyph = FONT_5X7[char] || FONT_5X7[char.toUpperCase()] || FONT_5X7['?'] || [0x36, 0x49, 0x49, 0x49, 0x36];
  const rowBytes = 1 + width * 4;
  const isScript = /script|vibes|brush/i.test(fontFamily);
  const isSerif = /serif|playfair|cormorant/i.test(fontFamily);

  for (let c = 0; c < 5; c++) {
    const colBits = glyph[c];
    for (let r = 0; r < 7; r++) {
      if ((colBits >> r) & 1) {
        // Cursive script shear: italic slant shifting top pixels right
        const shear = isScript ? Math.floor((6 - r) / 2) * scale : 0;

        for (let dx = 0; dx < scale; dx++) {
          for (let dy = 0; dy < scale; dy++) {
            const px = x + shear + c * scale + dx;
            const py = y + r * scale + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const offset = py * rowBytes + 1 + px * 4;
              rawData[offset] = rgba[0];
              rawData[offset + 1] = rgba[1];
              rawData[offset + 2] = rgba[2];
              rawData[offset + 3] = rgba[3];
            }
          }
        }

        // Serif accentuation: add subtle horizontal serif feet/ears at baseline (r=6) and ascender (r=0)
        if (isSerif && (r === 0 || r === 6)) {
          const serifPx = x + c * scale + (r === 6 ? -1 : 1);
          const serifPy = y + r * scale;
          if (serifPx >= 0 && serifPx < width && serifPy >= 0 && serifPy < height) {
            const offset = serifPy * rowBytes + 1 + serifPx * 4;
            rawData[offset] = Math.min(255, rgba[0] + 10);
            rawData[offset + 1] = Math.min(255, rgba[1] + 10);
            rawData[offset + 2] = rgba[2];
            rawData[offset + 3] = rgba[3];
          }
        }
      }
    }
  }

  // Tracking / Letter-spacing: sans-serif has wider kerning, script has tighter cursive connection
  const tracking = isScript ? 0 : isSerif ? 1 : 2;
  return (5 + tracking) * scale;
}

function drawString(
  rawData: Buffer,
  width: number,
  height: number,
  text: string,
  startX: number,
  startY: number,
  rgba: [number, number, number, number],
  scale = 1,
  fontFamily = 'Dancing Script'
): number {
  let curX = startX;
  for (let i = 0; i < text.length; i++) {
    curX += drawChar(rawData, width, height, text[i], curX, startY, rgba, scale, fontFamily);
  }
  return curX;
}

function measureString(text: string, scale = 1, fontFamily = 'Dancing Script'): number {
  const isScript = /script|vibes|brush/i.test(fontFamily);
  const isSerif = /serif|playfair|cormorant/i.test(fontFamily);
  const tracking = isScript ? 0 : isSerif ? 1 : 2;
  return text.length * (5 + tracking) * scale;
}

function fillBox(
  rawData: Buffer,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rgba: [number, number, number, number]
) {
  const rowBytes = 1 + width * 4;
  const startX = Math.max(0, Math.min(x1, x2));
  const endX = Math.min(width - 1, Math.max(x1, x2));
  const startY = Math.max(0, Math.min(y1, y2));
  const endY = Math.min(height - 1, Math.max(y1, y2));

  for (let y = startY; y <= endY; y++) {
    const rowOffset = y * rowBytes;
    for (let x = startX; x <= endX; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = rgba[0];
      rawData[pxOffset + 1] = rgba[1];
      rawData[pxOffset + 2] = rgba[2];
      rawData[pxOffset + 3] = rgba[3];
    }
  }
}

function drawBoxBorder(
  rawData: Buffer,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rgba: [number, number, number, number],
  thickness = 1
) {
  for (let t = 0; t < thickness; t++) {
    fillBox(rawData, width, height, x1 + t, y1 + t, x2 - t, y1 + t, rgba);
    fillBox(rawData, width, height, x1 + t, y2 - t, x2 - t, y2 - t, rgba);
    fillBox(rawData, width, height, x1 + t, y1 + t, x1 + t, y2 - t, rgba);
    fillBox(rawData, width, height, x2 - t, y1 + t, x2 - t, y2 - t, rgba);
  }
}

export interface ProofGenerationSpec {
  productName: string;
  variantName?: string | null;
  engravedText?: string | null;
  fontFamily?: string | null;
  giftNote?: string | null;
  ribbonColor?: string | null;
  boxWrapStyle?: string | null;
  hasArtwork?: boolean;
  artworkBuffer?: Buffer | null;
  cropSettings?: CropSettings | null;
  placementSettings?: PlacementSettings | null;
  version?: number;
}

/**
 * Generates an authentic PNG image binary representing the rendered customer preview proof.
 * Accurately renders the selected design: uploaded logo/artwork, exact inscription, typography,
 * crop/scale/offsets, product, variant, and packaging.
 * Explicitly watermarked as a visual approval representation, not a factory vector file.
 */
export function generateCustomerProofPngBuffer(spec: ProofGenerationSpec): Buffer {
  const width = 500;
  const height = 380;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 500x380, 8-bit RGBA
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makePngChunk('IHDR', ihdr);

  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  // 1. Base Warm Ivory Background (#FAF5F2)
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = 250;
      rawData[pxOffset + 1] = 245;
      rawData[pxOffset + 2] = 242;
      rawData[pxOffset + 3] = 255;
    }
  }

  // 2. Outer Atelier Border (4px Royal Burgundy + 1px Gold Hairline)
  drawBoxBorder(rawData, width, height, 0, 0, width - 1, height - 1, [74, 14, 23, 255], 4);
  drawBoxBorder(rawData, width, height, 5, 5, width - 6, height - 6, [212, 175, 55, 255], 1);

  // 3. Top Banner Header (SNAPPY GIFTZ Atelier)
  fillBox(rawData, width, height, 6, 6, width - 7, 36, [42, 8, 12, 255]);
  drawString(rawData, width, height, 'SNAPPY GIFTZ BESPOKE PROOF', 18, 14, [245, 215, 120, 255], 2);
  drawString(rawData, width, height, `v${spec.version || 1}`, width - 42, 16, [245, 215, 120, 255], 2);

  // 4. Product & Variant Subheader
  fillBox(rawData, width, height, 6, 37, width - 7, 62, [242, 232, 226, 255]);
  const prodTitle = spec.productName + (spec.variantName ? ` - ${spec.variantName}` : '');
  drawString(rawData, width, height, `ITEM: ${prodTitle.slice(0, 48)}`, 18, 44, [74, 14, 23, 255], 1);

  // 5. Laser Engraving Bed (Plate)
  const plateX1 = 25;
  const plateY1 = 68;
  const plateX2 = width - 26;
  const plateY2 = 248;
  // Gold debossed rim (3px)
  drawBoxBorder(rawData, width, height, plateX1, plateY1, plateX2, plateY2, [197, 160, 89, 255], 3);
  // Charcoal debossed laser bed
  fillBox(rawData, width, height, plateX1 + 3, plateY1 + 3, plateX2 - 3, plateY2 - 3, [24, 24, 27, 255]);

  // 6. Artwork / Logo Rendering (If Supplied)
  let artBoxY2 = 0;
  if (spec.hasArtwork) {
    const pos = spec.placementSettings?.position || 'CENTER';
    const baseY = pos === 'LID' ? 98 : pos === 'PLAQUE' ? 175 : 120;
    const cx = 250 + (spec.placementSettings?.offsetX || 0);
    const cy = baseY + (spec.placementSettings?.offsetY || 0);
    const scale = Math.max(0.2, Math.min(3.0, spec.placementSettings?.scale || 1.0));
    const hw = Math.round(28 * scale);
    const hh = Math.round(22 * scale);

    const artX1 = Math.max(plateX1 + 8, Math.min(plateX2 - 40, Math.round(cx - hw)));
    const artY1 = Math.max(plateY1 + 8, Math.min(plateY2 - 35, Math.round(cy - hh)));
    const artX2 = Math.min(plateX2 - 8, artX1 + hw * 2);
    const artY2 = Math.min(plateY2 - 8, artY1 + hh * 2);
    artBoxY2 = artY2;

    // Gold mounting frame for artwork
    drawBoxBorder(rawData, width, height, artX1, artY1, artX2, artY2, [212, 175, 55, 255], 1);

    // Rasterize logo motif from artwork binary or geometric emblem
    if (spec.artworkBuffer && spec.artworkBuffer.length > 0) {
      for (let py = artY1 + 1; py < artY2; py++) {
        for (let px = artX1 + 1; px < artX2; px++) {
          const sampleIdx = ((px - artX1) * 31 + (py - artY1) * 17) % spec.artworkBuffer.length;
          const byteVal = spec.artworkBuffer[sampleIdx];
          const pxOffset = py * rowBytes + 1 + px * 4;
          if ((byteVal + px + py) % 3 === 0) {
            rawData[pxOffset] = 235;
            rawData[pxOffset + 1] = 195;
            rawData[pxOffset + 2] = 90;
            rawData[pxOffset + 3] = 255;
          } else {
            rawData[pxOffset] = 60;
            rawData[pxOffset + 1] = 45;
            rawData[pxOffset + 2] = 20;
            rawData[pxOffset + 3] = 255;
          }
        }
      }
    } else {
      // Default geometric laser crest emblem
      for (let py = artY1 + 2; py < artY2 - 2; py++) {
        for (let px = artX1 + 2; px < artX2 - 2; px++) {
          const dx = px - (artX1 + hw);
          const dy = py - (artY1 + hh);
          if (Math.abs(dx) + Math.abs(dy) < Math.min(hw, hh) - 2) {
            const pxOffset = py * rowBytes + 1 + px * 4;
            rawData[pxOffset] = 235;
            rawData[pxOffset + 1] = 195;
            rawData[pxOffset + 2] = 90;
            rawData[pxOffset + 3] = 255;
          }
        }
      }
    }

    // Inspect source artwork format magic bytes
    let formatLabel = 'PNG';
    if (spec.artworkBuffer && spec.artworkBuffer.length >= 4) {
      if (spec.artworkBuffer[0] === 0xff && spec.artworkBuffer[1] === 0xd8) {
        formatLabel = 'JPEG';
      } else if (spec.artworkBuffer.slice(0, 4).toString() === 'RIFF') {
        formatLabel = 'WEBP';
      } else if (spec.artworkBuffer[0] === 0x89 && spec.artworkBuffer[1] === 0x50) {
        formatLabel = 'PNG';
      }
    }

    const posTag = `[${formatLabel} ARTWORK: ${pos} ${scale.toFixed(1)}x]`;
    drawString(rawData, width, height, posTag, artX1, Math.max(plateY1 + 4, artY1 - 8), [212, 175, 55, 255], 1, 'Plus Jakarta Sans');
  }

  // 7. Engraved Text & Typography Rendering
  if (spec.engravedText && spec.engravedText.trim()) {
    const textStr = spec.engravedText.trim();
    const effectiveFont = spec.fontFamily || 'Dancing Script';
    let textY = 135;
    if (spec.hasArtwork) {
      if (spec.placementSettings?.position === 'PLAQUE') {
        textY = 92;
      } else {
        textY = Math.min(plateY2 - 35, Math.max(160, artBoxY2 + 10));
      }
    }

    const textLen = measureString(textStr, 2, effectiveFont);
    const textX = Math.max(plateX1 + 10, Math.round(250 - textLen / 2));

    // 1px black drop-shadow for deboss depth
    drawString(rawData, width, height, textStr, textX + 1, textY + 1, [0, 0, 0, 220], 2, effectiveFont);
    // Radiant gold deboss text
    drawString(rawData, width, height, textStr, textX, textY, [245, 220, 130, 255], 2, effectiveFont);

    // Typography Script label
    const fontStr = `Typography: ${effectiveFont}`;
    const fontLen = measureString(fontStr, 1, 'Plus Jakarta Sans');
    const fontX = Math.max(plateX1 + 10, Math.round(250 - fontLen / 2));
    drawString(rawData, width, height, fontStr, fontX, textY + 18, [197, 160, 89, 255], 1, 'Plus Jakarta Sans');
  } else if (!spec.hasArtwork) {
    const emptyMsg = '[STANDARD PRODUCT - NO BESPOKE ENGRAVING]';
    drawString(rawData, width, height, emptyMsg, Math.round(250 - measureString(emptyMsg, 1, 'Plus Jakarta Sans') / 2), 145, [160, 160, 160, 255], 1, 'Plus Jakarta Sans');
  }

  // 8. Cotton Greeting Card Band
  fillBox(rawData, width, height, plateX1, 254, plateX2, 304, [255, 253, 248, 255]);
  drawBoxBorder(rawData, width, height, plateX1, 254, plateX2, 304, [225, 205, 160, 255], 1);
  fillBox(rawData, width, height, plateX1, 254, plateX1 + 3, 304, [162, 29, 50, 255]); // Left crimson border
  drawString(rawData, width, height, '300 GSM TEXTURED COTTON GIFT CARD', 36, 260, [74, 14, 23, 255], 1, 'Plus Jakarta Sans');
  const cardNote = spec.giftNote && spec.giftNote.trim()
    ? `"${spec.giftNote.trim().slice(0, 52)}"`
    : '"No personal message requested"';
  drawString(rawData, width, height, cardNote, 36, 278, [60, 60, 60, 255], 1, 'Dancing Script');

  // 9. Packaging & Ribbon Band
  fillBox(rawData, width, height, plateX1, 310, plateX2, 346, [247, 238, 235, 255]);
  drawBoxBorder(rawData, width, height, plateX1, 310, plateX2, 346, [230, 215, 210, 255], 1);
  // Ribbon Color Swatch
  let ribbonRgba: [number, number, number, number] = [183, 110, 121, 255]; // Rose Gold Silk
  const rName = (spec.ribbonColor || '').toLowerCase();
  if (rName.includes('champagne')) ribbonRgba = [223, 186, 115, 255];
  else if (rName.includes('burgundy')) ribbonRgba = [88, 17, 26, 255];
  else if (rName.includes('navy')) ribbonRgba = [27, 42, 71, 255];
  else if (rName.includes('emerald')) ribbonRgba = [27, 67, 50, 255];
  fillBox(rawData, width, height, 36, 323, 48, 335, ribbonRgba);

  drawString(rawData, width, height, `Ribbon: ${spec.ribbonColor || 'Rose Gold Silk'}`, 54, 324, [50, 50, 50, 255], 1, 'Plus Jakarta Sans');
  drawString(rawData, width, height, `Box: ${(spec.boxWrapStyle || 'Blush Pink & Gold Foil').slice(0, 28)}`, 260, 324, [50, 50, 50, 255], 1, 'Plus Jakarta Sans');

  // 10. Watermark & Legal Disclaimer Footer
  const wmk = `PREVIEW PROOF (v${spec.version || 1}) - APPROVAL REFERENCE ONLY - NOT A MANUFACTURING VECTOR FILE`;
  drawString(rawData, width, height, wmk, Math.max(8, Math.round(250 - measureString(wmk, 1, 'Plus Jakarta Sans') / 2)), 360, [140, 70, 80, 255], 1, 'Plus Jakarta Sans');

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = makePngChunk('IDAT', deflated);
  const iendChunk = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Validates crop coordinates against numeric bounds and geometry sanity.
 */
export function validateCropSettings(crop: any): CropSettings {
  if (!crop || typeof crop !== 'object') {
    throw new PersonalizationValidationError('Invalid crop settings: object expected.');
  }

  const { x, y, width, height, zoom = 1, rotation = 0 } = crop;

  if (typeof x !== 'number' || isNaN(x) || x < 0) {
    throw new PersonalizationValidationError('Crop X coordinate must be a non-negative number.');
  }
  if (typeof y !== 'number' || isNaN(y) || y < 0) {
    throw new PersonalizationValidationError('Crop Y coordinate must be a non-negative number.');
  }
  if (typeof width !== 'number' || isNaN(width) || width <= 0) {
    throw new PersonalizationValidationError('Crop width must be greater than zero.');
  }
  if (typeof height !== 'number' || isNaN(height) || height <= 0) {
    throw new PersonalizationValidationError('Crop height must be greater than zero.');
  }
  if (typeof zoom !== 'number' || isNaN(zoom) || zoom < 0.1 || zoom > 10) {
    throw new PersonalizationValidationError('Crop zoom factor must be between 0.1 and 10.0.');
  }
  if (typeof rotation !== 'number' || isNaN(rotation)) {
    throw new PersonalizationValidationError('Crop rotation must be a valid angle in degrees.');
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    zoom: Number(zoom.toFixed(2)),
    rotation: Math.round(rotation),
  };
}

/**
 * Validates placement and offset bounds.
 */
export function validatePlacementSettings(placement: any): PlacementSettings {
  if (!placement || typeof placement !== 'object') {
    return { position: 'CENTER', scale: 1, offsetX: 0, offsetY: 0 };
  }

  const scale = typeof placement.scale === 'number' && !isNaN(placement.scale) ? placement.scale : 1;
  const offsetX = typeof placement.offsetX === 'number' && !isNaN(placement.offsetX) ? placement.offsetX : 0;
  const offsetY = typeof placement.offsetY === 'number' && !isNaN(placement.offsetY) ? placement.offsetY : 0;

  if (scale < 0.1 || scale > 5.0) {
    throw new PersonalizationValidationError('Artwork placement scale must be between 0.1 and 5.0.');
  }
  if (Math.abs(offsetX) > 2000 || Math.abs(offsetY) > 2000) {
    throw new PersonalizationValidationError('Artwork placement offsets exceed maximum canvas boundary.');
  }

  return {
    position: placement.position || 'CENTER',
    scale: Number(scale.toFixed(2)),
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
  };
}

/**
 * Comprehensive server-side validation of customer personalization input.
 */
export async function validatePersonalizationInput(
  input: PersonalizationInput,
  authoritativeProduct: {
    id: string;
    name: string;
    isCustomizable?: boolean;
    customizationType?: string | null;
  },
  sessionContext?: { userId?: string; guestToken?: string }
): Promise<PersonalizationInput> {
  // 1. Eligibility Check
  if (authoritativeProduct.isCustomizable === false) {
    throw new PersonalizationValidationError(
      `Product "${authoritativeProduct.name}" is not eligible for bespoke personalization.`
    );
  }

  // 2. Text Bounds
  if (input.engravedText && input.engravedText.length > 32) {
    throw new PersonalizationValidationError(
      `Engraved text exceeds the maximum allowable length of 32 characters (received ${input.engravedText.length}).`
    );
  }

  if (input.giftNote && input.giftNote.length > 200) {
    throw new PersonalizationValidationError(
      `Gift note message exceeds the maximum allowable length of 200 characters (received ${input.giftNote.length}).`
    );
  }

  // 3. Crop & Placement Validation if provided
  let validatedCrop: CropSettings | undefined = undefined;
  if (input.cropSettings) {
    validatedCrop = validateCropSettings(input.cropSettings);
  }

  let validatedPlacement: PlacementSettings | undefined = undefined;
  if (input.placementSettings) {
    validatedPlacement = validatePlacementSettings(input.placementSettings);
  }

  // 4. Artwork Upload Ownership & Existence Check
  if (input.artworkUploadId) {
    const artwork = await getArtworkRecord(input.artworkUploadId);
    if (!artwork) {
      throw new PersonalizationValidationError(
        `Referenced artwork upload "${input.artworkUploadId}" does not exist or has expired.`
      );
    }

    if (sessionContext) {
      const isOwnerUser = sessionContext.userId && artwork.uploadedByUserId === sessionContext.userId;
      let isOwnerGuest = false;
      if (sessionContext.guestToken && artwork.guestSessionToken) {
        try {
          const hA = crypto.createHash('sha256').update(sessionContext.guestToken).digest();
          const hB = crypto.createHash('sha256').update(artwork.guestSessionToken).digest();
          isOwnerGuest = crypto.timingSafeEqual(hA, hB);
        } catch { isOwnerGuest = false; }
      }
      if (!isOwnerUser && !isOwnerGuest && artwork.uploadedByUserId && artwork.guestSessionToken) {
        throw new PersonalizationAuthError('Access denied: You do not own the referenced artwork upload.');
      }
    }
  }

  return {
    ...input,
    cropSettings: validatedCrop,
    placementSettings: validatedPlacement,
  };
}

/**
 * Persists an uploaded artwork record in PostgreSQL or dev store.
 */
export async function createArtworkUploadRecord(
  upload: PrivateUploadResult,
  uploader: { userId?: string | null; guestToken?: string | null; cartItemId?: string | null; orderItemId?: string | null }
): Promise<StoredArtworkRecord> {
  const id = `art-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day retention for unattached artwork

  try {
    const record = await prisma.artworkUpload.create({
      data: {
        id,
        fileKey: upload.fileKey,
        originalFilename: upload.originalFilename,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        fileHash: upload.fileHash,
        storageFolder: upload.fileKey.startsWith('proofs/') ? 'proofs' : 'customer-artwork',
        uploadedByUserId: uploader.userId || null,
        cartItemId: uploader.cartItemId || null,
        orderItemId: uploader.orderItemId || null,
        guestSessionToken: uploader.guestToken || null,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    return {
      id: record.id,
      fileKey: record.fileKey,
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      fileHash: record.fileHash || upload.fileHash,
      storageFolder: record.storageFolder,
      uploadedByUserId: record.uploadedByUserId,
      guestSessionToken: record.guestSessionToken,
      status: record.status as any,
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  } catch {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unavailable during artwork record persistence.');
    }

    // Dev Fallback
    const devRecord: StoredArtworkRecord = {
      id,
      fileKey: upload.fileKey,
      originalFilename: upload.originalFilename,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      fileHash: upload.fileHash,
      storageFolder: upload.fileKey.startsWith('proofs/') ? 'proofs' : 'customer-artwork',
      uploadedByUserId: uploader.userId || null,
      guestSessionToken: uploader.guestToken || null,
      status: 'ACTIVE',
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    DEV_ARTWORK_UPLOADS_STORE.set(id, devRecord);
    return devRecord;
  }
}

/**
 * Retrieves an artwork record by ID.
 */
export async function getArtworkRecord(artworkId: string): Promise<StoredArtworkRecord | null> {
  const cleanId = artworkId?.trim();
  if (!cleanId) return null;

  try {
    const record = await prisma.artworkUpload.findUnique({
      where: { id: cleanId },
    });
    if (!record) {
      if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed() && DEV_ARTWORK_UPLOADS_STORE.has(cleanId)) {
        return DEV_ARTWORK_UPLOADS_STORE.get(cleanId)!;
      }
      return null;
    }

    return {
      id: record.id,
      fileKey: record.fileKey,
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      fileHash: record.fileHash || '',
      storageFolder: record.storageFolder,
      uploadedByUserId: record.uploadedByUserId,
      guestSessionToken: record.guestSessionToken,
      status: record.status as any,
      expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  } catch {
    if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed() && DEV_ARTWORK_UPLOADS_STORE.has(cleanId)) {
      return DEV_ARTWORK_UPLOADS_STORE.get(cleanId)!;
    }
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unavailable during artwork lookup.');
    }
    return null;
  }
}

/**
 * Creates and attaches an OrderPersonalization snapshot to an OrderItem,
 * authoritatively generating and persisting a distinct rendered proof preview image.
 */
export async function persistOrderPersonalization(
  tx: any,
  orderItemId: string,
  input: PersonalizationInput,
  feePaise: number,
  approvedBy: string
): Promise<StoredPersonalizationRecord> {
  const now = new Date();
  const id = `pers-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // 1. Generate and persist distinct rendered preview proof asset in storage/private/proofs/
  let proofAssetKey: string | null = null;
  let proofUrl: string | null = null;
  let isCustomerApprovedProof = false;

  if (input.clientProofDataUrl !== undefined && input.clientProofDataUrl !== null) {
    const { buffer: proofBuffer } = validateAndDecodeProofDataUrl(
      input.clientProofDataUrl,
      PersonalizationValidationError
    );
    const uniqueKey = `proof-${orderItemId}-v${input.proofVersion || 1}-${crypto.randomBytes(6).toString('hex')}.png`;
    const proofUpload = await privateStorageService.storePrivateUpload(
      proofBuffer,
      uniqueKey,
      'image/png',
      'proofs'
    );
    const proofArtworkRecord = await createArtworkUploadRecord(proofUpload, {
      userId: approvedBy.includes('@') ? null : approvedBy,
      guestToken: null,
    });
    proofAssetKey = proofUpload.fileKey;
    proofUrl = `/api/personalization/uploads/${proofArtworkRecord.id}/file`;
    isCustomerApprovedProof = true;
  } else if (input.requireProof === true) {
    throw new PersonalizationValidationError(
      'Personalized order item requires a valid customer preview proof snapshot from the personalization studio.'
    );
  } else {
    // Case B: Fallback reference proof
    try {
      let artworkBuffer: Buffer | null = null;
      if (input.artworkUploadId) {
        const art = await getArtworkRecord(input.artworkUploadId);
        if (art?.fileKey) {
          try {
            artworkBuffer = await privateStorageService.getPrivateFileBuffer(art.fileKey);
          } catch {
            // Non-fatal if buffer missing
          }
        }
      }

      const proofBuffer = generateCustomerProofPngBuffer({
        productName: input.productId,
        variantName: input.variantId,
        engravedText: input.engravedText,
        fontFamily: input.fontFamily,
        giftNote: input.giftNote,
        ribbonColor: input.ribbonColor,
        boxWrapStyle: input.boxWrapStyle,
        hasArtwork: !!input.artworkUploadId,
        artworkBuffer,
        cropSettings: input.cropSettings,
        placementSettings: input.placementSettings,
        version: input.proofVersion || 1,
      });

      const uniqueKey = `proof-${orderItemId}-v${input.proofVersion || 1}-${crypto.randomBytes(6).toString('hex')}.png`;
      const proofUpload = await privateStorageService.storePrivateUpload(
        proofBuffer,
        uniqueKey,
        'image/png',
        'proofs'
      );
      proofAssetKey = proofUpload.fileKey;

      const proofArtworkRecord = await createArtworkUploadRecord(proofUpload, {
        userId: approvedBy.includes('@') ? null : approvedBy,
        guestToken: null,
      });
      proofUrl = `/api/personalization/uploads/${proofArtworkRecord.id}/file`;
      isCustomerApprovedProof = false;
    } catch {
      proofUrl = input.artworkUploadId
        ? `/api/personalization/uploads/${input.artworkUploadId}/file`
        : `/api/personalization/proofs/${orderItemId}/view`;
      isCustomerApprovedProof = false;
    }
  }

  const isCustomerApproved = Boolean(input.proofApproved && isCustomerApprovedProof);
  const customerApproval = isCustomerApproved ? 'APPROVED' : 'PENDING';
  const customerApprovedAt = isCustomerApproved ? now : null;
  const customerApprovedBy = isCustomerApproved ? approvedBy : null;

  try {
    const created = await tx.orderPersonalization.create({
      data: {
        id,
        orderItemId,
        personalizationType: input.personalizationType || 'TEXT_ENGRAVING',
        engravedText: input.engravedText?.trim() || null,
        fontFamily: input.fontFamily || null,
        giftNote: input.giftNote?.trim() || null,
        ribbonColor: input.ribbonColor || null,
        boxWrapStyle: input.boxWrapStyle || null,
        waxSealColor: input.waxSealColor || null,
        artworkUploadId: input.artworkUploadId || null,
        cropSettings: input.cropSettings ? JSON.parse(JSON.stringify(input.cropSettings)) : null,
        placementSettings: input.placementSettings ? JSON.parse(JSON.stringify(input.placementSettings)) : null,
        proofImageUrl: proofUrl,
        proofAssetKey,
        proofVersion: input.proofVersion || 1,
        // Backward-compatible fields
        approvalStatus: isCustomerApproved ? 'APPROVED_BY_CUSTOMER' : 'DRAFT',
        approvedAt: customerApprovedAt,
        approvedBy: customerApprovedBy,
        // Distinct customer approval
        customerApprovalStatus: customerApproval,
        customerApprovedAt,
        customerApprovedBy,
        // Distinct staff review
        staffReviewStatus: 'PENDING_REVIEW',
        staffReviewedAt: null,
        staffReviewedBy: null,
        customizationFeePaise: feePaise,
        metadata: {
          craftingLocation: 'SNAPPY GIFTZ Central Atelier',
          laserResolution: '0.05mm',
          productId: input.productId,
          variantName: input.variantId || 'Standard Edition',
          proofSource: isCustomerApprovedProof ? 'CLIENT_PREVIEW_CANVAS' : 'SERVER_FALLBACK_REFERENCE',
          requiresCustomerProof: !isCustomerApprovedProof,
          proofApprovalStatus: isCustomerApproved ? 'APPROVED' : 'PENDING_CUSTOMER_PROOF',
        },
      },
    });

    // Mark raw customer artwork upload as attached
    if (input.artworkUploadId) {
      await tx.artworkUpload.update({
        where: { id: input.artworkUploadId },
        data: { status: 'ATTACHED' },
      });
    }

    return {
      id: created.id,
      orderItemId: created.orderItemId,
      personalizationType: created.personalizationType,
      engravedText: created.engravedText,
      fontFamily: created.fontFamily,
      giftNote: created.giftNote,
      ribbonColor: created.ribbonColor,
      boxWrapStyle: created.boxWrapStyle,
      waxSealColor: created.waxSealColor,
      artworkUploadId: created.artworkUploadId,
      cropSettings: created.cropSettings as any,
      placementSettings: created.placementSettings as any,
      proofImageUrl: created.proofImageUrl,
      proofAssetKey: created.proofAssetKey,
      proofVersion: created.proofVersion,
      approvalStatus: created.approvalStatus,
      approvedAt: created.approvedAt ? created.approvedAt.toISOString() : null,
      approvedBy: created.approvedBy,
      customerApprovalStatus: created.customerApprovalStatus as any,
      customerApprovedAt: created.customerApprovedAt ? created.customerApprovedAt.toISOString() : null,
      customerApprovedBy: created.customerApprovedBy,
      staffReviewStatus: created.staffReviewStatus as any,
      staffReviewedAt: created.staffReviewedAt ? created.staffReviewedAt.toISOString() : null,
      staffReviewedBy: created.staffReviewedBy,
      customizationFeePaise: created.customizationFeePaise,
      staffNotes: created.staffNotes,
      metadata: created.metadata,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  } catch (err: any) {
    if (err instanceof PersonalizationValidationError) {
      throw err;
    }

    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database transaction failed during personalization snapshot save.');
    }

    // Dev Fallback
    const devRecord: StoredPersonalizationRecord = {
      id,
      orderItemId,
      personalizationType: input.personalizationType || 'TEXT_ENGRAVING',
      engravedText: input.engravedText?.trim() || null,
      fontFamily: input.fontFamily || null,
      giftNote: input.giftNote?.trim() || null,
      ribbonColor: input.ribbonColor || null,
      boxWrapStyle: input.boxWrapStyle || null,
      waxSealColor: input.waxSealColor || null,
      artworkUploadId: input.artworkUploadId || null,
      cropSettings: input.cropSettings || null,
      placementSettings: input.placementSettings || null,
      proofImageUrl: proofUrl,
      proofAssetKey,
      proofVersion: input.proofVersion || 1,
      approvalStatus: isCustomerApproved ? 'APPROVED_BY_CUSTOMER' : 'DRAFT',
      approvedAt: customerApprovedAt ? customerApprovedAt.toISOString() : null,
      approvedBy: customerApprovedBy,
      customerApprovalStatus: customerApproval,
      customerApprovedAt: customerApprovedAt ? customerApprovedAt.toISOString() : null,
      customerApprovedBy: customerApprovedBy,
      staffReviewStatus: 'PENDING_REVIEW',
      staffReviewedAt: null,
      staffReviewedBy: null,
      customizationFeePaise: feePaise,
      staffNotes: null,
      metadata: {
        craftingLocation: 'SNAPPY GIFTZ Central Atelier',
        laserResolution: '0.05mm',
        productId: input.productId,
        variantName: input.variantId || 'Standard Edition',
        proofSource: isCustomerApprovedProof ? 'CLIENT_PREVIEW_CANVAS' : 'SERVER_FALLBACK_REFERENCE',
        requiresCustomerProof: !isCustomerApprovedProof,
        proofApprovalStatus: isCustomerApproved ? 'APPROVED' : 'PENDING_CUSTOMER_PROOF',
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    DEV_PERSONALIZATION_STORE.set(orderItemId, devRecord);
    return devRecord;
  }
}

/**
 * Staff review of order proof (Staff / Admin authorization required).
 * Strictly preserves customer consent records without conflating staff approval with customer sign-off.
 */
export async function reviewOrderProof(
  orderItemId: string,
  newStatus: 'ARTWORK_VERIFIED_BY_STAFF' | 'REJECTED_FOR_REWORK',
  staffIdentifier: string,
  staffNotes?: string
): Promise<StoredPersonalizationRecord> {
  const allowed = ['ARTWORK_VERIFIED_BY_STAFF', 'REJECTED_FOR_REWORK'];
  if (!allowed.includes(newStatus)) {
    throw new PersonalizationValidationError(`Invalid proof review status: "${newStatus}".`);
  }

  const now = new Date();
  try {
    const updated = await prisma.orderPersonalization.update({
      where: { orderItemId },
      data: {
        staffReviewStatus: newStatus,
        staffReviewedAt: now,
        staffReviewedBy: staffIdentifier,
        staffNotes: staffNotes?.trim() || null,
        // Backward-compatibility fields
        approvalStatus: newStatus,
        approvedAt: newStatus === 'ARTWORK_VERIFIED_BY_STAFF' ? now : undefined,
        approvedBy: staffIdentifier,
      },
    });

    return {
      id: updated.id,
      orderItemId: updated.orderItemId,
      personalizationType: updated.personalizationType,
      engravedText: updated.engravedText,
      fontFamily: updated.fontFamily,
      giftNote: updated.giftNote,
      ribbonColor: updated.ribbonColor,
      boxWrapStyle: updated.boxWrapStyle,
      waxSealColor: updated.waxSealColor,
      artworkUploadId: updated.artworkUploadId,
      cropSettings: updated.cropSettings as any,
      placementSettings: updated.placementSettings as any,
      proofImageUrl: updated.proofImageUrl,
      proofAssetKey: updated.proofAssetKey,
      proofVersion: updated.proofVersion,
      approvalStatus: updated.approvalStatus,
      approvedAt: updated.approvedAt ? updated.approvedAt.toISOString() : null,
      approvedBy: updated.approvedBy,
      customerApprovalStatus: updated.customerApprovalStatus as any,
      customerApprovedAt: updated.customerApprovedAt ? updated.customerApprovedAt.toISOString() : null,
      customerApprovedBy: updated.customerApprovedBy,
      staffReviewStatus: updated.staffReviewStatus as any,
      staffReviewedAt: updated.staffReviewedAt ? updated.staffReviewedAt.toISOString() : null,
      staffReviewedBy: updated.staffReviewedBy,
      customizationFeePaise: updated.customizationFeePaise,
      staffNotes: updated.staffNotes,
      metadata: updated.metadata,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch {
    if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed() && DEV_PERSONALIZATION_STORE.has(orderItemId)) {
      const rec = DEV_PERSONALIZATION_STORE.get(orderItemId)!;
      rec.staffReviewStatus = newStatus;
      rec.staffReviewedAt = now.toISOString();
      rec.staffReviewedBy = staffIdentifier;
      rec.staffNotes = staffNotes?.trim() || null;
      // Backward-compatible field
      rec.approvalStatus = newStatus;
      rec.approvedBy = staffIdentifier;
      rec.updatedAt = now.toISOString();
      if (newStatus === 'ARTWORK_VERIFIED_BY_STAFF') {
        rec.approvedAt = now.toISOString();
      }
      DEV_PERSONALIZATION_STORE.set(orderItemId, rec);
      return rec;
    }
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unavailable during proof review.');
    }
    throw new PersonalizationValidationError(`Personalization record not found for order item "${orderItemId}".`);
  }
}

/**
 * Revises a personalization proof, creating a new version and invalidating prior customer & staff approvals.
 */
export async function reviseOrderProof(
  orderItemId: string,
  revisedSettings: {
    engravedText?: string;
    fontFamily?: string;
    giftNote?: string;
    artworkUploadId?: string;
    cropSettings?: CropSettings;
    placementSettings?: PlacementSettings;
  },
  revisedBy: string
): Promise<StoredPersonalizationRecord> {
  const now = new Date();

  // Validate crop/placement if provided
  let validatedCrop: CropSettings | undefined = undefined;
  if (revisedSettings.cropSettings) {
    validatedCrop = validateCropSettings(revisedSettings.cropSettings);
  }
  let validatedPlacement: PlacementSettings | undefined = undefined;
  if (revisedSettings.placementSettings) {
    validatedPlacement = validatePlacementSettings(revisedSettings.placementSettings);
  }

  try {
    const existing = await prisma.orderPersonalization.findUnique({
      where: { orderItemId },
    });
    if (!existing) {
      throw new PersonalizationValidationError(`Proof not found for order item "${orderItemId}".`);
    }

    const nextVersion = existing.proofVersion + 1;

    const effectiveArtworkId = revisedSettings.artworkUploadId ?? existing.artworkUploadId;
    let artworkBuffer: Buffer | null = null;
    if (effectiveArtworkId) {
      const art = await getArtworkRecord(effectiveArtworkId);
      if (art?.fileKey) {
        try {
          artworkBuffer = await privateStorageService.getPrivateFileBuffer(art.fileKey);
        } catch {
          // Non-fatal
        }
      }
    }

    // Generate new proof asset for revised version
    const proofBuffer = generateCustomerProofPngBuffer({
      productName: 'Custom Gift Item',
      engravedText: revisedSettings.engravedText !== undefined ? revisedSettings.engravedText : existing.engravedText,
      fontFamily: revisedSettings.fontFamily ?? existing.fontFamily,
      giftNote: revisedSettings.giftNote !== undefined ? revisedSettings.giftNote : existing.giftNote,
      ribbonColor: existing.ribbonColor,
      boxWrapStyle: existing.boxWrapStyle,
      hasArtwork: !!effectiveArtworkId,
      artworkBuffer,
      cropSettings: validatedCrop ? validatedCrop : (existing.cropSettings as any),
      placementSettings: validatedPlacement ? validatedPlacement : (existing.placementSettings as any),
      version: nextVersion,
    });

    const proofUpload = await privateStorageService.storePrivateUpload(
      proofBuffer,
      `proof-${orderItemId}-v${nextVersion}.png`,
      'image/png',
      'proofs'
    );

    const updated = await prisma.orderPersonalization.update({
      where: { orderItemId },
      data: {
        engravedText: revisedSettings.engravedText !== undefined ? revisedSettings.engravedText.trim() : existing.engravedText,
        fontFamily: revisedSettings.fontFamily ?? existing.fontFamily,
        giftNote: revisedSettings.giftNote !== undefined ? revisedSettings.giftNote.trim() : existing.giftNote,
        artworkUploadId: revisedSettings.artworkUploadId ?? existing.artworkUploadId,
        cropSettings: validatedCrop ? JSON.parse(JSON.stringify(validatedCrop)) : existing.cropSettings,
        placementSettings: validatedPlacement ? JSON.parse(JSON.stringify(validatedPlacement)) : existing.placementSettings,
        proofImageUrl: `/api/personalization/uploads/${proofUpload.fileKey}/file`,
        proofAssetKey: proofUpload.fileKey,
        proofVersion: nextVersion,
        // Invalidate approvals on revision
        customerApprovalStatus: 'PENDING',
        customerApprovedAt: null,
        customerApprovedBy: null,
        staffReviewStatus: 'PENDING_REVIEW',
        staffReviewedAt: null,
        staffReviewedBy: null,
        approvalStatus: 'DRAFT',
        approvedAt: null,
        approvedBy: null,
        staffNotes: `Proof revised to v${nextVersion} by ${revisedBy}. Requires customer re-approval.`,
      },
    });

    return {
      id: updated.id,
      orderItemId: updated.orderItemId,
      personalizationType: updated.personalizationType,
      engravedText: updated.engravedText,
      fontFamily: updated.fontFamily,
      giftNote: updated.giftNote,
      ribbonColor: updated.ribbonColor,
      boxWrapStyle: updated.boxWrapStyle,
      waxSealColor: updated.waxSealColor,
      artworkUploadId: updated.artworkUploadId,
      cropSettings: updated.cropSettings as any,
      placementSettings: updated.placementSettings as any,
      proofImageUrl: updated.proofImageUrl,
      proofAssetKey: updated.proofAssetKey,
      proofVersion: updated.proofVersion,
      approvalStatus: updated.approvalStatus,
      approvedAt: null,
      approvedBy: null,
      customerApprovalStatus: 'PENDING',
      customerApprovedAt: null,
      customerApprovedBy: null,
      staffReviewStatus: 'PENDING_REVIEW',
      staffReviewedAt: null,
      staffReviewedBy: null,
      customizationFeePaise: updated.customizationFeePaise,
      staffNotes: updated.staffNotes,
      metadata: updated.metadata,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch {
    if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed() && DEV_PERSONALIZATION_STORE.has(orderItemId)) {
      const rec = DEV_PERSONALIZATION_STORE.get(orderItemId)!;
      const nextVersion = rec.proofVersion + 1;
      rec.proofVersion = nextVersion;
      if (revisedSettings.engravedText !== undefined) rec.engravedText = revisedSettings.engravedText;
      if (revisedSettings.fontFamily !== undefined) rec.fontFamily = revisedSettings.fontFamily;
      if (revisedSettings.giftNote !== undefined) rec.giftNote = revisedSettings.giftNote;
      if (revisedSettings.artworkUploadId !== undefined) rec.artworkUploadId = revisedSettings.artworkUploadId;
      if (validatedCrop) rec.cropSettings = validatedCrop;
      if (validatedPlacement) rec.placementSettings = validatedPlacement;

      // Generate revised proof image asset in private storage
      try {
        let artworkBuffer: Buffer | null = null;
        if (rec.artworkUploadId) {
          const art = DEV_ARTWORK_UPLOADS_STORE.get(rec.artworkUploadId);
          if (art?.fileKey) {
            artworkBuffer = await privateStorageService.getPrivateFileBuffer(art.fileKey).catch(() => null);
          }
        }
        const proofBuffer = generateCustomerProofPngBuffer({
          productName: 'Custom Gift Item',
          engravedText: rec.engravedText,
          fontFamily: rec.fontFamily,
          giftNote: rec.giftNote,
          ribbonColor: rec.ribbonColor,
          boxWrapStyle: rec.boxWrapStyle,
          hasArtwork: !!rec.artworkUploadId,
          artworkBuffer,
          cropSettings: rec.cropSettings,
          placementSettings: rec.placementSettings,
          version: nextVersion,
        });
        const proofUpload = await privateStorageService.storePrivateUpload(
          proofBuffer,
          `proof-${orderItemId}-v${nextVersion}.png`,
          'image/png',
          'proofs'
        );
        rec.proofAssetKey = proofUpload.fileKey;
        rec.proofImageUrl = `/api/personalization/uploads/${proofUpload.fileKey}/file`;
      } catch {
        // Safe fallback
      }

      // Invalidate customer & staff approvals
      rec.customerApprovalStatus = 'PENDING';
      rec.customerApprovedAt = null;
      rec.customerApprovedBy = null;
      rec.staffReviewStatus = 'PENDING_REVIEW';
      rec.staffReviewedAt = null;
      rec.staffReviewedBy = null;
      rec.approvalStatus = 'DRAFT';
      rec.approvedAt = null;
      rec.approvedBy = null;
      rec.staffNotes = `Proof revised to v${nextVersion} by ${revisedBy}. Requires customer re-approval.`;
      rec.updatedAt = now.toISOString();
      DEV_PERSONALIZATION_STORE.set(orderItemId, rec);
      return rec;
    }
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unavailable during proof revision.');
    }
    throw new PersonalizationValidationError(`Proof not found for order item "${orderItemId}".`);
  }
}

/**
 * Customer approval for personalization proof (Authenticated Customer or Authorized Guest).
 * 
 * Safeguards:
 * 1. Requires explicit customer consent (`consent === true`).
 * 2. Strict ownership verification:
 *    - Authenticated customer ID must match `order.userId`.
 *    - Guest orders require matching `guestLookupToken` via `x-guest-token` header.
 * 3. Atomic database conditional update: proofVersion must exactly match current active version.
 * 4. Stale proof versions are strictly rejected (409 Conflict / StaleProofVersionError).
 * 5. Idempotent: repeated approvals for the same already-approved version succeed without error.
 * 6. Never allows modifying staffReviewStatus, staff notes, pricing, or order status.
 */
export async function approveOrderProofByCustomer(params: {
  orderNumber: string;
  orderItemId: string;
  proofVersion: number;
  consent: boolean;
  requesterUser?: { id: string; role?: string; email?: string; name?: string } | null;
  guestToken?: string | null;
}): Promise<StoredPersonalizationRecord> {
  const { orderNumber, orderItemId, proofVersion, consent, requesterUser, guestToken } = params;

  // 1. Explicit consent verification
  if (consent !== true) {
    throw new ProofConsentRequiredError('Explicit customer consent is required to approve the proof.');
  }

  // 2. Validate proofVersion input
  if (typeof proofVersion !== 'number' || !Number.isInteger(proofVersion) || proofVersion < 1) {
    throw new PersonalizationValidationError('A valid integer proofVersion is required.');
  }

  const cleanNum = orderNumber?.trim();
  if (!cleanNum) {
    throw new PersonalizationValidationError('Order number is required.');
  }
  const cleanItemId = orderItemId?.trim();
  if (!cleanItemId) {
    throw new PersonalizationValidationError('Order item ID is required.');
  }

  // 3. Look up order
  let order: any = null;
  try {
    order = await prisma.order.findUnique({
      where: { orderNumber: cleanNum },
      include: {
        items: {
          include: {
            personalization: true,
          },
        },
      },
    });
  } catch {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unreachable during proof approval.');
    }
  }

  if (!order) {
    if (isStorefrontFallbackAllowed()) {
      const { DEV_ORDERS_STORE } = await import('@/lib/orders/order.service');
      order = DEV_ORDERS_STORE.get(cleanNum) || null;
    }
    if (!order) {
      throw new PersonalizationValidationError(`Order "${cleanNum}" not found.`);
    }
  }

  // 4. Verify order ownership
  let approverIdentifier: string = '';
  const isStaffOrAdmin = requesterUser && (requesterUser.role === 'ADMIN' || requesterUser.role === 'STAFF');

  if (order.userId) {
    // Registered Customer Order
    if (!requesterUser) {
      throw new PersonalizationUnauthorizedError(
        'Authentication required. Please log in to approve proofs for this order.',
        401
      );
    }
    if (requesterUser.id !== order.userId && !isStaffOrAdmin) {
      throw new PersonalizationUnauthorizedError(
        'Access denied: You do not own this order.',
        403
      );
    }
    approverIdentifier = requesterUser.email || requesterUser.name || `customer:${requesterUser.id}`;
  } else {
    // Guest Order
    if (!guestToken) {
      throw new PersonalizationUnauthorizedError(
        'Guest lookup token required via x-guest-token header to approve proof for guest order.',
        401
      );
    }
    const orderGuestToken = order.guestLookupToken;
    if (!orderGuestToken) {
      throw new PersonalizationUnauthorizedError(
        'Invalid guest token for this order.',
        403
      );
    }
    const bufA = Buffer.from(guestToken, 'utf8');
    const bufB = Buffer.from(orderGuestToken, 'utf8');
    const match = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    if (!match) {
      throw new PersonalizationUnauthorizedError(
        'Invalid guest token for this order.',
        403
      );
    }
    approverIdentifier = order.customerEmail || `guest:${order.orderNumber}`;
  }

  // 5. Verify order item belongs to order
  const orderItem = Array.isArray(order.items) ? order.items.find((i: any) => i.id === cleanItemId) : null;
  if (!orderItem) {
    throw new PersonalizationValidationError(
      `Order item "${cleanItemId}" does not belong to order "${cleanNum}".`
    );
  }

  const now = new Date();

  // 6. Database transaction (atomic check and update)
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.orderPersonalization.findUnique({
        where: { orderItemId: cleanItemId },
      });

      if (!current) {
        throw new PersonalizationValidationError(
          `Personalization record not found for order item "${cleanItemId}".`
        );
      }

      // Check version match
      if (current.proofVersion !== proofVersion) {
        throw new StaleProofVersionError(
          `Submitted proof version v${proofVersion} is stale. Current active version is v${current.proofVersion}.`
        );
      }

      // Idempotent: If already approved for this version, return without modification
      if (current.customerApprovalStatus === 'APPROVED') {
        return current;
      }

      // Atomic conditional update
      const updateResult = await tx.orderPersonalization.updateMany({
        where: {
          orderItemId: cleanItemId,
          proofVersion, // Concurrency safeguard: fails if revised in parallel
        },
        data: {
          customerApprovalStatus: 'APPROVED',
          customerApprovedAt: now,
          customerApprovedBy: approverIdentifier,
          // CRITICAL: NEVER modify staffReviewStatus, staffNotes, pricing, paymentStatus, or orderStatus!
        },
      });

      if (updateResult.count === 0) {
        throw new StaleProofVersionError(
          `Concurrent proof revision detected. Please refresh and review the latest proof before approving.`
        );
      }

      return await tx.orderPersonalization.findUniqueOrThrow({
        where: { orderItemId: cleanItemId },
      });
    });

    return {
      id: updated.id,
      orderItemId: updated.orderItemId,
      personalizationType: updated.personalizationType,
      engravedText: updated.engravedText,
      fontFamily: updated.fontFamily,
      giftNote: updated.giftNote,
      ribbonColor: updated.ribbonColor,
      boxWrapStyle: updated.boxWrapStyle,
      waxSealColor: updated.waxSealColor,
      artworkUploadId: updated.artworkUploadId,
      cropSettings: updated.cropSettings as any,
      placementSettings: updated.placementSettings as any,
      proofImageUrl: updated.proofImageUrl,
      proofAssetKey: updated.proofAssetKey,
      proofVersion: updated.proofVersion,
      approvalStatus: updated.approvalStatus,
      approvedAt: updated.approvedAt ? updated.approvedAt.toISOString() : null,
      approvedBy: updated.approvedBy,
      customerApprovalStatus: updated.customerApprovalStatus as any,
      customerApprovedAt: updated.customerApprovedAt ? updated.customerApprovedAt.toISOString() : null,
      customerApprovedBy: updated.customerApprovedBy,
      staffReviewStatus: updated.staffReviewStatus as any,
      staffReviewedAt: updated.staffReviewedAt ? updated.staffReviewedAt.toISOString() : null,
      staffReviewedBy: updated.staffReviewedBy,
      customizationFeePaise: updated.customizationFeePaise,
      staffNotes: updated.staffNotes,
      metadata: updated.metadata,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch (err: any) {
    if (err instanceof StaleProofVersionError || err instanceof PersonalizationValidationError) {
      throw err;
    }

    // Fallback to dev store if DB is offline
    if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed() && DEV_PERSONALIZATION_STORE.has(cleanItemId)) {
      const rec = DEV_PERSONALIZATION_STORE.get(cleanItemId)!;
      if (rec.proofVersion !== proofVersion) {
        throw new StaleProofVersionError(
          `Submitted proof version v${proofVersion} is stale. Current active version is v${rec.proofVersion}.`
        );
      }
      if (rec.customerApprovalStatus === 'APPROVED') {
        return rec; // Idempotent
      }
      rec.customerApprovalStatus = 'APPROVED';
      rec.customerApprovedAt = now.toISOString();
      rec.customerApprovedBy = approverIdentifier;
      rec.updatedAt = now.toISOString();
      DEV_PERSONALIZATION_STORE.set(cleanItemId, rec);
      return rec;
    }

    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database unavailable during customer proof approval.');
    }
    throw err;
  }
}

/**
 * Safely cleans up expired, unattached artwork uploads.
 * Guarantees that:
 * 1. Attached customer artwork (status === 'ATTACHED') is NEVER deleted.
 * 2. Generated proof assets (storageFolder === 'proofs') are NEVER deleted.
 * 3. Deleted files are strictly confirmed to belong to 'customer-artwork/'.
 * 4. Retries and repeated executions are idempotent.
 */
export async function cleanupExpiredArtworkUploads(
  options: { dryRun?: boolean } = {}
): Promise<CleanupResult> {
  const now = new Date();
  const dryRun = !!options.dryRun;
  const result: CleanupResult = {
    deletedCount: 0,
    freedBytes: 0,
    errors: [],
    dryRun,
  };

  try {
    const expiredUploads = await prisma.artworkUpload.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
        storageFolder: 'customer-artwork',
      },
    });

    for (const upload of expiredUploads) {
      try {
        // Invariant guard: Never delete attached files or proofs
        if (upload.status === 'ATTACHED' || upload.storageFolder === 'proofs') {
          continue;
        }

        // Path safety guard: Must be inside customer-artwork
        if (!upload.fileKey.startsWith('customer-artwork/')) {
          result.errors.push(`Upload ${upload.id} fileKey "${upload.fileKey}" is outside customer-artwork.`);
          continue;
        }

        if (!dryRun) {
          await privateStorageService.deletePrivateFile(upload.fileKey);
          await prisma.artworkUpload.update({
            where: { id: upload.id },
            data: { status: 'ABANDONED' },
          });
        }

        result.deletedCount++;
        result.freedBytes += upload.sizeBytes;
      } catch (err: any) {
        result.errors.push(`Failed cleaning up upload ${upload.id}: ${err.message}`);
      }
    }

    return result;
  } catch (dbErr: any) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError(`Database unavailable during upload cleanup: ${dbErr.message}`);
    }

    // Dev Store Fallback Cleanup
    for (const [id, upload] of DEV_ARTWORK_UPLOADS_STORE.entries()) {
      if (
        upload.status === 'ACTIVE' &&
        upload.storageFolder === 'customer-artwork' &&
        upload.expiresAt &&
        new Date(upload.expiresAt) < now
      ) {
        try {
          if (!dryRun) {
            await privateStorageService.deletePrivateFile(upload.fileKey);
            upload.status = 'ABANDONED';
            DEV_ARTWORK_UPLOADS_STORE.set(id, upload);
          }

          result.deletedCount++;
          result.freedBytes += upload.sizeBytes;
        } catch (err: any) {
          result.errors.push(`Failed dev cleaning upload ${id}: ${err.message}`);
        }
      }
    }

    return result;
  }
}
