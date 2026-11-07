import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/catalog/validation';

export async function GET(req: Request) {
  try {
    await requireRole([Role.ADMIN, Role.STAFF], req);

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: categories });
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
      return NextResponse.json({ error: 'Category name must be at least 2 characters' }, { status: 400 });
    }

    const targetSlug = body.slug ? slugify(body.slug) : slugify(body.name);

    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ name: { equals: body.name.trim() } }, { slug: targetSlug }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Category with name "${body.name}" or slug "${targetSlug}" already exists.` },
        { status: 409 }
      );
    }

    const category = await prisma.$transaction(async (tx) => {
      const cat = await tx.category.create({
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
          action: 'CATALOG_CATEGORY_CREATED',
          resource: `Category:${cat.id}`,
          details: { name: cat.name, slug: cat.slug },
        },
      });

      return cat;
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
