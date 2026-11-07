/**
 * Courier tracking pipeline (push-based, no polling).
 *
 * The courier aggregator (Shiprocket: Settings > API > Webhooks) POSTs every scan / status change
 * to /api/webhooks/courier-tracking. We store each scan as a ShipmentTrackingEvent (deduplicated,
 * so webhook retries are harmless), move the shipment/order forward (never backward), and email
 * the customer at the moments that matter: out for delivery, delivered, delivery attempt failed.
 * The customer's tracking view reads the stored timeline, so it is current as soon as the courier
 * pushes an update.
 */
import crypto from 'node:crypto';
import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type NormalizedTrackingStatus =
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'FAILED_ATTEMPT'
  | 'DELIVERED'
  | 'RTO'
  | 'CANCELLED'
  | 'OTHER';

/** Higher rank = further along. Shipment status never moves to a lower rank. */
const STATUS_RANK: Record<NormalizedTrackingStatus, number> = {
  OTHER: 0,
  CANCELLED: 0,
  PICKED_UP: 1,
  IN_TRANSIT: 2,
  FAILED_ATTEMPT: 3,
  OUT_FOR_DELIVERY: 3,
  RTO: 4,
  DELIVERED: 5,
};

export const TRACKING_STATUS_LABELS: Record<NormalizedTrackingStatus, string> = {
  PICKED_UP: 'Picked up by courier',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  FAILED_ATTEMPT: 'Delivery attempt failed',
  DELIVERED: 'Delivered',
  RTO: 'Returning to sender',
  CANCELLED: 'Shipment cancelled',
  OTHER: 'Shipment update',
};

/** Maps a courier's free-text status label to our small set of statuses. */
export function normalizeCourierStatus(label: string | null | undefined): NormalizedTrackingStatus {
  const s = String(label || '').toUpperCase().replace(/[_-]+/g, ' ').trim();
  if (!s) return 'OTHER';
  if (s.includes('RTO') || s.includes('RETURN')) return 'RTO';
  if (s.includes('UNDELIVERED') || s.includes('NOT DELIVERED') || s.includes('FAILED') || s.includes('NDR')) {
    return 'FAILED_ATTEMPT';
  }
  if (s.includes('OUT FOR DELIVERY')) return 'OUT_FOR_DELIVERY';
  if (s.includes('DELIVERED')) return 'DELIVERED';
  if (s.includes('CANCEL')) return 'CANCELLED';
  if (s.includes('PICKED') || s.includes('PICKUP') || s.includes('PICK UP')) return 'PICKED_UP';
  if (
    s.includes('TRANSIT') ||
    s.includes('SHIPPED') ||
    s.includes('REACHED') ||
    s.includes('HUB') ||
    s.includes('DISPATCH') ||
    s.includes('MANIFEST') ||
    s.includes('ARRIVED') ||
    s.includes('DEPART')
  ) {
    return 'IN_TRANSIT';
  }
  return 'OTHER';
}

/**
 * Parses courier timestamps, which are IST without a zone: "2026-11-07 14:05:00",
 * "07 11 2026 14:05:00" or "07-11-2026 14:05:00". Falls back to now.
 */
export function parseCourierTimestamp(value: unknown, fallback: Date = new Date()): Date {
  if (!value) return fallback;
  const raw = String(value).trim();
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}+05:30`);
  m = raw.match(/^(\d{2})[ \-/](\d{2})[ \-/](\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] || '00'}+05:30`);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** Constant-time check of the webhook token Shiprocket sends in the x-api-key header. */
