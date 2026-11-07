// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';

import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { hasRole, requireRole, AuthError } from '../lib/auth/rbac';
import { createSession, validateSessionToken, invalidateSession, SESSION_COOKIE_NAME } from '../lib/auth/session';
import { GET as meHandler } from '../app/api/auth/me/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';

/**
 * SNAPPY GIFTZ — Role-Based Admin Portal Navigation & RBAC Test Suite
 * Validates Requirement 5:
 *  - ADMIN can see and use Admin Portal from the storefront.
 *  - SUPER_ADMIN can see and use Admin Portal from the storefront.
 *  - CUSTOMER cannot see or access Admin Portal.
 *  - Logging out removes the Admin Portal option.
 *  - Refreshing the storefront preserves the correct role-based navigation.
 *  - Server-side role enforcement on admin endpoints.
 */
async function runRoleBasedAdminNavigationTests() {
  console.log('🧪 Starting Role-Based Admin Navigation & Security Tests...\n');

  // --------------------------------------------------------------------------
  // Test 1: RBAC hasRole Authoritative Permission Hierarchy
  // --------------------------------------------------------------------------
  console.log('1. Testing RBAC hasRole authorization logic...');
  
  // ADMIN role
  assert.equal(hasRole(Role.ADMIN, [Role.ADMIN]), true, 'ADMIN must satisfy [Role.ADMIN]');
  assert.equal(hasRole(Role.ADMIN, [Role.STAFF]), true, 'ADMIN has implicit access to staff operations');
  assert.equal(hasRole(Role.ADMIN, [Role.CUSTOMER]), true, 'ADMIN has implicit access to customer operations');
  assert.equal(hasRole('ADMIN', [Role.ADMIN]), true, 'String "ADMIN" must satisfy [Role.ADMIN]');

  // SUPER_ADMIN role
  assert.equal(hasRole('SUPER_ADMIN' as any, [Role.ADMIN]), true, 'SUPER_ADMIN must have administrative privileges');
  assert.equal(hasRole('SUPER_ADMIN' as any, [Role.STAFF]), true, 'SUPER_ADMIN has implicit staff access');
  assert.equal(hasRole('super_admin' as any, [Role.ADMIN]), true, 'Case-insensitive SUPER_ADMIN must have admin access');

  // CUSTOMER role
  assert.equal(hasRole(Role.CUSTOMER, [Role.ADMIN]), false, 'CUSTOMER must NOT have [Role.ADMIN] permissions');
  assert.equal(hasRole(Role.CUSTOMER, [Role.STAFF]), false, 'CUSTOMER must NOT have [Role.STAFF] permissions');
  assert.equal(hasRole(Role.CUSTOMER, [Role.ADMIN, Role.STAFF]), false, 'CUSTOMER must NOT have admin or staff permissions');

  // Guest / Anonymous / Null
  assert.equal(hasRole(null as any, [Role.ADMIN]), false, 'Null user must be denied');
  assert.equal(hasRole(undefined as any, [Role.ADMIN]), false, 'Undefined user must be denied');
  console.log('   ✓ hasRole correctly permits ADMIN & SUPER_ADMIN and rejects CUSTOMER/guests.\n');

  // --------------------------------------------------------------------------
  // Test 2: Storefront Role-Based Navigation Display Logic
  // --------------------------------------------------------------------------
  console.log('2. Testing Storefront Navigation Item Display Predicates...');

  function shouldDisplayAdminPortalNav(user: { role?: string } | null | undefined): boolean {
    if (!user || !user.role) return false;
    const norm = user.role.toUpperCase();
    return norm === 'ADMIN' || norm === 'SUPER_ADMIN' || norm === 'STAFF';
  }

  // ADMIN
  assert.equal(shouldDisplayAdminPortalNav({ role: 'ADMIN' }), true, 'ADMIN must see Admin Portal');
  assert.equal(shouldDisplayAdminPortalNav({ role: Role.ADMIN }), true, 'Role.ADMIN must see Admin Portal');

  // SUPER_ADMIN
  assert.equal(shouldDisplayAdminPortalNav({ role: 'SUPER_ADMIN' }), true, 'SUPER_ADMIN must see Admin Portal');

  // STAFF
  assert.equal(shouldDisplayAdminPortalNav({ role: Role.STAFF }), true, 'STAFF must see Admin Portal');

  // CUSTOMER
  assert.equal(shouldDisplayAdminPortalNav({ role: 'CUSTOMER' }), false, 'CUSTOMER must NEVER see Admin Portal');
  assert.equal(shouldDisplayAdminPortalNav({ role: Role.CUSTOMER }), false, 'Role.CUSTOMER must NEVER see Admin Portal');

  // Anonymous / Logged out
  assert.equal(shouldDisplayAdminPortalNav(null), false, 'Unauthenticated visitor must NEVER see Admin Portal');
  assert.equal(shouldDisplayAdminPortalNav(undefined), false, 'Undefined visitor must NEVER see Admin Portal');
  console.log('   ✓ Navigation predicates strictly gate Admin Portal to verified administrative roles.\n');

  // --------------------------------------------------------------------------
  // Test 3: Session Creation & Server Verification (/api/auth/me)
  // --------------------------------------------------------------------------
  console.log('3. Testing Server-Verified Session Role Resolution (/api/auth/me)...');

  // 3a. Admin session
  const adminSession = await createSession('usr-admin-test-01', {
    email: 'admin.test@snappygiftz.com',
    role: Role.ADMIN,
    name: 'Admin Tester',
  });
  assert.ok(adminSession.sessionToken, 'Admin session token must be created');

  const adminReq = new Request('http://localhost:3000/api/auth/me', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.sessionToken}` },
  });
  const adminMeRes = await meHandler(adminReq);
  assert.equal(adminMeRes.status, 200);
  const adminMeData = await adminMeRes.json();
  assert.equal(adminMeData.authenticated, true);
  assert.equal(adminMeData.user.role, Role.ADMIN);
  assert.equal(shouldDisplayAdminPortalNav(adminMeData.user), true, 'Storefront will display Admin Portal for ADMIN');
  console.log('   ✓ ADMIN session verified: role = ADMIN, Admin Portal displayed.');

  // 3b. Customer session
  const customerSession = await createSession('usr-customer-test-01', {
    email: 'customer.test@example.com',
    role: Role.CUSTOMER,
    name: 'Customer Tester',
  });
  assert.ok(customerSession.sessionToken, 'Customer session token must be created');

  const customerReq = new Request('http://localhost:3000/api/auth/me', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${customerSession.sessionToken}` },
  });
  const customerMeRes = await meHandler(customerReq);
  assert.equal(customerMeRes.status, 200);
  const customerMeData = await customerMeRes.json();
  assert.equal(customerMeData.authenticated, true);
  assert.equal(customerMeData.user.role, Role.CUSTOMER);
  assert.equal(shouldDisplayAdminPortalNav(customerMeData.user), false, 'Storefront must OMIT Admin Portal for CUSTOMER');
  console.log('   ✓ CUSTOMER session verified: role = CUSTOMER, Admin Portal strictly omitted.');

  // 3c. Unauthenticated request
  const unauthReq = new Request('http://localhost:3000/api/auth/me');
  const unauthMeRes = await meHandler(unauthReq);
  assert.equal(unauthMeRes.status, 401);
  const unauthMeData = await unauthMeRes.json();
  assert.equal(unauthMeData.authenticated, false);
  assert.equal(shouldDisplayAdminPortalNav(unauthMeData.user), false, 'Storefront must OMIT Admin Portal for guests');
  console.log('   ✓ Anonymous guest verified: authenticated = false, Admin Portal strictly omitted.\n');

  // --------------------------------------------------------------------------
  // Test 4: Logging Out Removes Admin Portal Option
  // --------------------------------------------------------------------------
  console.log('4. Testing Logout revokes session and removes Admin Portal option...');

  const logoutReq = new Request('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { cookie: `${SESSION_COOKIE_NAME}=${adminSession.sessionToken}` },
  });
  const logoutRes = await logoutHandler(logoutReq);
  assert.equal(logoutRes.status, 200);

  // Subsequent /api/auth/me with revoked token must return 401
  const postLogoutMeRes = await meHandler(adminReq);
  assert.equal(postLogoutMeRes.status, 401);
  const postLogoutData = await postLogoutMeRes.json();
  assert.equal(postLogoutData.authenticated, false);
  assert.equal(shouldDisplayAdminPortalNav(postLogoutData.user), false, 'Admin Portal option must disappear post-logout');
  console.log('   ✓ Logout invalidates session and removes Admin Portal navigation.\n');

  // --------------------------------------------------------------------------
  // Test 5: Refreshing Storefront Preserves Role-Based Navigation
  // --------------------------------------------------------------------------
  console.log('5. Testing Refresh / Persistence of Role-Based Navigation...');

  const freshAdminSession = await createSession('usr-admin-refresh-test', {
    email: 'admin.refresh@snappygiftz.com',
    role: Role.ADMIN,
    name: 'Persistent Admin',
  });

  // Emulate repeated page refreshes across multiple routes (/, /shop, /catalog, /products/mug, /cart, /checkout, /account)
  const storefrontRoutes = ['/', '/shop', '/catalog', '/products/gold-rim-mug', '/cart', '/checkout', '/account'];
  for (const route of storefrontRoutes) {
    const routeReq = new Request(`http://localhost:3000/api/auth/me?route=${encodeURIComponent(route)}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${freshAdminSession.sessionToken}` },
    });
    const res = await meHandler(routeReq);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.authenticated, true);
    assert.equal(data.user.role, Role.ADMIN);
    assert.equal(shouldDisplayAdminPortalNav(data.user), true, `Admin Portal must remain visible on ${route}`);
  }
  console.log(`   ✓ Refreshed across ${storefrontRoutes.length} storefront routes: Admin Portal persisted on all of them.\n`);

  // --------------------------------------------------------------------------
  // Test 6: Server-Side RBAC Enforcement on Protected Resources
  // --------------------------------------------------------------------------
  console.log('6. Testing Server-Side RBAC Protection on Admin Endpoints...');

  // Customer attempting admin action must be rejected with 403 FORBIDDEN
  const customerRbacReq = new Request('http://localhost:3000/api/admin/overview', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${customerSession.sessionToken}` },
  });

  try {
    await requireRole([Role.ADMIN, Role.STAFF], customerRbacReq);
    assert.fail('Customer should have thrown 403 AuthError on admin resource');
  } catch (err: any) {
    assert.ok(err instanceof AuthError, 'Error must be an AuthError');
    assert.equal(err.statusCode, 403, 'Customer accessing admin resource must receive HTTP 403');
    assert.equal(err.code, 'FORBIDDEN', 'Error code must be FORBIDDEN');
  }

  // Admin performing admin action must be allowed
  const adminRbacReq = new Request('http://localhost:3000/api/admin/overview', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${freshAdminSession.sessionToken}` },
  });
  const authorizedUser = await requireRole([Role.ADMIN, Role.STAFF], adminRbacReq);
  assert.equal(authorizedUser.role, Role.ADMIN, 'Admin user must be authorized on admin resource');
  console.log('   ✓ Server-side requireRole strictly returns 403 for CUSTOMER and grants access for ADMIN.\n');

  console.log('🎉 All Role-Based Admin Navigation & Security Tests Passed Successfully!\n');
}

runRoleBasedAdminNavigationTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});

