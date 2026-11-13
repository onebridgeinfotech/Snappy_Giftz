import { prisma } from '@/lib/prisma';
import { defaultProductSections } from './landing-sections';
import { toStringArray, truncate } from './site';

const titleCase = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Product name + a short Hyderabad suffix, kept within ~60 chars without cutting words. */
export function buildSeoTitle(name: string): string {
  const n = name.trim();
  for (const suffix of [' — Buy Online in Hyderabad', ' | Hyderabad', '']) {
    if ((n + suffix).length <= 60) return n + suffix;
  }
  return n.slice(0, 60).replace(/\s+\S*$/, '');
}

/** "<lead>. Buy <name> from ₹<price>[ with custom personalisation]. Fast delivery across Hyderabad." within 158 chars. */
export function buildMetaDescription(p: { name: string; tagline: string | null; description: string; basePricePaise: number; isCustomizable: boolean }): string {
  const lead = (p.tagline || p.description).replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  const tail = ` Buy ${p.name} from ₹${Math.round(p.basePricePaise / 100)}${p.isCustomizable ? ' with custom personalisation' : ''}. Fast delivery across Hyderabad.`;
  const room = 158 - tail.length;
  const head = lead.length > room ? lead.slice(0, Math.max(room - 1, 0)).replace(/\s+\S*$/, '') + '…' : lead;
  return room > 30 ? `${head}.${tail}`.replace('….', '…') : truncate(`${lead}.${tail}`, 158);
}

/**
 * Creates a dedicated landing page (ContentPage) for every active product that does not have one yet.
 * Each page gets its own SEO title, meta description, keywords and overview built from that product's data.
 * Existing pages (hand-edited by the team) are never overwritten.
 */
export async function generateProductLandingPages(): Promise<{ created: number; skipped: number }> {
  const products = await prisma.product.findMany({
    where: { isArchived: false },
    include: { category: true, contentPage: { select: { id: true } } },
  });
  let created = 0;
  let skipped = 0;
  for (const p of products) {
    if (p.contentPage) {
      skipped++;
      continue;
    }
    const occasions = toStringArray(p.occasions);
    const recipients = toStringArray(p.recipients);
    const price = Math.round(p.basePricePaise / 100);
    const occasionText = occasions.slice(0, 3).map(titleCase).join(', ');
    const seoTitle = buildSeoTitle(p.name);
    const metaDescription = buildMetaDescription(p);
    const sections = defaultProductSections({
      name: p.name,
      isCustomizable: p.isCustomizable,
      customizationType: p.customizationType,
      occasions,
      recipients,
      minOrderQty: p.minOrderQty,
      categoryName: p.category.name,
    });
    const images = toStringArray(p.images);
    await prisma.contentPage.create({
      data: {
        kind: 'PRODUCT',
        productId: p.id,
        slug: p.slug,
        title: p.name,
        heroTitle: p.name,
        heroSubtitle: p.tagline,
        heroImageUrl: images[0] ?? null,
        overview: `${p.description}${occasionText ? `\n\nPerfect for ${occasionText}.` : ''}`,
        sections: sections as object,
        seoTitle,
        metaDescription,
        keywords: [p.name, `${p.name} Hyderabad`, `${p.category.name} gifts`, ...occasions.map((o) => `${titleCase(o)} gifts`)].slice(0, 12),
      },
    });
    created++;
  }
  return { created, skipped };
}
