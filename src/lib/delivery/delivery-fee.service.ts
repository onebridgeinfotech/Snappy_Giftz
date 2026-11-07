/**
 * Automatic, distance-based delivery charges, measured from the studio location set in
 * Admin > Tax & Delivery. Uses free services only (no paid Google Maps).
 *
 * How the delivery distance is found (best available first):
 *   1. The customer's current GPS location ("Use my current location" at checkout).
 *   2. The typed delivery address, geocoded with free OpenStreetMap Nominatim, accepted only when it
 *      lands within 6 km of its PIN code centre (guards against wrong matches).
 *   3. The PIN code: the built-in Hyderabad table (distances from A S Rao Nagar, used while the
 *      studio is within 1 km of it), otherwise the PIN code centre from Nominatim.
 * Straight-line distances are converted to road estimates (x1.3). A GPS/address distance is never
 * allowed below the PIN code's distance minus 2 km, so a faked location cannot lower the charge.
 *
 * The fee is the first active slab covering that distance (e.g. up to 10 km = ₹200). The customer
 * sees it before placing the order, so placing the order is the approval. When no distance can be
 * found the order falls back to owner review.
 *
 * Set DELIVERY_FEE_MODE=manual to send every order to owner review.
 */
import { prisma } from '@/lib/prisma';
import { distanceService, ATELIER_ADDRESS, MAX_DELIVERY_RADIUS_KM, type DistanceCalculationResult } from '@/lib/shipping/distance.service';
import { geocodeAddress, geocodePincode } from '@/lib/delivery/free-geocoding.service';
import { primePincodeFromDatabase } from '@/lib/delivery/delivery.service';
import { DEV_PINCODES, INITIAL_HYDERABAD_PINCODES } from '@/lib/shipping/pincode.service';

export interface DeliveryFeeSlabDTO {
  id?: string;
  maxDistanceKm: number;
  feePaise: number;
}

export interface DeliverySettingsDTO {
  hubName: string;
  hubAddress: string;
  hubPincode: string;
  hubLatitude: number;
  hubLongitude: number;
  maxRadiusKm: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Used until the owner saves their own slabs (or if the slab table is not migrated yet). */
export const DEFAULT_DELIVERY_FEE_SLABS: DeliveryFeeSlabDTO[] = [
  { maxDistanceKm: 10, feePaise: 20000 }, // up to 10 km: ₹200
  { maxDistanceKm: 15, feePaise: 25000 }, // 10–15 km: ₹250
  { maxDistanceKm: 20, feePaise: 30000 }, // 15–20 km: ₹300
];

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettingsDTO = {
  hubName: 'SNAPPY GIFTZ Studio, A S Rao Nagar',
  hubAddress: `${ATELIER_ADDRESS.street}, ${ATELIER_ADDRESS.locality}, ${ATELIER_ADDRESS.city}, ${ATELIER_ADDRESS.state} ${ATELIER_ADDRESS.pincode}`,
  hubPincode: ATELIER_ADDRESS.pincode,
  hubLatitude: ATELIER_ADDRESS.latitude,
  hubLongitude: ATELIER_ADDRESS.longitude,
  maxRadiusKm: MAX_DELIVERY_RADIUS_KM,
};

/** Straight-line distance is shorter than the road; this converts it to an estimated road distance. */
const ROAD_FACTOR = 1.3;
/** GPS distance may be at most this much below the PIN code's distance (anti-spoofing floor). */
const GPS_BELOW_PIN_TOLERANCE_KM = 2;

export class DeliveryFeeError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'DeliveryFeeError';
    this.statusCode = statusCode;
  }
}

export function isAutoDeliveryFeeEnabled(): boolean {
  return (process.env.DELIVERY_FEE_MODE || 'auto').toLowerCase() !== 'manual';
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Accepts only plausible coordinates inside India; anything else is ignored. */
export function sanitizeGeoPoint(lat: unknown, lng: unknown): GeoPoint | null {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 6 || latitude > 37.5 || longitude < 68 || longitude > 97.5) return null;
  return { latitude, longitude };
}

// ---------------------------------------------------------------------------
// Studio location + radius
// ---------------------------------------------------------------------------

