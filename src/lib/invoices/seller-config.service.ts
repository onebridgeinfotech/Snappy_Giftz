import { prisma } from '@/lib/prisma';
import { isStorefrontFallbackAllowed } from '@/lib/catalog/public-catalog.service';

export type EInvoiceStatus =
  | 'PENDING_ACCOUNTANT_CONFIRMATION'
  | 'EXEMPT_BELOW_THRESHOLD'
  | 'EXEMPT_NOTIFIED_CATEGORY'
  | 'APPLICABLE';

export type InvoiceSignatureMode =
  | 'PHYSICAL_SIGNATURE_ON_PRINT'
  | 'DIGITAL_SIGNATURE_IT_ACT'
  | 'ELECTRONIC_INVOICE_EXCEPTION'
  | 'E_INVOICE_IRP_QR';

export interface SellerConfigData {
  id?: string;
  legalName: string;
  tradeName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  registeredStreet: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  contactEmail: string;
  contactPhone: string;
  invoicePrefix: string;
  authorizedSignatoryName?: string | null;
  authorizedSignatoryDesignation?: string | null;
  invoiceFooterTerms?: string | null;
  isVerified: boolean;

  // E-Invoicing Applicability (CGST Rule 48(4) & Rule 46(s))
  eInvoiceStatus: EInvoiceStatus;
  eInvoiceExemptionReason?: string | null;
  eInvoiceConfirmedBy?: string | null;
  eInvoiceConfirmedAt?: string | Date | null;
  panAggregateTurnoverExceeds5Cr: boolean;

  // Signature Compliance Mode (CGST Rule 46(q))
  signatureMode: InvoiceSignatureMode;
  digitalSignatureConfigured: boolean;
  electronicInvoiceSignatureExemptionConfirmed?: boolean;
  electronicInvoiceExemptionConfirmedBy?: string | null;
  electronicInvoiceExemptionConfirmedAt?: string | Date | null;

  updatedAt?: string | Date;
  updatedBy?: string | null;
}

export class SellerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SellerConfigError';
  }
}

/**
 * Standard Indian GSTIN Regex: 15 alphanumeric characters
 * 2 digits (state code) + 10 alphanumeric (PAN) + 1 entity digit + 'Z' + 1 checksum digit
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

// Development / Offline Fallback Store
export const DEV_SELLER_CONFIG_STORE: Map<string, SellerConfigData> = new Map();

import { BUSINESS_CONFIG } from '@/config/business';

/**
 * Default sample configuration for development and test environments.
 * Strictly flagged as unverified (`isVerified: false`) and e-invoice status as PENDING.
 */
export const DEFAULT_SAMPLE_SELLER_CONFIG: SellerConfigData = {
  id: 'default',
  legalName: BUSINESS_CONFIG.legalName,
  tradeName: BUSINESS_CONFIG.tradeName,
  gstin: process.env.SELLER_GSTIN || (BUSINESS_CONFIG.address.stateCode + 'AAAAA0000A1Z5'),
  pan: 'AAAAA0000A',
  registeredStreet: `${BUSINESS_CONFIG.address.line1}, ${BUSINESS_CONFIG.address.line2}`,
  city: BUSINESS_CONFIG.address.city,
  state: BUSINESS_CONFIG.address.state,
  stateCode: BUSINESS_CONFIG.address.stateCode,
  pincode: BUSINESS_CONFIG.address.pincode,
  contactEmail: BUSINESS_CONFIG.officialEmail,
  contactPhone: BUSINESS_CONFIG.whatsappFormatted,
  invoicePrefix: 'SG',
  authorizedSignatoryName: 'Authorized Signatory',
  authorizedSignatoryDesignation: 'Authorized Signatory',
  invoiceFooterTerms: 'This is a sample tax invoice for review. Goods once customized as per customer specification are non-refundable. All disputes subject to Hyderabad jurisdiction.',
  isVerified: false, // Must be explicitly verified before production legal issuance

  // E-Invoicing Applicability: Unverified by default; requires accountant audit of PAN turnover
  eInvoiceStatus: 'PENDING_ACCOUNTANT_CONFIRMATION',
  eInvoiceExemptionReason: null,
  eInvoiceConfirmedBy: null,
  eInvoiceConfirmedAt: null,
  panAggregateTurnoverExceeds5Cr: false,

  // Signature Compliance: Safe default requiring physical signature on printed dispatch copy
  signatureMode: 'PHYSICAL_SIGNATURE_ON_PRINT',
  digitalSignatureConfigured: false,
  electronicInvoiceSignatureExemptionConfirmed: false,
  electronicInvoiceExemptionConfirmedBy: null,
  electronicInvoiceExemptionConfirmedAt: null,
};

