import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const slug = `qa-rupee-one-${Date.now()}`;
  const name = `QA One Rupee Test ${new Date().toISOString().slice(0, 19)}`;

  let category = await prisma.category.findFirst({ where: { isActive: true } });
  if (!category) {
    throw new Error('No active category in database');
  }

  const product = await prisma.$transaction(async (tx) => {
    return tx.product.create({
      data: {
        name,
        slug,
        description: 'Automated E2E test product priced at exactly ₹1.00.',
        categoryId: category!.id,
        occasions: ['Festival'],
        recipients: ['Family'],
        hsnCode: '69120010',
        taxRatePercent: 18,
        basePricePaise: 100,
        mrpPaise: 100,
        productType: 'REGULAR',
        isCustomizable: false,
        minOrderQty: 1,
        images: ['/placeholder-product.jpg'],
        isActive: true,
        isArchived: false,
        variants: {
          create: [
            {
              name: 'Standard',
              sku: `QA1R${Date.now().toString().slice(-8)}`,
              attributes: {},
              pricePaise: 100,
              stockQuantity: 50,
            },
          ],
        },
      },
      include: { variants: true },
    });
  });

  console.log(
    JSON.stringify(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        basePricePaise: product.basePricePaise,
        variantPricePaise: product.variants[0]?.pricePaise,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
