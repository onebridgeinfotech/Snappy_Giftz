// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy, SESSION_COOKIE_NAME } from '../proxy';
import { getSafeRedirectUrl } from '../lib/auth/redirect';
import { createSession } from '../lib/auth/session';
import { Role } from '@prisma/client';

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  ✘ [FAIL] ${name}`);
    console.error('    Error:', err.message);
    throw err;
  }
}

function createRequest(url: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}): NextRequest {
  const reqHeaders = new Headers(headers);
  const cookieString = Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
  if (cookieString) {
    reqHeaders.set('cookie', cookieString);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    headers: reqHeaders,
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' Snappy Gifts — Global Login-First Storefront Test Suite        ');
  console.log('================================================================\n');

  console.log('--- 1. Safe Redirection & Open-Redirect Prevention ---');

  test('Sanitizes open-redirect attempts with full URLs (https://evil.com)', () => {
    assert.equal(getSafeRedirectUrl('https://evil.com'), '/');
    assert.equal(getSafeRedirectUrl('http://attacker.com/steal'), '/');
  });

  test('Sanitizes protocol-relative open-redirect attempts (//evil.com)', () => {
    assert.equal(getSafeRedirectUrl('//evil.com'), '/');
    assert.equal(getSafeRedirectUrl('//evil.com/path'), '/');
  });

  test('Sanitizes backslash-based evasion attempts (/\\evil.com or \\\\evil.com)', () => {
    assert.equal(getSafeRedirectUrl('/\\evil.com'), '/');
    assert.equal(getSafeRedirectUrl('\\\\evil.com'), '/');
    assert.equal(getSafeRedirectUrl('\\evil.com'), '/');
  });

  test('Sanitizes JavaScript scheme injection (javascript:alert(1))', () => {
    assert.equal(getSafeRedirectUrl('javascript:alert(1)'), '/');
    assert.equal(getSafeRedirectUrl('/javascript:alert(1)'), '/');
  });

  test('Prevents authentication loops by rejecting redirect back to /login or /register', () => {
    assert.equal(getSafeRedirectUrl('/login'), '/');
    assert.equal(getSafeRedirectUrl('/login?foo=bar'), '/');
    assert.equal(getSafeRedirectUrl('/register'), '/');
    assert.equal(getSafeRedirectUrl('/reset-password'), '/');
  });

  test('Preserves safe internal relative application paths', () => {
    assert.equal(getSafeRedirectUrl('/products/personalized-frame'), '/products/personalized-frame');
    assert.equal(getSafeRedirectUrl('/shop?category=birthday'), '/shop?category=birthday');
    assert.equal(getSafeRedirectUrl('/account/orders'), '/account/orders');
    assert.equal(getSafeRedirectUrl('/cart'), '/cart');
    assert.equal(getSafeRedirectUrl('/checkout'), '/checkout');
  });

  console.log('\n--- 2. Unauthenticated Storefront Interception (Login-First) ---');

  test('Unauthenticated visit to homepage (/) redirects to /login', () => {
    const req = createRequest('http://localhost:3000/');
    const res = proxy(req);
    assert.ok(res.status === 307 || res.status === 302 || res.headers.get('location'));
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.pathname, '/login');
    assert.equal(location.searchParams.get('redirect'), null, 'Root / does not need redundant ?redirect=/');
  });

  test('Unauthenticated visit to /shop redirects to /login?redirect=/shop', () => {
    const req = createRequest('http://localhost:3000/shop');
    const res = proxy(req);
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.pathname, '/login');
    assert.equal(location.searchParams.get('redirect'), '/shop');
  });

  test('Unauthenticated visit to deep product (/products/crystal-rose) preserves destination', () => {
    const req = createRequest('http://localhost:3000/products/crystal-rose');
    const res = proxy(req);
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.pathname, '/login');
    assert.equal(location.searchParams.get('redirect'), '/products/crystal-rose');
  });

  test('Unauthenticated visit to /account/orders redirects to /login?redirect=/account/orders', () => {
    const req = createRequest('http://localhost:3000/account/orders');
    const res = proxy(req);
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.pathname, '/login');
    assert.equal(location.searchParams.get('redirect'), '/account/orders');
  });

  test('Unauthenticated visit to /cart redirects to /login?redirect=/cart', () => {
    const req = createRequest('http://localhost:3000/cart');
    const res = proxy(req);
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.pathname, '/login');
    assert.equal(location.searchParams.get('redirect'), '/cart');
  });

  test('Unauthenticated visit to /checkout redirects to /login?redirect=/checkout', () => {
    const req = createRequest('http://localhost:3000/checkout');
    const res = proxy(req);
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.pathname, '/login');
    assert.equal(location.searchParams.get('redirect'), '/checkout');
  });

  test('Unauthenticated visit to company pages (/about, /contact) redirects to /login', () => {
    const reqAbout = createRequest('http://localhost:3000/about');
    const resAbout = proxy(reqAbout);
    assert.equal(new URL(resAbout.headers.get('location')!).pathname, '/login');

    const reqContact = createRequest('http://localhost:3000/contact');
    const resContact = proxy(reqContact);
    assert.equal(new URL(resContact.headers.get('location')!).pathname, '/login');
  });

  console.log('\n--- 3. Public Route Exceptions & Operational Passthroughs ---');

  test('Public auth page /login is directly accessible without session', () => {
    const req = createRequest('http://localhost:3000/login');
    const res = proxy(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  test('Public auth page /register is directly accessible without session', () => {
    const req = createRequest('http://localhost:3000/register');
    const res = proxy(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  test('Public recovery page /reset-password is directly accessible without session', () => {
    const req = createRequest('http://localhost:3000/reset-password');
    const res = proxy(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  test('Admin portal /admin is exempt from customer login redirect (handles own auth)', () => {
    const req = createRequest('http://localhost:3000/admin');
    const res = proxy(req);
    assert.equal(res.status, 200, 'Admin route must pass to admin handler without redirecting to customer /login');
    assert.equal(res.headers.get('location'), null);
  });

  test('Public API route /api/auth/login is directly accessible', () => {
    const req = createRequest('http://localhost:3000/api/auth/login');
    const res = proxy(req);
    assert.equal(res.status, 200);
  });

  test('Public API route /api/auth/google is directly accessible', () => {
    const req = createRequest('http://localhost:3000/api/auth/google');
    const res = proxy(req);
    assert.equal(res.status, 200);
  });

  console.log('\n--- 4. Protected Customer API Endpoints ---');

  test('Unauthenticated request to customer API (/api/orders) returns HTTP 401 UNAUTHORIZED', async () => {
    const req = createRequest('http://localhost:3000/api/orders');
    const res = proxy(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'UNAUTHORIZED');
  });

  test('Unauthenticated request to customer API (/api/cart) returns HTTP 401 UNAUTHORIZED', async () => {
    const req = createRequest('http://localhost:3000/api/cart');
    const res = proxy(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'UNAUTHORIZED');
  });

  console.log('\n--- 5. Authenticated Customer Experience & Cache Invalidation ---');

  const { sessionToken: activeCustomerToken } = await createSession('customer-loginfirst-test', {
    role: Role.CUSTOMER,
    email: 'customer-test@snappygiftz.com',
  });

  test('Authenticated customer can access homepage (/) directly', () => {
    const req = createRequest('http://localhost:3000/', {
      [SESSION_COOKIE_NAME]: activeCustomerToken,
    });
    const res = proxy(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  test('Authenticated customer can access deep product (/products/crystal-rose)', () => {
    const req = createRequest('http://localhost:3000/products/crystal-rose', {
      [SESSION_COOKIE_NAME]: activeCustomerToken,
    });
    const res = proxy(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  test('Authenticated response attaches Cache-Control: no-store to prevent Back-button cached viewing', () => {
    const req = createRequest('http://localhost:3000/products/crystal-rose', {
      [SESSION_COOKIE_NAME]: activeCustomerToken,
    });
    const res = proxy(req);
    const cacheControl = res.headers.get('cache-control');
    assert.ok(cacheControl && cacheControl.includes('no-store'), 'Must include no-store header');
    assert.ok(cacheControl && cacheControl.includes('no-cache'), 'Must include no-cache header');
  });

  test('Authenticated customer visiting /login is redirected back to storefront', () => {
    const req = createRequest('http://localhost:3000/login', {
      [SESSION_COOKIE_NAME]: activeCustomerToken,
    });
    const res = proxy(req);
    assert.ok(res.headers.get('location'));
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.pathname, '/');
  });

  test('Authenticated customer visiting /login with ?redirect preserves safe target', () => {
    const req = createRequest('http://localhost:3000/login?redirect=%2Fproducts%2Fdocking-station', {
      [SESSION_COOKIE_NAME]: activeCustomerToken,
    });
    const res = proxy(req);
    const location = new URL(res.headers.get('location')!);
    assert.equal(location.pathname, '/products/docking-station');
  });

  console.log('\n================================================================');
  console.log('  Login-First Storefront Suite: ALL TESTS COMPLETED             ');
  console.log('================================================================');
}

runTestSuite().catch((e) => {
  console.error('Fatal Test Suite Error:', e);
  process.exit(1);
});
