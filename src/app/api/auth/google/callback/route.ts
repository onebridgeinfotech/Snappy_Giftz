import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { createSession, getSessionCookieOptions, DEV_SESSIONS_STORE } from '@/lib/auth/session';
import { isStorefrontFallbackAllowed } from '@/lib/catalog/public-catalog.service';
import { enqueueTransactionalEmail } from '@/lib/email/email-outbox.service';
import { renderCustomerRegistrationTemplate } from '@/lib/email/email-templates';
import { getSellerConfig } from '@/lib/invoices/seller-config.service';
import { getSafeRedirectUrl } from '@/lib/auth/redirect';

/**
 * Customer Google OAuth Callback Handler
 *
 * 1. Validates CSRF state parameter against cookie and HMAC signature.
 * 2. Exchanges authorization code for Google access token.
 * 3. Retrieves verified user profile from Google.
 * 4. Resolves or provisions customer User account (Role: CUSTOMER).
 * 5. Issues authenticated session and sets HTTP-only session cookie.
 * 6. Redirects customer to /account dashboard.
 */
export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const { searchParams } = reqUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  let appUrl: string;
  if (reqUrl.hostname === 'localhost' || reqUrl.hostname === '127.0.0.1') {
    const port = reqUrl.port ? `:${reqUrl.port}` : '';
    appUrl = `http://localhost${port}`;
  } else if (process.env.APP_URL) {
    appUrl = process.env.APP_URL.replace(/\/$/, '');
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    appUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  } else {
    appUrl = 'https://snappygiftz.com';
  }

  if (error || !code) {
    const errorUrl = new URL('/login', appUrl);
    errorUrl.searchParams.set('oauth_error', error || 'missing_auth_code');
    return NextResponse.redirect(errorUrl.toString());
  }

  // 1. Verify CSRF State
  const cookieHeader = req.headers.get('cookie') || '';
  const storedStateMatch = cookieHeader.match(/snappy_customer_oauth_state=([^;]+)/);
  const storedState = storedStateMatch ? decodeURIComponent(storedStateMatch[1].trim()) : null;

  if (!state || !storedState || state !== storedState) {
    const errorUrl = new URL('/login', appUrl);
    errorUrl.searchParams.set('oauth_error', 'invalid_csrf_state');
    return NextResponse.redirect(errorUrl.toString());
  }

  let redirectTarget = '/';

  // Validate state expiration and HMAC signature
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    const { nonce, timestamp, signature, redirect } = decoded;
    const now = Date.now();
    if (!nonce || !timestamp || now - timestamp > 15 * 60 * 1000) {
      const errorUrl = new URL('/login', appUrl);
      errorUrl.searchParams.set('oauth_error', 'expired_oauth_state');
      return NextResponse.redirect(errorUrl.toString());
    }

    redirectTarget = getSafeRedirectUrl(redirect, '/');

    const secretKey = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'snappy-oauth-secret-fallback';
    const expectedSigWithRedirect = crypto
      .createHmac('sha256', secretKey)
      .update(`${nonce}:${timestamp}:${redirectTarget}`)
      .digest('hex');
    const expectedSigLegacy = crypto
      .createHmac('sha256', secretKey)
      .update(`${nonce}:${timestamp}`)
      .digest('hex');

    if (signature !== expectedSigWithRedirect && signature !== expectedSigLegacy) {
      const errorUrl = new URL('/login', appUrl);
      errorUrl.searchParams.set('oauth_error', 'tampered_oauth_state');
      return NextResponse.redirect(errorUrl.toString());
    }
  } catch {
    const errorUrl = new URL('/login', appUrl);
    errorUrl.searchParams.set('oauth_error', 'corrupt_oauth_state');
    return NextResponse.redirect(errorUrl.toString());
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const errorUrl = new URL('/login', appUrl);
    errorUrl.searchParams.set('oauth_error', 'google_pending_credentials');
    return NextResponse.redirect(errorUrl.toString());
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(clientId.trim(), clientSecret.trim(), redirectUri);

    // 2. Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 3. Retrieve verified user profile from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const email = userInfo.data.email ? userInfo.data.email.trim().toLowerCase() : null;
    const name = userInfo.data.name?.trim() || email?.split('@')[0] || 'Customer';

    if (!email) {
      const errorUrl = new URL('/login', appUrl);
      errorUrl.searchParams.set('oauth_error', 'no_email_provided');
      return NextResponse.redirect(errorUrl.toString());
    }

    let userId: string;
    let userRole: Role = Role.CUSTOMER;
    let isNewUser = false;

    try {
      // 4. Look up existing user
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        if (!user.isActive) {
          const errorUrl = new URL('/login', appUrl);
          errorUrl.searchParams.set('oauth_error', 'account_deactivated');
          return NextResponse.redirect(errorUrl.toString());
        }
        userId = user.id;
        userRole = user.role;

        // Ensure email is marked verified
        if (!user.isEmailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isEmailVerified: true },
          });
        }
      } else {
        // Provision new Customer account
        isNewUser = true;
        const createdUser = await prisma.user.create({
          data: {
            email,
            name,
            role: Role.CUSTOMER,
            isEmailVerified: true,
            isActive: true,
          },
        });
        userId = createdUser.id;
        userRole = createdUser.role;

        // Enqueue welcome transactional email
        try {
          const seller = await getSellerConfig();
          const emailContent = renderCustomerRegistrationTemplate(seller, {
            customerName: name,
            customerEmail: email,
          });
          await enqueueTransactionalEmail({
            idempotencyKey: `email:welcome:google:${userId}`,
            eventType: 'CUSTOMER_REGISTRATION',
            recipientEmail: email,
            recipientName: name,
            subject: emailContent.subject,
            htmlBody: emailContent.html,
            textBody: emailContent.text,
          });
        } catch (emailErr) {
          console.warn('[GOOGLE_AUTH_CALLBACK] Welcome email enqueue soft-failed:', emailErr);
        }
      }
    } catch (dbErr) {
      // Development fallback if database is offline
      if (process.env.NODE_ENV !== 'production' && isStorefrontFallbackAllowed()) {
        userId = `google-dev-${Date.now()}`;
      } else {
        throw dbErr;
      }
    }

    // 5. Create authenticated session
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;

    const { sessionToken, expiresAt } = await createSession(userId, {
      role: userRole,
      email,
      userAgent,
      ipAddress,
      rememberMe: true,
    });

    const cookieOptions = getSessionCookieOptions(expiresAt, true, req);

    // 6. Redirect to requested storefront destination or root
    const targetUrl = new URL(redirectTarget, appUrl);
    if (isNewUser) {
      targetUrl.searchParams.set('welcome', 'google');
    }

    const response = NextResponse.redirect(targetUrl.toString());

    // Set session cookie
    response.cookies.set(cookieOptions.name, sessionToken, cookieOptions);

    // Clear state cookie
    response.cookies.delete('snappy_customer_oauth_state');

    return response;
  } catch (err: any) {
    console.error('[GOOGLE_AUTH_CALLBACK_ERROR]', err?.message || err);
    const errorUrl = new URL('/login', appUrl);
    errorUrl.searchParams.set('oauth_error', 'exchange_failed');
    return NextResponse.redirect(errorUrl.toString());
  }
}
