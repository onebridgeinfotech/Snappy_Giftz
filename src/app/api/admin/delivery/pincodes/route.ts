import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { listServiceablePincodes, upsertServiceablePincode, DeliveryError } from '@/lib/delivery/delivery.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);
    const pincodes = await listServiceablePincodes();
    return NextResponse.json({
      success: true,
      data: pincodes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list serviceable pincodes.' },
      { status: err.statusCode || 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole([Role.ADMIN], req);
    const body = await req.json();

    const { pincode, areaName, zoneId, isActive, deliveryDays, notes } = body;

    if (!pincode || typeof pincode !== 'string') {
      return NextResponse.json(
        { success: false, error: '6-digit Indian pincode is required.' },
        { status: 400 }
      );
    }

    const result = await upsertServiceablePincode({
      pincode,
      areaName,
      zoneId,
      isActive,
      deliveryDays,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: 'Hyderabad serviceable PIN code updated.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof DeliveryError ? err.statusCode : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to upsert PIN code.' },
      { status: statusCode }
    );
  }
}

