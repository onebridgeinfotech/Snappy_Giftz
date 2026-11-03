import { NextResponse } from 'next/server';
import {
  initiatePayment,
  OrderNotEligibleForPaymentError,
  DeliveryChargeNotApprovedError,
  OrderHoldExpiredError,
} from '@/lib/payments/payment.service';
import { getOptionalUser } from '@/lib/auth/rbac';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { PaymentConfigurationError, PaymentGatewayError } from '@/services/adapters/payment.adapter';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderNumber, guestToken, customerAcceptedDeliveryCharge } = body;

    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json(
        { error: 'Valid orderNumber string is required.' },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // Rate Limiting Guard: Prevent payment order flooding
    const rateLimit = await enforceRateLimit('PAYMENT_CREATE', `${ipAddress}:${orderNumber.trim()}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many payment initialization requests. Please wait a moment before retrying.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
        }
      );
    }

    const user = await getOptionalUser(req);

    const paymentConfig = await initiatePayment({
      orderNumber,
      guestToken,
      userId: user?.id,
      userRole: user?.role,
      customerAcceptedDeliveryCharge: typeof customerAcceptedDeliveryCharge === 'boolean' ? customerAcceptedDeliveryCharge : undefined,
    });

    return NextResponse.json({
      success: true,
      data: paymentConfig,
    });
  } catch (error: any) {
    if (error instanceof OrderHoldExpiredError) {
      return NextResponse.json(
        { error: error.message, code: 'HOLD_EXPIRED' },
        { status: 410 } // Gone / expired hold
      );
    }

    if (error instanceof DeliveryChargeNotApprovedError) {
      return NextResponse.json(
        { error: error.message, code: 'DELIVERY_CHARGE_NOT_APPROVED' },
        { status: 400 }
      );
    }

    if (error instanceof OrderNotEligibleForPaymentError) {
      return NextResponse.json(
        { error: error.message, code: 'ORDER_NOT_ELIGIBLE' },
        { status: 400 }
      );
    }

    if (error instanceof PaymentConfigurationError) {
      return NextResponse.json(
        { error: 'Payment gateway configuration is not available on this server.' },
        { status: 503 }
      );
    }

    if (error instanceof PaymentGatewayError) {
      return NextResponse.json(
        { error: error.message },
        { status: 502 }
      );
    }

    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json(
        { error: 'Database service unavailable. Please retry shortly.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to initiate payment. Please try again.' },
      { status: 500 }
    );
  }
}
