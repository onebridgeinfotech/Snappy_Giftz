/**
 * DEPRECATED: Corporate B2B functionality has been decommissioned.
 * SNAPPY GIFTZ is exclusively a consumer-focused e-commerce brand.
 */

export const DEV_ORGANIZATIONS_STORE = new Map<string, any>();
export const DEV_CORPORATE_RFQS_STORE = new Map<string, any>();
export const DEV_CORPORATE_QUOTES_STORE = new Map<string, any>();
export const DEV_CORPORATE_ORDER_GROUPS_STORE = new Map<string, any>();
export const DEV_CORPORATE_MEMBERS_STORE = new Map<string, any>();

export class CorporateValidationError extends Error {}
export class CorporatePermissionError extends Error {}
export class CorporateNotFoundError extends Error {}
export class CorporateStateError extends Error {}

export type CorporateRole = 'OWNER' | 'REQUESTER' | 'APPROVER' | 'FINANCE';
export type CorporateAccountStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export function resetCorporateDevStores() {
  DEV_ORGANIZATIONS_STORE.clear();
  DEV_CORPORATE_RFQS_STORE.clear();
  DEV_CORPORATE_QUOTES_STORE.clear();
  DEV_CORPORATE_ORDER_GROUPS_STORE.clear();
  DEV_CORPORATE_MEMBERS_STORE.clear();
}

export function sanitizeCsvField(val: string): string {
  if (!val) return '';
  return val.replace(/[\r\n\t]/g, ' ').trim();
}
