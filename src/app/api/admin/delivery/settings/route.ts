import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { getDeliverySettings, saveDeliverySettings, DeliveryFeeError } from '@/lib/delivery/delivery-fee.service';
import { isFreeGeocodingEnabled } from '@/lib/delivery/free-geocoding.service';

export const dynamic = 'force-dynamic';

/** GET: studio location + delivery radius. */
export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);
    const { settings, isDefault } = await getDeliverySettings();
    return NextResponse.json({
      success: true,
      data: { ...settings, isDefault, freeMapEnabled: isFreeGeocodingEnabled() },
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load delivery settings.' }, { status: 500 });
  }
}

/** PUT: save studio location + radius. Owner (ADMIN) only. */
export async function PUT(req: Request) {
  try {
    const user = await requireRole([Role.ADMIN], req);
    const body = await req.json().catch(() => ({}));
    const saved = await saveDeliverySettings(body, user.email || user.name || 'ADMIN');
    return NextResponse.json({ success: true, data: saved, message: 'Studio location saved.' });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof DeliveryFeeError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to save delivery settings.' }, { status: 500 });
  }
}
