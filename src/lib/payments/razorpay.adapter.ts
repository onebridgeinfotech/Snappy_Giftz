import crypto from 'node:crypto';
import {
  PaymentAdapter,
  CreatePaymentOrderInput,
  PaymentOrderResult,
  VerifyPaymentInput,
  WebhookVerificationResult,
  PaymentDetails,
  PaymentConfigurationError,
  PaymentGatewayError,
} from '@/services/adapters/payment.adapter';
import {
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getRazorpayWebhookSecret,
  isPlaceholderRazorpayValue,
} from './razorpay-env';

export const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

export class RazorpayPaymentAdapter implements PaymentAdapter {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor(
    keyId: string = getRazorpayKeyId(),
    keySecret: string = getRazorpayKeySecret(),
    webhookSecret: string = getRazorpayWebhookSecret()
  ) {
    this.keyId = keyId.trim();
    this.keySecret = keySecret.trim();
    this.webhookSecret = webhookSecret.trim();

    // Checkout requires API key + secret only. Webhook secret is validated when processing webhooks.
    if (process.env.NODE_ENV === 'production') {
      if (!this.keyId || isPlaceholderRazorpayValue(this.keyId)) {
        throw new PaymentConfigurationError(
          'Missing or placeholder RAZORPAY_KEY_ID in production environment.'
        );
      }
      if (!this.keySecret || isPlaceholderRazorpayValue(this.keySecret)) {
        throw new PaymentConfigurationError(
          'Missing or placeholder RAZORPAY_KEY_SECRET in production environment.'
        );
      }
    }
  }

  /**
   * Builds the official Razorpay Create Order payload conforming strictly to the
   * standard POST /v1/orders specification (amount, currency, receipt, notes).
   *
   * Capture Configuration Note:
   * Per Razorpay's published Standard Checkout server integration documentation, automatic
   * payment capture is configured through merchant settings in the Razorpay Dashboard
   * (Settings -> Configuration -> Payment Capture: "Auto-capture all payments").
   * The order creation request payload does not control capture state; capture is verified
   * independently on the server via fetchPaymentStatus() or a verified payment.captured webhook.
   */
  buildOrderPayload(input: CreatePaymentOrderInput): {
    amount: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  } {
    const amountNumber = typeof input.amountPaise === 'bigint'
      ? Number(input.amountPaise)
      : Math.round(input.amountPaise);

    if (amountNumber <= 0) {
      throw new PaymentGatewayError('Order amount in paise must be greater than zero.');
    }

    return {
      amount: amountNumber,
      currency: input.currency || 'INR',
      receipt: input.orderNumber.substring(0, 40),
      notes: {
        orderNumber: input.orderNumber,
        orderId: input.orderId,
        customerName: input.customerName.substring(0, 50),
        customerEmail: input.customerEmail.substring(0, 50),
        customerPhone: input.customerPhone.substring(0, 20),
      },
    };
  }

