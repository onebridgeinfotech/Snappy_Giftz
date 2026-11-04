import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createSession, getSessionCookieOptions } from '@/lib/auth/session';
import { Role } from '@prisma/client';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // Rate Limiting Guard: Prevent mass account creation spam
    const rateLimit = await enforceRateLimit('AUTH_REGISTER', ipAddress);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registration requests. Please try again after one minute.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
        }
      );
    }

    const body = await req.json();
    const { name, email, password, phone } = body;

    // 1. Basic validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Please enter a valid name (at least 2 characters).' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Password complexity validation
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
    }

    // 3. Prevent privilege escalation
    // Security Rule: Public self-registration ALWAYS defaults to CUSTOMER.
    // Elevated roles (ADMIN, STAFF) and corporate privileges (B2B_CLIENT) can never be self-assigned.
    // Corporate client onboarding requires organization profile submission and staff verification.
    const assignedRole: Role = Role.CUSTOMER;

    // Security Rule: Protected Admin Account Reservation
    if (cleanEmail === 'phoenixnot13@gmail.com') {
      return NextResponse.json(
        { error: 'This administrative account is protected and cannot be registered via public customer signup.' },
        { status: 403 }
      );
    }

    // 4. Duplicate account check
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json({ error: 'An account with this email address already exists.' }, { status: 409 });
    }

    // 5. Hash password using bcrypt with salt
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        phone: phone ? String(phone).trim() : null,
        passwordHash,
        role: assignedRole,
        isEmailVerified: false,
      },
    });

    // 6. Create database session (storing SHA-256 hash) and set secure cookie
    const { sessionToken, expiresAt } = await createSession(user.id);
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
    }, { status: 201 });

    response.cookies.set(cookieOptions.name, sessionToken, cookieOptions);
    return response;
  } catch (error) {
    console.error('[API_AUTH_REGISTER] Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during registration. Please try again.' }, { status: 500 });
  }
}