export function isValidCourierWebhookToken(supplied: string | null | undefined): boolean {
  const expected = process.env.COURIER_WEBHOOK_TOKEN?.trim();
  if (!expected || !supplied) return false;
  const a = crypto.createHash('sha256').update(supplied.trim()).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

interface ParsedScan {
  status: NormalizedTrackingStatus;
  rawStatus: string | null;
  activity: string | null;
  location: string | null;
  eventAt: Date;
}

/** Extracts scans from a Shiprocket-style payload (tolerant of missing/renamed fields). */
export function parseCourierPayload(payload: any): {
  awb: string | null;
  courierName: string | null;
  current: ParsedScan;
  scans: ParsedScan[];
} {
  const awb = payload?.awb != null ? String(payload.awb).trim() : payload?.awb_code ? String(payload.awb_code).trim() : null;
  const currentLabel = payload?.current_status || payload?.shipment_status || payload?.status || null;
  const current: ParsedScan = {
    status: normalizeCourierStatus(currentLabel),
    rawStatus: currentLabel ? String(currentLabel) : null,
    activity: null,
    location: null,
    eventAt: parseCourierTimestamp(payload?.current_timestamp),
  };
  const scans: ParsedScan[] = Array.isArray(payload?.scans)
    ? payload.scans.map((sc: any) => {
        const label = sc?.['sr-status-label'] || sc?.status || sc?.activity || null;
        return {
          status: normalizeCourierStatus(label),
          rawStatus: label ? String(label) : null,
          activity: sc?.activity ? String(sc.activity) : null,
          location: sc?.location ? String(sc.location) : null,
          eventAt: parseCourierTimestamp(sc?.date, current.eventAt),
        };
      })
    : [];
  return {
    awb,
    courierName: payload?.courier_name ? String(payload.courier_name) : null,
    current,
    scans,
  };
}

function dedupeKeyFor(awb: string, scan: ParsedScan): string {
  return crypto
    .createHash('sha256')
    .update(`${awb}|${scan.eventAt.toISOString()}|${scan.rawStatus || ''}|${scan.activity || ''}|${scan.location || ''}`)
    .digest('hex');
}

export interface CourierWebhookResult {
  status: 'PROCESSED' | 'IGNORED_NO_AWB' | 'IGNORED_UNKNOWN_AWB';
  awb?: string | null;
  orderNumber?: string;
  shipmentStatus?: NormalizedTrackingStatus;
  newEvents?: number;
}

/**
 * Stores the pushed scans and advances the shipment and order. Idempotent: replaying the same
 * payload adds no events and sends no extra emails.
 */
export async function processCourierTrackingWebhook(payload: any): Promise<CourierWebhookResult> {
  const parsed = parseCourierPayload(payload);
  if (!parsed.awb) return { status: 'IGNORED_NO_AWB' };

  const shipment = await prisma.shipment.findFirst({
    where: { awbNumber: parsed.awb },
    include: { order: true },
  });
  // Unknown AWB (e.g. a test push, or a shipment created outside this site): acknowledge so the
  // courier does not keep retrying, but store nothing.
  if (!shipment) return { status: 'IGNORED_UNKNOWN_AWB', awb: parsed.awb };

  const allScans = parsed.scans.length > 0 ? [...parsed.scans] : [];
  // Make sure the current status is in the timeline even when no scans are sent.
  if (!allScans.some((s) => s.rawStatus === parsed.current.rawStatus && s.status === parsed.current.status)) {
    allScans.push(parsed.current);
  }

  const created = await prisma.shipmentTrackingEvent.createMany({
    data: allScans.map((scan) => ({
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      awbNumber: parsed.awb!,
      status: scan.status,
      rawStatus: scan.rawStatus,
      activity: scan.activity,
      location: scan.location,
      eventAt: scan.eventAt,
      source: 'COURIER_WEBHOOK',
      dedupeKey: dedupeKeyFor(parsed.awb!, scan),
    })),
    skipDuplicates: true,
  });

  // Advance the shipment status (never backwards; FAILED_ATTEMPT may follow OUT_FOR_DELIVERY and vice versa).
  const previous = (shipment.dispatchStatus || 'PENDING') as NormalizedTrackingStatus;
  const next = parsed.current.status;
  const shouldAdvance =
    next !== 'OTHER' &&
    previous !== 'DELIVERED' &&
    (STATUS_RANK[next] ?? 0) >= (STATUS_RANK[previous] ?? 0);

  if (shouldAdvance && next !== previous) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        dispatchStatus: next,
        carrierPartner: shipment.carrierPartner || parsed.courierName,
        ...(next === 'DELIVERED' ? { deliveredAt: parsed.current.eventAt } : {}),
      },
    });
  }

  if (shouldAdvance) {
    await advanceOrderFromCourierStatus(shipment.order, next, parsed.current.rawStatus);
  }

  if (created.count > 0 && shouldAdvance && next !== previous) {
    await notifyCustomerOfTrackingUpdate(shipment.order, shipment, next, parsed.current).catch((err) =>
      console.warn(`[COURIER_TRACKING] Customer notification failed for #${shipment.order.orderNumber}:`, err)
    );
  }

  return {
    status: 'PROCESSED',
    awb: parsed.awb,
    orderNumber: shipment.order.orderNumber,
    shipmentStatus: shouldAdvance ? next : previous,
    newEvents: created.count,
  };
}

