import { INITIAL_HYDERABAD_PINCODES, DEV_PINCODES } from '@/lib/delivery/delivery.service';

export const INDIAN_STATE_GST_CODES: Record<string, string> = {
  'JAMMU AND KASHMIR': '01',
  'HIMACHAL PRADESH': '02',
  'PUNJAB': '03',
  'CHANDIGARH': '04',
  'UTTARAKHAND': '05',
  'HARYANA': '06',
  'DELHI': '07',
  'RAJASTHAN': '08',
  'UTTAR PRADESH': '09',
  'BIHAR': '10',
  'SIKKIM': '11',
  'ARUNACHAL PRADESH': '12',
  'NAGALAND': '13',
  'MANIPUR': '14',
  'MIZORAM': '15',
  'TRIPURA': '16',
  'MEGHALAYA': '17',
  'ASSAM': '18',
  'WEST BENGAL': '19',
  'JHARKHAND': '20',
  'ODISHA': '21',
  'CHHATTISGARH': '22',
  'MADHYA PRADESH': '23',
  'GUJARAT': '24',
  'DAMAN AND DIU': '25',
  'DADRA AND NAGAR HAVELI': '26',
  'MAHARASHTRA': '27',
  'ANDHRA PRADESH': '28',
  'KARNATAKA': '29',
  'GOA': '30',
  'LAKSHADWEEP': '31',
  'KERALA': '32',
  'TAMIL NADU': '33',
  'PUDUCHERRY': '34',
  'ANDAMAN AND NICOBAR ISLANDS': '35',
  'TELANGANA': '36',
  'LADAKH': '37',
};

export interface PincodeServiceabilityResult {
  valid: boolean;
  serviceable: boolean;
  city?: string;
  state?: string;
  stateCode: string;
  estimatedDays?: number;
  expressAvailable?: boolean;
  message: string;
}

/**
 * Validate standard 6-digit Indian Postal Index Number.
 */
export function isValidIndianPincode(pincode: string): boolean {
  if (!pincode || typeof pincode !== 'string') return false;
  const clean = pincode.trim();
  return /^[1-9][0-9]{5}$/.test(clean);
}

/**
 * Resolve 2-digit GST State Code from Indian State name.
 * Defaults to interstate "99" if state name is unknown.
 */
export function resolveStateCode(stateName?: string): string {
  if (!stateName || typeof stateName !== 'string') return '99';
  const normalized = stateName.trim().toUpperCase();
  return INDIAN_STATE_GST_CODES[normalized] || '99';
}

/**
 * Check delivery serviceability.
 * Business Rule: Hyderabad is the ONLY delivery location currently supported.
 */
export function checkPincodeServiceability(pincode: string): PincodeServiceabilityResult {
  const clean = pincode ? pincode.trim() : '';

  if (!isValidIndianPincode(clean)) {
    return {
      valid: false,
      serviceable: false,
      stateCode: '99',
      message: 'Please enter a valid 6-digit Indian PIN code (e.g. 500001, 500034, 500081)',
    };
  }

  // 1. Check owner-configured / dynamic registry
  const devRecord = DEV_PINCODES.get(clean);
  if (devRecord) {
    if (!devRecord.isActive) {
      return {
        valid: true,
        serviceable: false,
        stateCode: devRecord.stateCode || '36',
        message: `Delivery to PIN code ${clean} is currently inactive.`,
      };
    }
    return {
      valid: true,
      serviceable: true,
      city: devRecord.city || 'Hyderabad',
      state: devRecord.state || 'Telangana',
      stateCode: devRecord.stateCode || '36',
      estimatedDays: devRecord.deliveryDays,
      expressAvailable: true,
      message: `Direct personal delivery available in ${devRecord.areaName || 'Hyderabad'} within ${devRecord.deliveryDays} business day(s)`,
    };
  }

  // 2. Check initial verified Hyderabad seed registry
  const hyd = INITIAL_HYDERABAD_PINCODES[clean];
  if (hyd) {
    return {
      valid: true,
      serviceable: true,
      city: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      estimatedDays: hyd.days,
      expressAvailable: true,
      message: `Direct personal delivery available in ${hyd.area}, Hyderabad within ${hyd.days} business day(s)`,
    };
  }

  // Unapproved / Non-Hyderabad PIN codes
  return {
    valid: true,
    serviceable: false,
    stateCode: '99',
    message: `Delivery to PIN code ${clean} is currently not available. SNAPPY GIFTZ is currently exclusively serving Hyderabad verified express hubs.`,
  };
}
