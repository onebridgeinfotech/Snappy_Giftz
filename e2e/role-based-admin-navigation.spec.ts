import { test, expect } from '@playwright/test';

test.describe('Role-Based Admin Portal Navigation & RBAC', () => {

  test('1. Customer cannot see Admin Portal in storefront and receives 403 Forbidden on /admin', async ({ page }) => {
    test.setTimeout(90000);
    await page.context().clearCookies();

    // Sign in as CUSTOMER
    await page.goto('/login');
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Customer lands on storefront /
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
    await expect(page.locator('#nav-home-desktop')).toBeVisible({ timeout: 20000 });

    // Verify Admin Portal navigation is strictly hidden for CUSTOMER
    await expect(page.locator('#nav-admin-portal-desktop')).not.toBeVisible();
    await expect(page.locator('#nav-admin-portal-strip')).not.toBeVisible();

    // Attempt direct navigation to /admin as CUSTOMER
    await page.goto('/admin');
    await expect(page.getByText('403 FORBIDDEN')).toBeVisible({ timeout: 25000 });
    await expect(page.getByText('Administrator Privileges Required')).toBeVisible();
    await expect(page.getByText(/Your account is registered with the CUSTOMER role/i)).toBeVisible();

    // Click Return to Customer Storefront
    await page.getByRole('link', { name: /Return to Customer Storefront/i }).click();
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 25000 });
    await expect(page.locator('#nav-admin-portal-desktop')).not.toBeVisible();
  });

  test('2. Admin sees Admin Portal in storefront, can switch seamlessly between / and /admin', async ({ page }) => {
    test.setTimeout(90000);
    await page.context().clearCookies();

    // Sign in as ADMIN
    await page.goto('/login');
    await page.locator('#login-email').fill('admin@snappygiftz.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Admin lands on /admin
    await page.waitForURL('**/admin', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /Store & Warehouse Administration/i })).toBeVisible({ timeout: 25000 });
    await expect(page.getByRole('link', { name: /View Live Storefront/i })).toBeVisible({ timeout: 20000 });

    // Click "View Live Storefront" to navigate to the customer storefront
    await page.getByRole('link', { name: /View Live Storefront/i }).click();

    // Wait for storefront URL
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 25000 });

    // In customer storefront, Admin Portal button MUST be visible in desktop header & category strip
    await expect(page.locator('#nav-admin-portal-desktop')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#nav-admin-portal-strip')).toBeVisible();
    await expect(page.locator('#nav-home-desktop')).toBeVisible();

    // Click Admin Portal button to navigate back to /admin
    await page.locator('#nav-admin-portal-desktop').click();
    await page.waitForURL('**/admin', { timeout: 25000 });
    expect(page.url()).toContain('/admin');
    await expect(page.getByRole('heading', { name: /Store & Warehouse Administration/i })).toBeVisible({ timeout: 25000 });

    // Return to storefront and verify page reload preserves admin navigation without logging out
    await page.locator('#nav-home-desktop').click();
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 25000 });
    await expect(page.locator('#nav-admin-portal-desktop')).toBeVisible({ timeout: 20000 });

    await page.reload();
    await expect(page.locator('#nav-admin-portal-desktop')).toBeVisible({ timeout: 25000 });
  });

  test('3. Unauthenticated visitor cannot see Admin Portal navigation', async ({ page }) => {
    test.setTimeout(30000);
    await page.context().clearCookies();
    await page.goto('/login');

    // Unauthenticated on login page must not have Admin Portal
    await expect(page.locator('#nav-admin-portal-desktop')).not.toBeVisible();
    await expect(page.locator('#nav-admin-portal-strip')).not.toBeVisible();
  });
});
