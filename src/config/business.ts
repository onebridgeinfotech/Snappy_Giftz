/**
 * Centralized Official Business Configuration for SNAPPY GIFTZ
 * Single source of truth for business name, registered address, official email, and contact info.
 */

export const BUSINESS_CONFIG = {
  brandName: 'SNAPPY GIFTZ',
  legalName: 'SNAPPY GIFTZ',
  tradeName: 'SNAPPY GIFTZ',
  officialEmail: 'info@snappygiftz.com',
  businessEmail: 'info@snappygiftz.com',
  adminEmail: 'phoenixnot13@gmail.com',
  /** Operations inboxes that receive new-order and signup alerts */
  adminEmails: ['phoenixnot13@gmail.com', 'onebridgeinfotech@gmail.com'] as const,
  whatsappPhone: '9494800862',
  whatsappFormatted: '+91 94948 00862',
  website: 'https://snappygiftz.com',
  operatingHours: 'Mon-Sat 9:30 AM - 6:30 PM IST',
  minPreparationDays: 2,
  giftWrapFeeInr: 20,
  giftWrapFeePaise: 2000,
  deliveryRadiusKm: 20,
  address: {
    line1: 'Ground Floor, 1-19-68/C-8',
    line2: 'Laxmipuram Road, A S Rao Nagar',
    city: 'Hyderabad',
    district: 'Medchal-Malkajgiri',
    state: 'Telangana',
    stateCode: '36',
    pincode: '500062',
    country: 'India',
    formattedMultiLine: [
      'Ground Floor,',
      '1-19-68/C-8,',
      'Laxmipuram Road,',
      'A S Rao Nagar,',
      'Hyderabad,',
      'Medchal-Malkajgiri,',
      'Telangana – 500062,',
      'India.'
    ],
    formattedSingleLine: 'Ground Floor, 1-19-68/C-8, Laxmipuram Road, A S Rao Nagar, Hyderabad, Medchal-Malkajgiri, Telangana – 500062, India.'
  }
} as const;

export type BusinessConfig = typeof BUSINESS_CONFIG;

/** Admin notification recipients (env ADMIN_EMAILS comma-separated overrides extras). */
export function getAdminNotificationEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const merged = [...BUSINESS_CONFIG.adminEmails, ...fromEnv];
  return [...new Set(merged.map((e) => e.toLowerCase()))];
}

/** Primary operations administrator email address from env or default config. */
export function getPrimaryAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || BUSINESS_CONFIG.adminEmail).trim().toLowerCase();
}
