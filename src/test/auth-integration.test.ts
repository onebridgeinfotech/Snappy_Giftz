import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as loginPost } from '../app/api/auth/login/route';
import { GET as meGet } from '../app/api/auth/me/route';
import { GET as pickerConfigGet } from '../app/api/integrations/google-drive/picker-config/route';
import { POST as validateFoldersPost } from '../app/api/integrations/google-drive/validate-folders/route';
import { POST as pickerAuthorizePost } from '../app/api/integrations/google-drive/picker-authorize/route';
import { GET as authorizeGet } from '../app/api/integrations/google-drive/authorize/route';
import { createSession, SESSION_COOKIE_NAME, validateSessionToken } from '../lib/auth/session';
import { Role } from '@prisma/client';

test('Auth & Google Drive RBAC Integration Verification Suite', async (t) => {

  await t.test('1. Unauthenticated request to picker-config returns 401 UNAUTHORIZED', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-config', {
      method: 'GET',
    });
    const res = await pickerConfigGet(req);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.code, 'UNAUTHORIZED');
    assert.match(json.error, /Authentication required/i);
  });

  await t.test('2. Unauthenticated request to validate-folders returns 401 UNAUTHORIZED', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/validate-folders', {
      method: 'POST',
    });
    const res = await validateFoldersPost(req);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.code, 'UNAUTHORIZED');
  });

  await t.test('3. Unauthenticated request to authorize returns 401 UNAUTHORIZED', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/authorize', {
      method: 'GET',
    });
    const res = await authorizeGet(req);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.code, 'UNAUTHORIZED');
  });

  await t.test('4. Admin login with invalid password returns 401', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@snappygiftz.com', password: 'WrongPassword999!' }),
    });
    const res = await loginPost(req);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.match(json.error, /Invalid email or password/i);
  });

  let adminCookieHeader = '';
  let adminSessionToken = '';

  await t.test('5. Admin login with valid credentials creates real session & returns session cookie', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@snappygiftz.com', password: 'Password123!' }),
    });
    const res = await loginPost(req);
    assert.equal(res.status, 200, 'Login must succeed with 200');
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.user.email, 'admin@snappygiftz.com');
    assert.equal(json.user.role, Role.ADMIN);

    // Verify Set-Cookie header is returned with snappy_session_token
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Response must include set-cookie header');
    assert.ok(setCookie.includes(SESSION_COOKIE_NAME), 'Set-Cookie must contain snappy_session_token');

    // Extract token
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    assert.ok(match, 'Must match token in cookie');
    adminSessionToken = match[1];
    adminCookieHeader = `${SESSION_COOKIE_NAME}=${adminSessionToken}`;

    // Verify session token validates cryptographically in session store
    const sessionData = await validateSessionToken(adminSessionToken);
    assert.ok(sessionData, 'Session token must be validated by validateSessionToken');
    assert.equal(sessionData?.user.role, Role.ADMIN);
  });

  await t.test('6. GET /api/auth/me with admin cookie recognizes logged-in admin', async () => {
    const req = new Request('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: { cookie: adminCookieHeader },
    });
    const res = await meGet(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.authenticated, true);
    assert.equal(json.user.role, Role.ADMIN);
    assert.equal(json.user.email, 'admin@snappygiftz.com');
  });

  await t.test('7. GET /api/integrations/google-drive/picker-config with admin cookie returns 200 OK', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-config', {
      method: 'GET',
      headers: { cookie: adminCookieHeader },
    });
    const res = await pickerConfigGet(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.requiredFolders, 'Must contain requiredFolders mapping');
    assert.equal(json.requiredFolders.root.id, '1tyIZoYxyduRYjEmJARsCc_d4LfAYyFQ8');
  });

  await t.test('8. POST /api/integrations/google-drive/validate-folders with admin cookie passes auth (status 200 or 400 not connected, never 401)', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/validate-folders', {
      method: 'POST',
      headers: { cookie: adminCookieHeader },
    });
    const res = await validateFoldersPost(req);
    assert.notEqual(res.status, 401, 'Must never return 401 UNAUTHORIZED for authenticated admin');
    assert.notEqual(res.status, 403, 'Must never return 403 FORBIDDEN for authenticated admin');
    // If not connected yet via OAuth, returns 400 with message; if connected, returns 200
    assert.ok(res.status === 200 || res.status === 400);
    const json = await res.json();
    if (res.status === 400) {
      assert.match(json.error, /Google Drive is not connected/i);
    } else {
      assert.ok('allAccessible' in json);
    }
  });

  await t.test('9. POST /api/integrations/google-drive/picker-authorize with admin cookie passes auth (never 401/403)', async () => {
    const req = new Request('http://localhost:3000/api/integrations/google-drive/picker-authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookieHeader,
      },
      body: JSON.stringify({
        folders: [
          { id: '1tyIZoYxyduRYjEmJARsCc_d4LfAYyFQ8', name: 'SNAPPY_GIFTZ_STORAGE', type: 'root' },
        ],
      }),
    });
    const res = await pickerAuthorizePost(req);
    assert.notEqual(res.status, 401, 'Must never return 401 UNAUTHORIZED for authenticated admin');
    assert.notEqual(res.status, 403, 'Must never return 403 FORBIDDEN for authenticated admin');
    assert.ok(res.status === 200 || res.status === 400);
  });

  await t.test('10. Non-admin (CUSTOMER) session is rejected with 403 FORBIDDEN on Google Drive endpoints', async () => {
    const custSession = await createSession('cust-uuid-1', {
      role: Role.CUSTOMER,
      email: 'customer@example.com',
    });
    const custCookie = `${SESSION_COOKIE_NAME}=${custSession.sessionToken}`;

    // Picker config
    const reqCfg = new Request('http://localhost:3000/api/integrations/google-drive/picker-config', {
      headers: { cookie: custCookie },
    });
    const resCfg = await pickerConfigGet(reqCfg);
    assert.equal(resCfg.status, 403);
    const jsonCfg = await resCfg.json();
    assert.equal(jsonCfg.code, 'FORBIDDEN');

    // Validate folders
    const reqVal = new Request('http://localhost:3000/api/integrations/google-drive/validate-folders', {
      method: 'POST',
      headers: { cookie: custCookie },
    });
    const resVal = await validateFoldersPost(reqVal);
    assert.equal(resVal.status, 403);

    // Picker authorize
    const reqAuth = new Request('http://localhost:3000/api/integrations/google-drive/picker-authorize', {
      method: 'POST',
      headers: { cookie: custCookie },
    });
    const resAuth = await pickerAuthorizePost(reqAuth);
    assert.equal(resAuth.status, 403);
  });
});