/** Moves the order to OUT_FOR_DELIVERY / DELIVERED using the normal lifecycle (stock is deducted on delivery). */
async function advanceOrderFromCourierStatus(order: any, status: NormalizedTrackingStatus, rawStatus: string | null) {
  const { transitionOrderStatus, confirmOrderDelivery } = await import('@/lib/orders/order-lifecycle.service');
  const actor = 'COURIER_WEBHOOK';
  const note = `Courier update: ${rawStatus || TRACKING_STATUS_LABELS[status]}`;
  try {
    if (status === 'OUT_FOR_DELIVERY' && order.orderStatus === OrderStatus.DISPATCHED) {
      await transitionOrderStatus(order.id, OrderStatus.OUT_FOR_DELIVERY, actor, note);
    } else if (status === 'DELIVERED') {
      if (order.orderStatus === OrderStatus.DISPATCHED) {
        await confirmOrderDelivery(order.id, { notes: note }, actor);
      } else if (order.orderStatus === OrderStatus.OUT_FOR_DELIVERY) {
        await transitionOrderStatus(order.id, OrderStatus.DELIVERED, actor, note);
      }
    }
  } catch (err) {
    // A disallowed transition (e.g. order already cancelled) must not fail the webhook.
    console.warn(`[COURIER_TRACKING] Order #${order.orderNumber} not advanced to ${status}:`, err instanceof Error ? err.message : err);
  }
}

async function notifyCustomerOfTrackingUpdate(
  order: any,
  shipment: any,
  status: NormalizedTrackingStatus,
  current: ParsedScan
): Promise<void> {
  if (!['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_ATTEMPT'].includes(status)) return;
  if (!order.customerEmail) return;

  const [{ getSellerConfig }, { enqueueTransactionalEmail }, { renderShipmentStatusUpdateTemplate }, { SNAPPY_EMAIL_BRAND }] =
    await Promise.all([
      import('@/lib/invoices/seller-config.service'),
      import('@/lib/email/email-outbox.service'),
      import('@/lib/email/email-templates'),
      import('@/lib/email/snappy-email-brand'),
    ]);

  const seller = await getSellerConfig();
  const email = renderShipmentStatusUpdateTemplate(seller, {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    statusLabel: TRACKING_STATUS_LABELS[status],
    status,
    courierName: shipment.carrierPartner || null,
    awbNumber: shipment.awbNumber || null,
    trackingUrl: shipment.trackingUrl || null,
    location: current.location,
    ordersUrl: `${SNAPPY_EMAIL_BRAND.siteUrl}/account/orders`,
  });

  await enqueueTransactionalEmail({
    // One email per order per status (a second failed attempt on a later day still notifies).
    idempotencyKey: `email:tracking:${order.orderNumber}:${status}:${status === 'FAILED_ATTEMPT' ? current.eventAt.toISOString().slice(0, 10) : 'once'}`,
    eventType: `SHIPMENT_${status}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    recipientEmail: order.customerEmail,
    recipientName: order.customerName,
    subject: email.subject,
    htmlBody: email.html,
    textBody: email.text,
  });
}

export interface TrackingTimelineEntry {
  status: string;
  label: string;
  detail: string | null;
  location: string | null;
  at: string;
  source: 'STORE' | 'COURIER';
}

const CUSTOMER_VISIBLE_ORDER_STATUSES: Record<string, string> = {
  CONFIRMED: 'Order confirmed',
  PROCESSING: 'Being prepared',
  IN_CUSTOMIZATION: 'Personalisation in progress',
  QUALITY_CHECK: 'Quality check',
  DISPATCHED: 'Handed to courier',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Order cancelled',
};

/**
 * Builds the customer tracking timeline (newest first) from store status changes plus courier
 * scans. Internal notes are never exposed; only courier activity/location text is shown.
 */
export function buildTrackingTimeline(order: any): TrackingTimelineEntry[] {
  const entries: TrackingTimelineEntry[] = [];
  for (const h of order.statusHistory || []) {
    const label = CUSTOMER_VISIBLE_ORDER_STATUSES[h.toStatus];
    if (!label || h.fromStatus === h.toStatus) continue;
    if (h.changedBy === 'COURIER_WEBHOOK') continue; // the courier scan itself is shown instead
    entries.push({
      status: h.toStatus,
      label,
      detail: null,
      location: null,
      at: new Date(h.createdAt).toISOString(),
      source: 'STORE',
    });
  }
  for (const shipment of order.shipments || []) {
    for (const ev of shipment.trackingEvents || []) {
      entries.push({
        status: ev.status,
        label: ev.rawStatus || TRACKING_STATUS_LABELS[ev.status as NormalizedTrackingStatus] || 'Shipment update',
        detail: ev.activity || null,
        location: ev.location || null,
        at: new Date(ev.eventAt).toISOString(),
        source: 'COURIER',
      });
    }
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
