import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Valid GST slabs in India (Product.taxRatePercent is an integer). */
const GST_SLABS = [0, 3, 5, 12, 18, 28];

/** GET: every live product with its GST settings. */
export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);
    const products = await prisma.product.findMany({
      where: { isArchived: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, hsnCode: true, taxRatePercent: true, isTaxInclusive: true, basePricePaise: true },
    });
    return NextResponse.json({ success: true, data: { products, gstSlabs: GST_SLABS } });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load GST settings.' }, { status: 500 });
  }
}

/**
 * PUT: update GST for several products at once. Owner (ADMIN) only.
 * Body: { updates: [{ productId, taxRatePercent, hsnCode?, isTaxInclusive? }] }
 * New orders use the new rates; existing orders and invoices keep the rate they were placed with.
 */
export async function PUT(req: Request) {
  try {
    const user = await requireRole([Role.ADMIN], req);
    const body = await req.json().catch(() => ({}));
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (updates.length === 0 || updates.length > 500) {
      return NextResponse.json({ error: 'Send between 1 and 500 product updates.' }, { status: 400 });
    }

    const clean: Array<{ productId: string; taxRatePercent: number; hsnCode?: string; isTaxInclusive?: boolean }> = [];
    for (const u of updates) {
      const rate = Number(u?.taxRatePercent);
      if (typeof u?.productId !== 'string' || !u.productId) {
        return NextResponse.json({ error: 'Each update needs a productId.' }, { status: 400 });
      }
      if (!GST_SLABS.includes(rate)) {
        return NextResponse.json({ error: `GST must be one of ${GST_SLABS.join(', ')}%.` }, { status: 400 });
      }
      const hsn = typeof u.hsnCode === 'string' ? u.hsnCode.trim() : undefined;
      if (hsn !== undefined && !/^\d{4,8}$/.test(hsn)) {
        return NextResponse.json({ error: `HSN code "${hsn}" must be 4 to 8 digits.` }, { status: 400 });
      }
      clean.push({
        productId: u.productId,
        taxRatePercent: rate,
        hsnCode: hsn,
        isTaxInclusive: typeof u.isTaxInclusive === 'boolean' ? u.isTaxInclusive : undefined,
      });
    }

    const before = await prisma.product.findMany({
      where: { id: { in: clean.map((c) => c.productId) } },
      select: { id: true, name: true, hsnCode: true, taxRatePercent: true, isTaxInclusive: true },
    });
    if (before.length !== clean.length) {
      return NextResponse.json({ error: 'One or more products were not found.' }, { status: 404 });
    }

    await prisma.$transaction([
      ...clean.map((c) =>
        prisma.product.update({
          where: { id: c.productId },
          data: {
            taxRatePercent: c.taxRatePercent,
            ...(c.hsnCode !== undefined ? { hsnCode: c.hsnCode } : {}),
            ...(c.isTaxInclusive !== undefined ? { isTaxInclusive: c.isTaxInclusive } : {}),
          },
        })
      ),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'CATALOG_GST_UPDATED',
          resource: 'Product:tax-settings',
          details: { before, after: clean } as any,
        },
      }),
    ]);

    return NextResponse.json({ success: true, message: `GST updated for ${clean.length} product(s).` });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to save GST settings.' }, { status: 500 });
  }
}
