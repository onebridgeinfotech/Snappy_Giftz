import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  scopeKeyForUser,
  emptyClientStoreBundle,
  migrateLegacyGlobalClientStore,
  readClientStoreBundle,
  writeClientStoreBundle,
  LEGACY_CLIENT_STORE_MIGRATED_KEY,
} from '../lib/storefront/client-store-persistence';

describe('client-store-persistence', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    const ls = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    };
    (globalThis as any).localStorage = ls;
    (globalThis as any).window = globalThis;
  });

  it('scopeKeyForUser separates guest and authenticated users', () => {
    assert.equal(scopeKeyForUser(null), 'guest');
    assert.equal(scopeKeyForUser(undefined), 'guest');
    assert.equal(scopeKeyForUser('  '), 'guest');
    assert.equal(scopeKeyForUser('usr-abc'), 'user:usr-abc');
  });

  it('migrateLegacyGlobalClientStore moves shared wishlist to guest only', () => {
    storage.set('snappy_giftz_wishlist_v1', JSON.stringify(['prod-1', 'prod-2']));
    migrateLegacyGlobalClientStore();
    assert.equal(storage.get(LEGACY_CLIENT_STORE_MIGRATED_KEY), '1');
    assert.equal(storage.get('snappy_giftz_wishlist_v1'), undefined);
    const guest = readClientStoreBundle('guest');
    assert.deepEqual(guest.wishlist, ['prod-1', 'prod-2']);
    const user = readClientStoreBundle('user:new-user-1');
    assert.deepEqual(user.wishlist, []);
  });

  it('write and read per-user bundles independently', () => {
    writeClientStoreBundle('user:a', { ...emptyClientStoreBundle(), wishlist: ['p1'] });
    writeClientStoreBundle('user:b', { ...emptyClientStoreBundle(), wishlist: ['p2'] });
    assert.deepEqual(readClientStoreBundle('user:a').wishlist, ['p1']);
    assert.deepEqual(readClientStoreBundle('user:b').wishlist, ['p2']);
  });
});
