import { NextResponse } from 'next/server';
import { getRazorpayConfigStatus } from '@/lib/payments/razorpay-env';
import { getPaymentAdapter } from '@/lib/payments/payment-factory';
import { PaymentConfigurationError } from '@/services/adapters/payment.adapter';

/**
 * GET /api/health/payments — safe diagnostics (no secrets exposed).
 * Use after changing Hostinger env vars; restart Node app if checkoutReady is false.
 */
export async function GET() {
  const status = getRazorpayConfigStatus();
  let adapterOk = false;
  let adapterError: string | null = null;

  try {
    getPaymentAdapter();
    adapterOk = true;
  } catch (err) {
    adapterError =
      err instanceof PaymentConfigurationError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Payment adapter failed to initialize.';
  }

  return NextResponse.json({
    success: true,
    data: {
      ...status,
      adapterOk,
      adapterError,
      nodeEnv: process.env.NODE_ENV || 'unknown',
      hint:
        status.checkoutReady && adapterOk
          ? 'Razorpay API keys are loaded. Checkout should open the Razorpay modal after order creation.'
          : 'Fix env var names/values in hPanel, click Save (restarts Node), then retry. Required: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.',
    },
  });
}
