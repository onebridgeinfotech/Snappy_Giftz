import { PaymentAdapter, PaymentConfigurationError } from '@/services/adapters/payment.adapter';
import { MockPaymentAdapter } from './mock.adapter';
import { RazorpayPaymentAdapter } from './razorpay.adapter';

let cachedAdapter: PaymentAdapter | null = null;
let driverOverrideState: 'razorpay' | 'mock' | null = null;
let customAdapterInstance: PaymentAdapter | null = null;

/**
 * Sets an explicit driver override (primarily used by tests).
 */
export function setPaymentDriverOverride(driver: 'razorpay' | 'mock' | null): void {
  driverOverrideState = driver;
  cachedAdapter = null;
}

/**
 * Sets an explicit custom adapter instance (primarily used by test suites).
 */
export function setCustomPaymentAdapter(adapter: PaymentAdapter | null): void {
  if (process.env.NODE_ENV === 'production' && adapter instanceof MockPaymentAdapter) {
    throw new PaymentConfigurationError(
      'Security Violation: Mock payment driver is strictly forbidden in production mode.'
    );
  }
  customAdapterInstance = adapter;
}

/**
 * Returns the configured PaymentAdapter based on environment variables.
 * Defaults to 'razorpay' in production, or 'mock' during test/dev when real credentials are absent.
 * Strictly forbids 'mock' driver when NODE_ENV === 'production'.
 */
export function getPaymentAdapter(driverOverride?: 'razorpay' | 'mock'): PaymentAdapter {
  if (customAdapterInstance) {
    return customAdapterInstance;
  }

  const effectiveOverride = driverOverride || driverOverrideState;
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.TEST_SUITE_RUNNING);
  
  // In production, driver must be razorpay
  let driver = effectiveOverride || process.env.PAYMENT_DRIVER;
  if (!driver) {
    const hasConfiguredRazorpayCredentials =
      Boolean(process.env.RAZORPAY_KEY_ID) &&
      !process.env.RAZORPAY_KEY_ID.startsWith('rzp_mock') &&
      Boolean(process.env.RAZORPAY_KEY_SECRET);

    if (process.env.NODE_ENV === 'production') {
      driver = 'razorpay';
    } else if (isTest) {
      driver = 'mock';
    } else if (hasConfiguredRazorpayCredentials) {
      driver = 'razorpay';
    } else {
      driver = 'mock';
    }
  }

  if (process.env.NODE_ENV === 'production' && driver === 'mock') {
    throw new PaymentConfigurationError(
      'Security Violation: Mock payment driver is strictly forbidden in production mode.'
    );
  }

  if (driver === 'mock') {
    return new MockPaymentAdapter();
  }

  return new RazorpayPaymentAdapter();
}

/**
 * Resets any cached singleton and driver override.
 */
export function resetPaymentAdapter(): void {
  driverOverrideState = null;
  cachedAdapter = null;
  customAdapterInstance = null;
}

