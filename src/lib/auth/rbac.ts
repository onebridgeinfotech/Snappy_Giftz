import { Role, User } from '@prisma/client';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, validateSessionToken } from './session';

export class AuthError extends Error {
  statusCode: number;
  code: 'UNAUTHORIZED' | 'FORBIDDEN';

  constructor(message: string, statusCode: number = 401, code: 'UNAUTHORIZED' | 'FORBIDDEN' = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Checks whether a given user role satisfies any of the required roles.
 * ADMIN and SUPER_ADMIN roles have implicit access to all operations.
 */
export function hasRole(userRole: Role | string, allowedRoles: (Role | string)[]): boolean {
  if (!userRole || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return false;
  }
  const normalized = typeof userRole === 'string' ? userRole.toUpperCase() : userRole;
  // ADMIN and SUPER_ADMIN roles have implicit access to all operations
  if (normalized === Role.ADMIN || normalized === 'SUPER_ADMIN' || normalized === 'ADMIN') {
    return true;
  }
  return allowedRoles.some((r) => {
    const normAllowed = typeof r === 'string' ? r.toUpperCase() : r;
    return normAllowed === normalized;
  });
}

/**
 * Helper to extract session token from incoming HTTP Request headers or Next.js cookies
 */
export async function getSessionTokenFromContext(req?: Request): Promise<string | null> {
  // 1. Try reading from Request Cookie header if passed
  if (req) {
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      if (match) {
        return decodeURIComponent(match.substring(SESSION_COOKIE_NAME.length + 1));
      }
    }
  }

  // 2. Fall back to Next.js App Router dynamic cookies()
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    return cookie ? cookie.value : null;
  } catch {
    return null;
  }
}

/**
 * Centralized server-side authentication guard.
 * Verifies that the caller has an active, valid session in the database.
 * Throws 401 AuthError if unauthenticated.
 */
export async function requireAuth(req?: Request): Promise<User> {
  const token = await getSessionTokenFromContext(req);
  if (!token) {
    throw new AuthError('Authentication required. Please log in to proceed.', 401, 'UNAUTHORIZED');
  }

  const sessionData = await validateSessionToken(token);
  if (!sessionData || !sessionData.user) {
    throw new AuthError('Your session is invalid or has expired. Please log in again.', 401, 'UNAUTHORIZED');
  }

  return sessionData.user;
}

/**
 * Centralized server-side role-based authorization guard.
 * Enforces that the authenticated user possesses one of the allowed roles.
 * Throws 401 if unauthenticated, 403 if authenticated but insufficient permission.
 */
export async function requireRole(allowedRoles: Role[], req?: Request): Promise<User> {
  const user = await requireAuth(req);

  if (!hasRole(user.role, allowedRoles)) {
    throw new AuthError(
      `Access denied. This resource requires one of the following roles: [${allowedRoles.join(', ')}].`,
      403,
      'FORBIDDEN'
    );
  }

  return user;
}

/**
 * Retrieves the currently authenticated user if present, or null if unauthenticated.
 * Does not throw an error for anonymous/guest sessions.
 */
export async function getOptionalUser(req?: Request): Promise<User | null> {
  const token = await getSessionTokenFromContext(req);
  if (!token) return null;

  const sessionData = await validateSessionToken(token);
  return sessionData?.user ?? null;
}

