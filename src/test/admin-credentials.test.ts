// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { validateSessionToken } from '../lib/auth/session';
import { getPrimaryAdminEmail, getAdminNotificationEmails } from '../config/business';

export async function runAdminCredentialsTestSuite() {
  console.log('====================================================');
  console.log('  Snappy Gifts — Admin Credentials & Auth Verification');
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

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();

  await test('Environment variables ADMIN_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are present', () => {
    assert.ok(adminEmail, 'ADMIN_EMAIL should be defined in .env');
    assert.ok(adminEmail.includes('@'), 'ADMIN_EMAIL should be a valid email');
    assert.ok(adminPassword, 'ADMIN_BOOTSTRAP_PASSWORD should be defined in .env');
    assert.ok(adminPassword.length >= 8, 'ADMIN_BOOTSTRAP_PASSWORD should be at least 8 characters');
  });

  await test('Business config reflects ADMIN_EMAIL as primary admin and in notification list', () => {
    assert.equal(getPrimaryAdminEmail(), adminEmail);
    assert.ok(getAdminNotificationEmails().includes(adminEmail));
  });

  await test('Admin login with correct credentials succeeds and returns ADMIN role', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        rememberMe: true,
      }),
    });

    const res = await loginHandler(req);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.email.toLowerCase(), adminEmail);
    assert.equal(data.user.role, 'ADMIN');

    // Verify session cookie was set
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Expected Set-Cookie header to be set');
    assert.ok(setCookie.includes('snappy_session_token='), 'Expected snappy_session_token cookie');

    // Extract raw session token
    const tokenMatch = setCookie.match(/snappy_session_token=([^;]+)/);
    assert.ok(tokenMatch && tokenMatch[1], 'Expected valid session token');
    const rawToken = decodeURIComponent(tokenMatch[1]);

    // Validate the session token
    const sessionData = await validateSessionToken(rawToken);
    assert.ok(sessionData, 'Session token should be valid');
    assert.equal(sessionData.user.role, 'ADMIN', 'Session user role should be ADMIN');
    assert.equal(sessionData.user.email.toLowerCase(), adminEmail);
  });

  await test('Admin login with incorrect password fails with 401', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminEmail,
        password: 'DefinitiveWrongPassword999!',
        rememberMe: true,
      }),
    });

    const res = await loginHandler(req);
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.error, 'Invalid email or password.');
  });

  await test('Public customer signup with ADMIN_EMAIL is rejected with 403 Forbidden', async () => {
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Actor',
        email: adminEmail,
        password: 'Password123!',
      }),
    });

    const res = await registerHandler(req);
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error.includes('protected'), 'Expected protected account warning');
  });

  console.log(`\nAdmin Credentials Test Results: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('admin-credentials.test.ts')) {
  runAdminCredentialsTestSuite().catch((err) => {
    console.error('Fatal error running admin credentials test:', err);
    process.exit(1);
  });
}