DEV_SELLER_CONFIG_STORE.set('default', { ...DEFAULT_SAMPLE_SELLER_CONFIG });

/**
 * Validates seller configuration fields according to Indian GST requirements.
 */
export function validateSellerConfigData(data: Partial<SellerConfigData>): string[] {
  const errors: string[] = [];

  if (!data.legalName || data.legalName.trim().length < 3) {
    errors.push('Legal seller business name is required and must be at least 3 characters.');
  }

  const cleanGstin = data.gstin ? data.gstin.trim().toUpperCase() : '';
  if (!cleanGstin || !GSTIN_REGEX.test(cleanGstin)) {
    errors.push(`Invalid GSTIN format: "${data.gstin || ''}". Expected 15-character valid GSTIN (e.g. 08AAAAA0000A1Z5).`);
  }

  const cleanStateCode = data.stateCode ? data.stateCode.trim() : '';
  if (!cleanStateCode || cleanStateCode.length !== 2) {
    errors.push('Valid 2-digit GST state code is required (e.g. "08" for Rajasthan).');
  }

  if (cleanGstin && cleanStateCode && !cleanGstin.startsWith(cleanStateCode)) {
    errors.push(`GSTIN state prefix "${cleanGstin.substring(0, 2)}" does not match configured supplier state code "${cleanStateCode}".`);
  }

  const cleanPincode = data.pincode ? data.pincode.trim() : '';
  if (!cleanPincode || !PINCODE_REGEX.test(cleanPincode)) {
    errors.push('Valid 6-digit Indian PIN code is required.');
  }

  if (!data.registeredStreet || data.registeredStreet.trim().length < 5) {
    errors.push('Registered business street address is required.');
  }

  if (!data.city || data.city.trim().length < 2) {
    errors.push('Registered business city is required.');
  }

  if (!data.contactEmail || !data.contactEmail.includes('@')) {
    errors.push('Valid business contact email is required.');
  }

  const prefix = data.invoicePrefix ? data.invoicePrefix.trim() : '';
  if (!prefix || prefix.length < 1 || prefix.length > 5 || !/^[A-Z0-9]+$/i.test(prefix)) {
    errors.push('Invoice prefix must be between 1 and 5 alphanumeric characters (e.g. "SG").');
  }

  // Validate eInvoiceStatus
  const validEInvoiceStatuses: EInvoiceStatus[] = [
    'PENDING_ACCOUNTANT_CONFIRMATION',
    'EXEMPT_BELOW_THRESHOLD',
    'EXEMPT_NOTIFIED_CATEGORY',
    'APPLICABLE',
  ];
  if (data.eInvoiceStatus && !validEInvoiceStatuses.includes(data.eInvoiceStatus)) {
    errors.push(`Invalid e-invoice status: "${data.eInvoiceStatus}". Must be one of: ${validEInvoiceStatuses.join(', ')}.`);
  }

  if (data.eInvoiceStatus === 'EXEMPT_NOTIFIED_CATEGORY' && (!data.eInvoiceExemptionReason || data.eInvoiceExemptionReason.trim().length < 3)) {
    errors.push('eInvoiceExemptionReason is required when eInvoiceStatus is EXEMPT_NOTIFIED_CATEGORY (e.g. SEZ Unit under Notification 13/2020-CT).');
  }

  if (data.eInvoiceStatus === 'EXEMPT_BELOW_THRESHOLD' && data.panAggregateTurnoverExceeds5Cr === true) {
    errors.push('Cannot claim EXEMPT_BELOW_THRESHOLD when panAggregateTurnoverExceeds5Cr is true. Section 2(6) of CGST Act mandates PAN-level aggregate turnover across all GSTINs.');
  }

  // Validate signatureMode
  const validSignatureModes: InvoiceSignatureMode[] = [
    'PHYSICAL_SIGNATURE_ON_PRINT',
    'DIGITAL_SIGNATURE_IT_ACT',
    'ELECTRONIC_INVOICE_EXCEPTION',
    'E_INVOICE_IRP_QR',
  ];
  if (data.signatureMode && !validSignatureModes.includes(data.signatureMode)) {
    errors.push(`Invalid signature mode: "${data.signatureMode}". Must be one of: ${validSignatureModes.join(', ')}.`);
  }

  if (
    data.electronicInvoiceSignatureExemptionConfirmed &&
    (!data.electronicInvoiceExemptionConfirmedBy || data.electronicInvoiceExemptionConfirmedBy.trim().length < 2)
  ) {
    errors.push('electronicInvoiceExemptionConfirmedBy (accountant or tax auditor identifier) is required when electronicInvoiceSignatureExemptionConfirmed is true.');
  }

  if (
    (data.signatureMode === 'ELECTRONIC_INVOICE_EXCEPTION' || data.signatureMode === 'E_INVOICE_IRP_QR') &&
    data.electronicInvoiceSignatureExemptionConfirmed !== true
  ) {
    errors.push(
      'Cannot select electronic invoice signature exemption without accountant audit and confirmation (electronicInvoiceSignatureExemptionConfirmed must be true with electronicInvoiceExemptionConfirmedBy). Under CGST Rule 46, signature exemption cannot be assumed without accountant verification.'
    );
  }

  return errors;
}

