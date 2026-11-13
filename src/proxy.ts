import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSafeRedirectUrl } from './lib/auth/redirect';
import { peekRedirect, recordRedirectHit } from './lib/cms/redirects';

export const SESSION_COOKIE_NAME = 'snappy_session_token';

/**
 * Public Route Whitelist
 * Routes that do not require customer authentication.
 */
const PUBLIC_PAGE_PREFIXES = [
  '/',
  '/catalog',
  '/products',
  '/blog',
  '/services',
  '/rss.xml',
  '/shop',
  '/cart',
  '/checkout',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/shipping-policy',
  '/login',
  '/register',
  '/reset-password',
  '/forgot-password',
  '/admin', // Admin portal handles its own authentication and RBAC independently
  '/delivery', // Delivery-person OTP confirmation links (signed, single order, auto-expire)
];

const PUBLIC_API_PREFIXES = [
  '/api/auth', // Authentication endpoints (login, register, google, otp, etc.)
  '/api/admin', // Admin API routes are protected by role-based requireRole([ADMIN, STAFF])
  '/api/integrations', // Integration routes are protected by requireRole([ADMIN])
  '/api/webhooks', // Signed webhooks (e.g. Razorpay HMAC)
  '/api/health', // Health and readiness probes
  '/api/shipping', // Pincode & distance serviceability lookups
  '/api/delivery', // Delivery calculation and rates
  '/api/catalog', // Public products, categories, occasions
  '/api/blog', // Blog view tracking + comment submission (rate limited)
  '/api/newsletter', // Newsletter signup
  '/api/cms/enquiry', // Landing-page enquiry form (rate limited)
  '/api/cms/cron', // Scheduled publish hook (bearer secret)
  '/api/orders/lookup', // Order tracking concierge
  '/api/checkout', // Quote calculation & checkout flow
  '/api/payments', // Razorpay order generation & verification
  '/api/personalization', // Customization configuration & uploads
];

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Next.js 16 Global Proxy (Middleware)
 *
 * Enforces a Global Login-First Customer Experience:
 * - Unauthenticated visitors accessing the storefront (/, /products, /catalog, /cart, /checkout, etc.)
 *   are automatically redirected to /login with their target preserved in the ?redirect parameter.
 * - Unauthenticated requests to customer APIs return HTTP 401 UNAUTHORIZED.
 * - Authenticated requests are allowed through with cache-invalidation headers
 *   so browser Back navigation after logout cannot expose protected customer content.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 0. Admin-managed 301/302 redirects (Content > Redirects). Fails open on any error.
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/admin') && !pathname.startsWith('/_next')) {
    try {
      const rule = peekRedirect(pathname);
      if (rule) {
        recordRedirectHit(rule.id);
        const isAbsolute = rule.toPath.startsWith('http://') || rule.toPath.startsWith('https://');
        const target = isAbsolute ? new URL(rule.toPath) : new URL(rule.toPath, request.url);
        if (!isAbsolute && search && !rule.toPath.includes('?')) target.search = search;
        return NextResponse.redirect(target, rule.statusCode);
      }
    } catch {
      /* fail open */
    }
  }

  // 1. Check for active session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(sessionCookie && sessionCookie.trim().length >= 32);

  // 2. Handle public page routes (/login, /register, etc.)
  if (isPublicPage(pathname)) {
    // If an authenticated customer directly visits /login or /register, redirect to storefront
    if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      const safeDestination = getSafeRedirectUrl(redirectParam, '/');
      return NextResponse.redirect(new URL(safeDestination, request.url));
    }
    return NextResponse.next();
  }

  // 3. Handle public API routes (/api/auth, /api/webhooks, /api/admin, etc.)
  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  // 4. If customer is unauthenticated, guard protected resources
  if (!isAuthenticated) {
    // For API requests, return JSON 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Authentication required. Please log in to proceed.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // For page requests, redirect to /login
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      const originalPath = pathname + search;
      loginUrl.searchParams.set('redirect', originalPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 5. Customer is authenticated: allow through and set no-cache headers to prevent bfcache retention
  const response = NextResponse.next();
  if (!pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml
     * - static asset extensions
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|rss\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot|mp4|webm)).*)',
  ],
};
