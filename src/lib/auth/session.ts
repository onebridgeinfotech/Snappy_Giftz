import crypto from 'node:crypto';
import { prisma } from '../prisma';
import { User, Session } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'snappy_session_token';
export const SESSION_TTL_DAYS = 30;
export const SESSION_TRANSIENT_DAYS = 1;

export interface SessionWithUser {
  session: Session;
  user: User;
}

export function getSessionCookieOptions(expiresAt: Date, rememberMe: boolean = true) {
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const isProd = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
    maxAge: maxAgeSeconds,
  };
}

/**
 * Generates a high-entropy 256-bit cryptographically secure raw bearer token for client cookies
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes a SHA-256 cryptographic hash of a session token for secure database storage.
 * Storing hashes rather than raw tokens protects users if the database is ever read or dumped.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

import { isStorefrontFallbackAllowed } from '../catalog/public-catalog.service';

export const DEV_SESSIONS_STORE = new Map<string, SessionWithUser>();

/**
 * Persists a new user session in the PostgreSQL database using a cryptographic hash,
 * with graceful in-memory dev fallback when running in offline test/dev environments.
 * In production (NODE_ENV === 'production'), strictly fails closed if database write fails.
 */
export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string; role?: any; email?: string; rememberMe?: boolean }
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const rawSessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawSessionToken);
  const ttlDays = meta?.rememberMe === false ? SESSION_TRANSIENT_DAYS : SESSION_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  try {
    await prisma.session.create({
      data: {
        sessionToken: tokenHash, // Store only the hash in DB
        userId,
        expiresAt,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });
    return { sessionToken: rawSessionToken, expiresAt };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed()) {
      DEV_SESSIONS_STORE.set(rawSessionToken, {
        session: {
          id: `sess-${Date.now()}`,
          sessionToken: tokenHash,
          userId,
          expiresAt,
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
          createdAt: new Date(),
        },
        user: {
          id: userId,
          email: meta?.email || `${userId}@example.com`,
          passwordHash: 'dev-hash',
          name: 'Test Customer',
          phone: '9876543210',
          role: meta?.role || 'CUSTOMER',
          isEmailVerified: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return { sessionToken: rawSessionToken, expiresAt };
    }
    // In production, strictly fail closed
    throw err;
  }
}

/**
 * Validates a session token from request cookies by hashing it and looking up the database record
 */
export async function validateSessionToken(rawToken: string): Promise<SessionWithUser | null> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
    return null;
  }

  try {
    const tokenHash = hashSessionToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { sessionToken: tokenHash },
      include: { user: true },
    });

    if (!session || !session.user) {
      if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed() && DEV_SESSIONS_STORE.has(rawToken)) {
        const dev = DEV_SESSIONS_STORE.get(rawToken)!;
        if (Date.now() <= dev.session.expiresAt.getTime() && dev.user.isActive) {
          return dev;
        }
      }
      return null;
    }

    // Check expiry
    if (Date.now() > session.expiresAt.getTime()) {
      // Invalidate expired session asynchronously
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Check if user is active
    if (!session.user.isActive) {
      return null;
    }

    return { session, user: session.user };
  } catch {
    if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed() && DEV_SESSIONS_STORE.has(rawToken)) {
      const dev = DEV_SESSIONS_STORE.get(rawToken)!;
      if (Date.now() <= dev.session.expiresAt.getTime() && dev.user.isActive) {
        return dev;
      }
    }
    return null;
  }
}

/**
 * Revokes a session upon user logout
 */
export async function invalidateSession(rawToken: string): Promise<void> {
  if (!rawToken) return;

  // Invalidate in memory dev store
  DEV_SESSIONS_STORE.delete(rawToken);

  try {
    const tokenHash = hashSessionToken(rawToken);
    await prisma.session.deleteMany({
      where: { sessionToken: tokenHash },
    });
  } catch (error) {
    console.error('[AUTH_SESSION] Error invalidating session:', error);
  }
}

/**
 * Revokes all sessions for a specific user (e.g. password change / security breach)
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  // Invalidate matching entries in memory dev store
  for (const [token, sessionData] of DEV_SESSIONS_STORE.entries()) {
    if (sessionData.user.id === userId || sessionData.session.userId === userId) {
      DEV_SESSIONS_STORE.delete(token);
    }
  }

  try {
    await prisma.session.deleteMany({
      where: { userId },
    });
  } catch (error) {
    console.error('[AUTH_SESSION] Error invalidating all user sessions:', error);
  }
}
