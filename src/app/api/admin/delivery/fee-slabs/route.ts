import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import {
  getDeliverySettings,
  getDeliveryFeeSlabs,
  saveDeliveryFeeSlabs,
  isAutoDeliveryFeeEnabled,
  DeliveryFeeError,
} from '@/lib/delivery/delivery-fee.service';

export const dynamic = 'force-dynamic';

/** GET: current distance slabs (staff can view). */
export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);
    const [{ slabs, isDefault }, { settings }] = await Promise.all([getDeliveryFeeSlabs(), getDeliverySettings()]);
    return NextResponse.json({
      success: true,
      data: { slabs, isDefault, autoEnabled: isAutoDeliveryFeeEnabled(), maxRadiusKm: settings.maxRadiusKm },
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load delivery charges.' }, { status: 500 });
  }
}

/** PUT: replace the slabs. Owner (ADMIN) only. Body: { slabs: [{ maxDistanceKm, feePaise }] } */
export async function PUT(req: Request) {
  try {
    const user = await requireRole([Role.ADMIN], req);
    const body = await req.json().catch(() => ({}));
    const saved = await saveDeliveryFeeSlabs(body.slabs, user.email || user.name || 'ADMIN');
    return NextResponse.json({ success: true, data: { slabs: saved }, message: 'Delivery charges saved.' });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof DeliveryFeeError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to save delivery charges.' }, { status: 500 });
  }
}