let settingsCache: { value: DeliverySettingsDTO; at: number; isDefault: boolean } | null = null;

export async function getDeliverySettings(): Promise<{ settings: DeliverySettingsDTO; isDefault: boolean }> {
  if (settingsCache && Date.now() - settingsCache.at < 30_000) {
    return { settings: settingsCache.value, isDefault: settingsCache.isDefault };
  }
  let value = DEFAULT_DELIVERY_SETTINGS;
  let isDefault = true;
  try {
    const row = await prisma.deliverySettings.findUnique({ where: { id: 'default' } });
    if (row) {
      value = {
        hubName: row.hubName,
        hubAddress: row.hubAddress,
        hubPincode: row.hubPincode,
        hubLatitude: row.hubLatitude,
        hubLongitude: row.hubLongitude,
        maxRadiusKm: row.maxRadiusKm,
      };
      isDefault = false;
    }
  } catch {
    // Table not migrated yet / DB offline: defaults.
  }
  settingsCache = { value, at: Date.now(), isDefault };
  return { settings: value, isDefault };
}

export async function saveDeliverySettings(input: Partial<DeliverySettingsDTO>, actor: string): Promise<DeliverySettingsDTO> {
  const hubName = String(input.hubName || '').trim();
  const hubAddress = String(input.hubAddress || '').trim();
  const hubPincode = String(input.hubPincode || '').trim();
  const point = sanitizeGeoPoint(input.hubLatitude, input.hubLongitude);
  const maxRadiusKm = Math.round(Number(input.maxRadiusKm));

  if (hubName.length < 2 || hubName.length > 120) throw new DeliveryFeeError('Enter the studio name (2–120 characters).');
  if (hubAddress.length < 5 || hubAddress.length > 400) throw new DeliveryFeeError('Enter the studio address.');
  if (!/^[1-9][0-9]{5}$/.test(hubPincode)) throw new DeliveryFeeError('Studio PIN code must be 6 digits.');
  if (!point) throw new DeliveryFeeError('Latitude/longitude must be a location in India (e.g. 17.4789, 78.5492).');
  if (!Number.isFinite(maxRadiusKm) || maxRadiusKm < 1 || maxRadiusKm > 200) {
    throw new DeliveryFeeError('Delivery radius must be between 1 and 200 km.');
  }

  const data = { hubName, hubAddress, hubPincode, hubLatitude: point.latitude, hubLongitude: point.longitude, maxRadiusKm };
  try {
    await prisma.$transaction([
      prisma.deliverySettings.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...data, updatedBy: actor },
        update: { ...data, updatedBy: actor },
      }),
      prisma.auditLog.create({
        data: { action: 'DELIVERY_SETTINGS_UPDATED', resource: 'DeliverySettings:default', details: { ...data, actor } },
      }),
    ]);
  } catch (err: any) {
    throw new DeliveryFeeError(
      /DeliverySettings|doesn't exist|does not exist/i.test(String(err?.message))
        ? 'The delivery settings table is missing. Run the database migration (npx prisma migrate deploy) and try again.'
        : 'Could not save the studio location. Please try again.',
      500
    );
  }
  settingsCache = null;
  return data;
}

/** The built-in PIN table measures from A S Rao Nagar; it stays valid while the studio is within 1 km. */
function pinTableMatchesHub(settings: DeliverySettingsDTO): boolean {
  return (
    haversineKm(
      { latitude: settings.hubLatitude, longitude: settings.hubLongitude },
      { latitude: ATELIER_ADDRESS.latitude, longitude: ATELIER_ADDRESS.longitude }
    ) <= 1
  );
}

// ---------------------------------------------------------------------------
// Fee slabs
// ---------------------------------------------------------------------------

export async function getDeliveryFeeSlabs(): Promise<{ slabs: DeliveryFeeSlabDTO[]; isDefault: boolean }> {
  try {
    const rows = await prisma.deliveryFeeSlab.findMany({ where: { isActive: true }, orderBy: { maxDistanceKm: 'asc' } });
    if (rows.length > 0) {
      return {
        slabs: rows.map((r) => ({ id: r.id, maxDistanceKm: r.maxDistanceKm, feePaise: Number(r.feePaise) })),
        isDefault: false,
      };
    }
  } catch {
    // Table not migrated yet, or database offline: use defaults.
  }
  return { slabs: DEFAULT_DELIVERY_FEE_SLABS, isDefault: true };
}

