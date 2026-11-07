import type { CartItem, CorporateQuotation, Order } from '@/types';

const SCOPE_VERSION = 'v2';
const LEGACY_KEYS = {
  cart: 'snappy_giftz_cart_v1',
  wishlist: 'snappy_giftz_wishlist_v1',
  orders: 'snappy_giftz_orders_v1',
  quotations: 'snappy_giftz_rfqs_v1',
} as const;

const SCOPED_SUFFIX = {
  cart: 'cart',
  wishlist: 'wishlist',
  orders: 'orders',
  quotations: 'rfqs',
} as const;

export const LEGACY_CLIENT_STORE_MIGRATED_KEY = 'snappy_giftz_client_store_legacy_migrated_v1';

export type ClientStoreBundle = {
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  quotations: CorporateQuotation[];
};

export function scopeKeyForUser(userId: string | null | undefined): string {
  const id = typeof userId === 'string' ? userId.trim() : '';
  return id ? `user:${id}` : 'guest';
}

function scopedStorageKey(kind: keyof typeof SCOPED_SUFFIX, scope: string): string {
  return `snappy_giftz_${SCOPED_SUFFIX[kind]}_${SCOPE_VERSION}:${scope}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function emptyClientStoreBundle(): ClientStoreBundle {
  return { cart: [], wishlist: [], orders: [], quotations: [] };
}

/** One-time: move unscoped (shared) keys into the guest scope so new logins do not inherit another account's data. */
export function migrateLegacyGlobalClientStore(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(LEGACY_CLIENT_STORE_MIGRATED_KEY) === '1') return;

    const guest = 'guest';
    const kinds = Object.keys(LEGACY_KEYS) as (keyof typeof LEGACY_KEYS)[];

    for (const kind of kinds) {
      const legacyRaw = localStorage.getItem(LEGACY_KEYS[kind]);
      if (!legacyRaw) continue;

      const targetKey = scopedStorageKey(kind, guest);
      const existingRaw = localStorage.getItem(targetKey);
      if (!existingRaw) {
        localStorage.setItem(targetKey, legacyRaw);
      }
      localStorage.removeItem(LEGACY_KEYS[kind]);
    }

    localStorage.setItem(LEGACY_CLIENT_STORE_MIGRATED_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

export function readClientStoreBundle(scope: string): ClientStoreBundle {
  if (typeof window === 'undefined') return emptyClientStoreBundle();

  return {
    cart: safeParse<CartItem[]>(localStorage.getItem(scopedStorageKey('cart', scope)), []),
    wishlist: safeParse<string[]>(localStorage.getItem(scopedStorageKey('wishlist', scope)), []),
    orders: safeParse<Order[]>(localStorage.getItem(scopedStorageKey('orders', scope)), []),
    quotations: safeParse<CorporateQuotation[]>(
      localStorage.getItem(scopedStorageKey('quotations', scope)),
      []
    ),
  };
}

export function writeClientStoreBundle(scope: string, bundle: ClientStoreBundle): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(scopedStorageKey('cart', scope), JSON.stringify(bundle.cart));
    localStorage.setItem(scopedStorageKey('wishlist', scope), JSON.stringify(bundle.wishlist));
    localStorage.setItem(scopedStorageKey('orders', scope), JSON.stringify(bundle.orders));
    localStorage.setItem(scopedStorageKey('quotations', scope), JSON.stringify(bundle.quotations));
  } catch {
    // ignore
  }
}
