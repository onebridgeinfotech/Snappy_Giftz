import { NextResponse } from 'next/server';
import {
  isValidCourierWebhookToken,
  processCourierTrackingWebhook,
} from '@/lib/shipping/courier-tracking.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/courier-tracking
 *
 * Courier status push (Shiprocket: Settings > API > Webhooks). Shiprocket rejects webhook URLs
 * containing "shiprocket", "sr", "kr" or "kartrocket", hence this neutral path.
 * Auth: the token configured in Shiprocket is sent as the x-api-key header and must equal
 * COURIER_WEBHOOK_TOKEN. Always answers 200 for authenticated pushes (even unknown AWBs) so the
 * courier does not retry forever; processing is idempotent.
 */
export async function POST(req: Request) {
  if (!isValidCourierWebhookToken(req.headers.get('x-api-key'))) {
    return NextResponse.json({ error: 'Invalid webhook token.' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ received: true, status: 'IGNORED_INVALID_JSON' }, { status: 200 });
  }

  try {
    const result = await processCourierTrackingWebhook(payload);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (err: any) {
    // 500 lets the courier retry later (e.g. database briefly unavailable); retries are deduplicated.
    console.error('[COURIER_WEBHOOK_ERROR]', err?.message || err);
    return NextResponse.json({ error: 'Tracking update could not be processed.' }, { status: 500 });
  }
}
