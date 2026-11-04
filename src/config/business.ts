/**
 * Centralized Official Business Configuration for SNAPPY GIFTZ
 * Single source of truth for business name, registered address, official email, and contact info.
 */

export const BUSINESS_CONFIG = {
  brandName: 'SNAPPY GIFTZ',
  legalName: 'SNAPPY GIFTZ',
  tradeName: 'SNAPPY GIFTZ',
  officialEmail: 'ezonetechnologies2124@gmail.com',
  adminEmail: 'phoenixnot13@gmail.com',
  whatsappPhone: '8309600721',
  whatsappFormatted: '+91 83096 00721',
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
