import { NextResponse } from 'next/server';
import { distanceService, validateDeliveryDate } from '@/lib/shipping/distance.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pincode = searchParams.get('pincode') || '';
    const address = searchParams.get('address') || undefined;

    const result = await distanceService.calculateDistance(pincode, address);
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

    const distanceResult = await distanceService.calculateDistance(pincode, address);

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
