import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { listDeliveryFeeRules, upsertDeliveryFeeRule, DeliveryError } from '@/lib/delivery/delivery.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);
    const rules = await listDeliveryFeeRules();
    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list delivery fee rules.' },
      { status: err.statusCode || 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole([Role.ADMIN], req);
    const body = await req.json();

    const { id, name, minOrderAmountPaise, maxOrderAmountPaise, feePaise, priority, isActive } = body;

    if (!name || typeof feePaise !== 'number' || typeof minOrderAmountPaise !== 'number') {
      return NextResponse.json(
        { success: false, error: 'name, minOrderAmountPaise, and feePaise are required.' },
        { status: 400 }
      );
    }

    const result = await upsertDeliveryFeeRule({
      id,
      name,
      minOrderAmountPaise,
      maxOrderAmountPaise,
      feePaise,
      priority,
      isActive,
    });

    return NextResponse.json({
      success: true,
      message: 'Delivery fee rule saved successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err instanceof DeliveryError ? err.statusCode : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save delivery fee rule.' },
      { status: statusCode }
    );
  }
}

