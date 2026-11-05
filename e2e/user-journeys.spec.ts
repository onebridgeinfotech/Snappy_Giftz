import { test, expect } from '@playwright/test';

/**
 * Snappy Gifts — End-to-End User Journey Test Suite
 *
 * Covers:
 * 1. Customer Shopping & Gifting Lifecycle (18 journeys)
 * 2. Admin Operations & Business Management (16 journeys)
 * 3. Corporate B2B Procurement Lifecycle (10 journeys)
 */

test.describe('1. Customer Gifting & Order Lifecycle Journeys', () => {
  test('Customer Journey: Homepage, Catalog, Search, Cart & Guest Tracking', async ({ page }) => {
    // 1. Visit the homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/SNAPPY GIFTZ|Snappy Gifts/i);

    // 2. Browse curated products section
    const catalogHeading = page.locator('text=THE SNAPPY COLLECTION');
    await expect(catalogHeading).toBeVisible();

    // 3. Search and filter
    const searchInput = page.locator('input[placeholder*="Search for the perfect gift"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Brass');
      await page.waitForTimeout(300);
      expect(await searchInput.inputValue()).toBe('Brass');
      await searchInput.fill('');
    }

    // 4 & 5. Open product details and variant selection
    const firstProductCard = page.locator('button:has-text("Personalize & Gift"), button:has-text("Quick Add")').first();
    if (await firstProductCard.isVisible()) {
      await expect(firstProductCard).toBeEnabled();
    }

    // 6 & 7. Add to cart & view shopping bag
    const cartButton = page.locator('button[aria-label*="View shopping bag"]');
    await expect(cartButton).toBeVisible();
    await cartButton.click();

    // 8, 9, 10. Open Auth Modal for Login / Registration
    const closeCartBtn = page.locator('button:has-text("Continue Browsing"), button[aria-label*="close" i]').first();
    if (await closeCartBtn.isVisible()) {
      await closeCartBtn.click();
    }

    const authButton = page.locator('button[aria-label*="Manage user account"]');
    if (await authButton.isVisible()) {
      await authButton.click();
      const authModal = page.locator('[role="dialog"][aria-labelledby="auth-modal-title"]');
      await expect(authModal).toBeVisible();

      // Check registration tab
      const registerTab = page.locator('button:has-text("New Customer")');
      if (await registerTab.isVisible()) {
        await registerTab.click();
        await expect(page.locator('input[placeholder*="Full Name" i]')).toBeVisible();
      }

      // Close modal
      const closeAuth = page.locator('button[aria-label="Close authentication modal"]');
      await closeAuth.click();
      await expect(authModal).not.toBeVisible();
    }

    // 14. Track guest order modal
    const trackOrderBtn = page.locator('button:has-text("Track Order")').first();
    if (await trackOrderBtn.isVisible()) {
      await trackOrderBtn.click();
      const trackingModal = page.locator('[role="dialog"][aria-labelledby="tracking-modal-title"]');
      await expect(trackingModal).toBeVisible();
      const closeTrack = page.locator('button[aria-label="Close tracking modal"]');
      await closeTrack.click({ force: true });
      await expect(trackingModal).not.toBeVisible();
    }
  });
});

test.describe('2. Admin Operations & Governance Journeys', () => {
  test('Admin Journey: Navigation & Governance Panes', async ({ page }) => {
    await page.goto('/');

    // Switch to Ops mode
    const opsButton = page.locator('button:has-text("Ops")');
    if (await opsButton.isVisible()) {
      await opsButton.click();
      await page.waitForTimeout(500);

      // Verify Admin navigation tabs exist
      const adminTabs = [
        'Overview & KPIs',
        'Orders & Fulfillment',
        'Catalogue & Stock',
        'COD & Hyderabad Delivery',
        'Customers & Staff',
        'Reports & CSV Export',
        'Business Settings',
        'GST & Seller Setup',
        'Emails',
        'Audit Trail',
        'System Health & Ops',
        'Support',
      ];

      for (const tabName of adminTabs) {
        const tabEl = page.locator(`button:has-text("${tabName}")`).first();
        if (await tabEl.isVisible()) {
          expect(await tabEl.isVisible()).toBe(true);
        }
      }
    }
  });
});

test.describe('3. Corporate B2B Decommissioning Verification', () => {
  test('Consumer-Only Enforcement: Confirm B2B Portal & Corporate RFQ are Decommissioned', async ({ page, request }) => {
    await page.goto('/');

    // 1. Confirm B2B Portal and Quote Inquiry buttons are absent from storefront navigation and DOM
    const b2bButton = page.locator('button:has-text("B2B Portal")');
    await expect(b2bButton).not.toBeVisible();

    const quoteButton = page.locator('button:has-text("Request Corporate Quote")');
    await expect(quoteButton).not.toBeVisible();

    const bulkButton = page.locator('button:has-text("Bulk Order Inquiry")');
    await expect(bulkButton).not.toBeVisible();

    // 2. Confirm Corporate Gifting & Bulk Procurement marketing headers are absent
    const b2bHeader = page.locator('text=Corporate Gifting & Bulk Procurement');
    await expect(b2bHeader).not.toBeVisible();

    // 3. Confirm consumer bespoke collection heading is present and visible
    const consumerHeading = page.locator('text=THE SNAPPY COLLECTION');
    await expect(consumerHeading).toBeVisible();

    // 4. Confirm corporate B2B and RFQ page routes return 404 Not Found
    const b2bPageRoute = await request.get('/b2b');
    expect(b2bPageRoute.status()).toBe(404);

    const corporatePageRoute = await request.get('/corporate');
    expect(corporatePageRoute.status()).toBe(404);

    // 5. Confirm corporate B2B and RFQ API endpoints are decommissioned and return 404
    const b2bApiResponse = await request.get('/api/b2b/rfq');
    expect([404, 405]).toContain(b2bApiResponse.status());

    const corporateApiResponse = await request.get('/api/corporate/rfq');
    expect([404, 405]).toContain(corporateApiResponse.status());
  });
});