/**
 * Retrieves the active seller configuration.
 */
export async function getSellerConfig(): Promise<SellerConfigData> {
  try {
    const config = await prisma.sellerConfig.findUnique({
      where: { id: 'default' },
    });

    if (config) {
      return {
        id: config.id,
        legalName: config.legalName,
        tradeName: config.tradeName,
        gstin: config.gstin,
        pan: config.pan,
        registeredStreet: config.registeredStreet,
        city: config.city,
        state: config.state,
        stateCode: config.stateCode,
        pincode: config.pincode,
        contactEmail: config.contactEmail,
        contactPhone: config.contactPhone,
        invoicePrefix: config.invoicePrefix,
        authorizedSignatoryName: config.authorizedSignatoryName,
        authorizedSignatoryDesignation: config.authorizedSignatoryDesignation,
        invoiceFooterTerms: config.invoiceFooterTerms,
        isVerified: config.isVerified,
        eInvoiceStatus: (config.eInvoiceStatus as EInvoiceStatus) || 'PENDING_ACCOUNTANT_CONFIRMATION',
        eInvoiceExemptionReason: config.eInvoiceExemptionReason,
        eInvoiceConfirmedBy: config.eInvoiceConfirmedBy,
        eInvoiceConfirmedAt: config.eInvoiceConfirmedAt,
        panAggregateTurnoverExceeds5Cr: Boolean(config.panAggregateTurnoverExceeds5Cr),
        signatureMode: (config.signatureMode as InvoiceSignatureMode) || 'PHYSICAL_SIGNATURE_ON_PRINT',
        digitalSignatureConfigured: Boolean(config.digitalSignatureConfigured),
        electronicInvoiceSignatureExemptionConfirmed: Boolean(config.electronicInvoiceSignatureExemptionConfirmed),
        electronicInvoiceExemptionConfirmedBy: config.electronicInvoiceExemptionConfirmedBy,
        electronicInvoiceExemptionConfirmedAt: config.electronicInvoiceExemptionConfirmedAt,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
      };
    }
  } catch {
    // DB offline fallback
  }

  if (DEV_SELLER_CONFIG_STORE.has('default')) {
    return { ...DEV_SELLER_CONFIG_STORE.get('default')! };
  }

  return { ...DEFAULT_SAMPLE_SELLER_CONFIG };
}

/**
 * Updates seller and invoice configuration.
 */
