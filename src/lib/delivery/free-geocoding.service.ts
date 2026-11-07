/**
 * Free geocoding via OpenStreetMap Nominatim (no API key, no cost).
 *
 * Usage policy (https://operations.osmfoundation.org/policies/nominatim/) is respected:
 *   - server-side only, at most 1 request per second across this process (extra requests are skipped,
 *     never queued, so checkout never waits),
 *   - results cached for 7 days (PIN codes and addresses rarely move),
 *   - an identifying User-Agent, and "© OpenStreetMap contributors" attribution shown at checkout.
 *
 * Set NOMINATIM_ENABLED=false to turn it off (delivery pricing then uses GPS + the PIN table only).
 * Set NOMINATIM_URL to point at a self-hosted Nominatim if traffic grows.
 */
import type { GeoPoint } from './delivery-fee.service';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1100;
const cache = new Map<string, { point: GeoPoint | null; at: number }>();
let lastRequestAt = 0;

export function isFreeGeocodingEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return process.env.NOMINATIM_ENABLED === 'true';
  return (process.env.NOMINATIM_ENABLED || 'true').toLowerCase() !== 'false';
}

function inIndia(p: GeoPoint) {
  return p.latitude >= 6 && p.latitude <= 37.5 && p.longitude >= 68 && p.longitude <= 97.5;
}

/** Geocode a query to a point in India, or null (unknown, rate-limited, offline or disabled). */
async function geocode(query: string, params: Record<string, string>): Promise<GeoPoint | null> {
  if (!isFreeGeocodingEnabled()) return null;
  const key = `${query}|${JSON.stringify(params)}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.point;

  if (Date.now() - lastRequestAt < MIN_INTERVAL_MS) return null; // respect 1 req/s; fall back instead of waiting
  lastRequestAt = Date.now();

  try {
    const base = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
    const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'in', ...params });
    const res = await fetch(`${base}/search?${qs.toString()}`, {
      headers: {
        'User-Agent': 'SnappyGiftzStore/1.0 (+https://snappygiftz.com; delivery distance)',
        'Accept-Language': 'en-IN',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null; // do not cache server errors
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = rows?.[0];
    const point = first ? { latitude: Number(first.lat), longitude: Number(first.lon) } : null;
    const valid = point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && inIndia(point) ? point : null;
    cache.set(key, { point: valid, at: Date.now() });
    return valid;
  } catch {
    return null;
  }
}

/** Approximate centre of an Indian PIN code. */
export function geocodePincode(pincode: string): Promise<GeoPoint | null> {
  return geocode(`pin:${pincode}`, { postalcode: pincode, country: 'India' });
}

/** A typed street address (best effort; Indian addresses often only match to the locality). */
export function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const clean = address.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (clean.length < 8) return Promise.resolve(null);
  return geocode(`addr:${clean}`, { q: clean });
}
