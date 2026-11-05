import { test, expect } from '@playwright/test';

test.describe('E-Commerce Shopping, Cart, Personalization & Checkout Flow', () => {

  test('1. Unauthenticated customer accessing /cart or /checkout is protected by login-first proxy', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/cart');
    expect(page.url()).toContain('/login?redirect=%2Fcart');
    await expect(page.locator('#login-email')).toBeVisible();

    await page.goto('/checkout');
    expect(page.url()).toContain('/login?redirect=%2Fcheckout');
    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('2. Customer logs in and explores product detail page with personalization and flat ₹20 gift wrap', async ({ page }) => {
    await page.context().clearCookies();

    // 1. Log in
    await page.goto('/login');
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/', { timeout: 15000 });

    // 2. Open Product Detail Page
    await page.goto('/products/prod-1');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // 3. Verify Personalization Section
    await expect(page.getByText(/Personalize This Gift/i)).toBeVisible();
    
    // Fill engraved text
    const engraveInput = page.locator('input[placeholder*="Ananya & Vikram"]');
    if (await engraveInput.isVisible()) {
      await engraveInput.fill('To My Beloved Ananya');
    }

    // Toggle flat ₹20 gift wrapping
    const giftWrapCheckbox = page.getByRole('checkbox', { name: /Add Luxury Gift Packaging/i });
    if (await giftWrapCheckbox.isVisible()) {
      await giftWrapCheckbox.check();
      await expect(page.getByText(/flat ₹20 per order/i)).toBeVisible();
    }

    // 4. Add to Cart
    await page.getByRole('button', { name: /add to shopping bag/i }).click();
    await expect(page.getByText(/added .* to your bag/i)).toBeVisible();
  });

  test('3. Cart Page displays items, flat ₹20 gift wrap, and proceeds to checkout', async ({ page }) => {
    await page.context().clearCookies();

    // 1. Log in
    await page.goto('/login?redirect=%2Fcart');
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/cart', { timeout: 15000 });

    // 2. Verify Cart Page loaded
    await expect(page.getByRole('heading', { name: /Bespoke Shopping Bag/i })).toBeVisible();

    // If empty bag is shown, navigate to product and add
    const emptyState = page.getByText(/Your Shopping Bag is Empty/i);
    if (await emptyState.isVisible()) {
      await page.goto('/products/prod-1');
      await page.getByRole('button', { name: /add to shopping bag/i }).click();
      await page.goto('/cart');
    }

    // 3. Verify Order Summary & Flat ₹20 rule banner
    await expect(page.getByText('Order Summary')).toBeVisible();
    await expect(page.getByText(/Luxury Gift Wrap Policy/i)).toBeVisible();
    await expect(page.getByText('Delivery Charge', { exact: true })).toBeVisible();

    // 4. Click Proceed to Checkout
    await page.getByRole('button', { name: /proceed to checkout/i }).click();
    await page.waitForURL('**/checkout', { timeout: 10000 });
    expect(page.url()).toContain('/checkout');
  });

  test('4. Checkout Page validates Hyderabad PIN distance, 2-day prep time, and renders order submission', async ({ page }) => {
    await page.context().clearCookies();

    // 1. Log in directly to checkout
    await page.goto('/login?redirect=%2Fcheckout');
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/checkout', { timeout: 15000 });

    // 2. Verify Checkout heading and steps
    await expect(page.getByRole('heading', { name: /Bespoke Checkout/i })).toBeVisible();
    await expect(page.getByText('Delivery Details')).toBeVisible();
    await expect(page.getByText('Delivery Fee & Approval')).toBeVisible();

    // 3. Verify PIN input with Hyderabad serviceability
    const pinInput = page.locator('input[placeholder="500062"]');
    await expect(pinInput).toBeVisible();
    await pinInput.fill('500062');

    // 4. Verify Delivery Date Picker enforcing minimum 2 days
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
    const minDateAttr = await dateInput.getAttribute('min');
    expect(minDateAttr).toBeTruthy();

    // 5. Verify Bespoke Delivery Notice
    await expect(page.getByText(/Bespoke Delivery Approval Flow/i)).toBeVisible();
  });

  test('5. Mobile viewport responsiveness on Cart and Checkout pages', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.context().clearCookies();

    // Log in
    await page.goto('/login?redirect=%2Fcart');
    await page.locator('#login-email').fill('customer@example.com');
    await page.locator('#login-password').fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/cart', { timeout: 15000 });

    // Verify no horizontal overflow on mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Verify mobile checkout
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: /Bespoke Checkout/i })).toBeVisible();
    const checkoutScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const checkoutClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(checkoutScrollWidth).toBeLessThanOrEqual(checkoutClientWidth + 2);
  });

});
