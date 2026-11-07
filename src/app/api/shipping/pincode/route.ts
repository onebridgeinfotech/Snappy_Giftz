import { NextResponse } from 'next/server';
import { checkHyderabadServiceability, primePincodeFromDatabase } from '@/lib/delivery/delivery.service';
import { checkPincodeServiceability } from '@/lib/shipping/pincode.service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pincode = searchParams.get('pincode') || '';

  // 1. Check database and dynamic owner registry first
  try {
    const dbCheck = await checkHyderabadServiceability(pincode);
    if (dbCheck.serviceable) {
      return NextResponse.json({
        success: true,
        data: {
          valid: true,
          serviceable: true,
          city: dbCheck.city,
          state: dbCheck.state,
          stateCode: dbCheck.stateCode,
          estimatedDays: dbCheck.deliveryDays,
          expressAvailable: true,
          message: dbCheck.message,
        },
      });
    }
  } catch {
    // fallback to synchronous check
  }

  // Load any owner override (e.g. a paused PIN) before the built-in list is consulted.
  await primePincodeFromDatabase(pincode);
  const result = checkPincodeServiceability(pincode);

  return NextResponse.json({
    success: result.valid,
    data: result,
  });
}
