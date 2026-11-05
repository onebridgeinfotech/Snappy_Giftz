/**
 * Snappy Gifts — Provider-Independent Distributed Rate Limiting Subsystem
 *
 * ARCHITECTURE & COMPLIANCE:
 * - Provider-independent abstraction supporting:
 *   1. Distributed Upstash Redis (HTTP REST API: atomic pipeline INCR + EXPIRE)
 *   2. Distributed standard Redis (via REST gateway or URL)
 *   3. Isolated in-memory development adapter for offline local dev and unit/integration testing
 * - Production Guard (Fail Closed):
 *   - NEVER silently falls back to in-memory adapter in production (NODE_ENV === 'production').
 *   - In production without configured Redis, sensitive abuse-prevention operations (e.g. login, OTP, payments)
 *     fail closed to prevent brute-force attacks across serverless lambdas.
 * - Atomic window tracking prevents race conditions across multi-instance deployments.
 */

export class RateLimiterError extends Error {
  constructor(message: string, public code: string = 'RATE_LIMITER_ERROR') {
    super(message);
    this.name = 'RateLimiterError';
  }
}

export class RateLimiterMisconfiguredError extends RateLimiterError {
  constructor(message: string) {
    super(message, 'RATE_LIMITER_MISCONFIGURED');
    this.name = 'RateLimiterMisconfiguredError';
  }
}

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  failClosedInProduction?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
  backend: 'upstash-redis' | 'redis' | 'memory';
}

export interface RateLimitAdapter {
  increment(key: string, windowSeconds: number): Promise<{ count: number; ttlRemainingSeconds: number }>;
  reset?(key?: string): Promise<void>;
}

// ============================================================================
// PRESET PER-OPERATION LIMITS
// ============================================================================

export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  // Authentication & Credentials
  AUTH_LOGIN: { limit: 5, windowSeconds: 60, failClosedInProduction: true },
  // Per IP+email after input validation — allows legitimate retries without sharing one global bucket
  AUTH_REGISTER: { limit: 10, windowSeconds: 600, failClosedInProduction: false },
  AUTH_OTP_SEND: { limit: 3, windowSeconds: 60, failClosedInProduction: true },
  AUTH_OTP_VERIFY: { limit: 5, windowSeconds: 60, failClosedInProduction: true },

  // Guest Order Lookup & Public Inquiries
  GUEST_LOOKUP: { limit: 10, windowSeconds: 60, failClosedInProduction: false },

  // Personalization Proof & File Access
  PROOF_DOWNLOAD: { limit: 30, windowSeconds: 60, failClosedInProduction: false },
  PROOF_APPROVAL: { limit: 10, windowSeconds: 60, failClosedInProduction: true },

  // Checkout & Payments
  PAYMENT_CREATE: { limit: 10, windowSeconds: 60, failClosedInProduction: true },
  PAYMENT_VERIFY: { limit: 10, windowSeconds: 60, failClosedInProduction: true },

  // Corporate Portal & B2B
  CORPORATE_RFQ: { limit: 5, windowSeconds: 60, failClosedInProduction: false },
  CORPORATE_CSV: { limit: 5, windowSeconds: 60, failClosedInProduction: false },

  // Admin Operations
  ADMIN_ACTION: { limit: 30, windowSeconds: 60, failClosedInProduction: true },
};

// ============================================================================
// IN-MEMORY DEVELOPMENT & TEST ADAPTER
// ============================================================================

interface MemoryBucketRecord {
  count: number;
  resetAt: number;
}

export class MemoryRateLimitAdapter implements RateLimitAdapter {
  private store: Map<string, MemoryBucketRecord> = new Map();

  async increment(key: string, windowSeconds: number): Promise<{ count: number; ttlRemainingSeconds: number }> {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now >= record.resetAt) {
      const resetAt = now + windowSeconds * 1000;
      this.store.set(key, { count: 1, resetAt });
      return { count: 1, ttlRemainingSeconds: windowSeconds };
    }

    record.count += 1;
    const ttlRemainingSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { count: record.count, ttlRemainingSeconds };
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  getStoreSize(): number {
    return this.store.size;
  }
}

// ============================================================================
// UPSTASH / REST REDIS DISTRIBUTED ADAPTER
// ============================================================================