export async function saveDeliveryFeeSlabs(slabs: DeliveryFeeSlabDTO[], actor: string): Promise<DeliveryFeeSlabDTO[]> {
  if (!Array.isArray(slabs) || slabs.length === 0 || slabs.length > 20) {
    throw new DeliveryFeeError('Add between 1 and 20 distance slabs.');
  }
  const clean = slabs
    .map((s) => ({ maxDistanceKm: Math.round(Number(s.maxDistanceKm)), feePaise: Math.round(Number(s.feePaise)) }))
    .sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  for (const s of clean) {
    if (!Number.isFinite(s.maxDistanceKm) || s.maxDistanceKm < 1 || s.maxDistanceKm > 200) {
      throw new DeliveryFeeError('Each slab distance must be between 1 and 200 km.');
    }
    if (!Number.isFinite(s.feePaise) || s.feePaise < 0 || s.feePaise > 500000) {
      throw new DeliveryFeeError('Each delivery charge must be between ₹0 and ₹5,000.');
    }
  }
  for (let i = 1; i < clean.length; i++) {
    if (clean[i].maxDistanceKm === clean[i - 1].maxDistanceKm) {
      throw new DeliveryFeeError(`Two slabs use the same distance (${clean[i].maxDistanceKm} km).`);
    }
  }
  try {
    await prisma.$transaction([
      prisma.deliveryFeeSlab.deleteMany({}),
      prisma.deliveryFeeSlab.createMany({
        data: clean.map((s) => ({ maxDistanceKm: s.maxDistanceKm, feePaise: BigInt(s.feePaise), updatedBy: actor })),
      }),
      prisma.auditLog.create({
        data: { action: 'DELIVERY_FEE_SLABS_UPDATED', resource: 'DeliveryFeeSlab', details: { slabs: clean, actor } },
      }),
    ]);
  } catch (err: any) {
    throw new DeliveryFeeError(
      /DeliveryFeeSlab|doesn't exist|does not exist/i.test(String(err?.message))
        ? 'The delivery charges table is missing. Run the database migration (npx prisma migrate deploy) and try again.'
        : 'Could not save delivery charges. Please try again.',
      500
    );
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

/**
 * PIN check honouring the owner's saved PIN settings: a paused PIN is never eligible; a PIN the
 * owner added outside the built-in list is eligible with unknown distance (-1).
 */
export async function evaluateDeliveryDistance(pincode: string, address?: string): Promise<DistanceCalculationResult> {
  const clean = (pincode || '').trim();
  const result = await distanceService.calculateDistance(clean, address);
  if (!/^[1-9][0-9]{5}$/.test(clean)) return result;

  await primePincodeFromDatabase(clean);
  const override = DEV_PINCODES.get(clean);
  if (!override) return result;

  if (!override.isActive) {
    return { ...result, isServiceable: false, message: `Delivery to PIN code ${clean} is currently paused. Please contact us for alternatives.` };
  }
  if (!INITIAL_HYDERABAD_PINCODES[clean]) {
    return {
      ...result,
      isServiceable: true,
      estimatedDistanceKm: -1,
      deliveryMethod: 'ATELIER_EXPRESS',
      message: `Eligible for direct delivery to ${override.areaName || override.city || 'your area'}.`,
    };
  }
  return result;
}

/** Address must land this close to its PIN code centre to be trusted. */
const ADDRESS_MAX_KM_FROM_PIN_CENTRE = 6;

const roadKm = (a: GeoPoint, b: GeoPoint) => Math.ceil(haversineKm(a, b) * ROAD_FACTOR);

export interface DeliveryFeeQuote {
  serviceable: boolean;
  /** true when the fee was calculated automatically and the order can be paid immediately */
  isAutomatic: boolean;
  distanceKm: number | null;
  feePaise: number | null;
  /** how the distance was measured */
  source: 'CURRENT_LOCATION' | 'ADDRESS_MAP' | 'PIN_CODE' | 'UNKNOWN';
  maxRadiusKm: number;
  hubName: string;
  message: string;
}

/** Delivery eligibility + charge for an address. Never trusts a fee from the browser. */
export async function quoteDeliveryFee(pincode: string, address?: string, currentLocation?: GeoPoint | null): Promise<DeliveryFeeQuote> {
  const { settings } = await getDeliverySettings();
  const hub: GeoPoint = { latitude: settings.hubLatitude, longitude: settings.hubLongitude };
  const base = { maxRadiusKm: settings.maxRadiusKm, hubName: settings.hubName };
  const pin = await evaluateDeliveryDistance(pincode, address);

  // A paused PIN, or a PIN outside the known delivery area, is never deliverable.
  const pinKnown = !!INITIAL_HYDERABAD_PINCODES[(pincode || '').trim()] || pin.estimatedDistanceKm === -1;
  if (!pin.isServiceable && (!pinKnown || /paused/i.test(pin.message))) {
    return { ...base, serviceable: false, isAutomatic: false, distanceKm: null, feePaise: null, source: 'UNKNOWN', message: pin.message };
  }

  // Reference distance for the PIN code (also the anti-spoofing floor)
  const cleanPin = (pincode || '').trim();
  const pinCentre = await geocodePincode(cleanPin);
  let pinKm: number | null =
    pinTableMatchesHub(settings) && typeof pin.estimatedDistanceKm === 'number' && pin.estimatedDistanceKm >= 0
      ? pin.estimatedDistanceKm
      : null;
  if (pinKm === null && pinCentre) pinKm = roadKm(hub, pinCentre);

  let km: number | null = null;
  let source: DeliveryFeeQuote['source'] = 'UNKNOWN';

  if (currentLocation) {
    km = roadKm(hub, currentLocation);
    source = 'CURRENT_LOCATION';
  } else if (address) {
    const addressPoint = await geocodeAddress(address);
    if (addressPoint && pinCentre && haversineKm(addressPoint, pinCentre) <= ADDRESS_MAX_KM_FROM_PIN_CENTRE) {
      km = roadKm(hub, addressPoint);
      source = 'ADDRESS_MAP';
    }
  }
  if (km !== null && pinKm !== null) {
    km = Math.max(km, pinKm - GPS_BELOW_PIN_TOLERANCE_KM);
  }
  if (km === null && pinKm !== null) {
    km = pinKm;
    source = 'PIN_CODE';
  }

  if (km !== null && km > settings.maxRadiusKm) {
    return {
      ...base,
      serviceable: false,
      isAutomatic: false,
      distanceKm: km,
      feePaise: null,
      source,
      message: `Not eligible: this address is about ${km} km from our studio. We deliver within ${settings.maxRadiusKm} km.`,
    };
  }

  if (!isAutoDeliveryFeeEnabled() || km === null) {
    return {
      ...base,
      serviceable: true,
      isAutomatic: false,
      distanceKm: km,
      feePaise: null,
      source,
      message: 'Eligible for delivery. Our team will confirm the delivery charge before payment.',
    };
  }

  const { slabs } = await getDeliveryFeeSlabs();
  const slab = slabs.find((s) => km! <= s.maxDistanceKm);
  if (!slab) {
    const furthest = slabs[slabs.length - 1]?.maxDistanceKm ?? settings.maxRadiusKm;
    return {
      ...base,
      serviceable: false,
      isAutomatic: false,
      distanceKm: km,
      feePaise: null,
      source,
      message: `Not eligible: this address is about ${km} km from our studio. We deliver within ${Math.min(furthest, settings.maxRadiusKm)} km.`,
    };
  }

  const feeText = slab.feePaise === 0 ? 'Free delivery' : `Delivery ₹${(slab.feePaise / 100).toLocaleString('en-IN')}`;
  return {
    ...base,
    serviceable: true,
    isAutomatic: true,
    distanceKm: km,
    feePaise: slab.feePaise,
    source,
    message: `Eligible: about ${km} km from our studio • ${feeText}`,
  };
}
