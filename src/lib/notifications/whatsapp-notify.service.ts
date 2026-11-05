import { BUSINESS_CONFIG } from '@/config/business';

type WhatsAppSendResult = { ok: boolean; error?: string; messageId?: string | null };

function graphVersion(): string {
  return (process.env.WHATSAPP_GRAPH_VERSION || 'v21.0').trim();
}

function isConfigured(): boolean {
  return Boolean(
    (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_META_ACCESS_TOKEN || '').trim() &&
      (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim()
  );
}

/**
 * Sends a plain-text WhatsApp message via Meta Cloud API (same pattern as OneSocial).
 * Falls back to no-op when credentials are not configured (site still uses wa.me links).
 */
export async function sendWhatsAppTextMessage(toE164Digits: string, body: string): Promise<WhatsAppSendResult> {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_META_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const mock = (process.env.WHATSAPP_LOCAL_MOCK || '').toLowerCase() === 'true';

  const to = toE164Digits.replace(/\D/g, '');
  if (!to || !body.trim()) {
    return { ok: false, error: 'invalid_payload' };
  }

  if (mock) {
    console.info('[WHATSAPP_MOCK]', to, body.slice(0, 120));
    return { ok: true, messageId: `wamid.LOCAL_${to}_${Date.now()}` };
  }

  if (!isConfigured()) {
    return { ok: false, error: 'not_configured' };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body: body.slice(0, 4096) },
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.warn('[WHATSAPP_SEND]', res.status, raw.slice(0, 500));
      return { ok: false, error: raw.slice(0, 200) || `http_${res.status}` };
    }

    let messageId: string | null = null;
    try {
      const parsed = JSON.parse(raw) as { messages?: Array<{ id?: string }> };
      messageId = parsed.messages?.[0]?.id || null;
    } catch {
      /* ignore */
    }
    return { ok: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send_failed';
    console.warn('[WHATSAPP_SEND]', message);
    return { ok: false, error: message };
  }
}

/** Notify operations desk on WhatsApp when Cloud API is configured. */
export async function notifyAdminWhatsApp(text: string): Promise<void> {
  const notifyTo =
    (process.env.WHATSAPP_ADMIN_NOTIFY_PHONE || BUSINESS_CONFIG.whatsappPhone || '').replace(/\D/g, '') ||
    '';
  if (!notifyTo) return;

  const result = await sendWhatsAppTextMessage(notifyTo, text);
  if (!result.ok && result.error !== 'not_configured') {
    console.warn('[WHATSAPP_ADMIN_NOTIFY]', result.error);
  }
}

export async function notifyNewOrderWhatsApp(details: {
  orderNumber: string;
  customerName: string;
  totalInr: string;
  paymentMethod: string;
}): Promise<void> {
  const line = `[SNAPPY GIFTZ] New order #${details.orderNumber}\n${details.customerName} · ${details.paymentMethod}\nTotal: ${details.totalInr}\n${BUSINESS_CONFIG.website}/admin`;
  await notifyAdminWhatsApp(line);
}