export class UpstashRedisRateLimitAdapter implements RateLimitAdapter {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }

  async increment(key: string, windowSeconds: number): Promise<{ count: number; ttlRemainingSeconds: number }> {
    // Atomic multi-command pipeline:
    // 1. INCR key
    // 2. EXPIRE key windowSeconds 'NX' (set expiry only if key has no expiry)
    // 3. TTL key
    const pipelineUrl = `${this.url}/pipeline`;
    const commands = [
      ['INCR', `ratelimit:${key}`],
      ['EXPIRE', `ratelimit:${key}`, String(windowSeconds), 'NX'],
      ['TTL', `ratelimit:${key}`],
    ];

    const response = await fetch(pipelineUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new RateLimiterError(`Upstash Redis HTTP error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (!Array.isArray(json) || json.length < 3) {
      throw new RateLimiterError('Unexpected response format from Upstash Redis pipeline.');
    }

    const count = Number(json[0]?.result || 1);
    let ttlRemaining = Number(json[2]?.result || windowSeconds);
    if (ttlRemaining < 0) ttlRemaining = windowSeconds;

    return { count, ttlRemainingSeconds: ttlRemaining };
  }
}

// Global dev instance
export const DEV_RATE_LIMITER_STORE = new MemoryRateLimitAdapter();

// Helper to reset store in tests
export function resetRateLimitDevStore(): void {
  DEV_RATE_LIMITER_STORE.reset();
}

/**
 * Resolves active adapter based on environment configuration.
 * Strictly prevents silent in-memory fallback in production.
 */
export function getRateLimitAdapter(): { adapter: RateLimitAdapter; backend: 'upstash-redis' | 'redis' | 'memory' } {
  const isProd = process.env.NODE_ENV === 'production';
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const backendPref = (process.env.RATE_LIMIT_BACKEND || '').trim().toLowerCase();

  if (upstashUrl && upstashToken) {
    return {
      adapter: new UpstashRedisRateLimitAdapter(upstashUrl, upstashToken),
      backend: 'upstash-redis',
    };
  }

  // Single-node hosting (e.g. Hostinger) may use in-memory limits when Redis is not provisioned
  if (backendPref === 'memory') {
    return {
      adapter: DEV_RATE_LIMITER_STORE,
      backend: 'memory',
    };
  }

  // Explicit development or test environment
  if (!isProd) {
    return {
      adapter: DEV_RATE_LIMITER_STORE,
      backend: 'memory',
    };
  }

  // Production without distributed configuration:
  // Must NOT silently use memory adapter in production.
  // We return a failing/guarding proxy that enforces failClosed semantics.
  return {
    backend: 'redis',
    adapter: {
      async increment(key: string, _windowSeconds: number) {
        throw new RateLimiterMisconfiguredError(
          'Production rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enforce multi-instance protection. In-memory rate limiting is forbidden in production.'
        );
      },
    },
  };
}

/**
 * Authoritative distributed rate limit enforcement function.
 *
 * @param operationKey Preset key from RATE_LIMIT_PRESETS or custom operation name
 * @param identifier Client IP, user ID, email, or guest token identifying the subject
 * @param customConfig Optional override for limit / window
 */
export async function enforceRateLimit(
  operationKey: keyof typeof RATE_LIMIT_PRESETS | string,
  identifier: string,
  customConfig?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const preset = RATE_LIMIT_PRESETS[operationKey] || {
    limit: 10,
    windowSeconds: 60,
    failClosedInProduction: false,
  };

  const limit = customConfig?.limit ?? preset.limit;
  const windowSeconds = customConfig?.windowSeconds ?? preset.windowSeconds;
  const failClosed = customConfig?.failClosedInProduction ?? preset.failClosedInProduction ?? false;

  const cleanId = (identifier || 'unknown').trim().toLowerCase();
  const bucketKey = `${operationKey}:${cleanId}`;

  const { adapter, backend } = getRateLimitAdapter();

  try {
    const { count, ttlRemainingSeconds } = await adapter.increment(bucketKey, windowSeconds);
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const now = Date.now();
    const resetAt = now + ttlRemainingSeconds * 1000;

    return {
      allowed,
      currentCount: count,
      limit,
      remaining,
      resetAt,
      retryAfterSeconds: allowed ? undefined : ttlRemainingSeconds,
      backend,
    };
  } catch (err: any) {
    // Handling when configured limiter is unavailable or misconfigured
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd && failClosed) {
      console.error(`[RATE_LIMITER:FAIL_CLOSED] Blocking request for "${bucketKey}":`, err.message);
      return {
        allowed: false,
        currentCount: limit + 1,
        limit,
        remaining: 0,
        resetAt: Date.now() + windowSeconds * 1000,
        retryAfterSeconds: windowSeconds,
        backend,
      };
    }

    if (!isProd) {
      // In dev/test fallback to memory adapter if remote call failed
      const { count, ttlRemainingSeconds } = await DEV_RATE_LIMITER_STORE.increment(bucketKey, windowSeconds);
      const allowed = count <= limit;
      return {
        allowed,
        currentCount: count,
        limit,
        remaining: Math.max(0, limit - count),
        resetAt: Date.now() + ttlRemainingSeconds * 1000,
        retryAfterSeconds: allowed ? undefined : ttlRemainingSeconds,
        backend: 'memory',
      };
    }

    // Production non-critical fail-open with alert
    console.warn(`[RATE_LIMITER:FAIL_OPEN] Distributed rate limiter unavailable for non-critical "${bucketKey}":`, err.message);
    return {
      allowed: true,
      currentCount: 1,
      limit,
      remaining: limit - 1,
      resetAt: Date.now() + windowSeconds * 1000,
      backend,
    };
  }
}
