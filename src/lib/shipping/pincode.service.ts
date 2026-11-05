export interface ServiceablePincodeDTO {
  id: string;
  pincode: string;
  areaName?: string | null;
  city: string;
  state: string;
  stateCode: string;
  zoneId?: string | null;
  zoneName?: string | null;
  isActive: boolean;
  deliveryDays: number;
  notes?: string | null;
}

// Initial default Hyderabad pincodes seed list for local fallback / development
export const INITIAL_HYDERABAD_PINCODES: Record<string, { area: string; days: number; distanceKm?: number }> = {
  // Primary Shop Hub (Ground Floor, 1-19-68/C-8, Laxmipuram Road, A S Rao Nagar)
  '500062': { area: 'A S Rao Nagar, ECIL, Kapra (Store Origin)', days: 2, distanceKm: 0 },
  '500047': { area: 'Sainikpuri, Neredmet, Defence Colony', days: 2, distanceKm: 3 },
  '500056': { area: 'Malkajgiri, Anandbagh', days: 2, distanceKm: 5 },
  '500078': { area: 'Kushaiguda, Cherlapally', days: 2, distanceKm: 4 },
  '500087': { area: 'Nagaram, Dammaiguda', days: 2, distanceKm: 4 },
  '500076': { area: 'Nacharam, Mallapur', days: 2, distanceKm: 6 },
  '500083': { area: 'Alwal, Lothkunta', days: 2, distanceKm: 7 },
  '500010': { area: 'Bolarum, Yapral, Risala Bazar', days: 2, distanceKm: 6 },
  '500015': { area: 'Karkhana, Gunrock Enclave', days: 2, distanceKm: 7 },
  '500011': { area: 'Bowenpally, Trimulgherry', days: 2, distanceKm: 8 },
  '500017': { area: 'Tarnaka, Habsiguda', days: 2, distanceKm: 8 },
  '500051': { area: 'Uppal, Ramanthapur', days: 2, distanceKm: 9 },
  '500003': { area: 'Secunderabad, Clock Tower, Marredpally', days: 2, distanceKm: 10 },
  '500044': { area: 'Amberpet, Osmania University', days: 2, distanceKm: 11 },
  '500061': { area: 'Keesara, Rampally', days: 2, distanceKm: 12 },
  '500020': { area: 'Musheerabad, Domalguda', days: 2, distanceKm: 12 },
  '500016': { area: 'Begumpet, Prakash Nagar', days: 2, distanceKm: 12 },
  '500029': { area: 'Himayatnagar, Narayanguda', days: 2, distanceKm: 13 },
  '500007': { area: 'Kacheguda, Barkatpura, Vidyanagar', days: 2, distanceKm: 14 },
  '500082': { area: 'Somajiguda, Raj Bhavan Road', days: 2, distanceKm: 14 },
  '500095': { area: 'Sultan Bazar, Bank Street', days: 2, distanceKm: 14 },
  '500060': { area: 'LB Nagar, Nagole', days: 2, distanceKm: 14 },
  '500001': { area: 'Hyderabad GPO, Abids, Koti', days: 2, distanceKm: 15 },
  '500004': { area: 'Khairatabad, Raj Bhavan', days: 2, distanceKm: 15 },
  '500002': { area: 'Charminar, Moghalpura', days: 2, distanceKm: 17 },
  '500034': { area: 'Banjara Hills, Panjagutta', days: 2, distanceKm: 18 },
  '500072': { area: 'Kukatpally, KPHB Colony', days: 2, distanceKm: 18 },
  '500028': { area: 'Mehdipatnam, Humayun Nagar', days: 2, distanceKm: 19 },
  '500033': { area: 'Jubilee Hills, Road No 36', days: 2, distanceKm: 19 },
  '500032': { area: 'Gachibowli, Telecom Nagar', days: 2, distanceKm: 20 },
  '500081': { area: 'Madhapur, Hitech City', days: 2, distanceKm: 20 },
  '500084': { area: 'Kondapur, Whitefields', days: 2, distanceKm: 20 },
  '500089': { area: 'Manikonda, Puppalguda', days: 2, distanceKm: 20 },
  '500090': { area: 'Nizampet, Pragathi Nagar', days: 2, distanceKm: 20 },
};

export const DEV_PINCODES = new Map<string, ServiceablePincodeDTO>();
for (const [pin, info] of Object.entries(INITIAL_HYDERABAD_PINCODES)) {
  DEV_PINCODES.set(pin, {
    id: `pin-${pin}`,
    pincode: pin,
    areaName: info.area,
    city: 'Hyderabad',
    state: 'Telangana',
    stateCode: '36',
    zoneName: 'Central Hyderabad',
    isActive: true,
    deliveryDays: info.days,
    notes: `Initial verified Hyderabad seed registry (~${info.distanceKm || 0} km from hub)`,
  });
}

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
