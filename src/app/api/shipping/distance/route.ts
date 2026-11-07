import { NextResponse } from 'next/server';
import { validateDeliveryDate } from '@/lib/shipping/distance.service';
import { evaluateDeliveryDistance, quoteDeliveryFee, sanitizeGeoPoint } from '@/lib/delivery/delivery-fee.service';

/** Distance check + automatic delivery charge for a PIN (shared with checkout pricing). */
async function evaluate(pincode: string, address?: string, location?: { latitude: number; longitude: number } | null) {
  const [result, fee] = await Promise.all([evaluateDeliveryDistance(pincode, address), quoteDeliveryFee(pincode, address, location)]);
  // The automatic quote decides eligibility (it knows the studio location and delivery radius).
  return {
    ...result,
    isServiceable: fee.serviceable,
    estimatedDistanceKm: fee.distanceKm ?? result.estimatedDistanceKm,
    message: fee.message,
    deliveryFee: fee,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pincode = searchParams.get('pincode') || '';
    const address = searchParams.get('address') || undefined;

    const result = await evaluate(pincode, address, sanitizeGeoPoint(searchParams.get('lat'), searchParams.get('lng')));
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to calculate distance' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pincode, address, requestedDeliveryDate } = body;

    const distanceResult = await evaluate(pincode, address);

    let dateValidation = null;
    if (requestedDeliveryDate) {
      dateValidation = validateDeliveryDate(requestedDeliveryDate);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...distanceResult,
        dateValidation,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to evaluate delivery eligibility' },
      { status: 500 }
    );
  }
}