  /**
   * Calls Razorpay REST API to create a payment order with exact integer paise amount.
   */
  async createOrder(input: CreatePaymentOrderInput): Promise<PaymentOrderResult> {
    if (!this.keyId || !this.keySecret) {
      throw new PaymentConfigurationError(
        'Razorpay API credentials are not configured on this server.'
      );
    }

    const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const payload = this.buildOrderPayload(input);

    try {
      const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorDesc = data?.error?.description || data?.error?.reason || 'Razorpay order creation failed.';
        throw new PaymentGatewayError(
          `Razorpay API error: ${errorDesc}`,
          response.status,
          data?.error
        );
      }

      return {
        gatewayOrderId: data.id,
        amountPaise: data.amount,
        currency: data.currency,
        gatewayKeyId: this.keyId,
      };
    } catch (err: any) {
      if (err instanceof PaymentGatewayError || err instanceof PaymentConfigurationError) {
        throw err;
      }
      throw new PaymentGatewayError(
        `Failed to reach Razorpay gateway: ${err.message}`
      );
    }
  }

  /**
   * Cryptographically verifies the Razorpay client callback signature.
   * Signature formula: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
   */
  async verifyPaymentSignature(input: VerifyPaymentInput): Promise<boolean> {
    if (!this.keySecret) {
      throw new PaymentConfigurationError('RAZORPAY_KEY_SECRET is not configured for signature verification.');
    }

    if (!input.gatewayOrderId || !input.gatewayPaymentId || !input.gatewaySignature) {
      return false;
    }

    const payload = `${input.gatewayOrderId.trim()}|${input.gatewayPaymentId.trim()}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    const cleanSig = input.gatewaySignature.trim();
    if (expected.length !== cleanSig.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(cleanSig, 'utf8')
    );
  }

  /**
   * Cryptographically verifies the Razorpay webhook raw body signature.
   * Signature formula: HMAC-SHA256(rawBody, webhook_secret)
   */
  async verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string
  ): Promise<WebhookVerificationResult> {
    if (!this.webhookSecret) {
      throw new PaymentConfigurationError('RAZORPAY_WEBHOOK_SECRET is not configured for webhook verification.');
    }

    if (!rawBody || !signature) {
      return { isValid: false, eventType: 'unknown', error: 'Missing raw body or signature.' };
    }

    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(bodyStr)
      .digest('hex');

    const cleanSig = signature.trim();
    if (expected.length !== cleanSig.length) {
      return { isValid: false, eventType: 'unknown', error: 'Signature length mismatch.' };
    }

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(cleanSig, 'utf8')
    );

    if (!isMatch) {
      return { isValid: false, eventType: 'unknown', error: 'Cryptographic signature mismatch.' };
    }

    try {
      const payload = JSON.parse(bodyStr);
      const eventType = payload.event || 'unknown';
      const paymentEntity = payload.payload?.payment?.entity;
      const orderEntity = payload.payload?.order?.entity;

      return {
        isValid: true,
        eventType,
        eventId: payload.event_id || payload.id || `evt_${Date.now()}`,
        gatewayOrderId: paymentEntity?.order_id || orderEntity?.id,
        gatewayPaymentId: paymentEntity?.id,
        amountPaise: paymentEntity?.amount || orderEntity?.amount,
        currency: paymentEntity?.currency || orderEntity?.currency || 'INR',
        rawPayload: payload,
      };
    } catch {
      return { isValid: false, eventType: 'unknown', error: 'Malformed JSON in webhook body.' };
    }
  }

  /**
   * Fetches authoritative payment status and capture details from Razorpay REST API.
   * Endpoint: GET /v1/payments/:id
   * Used to verify whether an authorized payment was actually captured before confirming an order.
   */
  async fetchPaymentStatus(gatewayPaymentId: string): Promise<PaymentDetails | null> {
    if (!this.keyId || !this.keySecret) {
      throw new PaymentConfigurationError('Razorpay API credentials are not configured on this server.');
    }
    if (!gatewayPaymentId || !gatewayPaymentId.trim()) {
      return null;
    }

    const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    try {
      const response = await fetch(`${RAZORPAY_API_BASE}/payments/${encodeURIComponent(gatewayPaymentId.trim())}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new PaymentGatewayError(
          `Razorpay payment lookup failed with HTTP ${response.status}`,
          response.status
        );
      }

      const data = await response.json();
      const status = (data.status || 'unknown').toLowerCase();
      const isCaptured = Boolean(data.captured || status === 'captured');

      return {
        status,
        amountPaise: Number(data.amount),
        currency: data.currency || 'INR',
        gatewayOrderId: data.order_id,
        captured: isCaptured,
      };
    } catch (err: any) {
      if (err instanceof PaymentGatewayError || err instanceof PaymentConfigurationError) {
        throw err;
      }
      throw new PaymentGatewayError(
        `Failed to reach Razorpay payment status API: ${err.message}`
      );
    }
  }
}

