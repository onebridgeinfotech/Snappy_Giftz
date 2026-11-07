import { NextResponse } from 'next/server';
import { calculateCartPricing, PricingValidationError } from '@/lib/pricing/pricing.service';
import { CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { quoteDeliveryFee, sanitizeGeoPoint } from '@/lib/delivery/delivery-fee.service';

/**
 * Checkout price preview. When a 6-digit `pincode` is sent, the automatic distance-based delivery
 * charge is included, so the customer sees the exact amount they will pay before placing the order.
 * The same calculation runs again on the server when the order is created.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, destinationStateCode } = body;
    const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';
    const address = typeof body.address === 'string' ? body.address.slice(0, 300) : undefined;

    const location = sanitizeGeoPoint(body.latitude, body.longitude);
    const delivery = /^[1-9][0-9]{5}$/.test(pincode) ? await quoteDeliveryFee(pincode, address, location) : null;
    const autoFeePaise = delivery?.serviceable && delivery.isAutomatic && typeof delivery.feePaise === 'number' ? delivery.feePaise : undefined;

    const quote = await calculateCartPricing(items, destinationStateCode, autoFeePaise);

    return NextResponse.json({
      success: true,
      data: {
        ...quote,
        delivery: delivery
          ? {
              serviceable: delivery.serviceable,
              isAutomatic: delivery.isAutomatic,
              distanceKm: delivery.distanceKm,
              feePaise: delivery.feePaise,
              source: delivery.source,
              maxRadiusKm: delivery.maxRadiusKm,
              message: delivery.message,
            }
          : null,
      },
    });
  } catch (error: any) {
    if (error instanceof PricingValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    if (error instanceof CatalogDatabaseError) {
      return NextResponse.json(
        { error: 'Authoritative pricing service is temporarily unavailable' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to calculate cart pricing' },
      { status: 500 }
    );
  }
}
