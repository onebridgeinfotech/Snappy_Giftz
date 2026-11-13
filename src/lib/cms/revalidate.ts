import { revalidatePath } from 'next/cache';

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // revalidatePath throws outside a request scope (e.g. scripts/tests) — ignore
  }
}

/** Refresh ISR caches after a content change. */
export function revalidateBlog(slug?: string | null) {
  safe(() => {
    revalidatePath('/blog', 'layout');
    if (slug) revalidatePath(`/blog/${slug}`);
    revalidatePath('/sitemap.xml');
    revalidatePath('/rss.xml');
  });
}

export function revalidateContentPage(kind: 'PRODUCT' | 'SERVICE', slug: string) {
  safe(() => {
    revalidatePath(kind === 'PRODUCT' ? `/products/${slug}` : `/services/${slug}`);
    if (kind === 'SERVICE') revalidatePath('/services');
    revalidatePath('/sitemap.xml');
  });
}

export function revalidateSite() {
  safe(() => revalidatePath('/', 'layout'));
}
