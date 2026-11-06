import { test, expect } from '@playwright/test';

test.describe('Customer Account & Profile Experience', () => {

  test('1. Unauthenticated customer accessing /account is redirected to /login?redirect=/account', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/account');
    expect(page.url()).toContain('/login?redirect=%2Faccount');
    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('2. Customer can sign in and view Account Profile, Edit Profile, and Manage Addresses', async ({ page }) => {
    await page.context().clearCookies();

    // 1. Visit /account (redirects to /login)
    await page.goto('/account');
    expect(page.url()).toContain('/login');

    // 2. Sign in as test customer
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // 3. Post-login redirects back to /account
    await page.waitForURL('**/account', { timeout: 15000 });
    expect(page.url()).toContain('/account');

    // 4. Verify customer profile details displayed (use .first() to handle header + card)
    await expect(page.getByText('Personal Details')).toBeVisible();
    await expect(page.getByText('customer@example.com').first()).toBeVisible();
    await expect(page.getByText('CUSTOMER', { exact: true }).first()).toBeVisible();

    // 5. Test Edit Profile
    await page.getByRole('button', { name: /edit profile/i }).click();
    const nameInput = page.locator('input[value*="Customer"], input[placeholder*="Name"]').first();
    await nameInput.fill('Ananya Sharma');
    await page.getByRole('button', { name: /save profile/i }).click();
    await expect(page.getByText('Profile updated successfully.')).toBeVisible();

    // 6. Test Navigation to Delivery Addresses tab
    await page.getByRole('button', { name: /delivery addresses/i }).click();
    await expect(page.getByText('Saved Delivery Addresses')).toBeVisible();

    // 7. Test Add Address modal
    await page.getByRole('button', { name: /add address|add first address/i }).first().click();
    await expect(page.getByText(/add new delivery address|edit delivery address/i)).toBeVisible();

    // Fill address form
    await page.locator('input[placeholder*="Priya Reddy"]').fill('Ananya Sharma');
    await page.locator('input[placeholder*="10-digit mobile"]').first().fill('9876543210');
    await page.locator('textarea[placeholder*="House no"]').fill('Villa 42, Jubilee Hills Road 10');
    await page.locator('input[placeholder*="Hyderabad"]').fill('Hyderabad');
    await page.locator('input[placeholder*="6-digit PIN"]').fill('500033');
    await page.getByRole('button', { name: /save address/i }).click();

    // Verify address saved in list
    await expect(page.getByText('Villa 42, Jubilee Hills Road 10')).toBeVisible();
    await expect(page.getByText('500033')).toBeVisible();

    // 8. Test Navigation to Security & Password tab
    await page.getByRole('button', { name: /security & password/i }).click();
    await expect(page.getByText('Change Password')).toBeVisible();
    await expect(page.locator('input[placeholder*="Min 8 chars"]')).toBeVisible();

    // 9. Test View All Orders link
    await page.getByRole('link', { name: /view all orders/i }).click();
    await page.waitForURL('**/account/orders', { timeout: 10000 });
    expect(page.url()).toContain('/account/orders');
    await expect(page.getByText('Your Orders')).toBeVisible();

    // Return to account
    await page.getByRole('link', { name: /back to account/i }).click();
    await page.waitForURL('**/account', { timeout: 10000 });

    // 10. Test Logout from Account Page
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL('**/login', { timeout: 15000 });
    expect(page.url()).toContain('/login');
  });

  test('3. Mobile Viewport: Customer Account renders responsively without layout clipping', async ({ page }) => {
    // Set iPhone 13 / 14 mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Log in directly
    await page.goto('/login?redirect=/account');
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/account', { timeout: 15000 });
    expect(page.url()).toContain('/account');

    // Wait for the account content to stabilize
    await expect(page.getByText('Personal Details')).toBeVisible();

    // Confirm tabs and header fit inside viewport width
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // No horizontal overflowing
  });

});
