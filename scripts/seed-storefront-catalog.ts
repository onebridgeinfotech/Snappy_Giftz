/**
 * Seeds MySQL with INITIAL_PRODUCTS so production checkout can price orders.
 * Run once on Hostinger (or any env) with DATABASE_URL set:
 *   npx tsx scripts/seed-storefront-catalog.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { INITIAL_PRODUCTS } from '../src/data/initialData';
import { slugify } from '../src/lib/catalog/validation';

function categorySlug(name: string): string {
  return slugify(name) || 'general';
}

async function main() {
  console.log('--- SNAPPY GIFTZ: Seed storefront catalog from INITIAL_PRODUCTS ---');

  const categoryCache = new Map<string, string>();

  for (const p of INITIAL_PRODUCTS) {
    const catName = p.category || 'General';
    let categoryId = categoryCache.get(catName);
    if (!categoryId) {
      const slug = categorySlug(catName);
      const cat = await prisma.category.upsert({
        where: { slug },
        create: {
          name: catName,
          slug,
          description: `${catName} collection`,
          isActive: true,
        },
        update: { isActive: true },
      });
      categoryId = cat.id;
      categoryCache.set(catName, categoryId);
    }

    const slug = slugify(p.name) || p.id;
    const basePricePaise = Math.round(p.basePrice * 100);
    const mrpPaise = Math.round((p.mrp || p.basePrice) * 100);

    await prisma.product.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        slug,
        tagline: p.tagline || null,
        description: p.description,
        categoryId,
        productType: p.isCustomizable ? 'CUSTOMIZABLE' : 'REGULAR',
        occasions: p.occasion || [],
        recipients: p.recipient || [],
        hsnCode: p.hsnCode || '69120010',
        taxRatePercent: p.taxRate ?? 18,
        basePricePaise,
        mrpPaise,
        isCustomizable: Boolean(p.isCustomizable),
        customizationType: p.customizationType || null,
        customizationFeePaise: 0,
        minOrderQty: p.minOrderQty ?? 1,
        images: p.images || [],
        isActive: true,
        isArchived: false,
      },
      update: {
        name: p.name,
        tagline: p.tagline || null,
        description: p.description,
        categoryId,
        hsnCode: p.hsnCode || '69120010',
        taxRatePercent: p.taxRate ?? 18,
        basePricePaise,
        mrpPaise,
        isCustomizable: Boolean(p.isCustomizable),
        customizationType: p.customizationType || null,
        minOrderQty: p.minOrderQty ?? 1,
        images: p.images || [],
        isActive: true,
        isArchived: false,
      },
    });

    const variantId = `${p.id}-default`;
    const sku = p.sku || `${p.id}-SKU`;
    await prisma.productVariant.upsert({
      where: { id: variantId },
      create: {
        id: variantId,
        productId: p.id,
        sku,
        name: 'Standard',
        attributes: {},
        pricePaise: basePricePaise,
        stockQuantity: p.stock ?? 100,
        isActive: true,
        isArchived: false,
      },
      update: {
        sku,
        pricePaise: basePricePaise,
        stockQuantity: p.stock ?? 100,
        isActive: true,
        isArchived: false,
      },
    });

    console.log(`  ✓ ${p.id} — ${p.name}`);
  }

  const count = await prisma.product.count({ where: { isActive: true, isArchived: false } });
  console.log(`\nDone. Active products in database: ${count}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
