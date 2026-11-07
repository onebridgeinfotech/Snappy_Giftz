// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { GET as getGoogleOAuth } from '../app/api/auth/google/route';

async function runLoginPageTests() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Customer Login Page Test Suite     ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✘ [FAIL] ${name}`);
      console.error(`     Reason: ${err.message}\n`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // 1. Input Validation Invariants
  // ------------------------------------------------------------------
  console.log('--- 1. Client & Server Input Validation Invariants ---');

  await test('Reject malformed email addresses', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = ['', 'plainaddress', '#@%^%#$@#$@#.com', '@example.com', 'email.example.com', 'email@example@example.com'];
    for (const email of invalidEmails) {
      assert.equal(emailRegex.test(email), false, `Should reject: ${email}`);
    }
  });

  await test('Accept valid email addresses with subdomains, tags, and standard TLDs', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = ['customer@example.com', 'user.name+tag@snappygiftz.com', 'support@mail.snappygiftz.com', 'buyer123@domain.co.in'];
    for (const email of validEmails) {
      assert.equal(emailRegex.test(email), true, `Should accept: ${email}`);
    }
  });

  await test('Password validation requires non-empty submission', () => {
    function validateLoginPayload(email: string, password?: string) {
      if (!email || !email.trim()) return { valid: false, error: 'Email required' };
      if (!password || !password.trim()) return { valid: false, error: 'Password required' };
      return { valid: true };
    }

    assert.equal(validateLoginPayload('user@example.com', '').valid, false);
    assert.equal(validateLoginPayload('user@example.com', '   ').valid, false);
    assert.equal(validateLoginPayload('', 'Password123!').valid, false);
    assert.equal(validateLoginPayload('user@example.com', 'SecurePass123!').valid, true);
  });

  // ------------------------------------------------------------------
  // 2. Role-Based Destination Routing & Open-Redirect Protection
  // ------------------------------------------------------------------
  console.log('\n--- 2. Role-Based Destination Routing & Open-Redirect Protection ---');

  function resolveLoginRedirect(role: Role, requestedRedirect?: string | null): string {
    // 1. Server-verified Super Administrator and Staff always land on Operations HQ
    if (role === Role.ADMIN || role === Role.STAFF) {
      return '/admin';
    }

    // 2. Customer redirection with open-redirect sanitization
    if (
      requestedRedirect &&
      requestedRedirect.startsWith('/') &&
      !requestedRedirect.startsWith('//') &&
      !requestedRedirect.includes('\\')
    ) {
      return requestedRedirect;
    }

    return '/account';
  }

  await test('ADMIN role routes strictly to /admin regardless of requested redirect', () => {
    assert.equal(resolveLoginRedirect(Role.ADMIN, '/account'), '/admin');
    assert.equal(resolveLoginRedirect(Role.ADMIN, '/products/gold-rim-mug'), '/admin');
    assert.equal(resolveLoginRedirect(Role.ADMIN, null), '/admin');
  });

  await test('STAFF role routes strictly to /admin', () => {
    assert.equal(resolveLoginRedirect(Role.STAFF, '/checkout'), '/admin');
    assert.equal(resolveLoginRedirect(Role.STAFF, null), '/admin');
  });

  await test('CUSTOMER role respects valid internal redirect routes', () => {
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, '/checkout'), '/checkout');
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, '/account/orders'), '/account/orders');
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, '/products/antique-lantern'), '/products/antique-lantern');
  });

  await test('CUSTOMER role defaults to /account when redirect is omitted or null', () => {
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, null), '/account');
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, ''), '/account');
  });

  await test('Neutralize open-redirect attacks attempting external domain redirection', () => {
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, 'https://evil-phishing-site.com'), '/account');
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, 'http://malicious.com'), '/account');
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, '//evil-domain.com'), '/account');
    assert.equal(resolveLoginRedirect(Role.CUSTOMER, '/\\evil-domain.com'), '/account');
  });

  // ------------------------------------------------------------------
  // 3. Google OAuth Architecture & Unverified Credentials Safe Guard
  // ------------------------------------------------------------------
  console.log('\n--- 3. Google OAuth Architecture & Unverified Credentials Safe Guard ---');

  await test('Google OAuth handler returns 501 unverified status when credentials unconfigured', async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    try {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const req = new Request('http://localhost:3000/api/auth/google', {
        headers: { accept: 'application/json' },
      });
      const res = await getGoogleOAuth(req);

      assert.equal(res.status, 501);
      const data = await res.json();
      assert.equal(data.configured, false);
      assert.equal(data.status, 'UNVERIFIED_PENDING_CREDENTIALS');
      assert.equal(data.provider, 'google');
      assert.match(data.message, /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
    } finally {
      if (originalClientId) process.env.GOOGLE_CLIENT_ID = originalClientId;
      if (originalClientSecret) process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    }
  });

  await test('Google OAuth browser navigation without JSON header redirects cleanly to /login with error query', async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    try {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const req = new Request('http://localhost:3000/api/auth/google', {
        headers: { accept: 'text/html,application/xhtml+xml' },
      });
      const res = await getGoogleOAuth(req);

      assert.equal(res.status, 307); // NextResponse.redirect defaults to 307
      const location = res.headers.get('location') || '';
      assert.match(location, /\/login\?oauth_error=google_pending_credentials/);
    } finally {
      if (originalClientId) process.env.GOOGLE_CLIENT_ID = originalClientId;
      if (originalClientSecret) process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    }
  });

  // ------------------------------------------------------------------
  // 4. Database Offline & Rate Limiting Error Classification
  // ------------------------------------------------------------------
  console.log('\n--- 4. Database Offline & Rate Limiting Error Classification ---');

  await test('Properly classify database connection errors into informative user messaging', () => {
    function classifyAuthError(status: number, code?: string) {
      if (status === 429) return 'rate_limit';
      if (status === 503 || code === 'DATABASE_UNAVAILABLE') return 'db_offline';
      if (status === 401) return 'invalid_credentials';
      return 'unexpected';
    }

    assert.equal(classifyAuthError(429), 'rate_limit');
    assert.equal(classifyAuthError(503), 'db_offline');
    assert.equal(classifyAuthError(500, 'DATABASE_UNAVAILABLE'), 'db_offline');
    assert.equal(classifyAuthError(401), 'invalid_credentials');
    assert.equal(classifyAuthError(500), 'unexpected');
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`  Login Page Tests: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Customer Login Page test suite.`);
  }

  return { passed, failed };
}

export { runLoginPageTests };

if (process.argv[1]?.includes('login-page.test')) {
  runLoginPageTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

