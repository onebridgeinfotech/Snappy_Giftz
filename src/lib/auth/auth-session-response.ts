import { NextResponse } from 'next/server';
import { User } from '@prisma/client';
import { createSession, getSessionCookieOptions } from './session';

export async function jsonWithNewSession(
  user: User,
  meta: { ipAddress?: string; userAgent?: string }
): Promise<NextResponse> {
  const { sessionToken, expiresAt } = await createSession(user.id, {
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });
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
}
