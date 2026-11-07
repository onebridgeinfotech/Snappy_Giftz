import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/catalog/validation';

export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);

    const occasions = await prisma.occasion.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: occasions });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const operator = await requireRole([Role.ADMIN], req);

    let body: { name: string; slug?: string; description?: string; imageUrl?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json({ error: 'Occasion name must be at least 2 characters' }, { status: 400 });
    }

    const targetSlug = body.slug ? slugify(body.slug) : slugify(body.name);

    const existing = await prisma.occasion.findFirst({
      where: {
        OR: [{ name: { equals: body.name.trim() } }, { slug: targetSlug }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Occasion with name "${body.name}" or slug "${targetSlug}" already exists.` },
        { status: 409 }
      );
    }

    const occasion = await prisma.$transaction(async (tx) => {
      const occ = await tx.occasion.create({
        data: {
          name: body.name.trim(),
          slug: targetSlug,
          description: body.description?.trim() || null,
          imageUrl: body.imageUrl?.trim() || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: operator.id,
          action: 'CATALOG_OCCASION_CREATED',
          resource: `Occasion:${occ.id}`,
          details: { name: occ.name, slug: occ.slug },
        },
      });

      return occ;
    });

    return NextResponse.json({ success: true, data: occasion }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
