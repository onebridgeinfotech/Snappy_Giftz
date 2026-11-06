import { test, expect } from '@playwright/test';

test.describe('Global Login-First Storefront Customer Experience', () => {

  test('1. Unauthenticated customer opening homepage (/) is redirected to /login', async ({ page }) => {
    // Clear cookies to simulate an unauthenticated visitor
    await page.context().clearCookies();

    await page.goto('/');
    expect(page.url()).toContain('/login');

    // Confirm login page elements
    await expect(page.getByText('SNAPPY GIFTZ', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Welcome to SNAPPY GIFTZ', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('2. Unauthenticated customer opening deep storefront route preserves redirect parameter', async ({ page }) => {
    await page.context().clearCookies();

    // Test product page
    await page.goto('/products/personalized-wooden-docking-station');
    expect(page.url()).toContain('/login?redirect=%2Fproducts%2Fpersonalized-wooden-docking-station');

    // Test account orders page
    await page.goto('/account/orders');
    expect(page.url()).toContain('/login?redirect=%2Faccount%2Forders');
  });

  test('3. Open-redirect attack is sanitized to safe root storefront', async ({ page }) => {
    await page.context().clearCookies();

    // Malicious open redirect query
    await page.goto('/login?redirect=https://evil.com');
    await expect(page.locator('#login-email')).toBeVisible();

    // Fill customer login credentials
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Must NOT redirect to evil.com, must redirect to safe root /
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    expect(page.url()).not.toContain('evil.com');
    expect(page.url()).toMatch(/http:\/\/localhost:3000\/?$/);
  });

  test('4. Full Customer Journey: Login -> Storefront Access -> Refresh -> Logout -> Back-Button Protection', async ({ page, context }) => {
    await context.clearCookies();

    // A. Visit deep protected path
    await page.goto('/products/personalized-wooden-docking-station');
    expect(page.url()).toContain('/login?redirect=%2Fproducts%2Fpersonalized-wooden-docking-station');

    // B. Log in as customer
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // C. Verifies successful post-login redirection to original product destination
    await page.waitForURL('**/products/personalized-wooden-docking-station', { timeout: 15000 });
    expect(page.url()).toContain('/products/personalized-wooden-docking-station');

    // D. Verify session cookie
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'snappy_session_token');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);

    // E. Refresh page: Session must persist without returning to login
    await page.reload();
    expect(page.url()).toContain('/products/personalized-wooden-docking-station');

    // F. Logout: call /api/auth/logout and clear session
    const logoutRes = await page.request.post('/api/auth/logout');
    expect(logoutRes.ok()).toBe(true);

    // Navigate to homepage after logout
    await page.goto('/');
    expect(page.url()).toContain('/login');

    // G. Browser Back button protection: navigating back must not expose protected content
    await page.goBack();
    await page.waitForTimeout(500);
    // After back navigation, must remain on /login or be redirected to /login
    expect(page.url()).toContain('/login');
  });

  test('5. Public technical exceptions remain accessible without session', async ({ page }) => {
    await page.context().clearCookies();

    const robotsRes = await page.request.get('/robots.txt');
    expect(robotsRes.status()).toBe(200);

    const sitemapRes = await page.request.get('/sitemap.xml');
    expect(sitemapRes.status()).toBe(200);

    const registerPage = await page.goto('/register');
    expect(registerPage?.status()).toBe(200);
    expect(page.url()).toContain('/register');
  });
});
