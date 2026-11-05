/** Reads Razorpay env vars and strips accidental wrapping quotes from hPanel paste. */
function readEnv(name: string, fallbacks: string[] = []): string {
  const raw = [name, ...fallbacks].map((k) => process.env[k]).find(Boolean) || '';
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function getRazorpayKeyId(): string {
  return readEnv('RAZORPAY_KEY_ID', ['RAZORPAY_API_KEY', 'NEXT_PUBLIC_RAZORPAY_KEY_ID']);
}

export function getRazorpayKeySecret(): string {
  return readEnv('RAZORPAY_KEY_SECRET', ['RAZORPAY_SECRET', 'RAZORPAY_KEY_SECRET_KEY']);
}

export function getRazorpayWebhookSecret(): string {
  return readEnv('RAZORPAY_WEBHOOK_SECRET', ['RAZORPAY_WEBHOOK_KEY']);
}

export function isPlaceholderRazorpayValue(value: string): boolean {
  const v = value.toLowerCase();
  return !v || v.includes('placeholder') || v === 'your_key_here';
}

export function getRazorpayConfigStatus(): {
  hasKeyId: boolean;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  keyIdPrefix: string | null;
  checkoutReady: boolean;
  issues: string[];
} {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  const webhookSecret = getRazorpayWebhookSecret();
  const issues: string[] = [];

  if (!keyId || isPlaceholderRazorpayValue(keyId)) {
    issues.push('Set RAZORPAY_KEY_ID (must start with rzp_test_ or rzp_live_).');
  }
  if (!keySecret || isPlaceholderRazorpayValue(keySecret)) {
    issues.push('Set RAZORPAY_KEY_SECRET (API secret from Razorpay dashboard).');
  }
  if (!webhookSecret || isPlaceholderRazorpayValue(webhookSecret)) {
    issues.push('Optional for checkout: RAZORPAY_WEBHOOK_SECRET (required for webhooks only).');
  }

  const checkoutReady =
    Boolean(keyId && keySecret) &&
    !isPlaceholderRazorpayValue(keyId) &&
    !isPlaceholderRazorpayValue(keySecret);

  return {
    hasKeyId: Boolean(keyId),
    hasKeySecret: Boolean(keySecret),
    hasWebhookSecret: Boolean(webhookSecret) && !isPlaceholderRazorpayValue(webhookSecret),
    keyIdPrefix: keyId ? `${keyId.slice(0, 12)}…` : null,
    checkoutReady,
    issues,
  };
}
