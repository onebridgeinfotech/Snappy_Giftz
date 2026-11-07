export const STOREFRONT_AUTH_CHANGED_EVENT = 'snappy:storefront-auth-changed';

export type StorefrontAuthUser = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
} | null;

/** Notify AppContext to load cart/wishlist for the signed-in user (or guest). */
export function notifyStorefrontAuthChanged(user: StorefrontAuthUser): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(STOREFRONT_AUTH_CHANGED_EVENT, { detail: { user } })
  );
}