export async function updateSellerConfig(
  input: Partial<SellerConfigData>,
  actorIdentifier = 'system-admin'
): Promise<SellerConfigData> {
  const current = await getSellerConfig();
  const merged: SellerConfigData = {
    ...current,
    ...input,
    legalName: input.legalName !== undefined ? input.legalName.trim() : current.legalName,
    tradeName: input.tradeName !== undefined ? (input.tradeName?.trim() || null) : current.tradeName,
    gstin: input.gstin !== undefined ? (input.gstin ? input.gstin.trim().toUpperCase() : null) : current.gstin,
    pan: input.pan !== undefined ? (input.pan?.trim().toUpperCase() || null) : current.pan,
    registeredStreet: input.registeredStreet !== undefined ? input.registeredStreet.trim() : current.registeredStreet,
    city: input.city !== undefined ? input.city.trim() : current.city,
    state: input.state !== undefined ? input.state.trim() : current.state,
    stateCode: input.stateCode !== undefined ? input.stateCode.trim() : current.stateCode,
    pincode: input.pincode !== undefined ? input.pincode.trim() : current.pincode,
    contactEmail: input.contactEmail !== undefined ? input.contactEmail.trim() : current.contactEmail,
    contactPhone: input.contactPhone !== undefined ? input.contactPhone.trim() : current.contactPhone,
    invoicePrefix: input.invoicePrefix !== undefined ? input.invoicePrefix.trim().toUpperCase() : current.invoicePrefix,
    authorizedSignatoryName: input.authorizedSignatoryName !== undefined ? (input.authorizedSignatoryName?.trim() || null) : current.authorizedSignatoryName,
    authorizedSignatoryDesignation: input.authorizedSignatoryDesignation !== undefined ? (input.authorizedSignatoryDesignation?.trim() || null) : current.authorizedSignatoryDesignation,
    invoiceFooterTerms: input.invoiceFooterTerms !== undefined ? (input.invoiceFooterTerms?.trim() || null) : current.invoiceFooterTerms,
    isVerified: input.isVerified !== undefined ? Boolean(input.isVerified) : current.isVerified,
    eInvoiceStatus: input.eInvoiceStatus !== undefined ? input.eInvoiceStatus : current.eInvoiceStatus,
    eInvoiceExemptionReason: input.eInvoiceExemptionReason !== undefined ? (input.eInvoiceExemptionReason?.trim() || null) : current.eInvoiceExemptionReason,
    eInvoiceConfirmedBy: input.eInvoiceConfirmedBy !== undefined ? (input.eInvoiceConfirmedBy?.trim() || null) : current.eInvoiceConfirmedBy,
    eInvoiceConfirmedAt: input.eInvoiceConfirmedAt !== undefined ? input.eInvoiceConfirmedAt : current.eInvoiceConfirmedAt,
    panAggregateTurnoverExceeds5Cr: input.panAggregateTurnoverExceeds5Cr !== undefined ? Boolean(input.panAggregateTurnoverExceeds5Cr) : current.panAggregateTurnoverExceeds5Cr,
    signatureMode: input.signatureMode !== undefined ? input.signatureMode : current.signatureMode,
    digitalSignatureConfigured: input.digitalSignatureConfigured !== undefined ? Boolean(input.digitalSignatureConfigured) : current.digitalSignatureConfigured,
    electronicInvoiceSignatureExemptionConfirmed:
      input.electronicInvoiceSignatureExemptionConfirmed !== undefined
        ? Boolean(input.electronicInvoiceSignatureExemptionConfirmed)
        : current.electronicInvoiceSignatureExemptionConfirmed,
    electronicInvoiceExemptionConfirmedBy:
      input.electronicInvoiceExemptionConfirmedBy !== undefined
        ? (input.electronicInvoiceExemptionConfirmedBy?.trim() || null)
        : current.electronicInvoiceExemptionConfirmedBy,
    electronicInvoiceExemptionConfirmedAt:
      input.electronicInvoiceExemptionConfirmedAt !== undefined
        ? input.electronicInvoiceExemptionConfirmedAt
        : current.electronicInvoiceExemptionConfirmedAt,
    updatedAt: new Date(),
    updatedBy: actorIdentifier,
  };

  const validationErrors = validateSellerConfigData(merged);
  if (validationErrors.length > 0) {
    throw new SellerConfigError(`Seller configuration validation failed: ${validationErrors.join('; ')}`);
  }

  try {
    const updated = await prisma.sellerConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        legalName: merged.legalName,
        tradeName: merged.tradeName,
        gstin: merged.gstin,
        pan: merged.pan,
        registeredStreet: merged.registeredStreet,
        city: merged.city,
        state: merged.state,
        stateCode: merged.stateCode,
        pincode: merged.pincode,
        contactEmail: merged.contactEmail,
        contactPhone: merged.contactPhone,
        invoicePrefix: merged.invoicePrefix,
        authorizedSignatoryName: merged.authorizedSignatoryName,
        authorizedSignatoryDesignation: merged.authorizedSignatoryDesignation,
        invoiceFooterTerms: merged.invoiceFooterTerms,
        isVerified: merged.isVerified,
        eInvoiceStatus: merged.eInvoiceStatus,
        eInvoiceExemptionReason: merged.eInvoiceExemptionReason,
        eInvoiceConfirmedBy: merged.eInvoiceConfirmedBy,
        eInvoiceConfirmedAt: merged.eInvoiceConfirmedAt ? new Date(merged.eInvoiceConfirmedAt) : null,
        panAggregateTurnoverExceeds5Cr: merged.panAggregateTurnoverExceeds5Cr,
        signatureMode: merged.signatureMode,
        digitalSignatureConfigured: merged.digitalSignatureConfigured,
        electronicInvoiceSignatureExemptionConfirmed: merged.electronicInvoiceSignatureExemptionConfirmed,
        electronicInvoiceExemptionConfirmedBy: merged.electronicInvoiceExemptionConfirmedBy,
        electronicInvoiceExemptionConfirmedAt: merged.electronicInvoiceExemptionConfirmedAt
          ? new Date(merged.electronicInvoiceExemptionConfirmedAt)
          : null,
        updatedBy: actorIdentifier,
      },
      update: {
        legalName: merged.legalName,
        tradeName: merged.tradeName,
        gstin: merged.gstin,
        pan: merged.pan,
        registeredStreet: merged.registeredStreet,
        city: merged.city,
        state: merged.state,
        stateCode: merged.stateCode,
        pincode: merged.pincode,
        contactEmail: merged.contactEmail,
        contactPhone: merged.contactPhone,
        invoicePrefix: merged.invoicePrefix,
        authorizedSignatoryName: merged.authorizedSignatoryName,
        authorizedSignatoryDesignation: merged.authorizedSignatoryDesignation,
        invoiceFooterTerms: merged.invoiceFooterTerms,
        isVerified: merged.isVerified,
        eInvoiceStatus: merged.eInvoiceStatus,
        eInvoiceExemptionReason: merged.eInvoiceExemptionReason,
        eInvoiceConfirmedBy: merged.eInvoiceConfirmedBy,
        eInvoiceConfirmedAt: merged.eInvoiceConfirmedAt ? new Date(merged.eInvoiceConfirmedAt) : null,
        panAggregateTurnoverExceeds5Cr: merged.panAggregateTurnoverExceeds5Cr,
        signatureMode: merged.signatureMode,
        digitalSignatureConfigured: merged.digitalSignatureConfigured,
        electronicInvoiceSignatureExemptionConfirmed: merged.electronicInvoiceSignatureExemptionConfirmed,
        electronicInvoiceExemptionConfirmedBy: merged.electronicInvoiceExemptionConfirmedBy,
        electronicInvoiceExemptionConfirmedAt: merged.electronicInvoiceExemptionConfirmedAt
          ? new Date(merged.electronicInvoiceExemptionConfirmedAt)
          : null,
        updatedBy: actorIdentifier,
      },
    });

    DEV_SELLER_CONFIG_STORE.set('default', {
      ...merged,
      updatedAt: updated.updatedAt.toISOString(),
    });

    return DEV_SELLER_CONFIG_STORE.get('default')!;
  } catch {
    if (process.env.NODE_ENV !== 'production' || isStorefrontFallbackAllowed()) {
      DEV_SELLER_CONFIG_STORE.set('default', merged);
      return merged;
    }
    throw new SellerConfigError('Database unreachable while saving seller configuration.');
  }
}

