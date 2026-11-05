import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, getSessionCookieOptions } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';

// Pre-computed dummy bcrypt hash with 10 salt rounds to equalize execution timing
// This completely neutralizes user enumeration attacks via side-channel timing analysis.
const DUMMY_BCRYPT_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Please enter both email and password.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // Rate Limiting Guard: Prevent credential stuffing & password brute-forcing
    const rateLimit = await enforceRateLimit('AUTH_LOGIN', `${ipAddress}:${cleanEmail}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again after one minute.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
        }
      );
    }

    // 1. Look up user by email
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || !user.passwordHash) {
      // Execute dummy password verification to ensure constant time execution
      await verifyPassword(password, DUMMY_BCRYPT_HASH);
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // 2. Verify password hash
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // 3. Check account active status
    if (!user.isActive) {
      return NextResponse.json({ error: 'This account has been deactivated. Please contact support.' }, { status: 403 });
    }

    // 4. Capture request metadata
    const userAgent = req.headers.get('user-agent') || undefined;

    // 5. Create database session (storing SHA-256 hash) and set HTTP-only cookie
    const { sessionToken, expiresAt } = await createSession(user.id, { userAgent, ipAddress });
    const cookieOptions = getSessionCookieOptions(expiresAt);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });

    response.cookies.set(cookieOptions.name, sessionToken, cookieOptions);
    return response;
  } catch (error: any) {
    console.error('[API_AUTH_LOGIN] Error:', error);
    if (
      error?.code === 'P1001' ||
      error?.name === 'PrismaClientInitializationError' ||
      /reach database|connection|ECONNREFUSED|ETIMEDOUT|PrismaClientInitializationError/i.test(error?.message || '')
    ) {
      return NextResponse.json(
        {
          error: 'Authentication database is temporarily unreachable. Please try again in a few moments or contact support.',
          code: 'DATABASE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'An unexpected error occurred during login. Please try again.' }, { status: 500 });
  }
}
