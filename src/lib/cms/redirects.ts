import { prisma } from '@/lib/prisma';

/**
 * In-memory cache of admin-managed redirects, consulted by the proxy on every
 * page request. Refreshes at most every 60 seconds and fails open, so a DB
 * outage never blocks page traffic.
 */
type RedirectRule = { id: string; toPath: string; statusCode: number };

let cache: Map<string, RedirectRule> | null = null;
let loadedAt = 0;
let loading: Promise<void> | null = null;
const TTL_MS = 60_000;

export function normalizePath(path: string): string {
  let p = (path || '').trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    /* keep as-is */
  }
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p.toLowerCase();
}

async function load() {
  const rows = await prisma.redirect.findMany({
    where: { isActive: true },
    select: { id: true, fromPath: true, toPath: true, statusCode: true },
  });
  cache = new Map(rows.map((r) => [normalizePath(r.fromPath), { id: r.id, toPath: r.toPath, statusCode: r.statusCode }]));
  loadedAt = Date.now();
}

export function invalidateRedirectCache() {
  loadedAt = 0;
}

export async function findRedirect(pathname: string): Promise<RedirectRule | null> {
  if (!cache || Date.now() - loadedAt > TTL_MS) {
    if (!loading) {
      loading = load()
        .catch(() => {
          loadedAt = Date.now(); // back off for a full TTL after a failure
          if (!cache) cache = new Map();
        })
        .finally(() => {
          loading = null;
        });
    }
    await loading;
  }
  return cache?.get(normalizePath(pathname)) ?? null;
}

export function recordRedirectHit(id: string) {
  prisma.redirect
    .update({ where: { id }, data: { hitCount: { increment: 1 }, lastHitAt: new Date() } })
    .catch(() => undefined);
}

/**
 * Synchronous lookup for the proxy (which must stay synchronous). Serves from the
 * in-memory cache and refreshes it in the background; the very first request after a
 * cold start may therefore miss a redirect.
 */
export function peekRedirect(pathname: string): RedirectRule | null {
  if ((!cache || Date.now() - loadedAt > TTL_MS) && !loading) {
    loading = load()
      .catch(() => {
        loadedAt = Date.now();
        if (!cache) cache = new Map();
      })
      .finally(() => {
        loading = null;
      });
  }
  return cache?.get(normalizePath(pathname)) ?? null;
}