/**
 * Asserts whether seller configuration is legally ready for final tax invoice issuance.
 * Throws SellerConfigError if missing or unverified in production.
 */
export function assertSellerConfigReadyForInvoice(
  config: SellerConfigData,
  isProduction: boolean
): void {
  const errors = validateSellerConfigData(config);
  if (errors.length > 0) {
    throw new SellerConfigError(
      `Cannot issue legal tax invoice. Missing or invalid seller configuration: ${errors.join('; ')}`
    );
  }

  if (isProduction) {
    if (!config.isVerified) {
      throw new SellerConfigError(
        'Cannot issue legal tax invoice in production: Seller business information and GST registration have not been formally verified by the store owner/accountant.'
      );
    }

    if (config.eInvoiceStatus === 'PENDING_ACCOUNTANT_CONFIRMATION') {
      throw new SellerConfigError(
        'Cannot issue legal tax invoice in production: E-invoicing applicability is PENDING_ACCOUNTANT_CONFIRMATION. An accountant must verify PAN-level aggregate turnover across preceding financial years from FY 2017-18 onwards, evaluate applicable notified exclusions, and confirm applicability status.'
      );
    }

    if (config.signatureMode === 'DIGITAL_SIGNATURE_IT_ACT' && !config.digitalSignatureConfigured) {
      throw new SellerConfigError(
        'Cannot issue legal tax invoice in production: Signature mode is set to DIGITAL_SIGNATURE_IT_ACT, but no IT Act 2000 Section 5 compliant Digital Signature Certificate (DSC) has been configured. Text disclaimers or decorative images do not fulfill the statutory signature requirement under CGST Rule 46(q).'
      );
    }

    if (
      (config.signatureMode === 'ELECTRONIC_INVOICE_EXCEPTION' || config.signatureMode === 'E_INVOICE_IRP_QR') &&
      !config.electronicInvoiceSignatureExemptionConfirmed
    ) {
      throw new SellerConfigError(
        'Cannot issue legal tax invoice in production: Signature mode is set to electronic invoice exemption, but the Rule 46 electronic-invoice signature exception has not been formally confirmed by the accountant. Under CGST Rule 46(q) and Rule 48(4), signature exemption requires verified statutory qualification; an IRN QR code does not automatically dispense with signature requirements.'
      );
    }
  }
}
