/**
 * SNAPPY GIFTZ — Delivery Distance & Preparation Eligibility Service
 *
 * Primary Fulfillment Center / Central Atelier:
 * Ground Floor, 1-19-68/C-8, Laxmipuram Road, A S Rao Nagar, Medchal-Malkajgiri, Hyderabad 500062
 *
 * Authoritative Business Rules:
 * 1. Delivery Coverage: Maximum 20 km from the central atelier.
 * 2. Minimum Preparation Time: 2 days (hand-crafted luxury items cannot be delivered same-day or next-day).
 * 3. Delivery charges are calculated automatically from distance (see src/lib/delivery/delivery-fee.service.ts).
 */

import { INITIAL_HYDERABAD_PINCODES } from './pincode.service';

export const ATELIER_ADDRESS = {
  street: 'Ground Floor, 1-19-68/C-8, Laxmipuram Road',
  locality: 'A S Rao Nagar, Kapra, Medchal-Malkajgiri',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '500062',
  latitude: 17.4789,
  longitude: 78.5492,
};

export const MAX_DELIVERY_RADIUS_KM = 20;
export const MIN_PREPARATION_DAYS = 2;

export interface DistanceCalculationResult {
  isServiceable: boolean;
  estimatedDistanceKm: number;
  maxRadiusKm: number;
  originPincode: string;
  destinationPincode: string;
  deliveryMethod: 'ATELIER_EXPRESS' | 'REGIONAL_COURIER';
  requiresOwnerApproval: boolean;
  message: string;
  isExternalServiceUsed: boolean;
}

export interface DistanceCalculatorService {
  calculateDistance(
    destinationPincode: string,
    destinationAddress?: string
  ): Promise<DistanceCalculationResult>;
}

/**
 * Local Seed-Based Distance Calculator
 * Uses verified Hyderabad municipal pin coordinates and road-network distance tables.
 */
class LocalDistanceService implements DistanceCalculatorService {
  async calculateDistance(
    destinationPincode: string,
    destinationAddress?: string
  ): Promise<DistanceCalculationResult> {
    const cleanPin = (destinationPincode || '').trim();

    if (!cleanPin || !/^\d{6}$/.test(cleanPin)) {
      return {
        isServiceable: false,
        estimatedDistanceKm: -1,
        maxRadiusKm: MAX_DELIVERY_RADIUS_KM,
        originPincode: ATELIER_ADDRESS.pincode,
        destinationPincode: cleanPin,
        deliveryMethod: 'REGIONAL_COURIER',
        requiresOwnerApproval: true,
        message: 'Invalid Indian PIN code. Please enter a valid 6-digit PIN.',
        isExternalServiceUsed: false,
      };
    }

    const seedRecord = INITIAL_HYDERABAD_PINCODES[cleanPin];

    if (!seedRecord) {
      // Outside standard Hyderabad verified seed
      return {
        isServiceable: false,
        estimatedDistanceKm: 25,
        maxRadiusKm: MAX_DELIVERY_RADIUS_KM,
        originPincode: ATELIER_ADDRESS.pincode,
        destinationPincode: cleanPin,
        deliveryMethod: 'REGIONAL_COURIER',
        requiresOwnerApproval: true,
        message: `PIN ${cleanPin} is outside our 20km Hyderabad direct delivery zone. Standard courier inquiry required.`,
        isExternalServiceUsed: false,
      };
    }

    const distanceKm = typeof seedRecord.distanceKm === 'number' ? seedRecord.distanceKm : 10;
    const isServiceable = distanceKm <= MAX_DELIVERY_RADIUS_KM;

    return {
      isServiceable,
      estimatedDistanceKm: distanceKm,
      maxRadiusKm: MAX_DELIVERY_RADIUS_KM,
      originPincode: ATELIER_ADDRESS.pincode,
      destinationPincode: cleanPin,
      deliveryMethod: 'ATELIER_EXPRESS',
      requiresOwnerApproval: true, // Owner manually sets delivery charge for all orders
      message: isServiceable
        ? `Eligible for direct delivery (about ${distanceKm} km from our studio).`
        : `Distance (${distanceKm} km) exceeds our 20 km direct delivery radius. Regional courier options may apply.`,
      isExternalServiceUsed: false,
    };
  }
}

/**
 * External Integration Interface: Google Maps Distance Matrix API
 * If GOOGLE_MAPS_API_KEY is configured in the environment, this adapter can be enabled.
 */
class GoogleMapsDistanceService implements DistanceCalculatorService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async calculateDistance(
    destinationPincode: string,
    destinationAddress?: string
  ): Promise<DistanceCalculationResult> {
    // If API key is not present or invalid, seamlessly fall back to local service
    if (!this.apiKey) {
      return new LocalDistanceService().calculateDistance(destinationPincode, destinationAddress);
    }

    try {
      const origin = `${ATELIER_ADDRESS.latitude},${ATELIER_ADDRESS.longitude}`;
      const dest = encodeURIComponent(destinationAddress || `${destinationPincode}, Hyderabad, India`);
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&key=${this.apiKey}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
        const distanceMeters = data.rows[0].elements[0].distance.value;
        const distanceKm = Math.round(distanceMeters / 1000);
        const isServiceable = distanceKm <= MAX_DELIVERY_RADIUS_KM;

        return {
          isServiceable,
          estimatedDistanceKm: distanceKm,
          maxRadiusKm: MAX_DELIVERY_RADIUS_KM,
          originPincode: ATELIER_ADDRESS.pincode,
          destinationPincode,
          deliveryMethod: 'ATELIER_EXPRESS',
          requiresOwnerApproval: true,
          message: isServiceable
            ? `Distance verified via Google Maps: ${distanceKm} km from A S Rao Nagar atelier.`
            : `Distance (${distanceKm} km) exceeds 20 km limit.`,
          isExternalServiceUsed: true,
        };
      }
    } catch {
      // Fallback
    }

    return new LocalDistanceService().calculateDistance(destinationPincode, destinationAddress);
  }
}

// Active singleton instance
// Free services only: the store does not use the paid Google Maps API. Delivery distance comes from
// the PIN table here plus GPS / OpenStreetMap in src/lib/delivery/delivery-fee.service.ts.
// (GoogleMapsDistanceService is kept for reference but is not wired in.)
export const distanceService: DistanceCalculatorService = new LocalDistanceService();
void GoogleMapsDistanceService;

/**
 * Helper to validate delivery date based on preparation time
 */
export function validateDeliveryDate(selectedDate: string | Date): {
  isValid: boolean;
  earliestAllowedDate: Date;
  selectedDate: Date;
  error?: string;
} {
  const earliestAllowed = new Date();
  earliestAllowed.setHours(0, 0, 0, 0);
  earliestAllowed.setDate(earliestAllowed.getDate() + MIN_PREPARATION_DAYS);

  const parsed = new Date(selectedDate);
  parsed.setHours(0, 0, 0, 0);

  if (isNaN(parsed.getTime())) {
    return {
      isValid: false,
      earliestAllowedDate: earliestAllowed,
      selectedDate: parsed,
      error: 'Invalid delivery date selected.',
    };
  }

  if (parsed < earliestAllowed) {
    const formatted = earliestAllowed.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return {
      isValid: false,
      earliestAllowedDate: earliestAllowed,
      selectedDate: parsed,
      error: `Earliest available delivery date is ${formatted} (minimum 2 days required for artisan preparation).`,
    };
  }

  return {
    isValid: true,
    earliestAllowedDate: earliestAllowed,
    selectedDate: parsed,
  };
}

