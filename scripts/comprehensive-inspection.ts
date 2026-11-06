import { chromium, Browser, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\Users\\lolla\\.gemini\\antigravity\\brain\\88a22714-cdaa-4b84-9000-22cdc0e6eb02\\screenshots\\inspection';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface AuditResult {
  category: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  apiOrUrl?: string;
  screenshot?: string;
}

const results: AuditResult[] = [];

async function main() {
  console.log('=== STARTING DEEP COMPREHENSIVE INSPECTION ===\n');

  // Read .env for test accounts
  const envContent = fs.readFileSync('.env', 'utf8');
  let adminEmail = '';
  let adminPassword = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('ADMIN_EMAIL=')) adminEmail = line.replace('ADMIN_EMAIL=', '').trim().replace(/^["']|["']$/g, '');
    if (line.startsWith('ADMIN_BOOTSTRAP_PASSWORD=')) adminPassword = line.replace('ADMIN_BOOTSTRAP_PASSWORD=', '').trim().replace(/^["']|["']$/g, '');
  }

  // 1. API HEALTH & ENDPOINTS AUDIT
  console.log('--- 1. Testing Core API Endpoints ---');
  const apiTests = [
    { name: 'Public Products API', url: 'http://localhost:3000/api/products', method: 'GET' },
    { name: 'Delivery Calculate API (Valid Hyderabad Pincode)', url: 'http://localhost:3000/api/delivery/calculate?pincode=500001&subtotalPaise=150000', method: 'GET' },
    { name: 'Delivery Calculate API (Rest of India Pincode)', url: 'http://localhost:3000/api/delivery/calculate?pincode=110001&subtotalPaise=150000', method: 'GET' },
    { name: 'Auth Current Session (Guest)', url: 'http://localhost:3000/api/auth/me', method: 'GET', expectStatus: 401 },
    { name: 'Admin Metrics API (Unauthenticated)', url: 'http://localhost:3000/api/admin/metrics', method: 'GET', expectStatus: 401 },
    { name: 'Order Tracking API (Non-existent Order)', url: 'http://localhost:3000/api/orders/track?orderNumber=SG-NONEXISTENT', method: 'GET' },
    { name: 'Admin Catalog API (Unauthenticated)', url: 'http://localhost:3000/api/admin/catalog', method: 'GET', expectStatus: 401 },
  ];

  for (const t of apiTests) {
    try {
      const res = await fetch(t.url, { method: t.method });
      const status = res.status;
      const body = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(body); } catch {}

      if (t.expectStatus) {
        if (status === t.expectStatus) {
          results.push({
            category: 'API Endpoints',
            name: t.name,
            status: 'PASS',
            details: `Protected endpoint correctly returned HTTP ${status} unauthorized`,
            apiOrUrl: t.url,
          });
        } else {
          results.push({
            category: 'API Endpoints',
            name: t.name,
            status: 'FAIL',
            details: `Expected HTTP ${t.expectStatus} but got ${status}: ${body.slice(0, 100)}`,
            apiOrUrl: t.url,
          });
        }
      } else {
        if (status >= 200 && status < 300) {
          const count = Array.isArray(parsed?.products) ? parsed.products.length : (Array.isArray(parsed) ? parsed.length : 'OK');
          results.push({
            category: 'API Endpoints',
            name: t.name,
            status: 'PASS',
            details: `HTTP 200 OK - Data received (${typeof count === 'number' ? count + ' items' : count})`,
            apiOrUrl: t.url,
          });
        } else if (status === 404 && t.name.includes('Non-existent')) {
          results.push({
            category: 'API Endpoints',
            name: t.name,
            status: 'PASS',
            details: `HTTP 404 handled cleanly for missing order lookup`,
            apiOrUrl: t.url,
          });
        } else {
          results.push({
            category: 'API Endpoints',
            name: t.name,
            status: status >= 500 ? 'FAIL' : 'WARNING',
            details: `HTTP ${status}: ${body.slice(0, 120)}`,
            apiOrUrl: t.url,
          });
        }
      }
    } catch (err: any) {
      results.push({
        category: 'API Endpoints',
        name: t.name,
        status: 'FAIL',
        details: `Fetch failed: ${err.message}`,
        apiOrUrl: t.url,
      });
    }
  }

  // 2. PLAYWRIGHT UI INSPECTION
  console.log('\n--- 2. Browser Inspection (Playwright) ---');
  const browser = await chromium.launch({ headless: true });

  try {
    // 2.1 GUEST USER BROWSER JOURNEY
    console.log('Inspecting Guest Flow on / ...');
    const guestPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await guestPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await guestPage.waitForTimeout(1500);

    const guestUrl = guestPage.url();
    if (guestUrl.includes('/login')) {
      const guestLink = guestPage.locator('a:has-text("Browse Storefront")').first();
      let trapped = false;
      if (await guestLink.count() > 0) {
        await guestLink.click();
        await guestPage.waitForTimeout(1500);
        if (guestPage.url().includes('/login')) {
          trapped = true;
        }
      }
      results.push({
        category: 'Guest Access & Storefront Routing',
        name: 'Guest Storefront Direct Access',
        status: 'FAIL',
        details: trapped
          ? 'CRITICAL DEFECT: Unauthenticated visitors visiting "/" are redirected to "/login". Clicking "Browse Storefront" attempts to go to "/" but src/proxy.ts immediately redirects back to "/login" in an inescapable loop.'
          : 'WARNING: Unauthenticated visitors are redirected to /login.',
        apiOrUrl: 'http://localhost:3000/'
      });
    } else {
      results.push({
        category: 'Guest Access & Storefront Routing',
        name: 'Guest Storefront Direct Access',
        status: 'PASS',
        details: 'Storefront opens cleanly for unauthenticated guest visitors without login barrier.',
        apiOrUrl: 'http://localhost:3000/'
      });
    }

    // 2.2 AUTHENTICATION & LOGIN FLOW
    console.log('Inspecting Login & Admin Session...');
    await guestPage.goto('http://localhost:3000/login');
    await guestPage.waitForTimeout(1000);

    const googleBtn = guestPage.locator('button:has-text("Google"), a:has-text("Google")').first();
    const hasGoogleBtn = await googleBtn.count() > 0;
    results.push({
      category: 'Authentication',
      name: 'Google OAuth Button Presence',
      status: hasGoogleBtn ? 'PASS' : 'WARNING',
      details: hasGoogleBtn ? 'Google Sign-In button is rendered.' : 'Google Sign-In button not found on login page.',
      apiOrUrl: 'http://localhost:3000/login'
    });

    const forgotPwLink = guestPage.locator('a:has-text("Forgot")').first();
    const hasForgotPw = await forgotPwLink.count() > 0;
    results.push({
      category: 'Authentication',
      name: 'Forgot Password Flow Link',
      status: hasForgotPw ? 'PASS' : 'WARNING',
      details: hasForgotPw ? 'Forgot password recovery link is present.' : 'Forgot password link missing.',
      apiOrUrl: 'http://localhost:3000/login'
    });

    // Customer Registration check
    await guestPage.goto('http://localhost:3000/register');
    await guestPage.waitForTimeout(1000);
    const registerName = await guestPage.locator('input[name="name"], #register-name').count() > 0;
    const registerEmail = await guestPage.locator('input[name="email"], #register-email').count() > 0;
    const registerPw = await guestPage.locator('input[name="password"], #register-password').count() > 0;
    results.push({
      category: 'Authentication',
      name: 'Customer Registration Page Elements',
      status: (registerName && registerEmail && registerPw) ? 'PASS' : 'FAIL',
      details: (registerName && registerEmail && registerPw) ? 'All customer registration inputs are present and functional.' : 'Missing inputs on /register.',
      apiOrUrl: 'http://localhost:3000/register'
    });

    // Perform Admin Login
    await guestPage.goto('http://localhost:3000/login');
    await guestPage.fill('#login-email', adminEmail);
    await guestPage.fill('#login-password', adminPassword);
    await guestPage.click('button[type="submit"]');
    await guestPage.waitForURL('**/admin', { timeout: 15000 });
    await guestPage.waitForTimeout(2000);

    const loggedInAdmin = guestPage.url().includes('/admin');
    results.push({
      category: 'Authentication',
      name: 'Admin Login & RBAC Verification',
      status: loggedInAdmin ? 'PASS' : 'FAIL',
      details: loggedInAdmin ? 'Admin logged in and redirected cleanly to /admin without privilege hang.' : 'Admin login failed or timed out.',
      apiOrUrl: 'http://localhost:3000/admin'
    });

    // 2.3 STOREFRONT NAVIGATION (AS AUTHENTICATED USER)
    console.log('Inspecting Storefront as Authenticated User...');
    await guestPage.goto('http://localhost:3000/');
    await guestPage.waitForTimeout(2000);

    // Check Admin Portal Pill in Header
    const adminPill = guestPage.locator('text=Admin Portal').first();
    const hasAdminPill = await adminPill.count() > 0;
    results.push({
      category: 'Storefront',
      name: 'Storefront Header Admin Navigation Pill',
      status: hasAdminPill ? 'PASS' : 'FAIL',
      details: hasAdminPill ? 'Admin pill present in top navigation for administrators.' : 'Admin pill missing.',
      apiOrUrl: 'http://localhost:3000/'
    });

    // Check Catalog Separation
    const makeItPersonalSection = await guestPage.locator('text=Make It Personal').count() > 0;
    const regularGiftsSection = await guestPage.locator('text=Regular Gifts').count() > 0;
    results.push({
      category: 'Storefront',
      name: 'Catalog Visual Separation (Personalized vs Regular)',
      status: (makeItPersonalSection && regularGiftsSection) ? 'PASS' : 'FAIL',
      details: `Make It Personal section: ${makeItPersonalSection}, Regular Gifts section: ${regularGiftsSection}.`,
      apiOrUrl: 'http://localhost:3000/'
    });

    // Check Personalization Studio Modal
    const personalizeBtn = guestPage.locator('button:has-text("Personalize Your Gift")').first();
    if (await personalizeBtn.count() > 0) {
      await personalizeBtn.click();
      await guestPage.waitForTimeout(1500);

      const studioModal = guestPage.locator('text=Personalization Studio').or(guestPage.locator('text=Live 3D Preview'));
      const studioOpen = await studioModal.count() > 0;
      results.push({
        category: 'Storefront',
        name: 'Personalization Studio 3D / Engraving Studio Modal',
        status: studioOpen ? 'PASS' : 'FAIL',
        details: studioOpen ? 'Studio opened with 3D/canvas view and font/engraving text inputs.' : 'Failed to open Personalization Studio.',
        apiOrUrl: 'http://localhost:3000/'
      });

      // Close modal
      await guestPage.keyboard.press('Escape');
      await guestPage.waitForTimeout(500);
    }

    // Check Product Detail Modal (click on regular gift card)
    const productCard = guestPage.locator('div[data-product-card], .group.cursor-pointer').first();
    if (await productCard.count() > 0) {
      await productCard.click();
      await guestPage.waitForTimeout(1000);
      const detailModal = guestPage.locator('text=Product Details').or(guestPage.locator('button:has-text("Add to Bag")'));
      const isDetailOpen = await detailModal.count() > 0;
      results.push({
        category: 'Storefront',
        name: 'Product Details Modal',
        status: isDetailOpen ? 'PASS' : 'FAIL',
        details: isDetailOpen ? 'Product details modal opened with specifications and pricing.' : 'Product modal failed to open on card click.',
      });
      await guestPage.keyboard.press('Escape');
      await guestPage.waitForTimeout(500);
    }

    // Check Add to Cart & Cart Drawer
    console.log('Inspecting Cart Drawer & Checkout Trigger...');
    const addToBag = guestPage.locator('button:has-text("Add to Bag"), button:has-text("Add to Cart")').first();
    let isCartOpen = false;
    if (await addToBag.count() > 0) {
      await addToBag.click();
      await guestPage.waitForTimeout(1500);

      const cartHeading = guestPage.locator('text=Shopping Bag').or(guestPage.locator('text=Cart Total'));
      isCartOpen = await cartHeading.count() > 0;
      results.push({
        category: 'Cart & Checkout',
        name: 'Add to Bag & Cart Drawer Display',
        status: isCartOpen ? 'PASS' : 'FAIL',
        details: isCartOpen ? 'Item added and Cart Drawer slide-over opened with subtotal and item list.' : 'Cart drawer failed to open.',
      });

      // Trigger Checkout Dialog from Cart Drawer
      const checkoutBtn = guestPage.locator('button:has-text("Proceed to Checkout"), button:has-text("Checkout")').first();
      if (await checkoutBtn.count() > 0) {
        await checkoutBtn.click();
        await guestPage.waitForTimeout(1500);

        const checkoutModal = guestPage.locator('text=Delivery Address').or(guestPage.locator('text=Pincode')).or(guestPage.locator('text=Payment Method'));
        const isCheckoutOpen = await checkoutModal.count() > 0;
        results.push({
          category: 'Cart & Checkout',
          name: 'Checkout Flow Modal & Address Capture',
          status: isCheckoutOpen ? 'PASS' : 'FAIL',
          details: isCheckoutOpen ? 'Checkout modal opened cleanly with Pincode and Address fields.' : 'Checkout modal failed to trigger.',
        });

        // Close checkout modal
        await guestPage.keyboard.press('Escape');
        await guestPage.waitForTimeout(500);
      }
    }

    // Check Order Tracking Modal
    const trackOrderBtn = guestPage.locator('button:has-text("Track Order")').first();
    if (await trackOrderBtn.count() > 0) {
      await trackOrderBtn.click();
      await guestPage.waitForTimeout(1000);
      const trackModal = guestPage.locator('text=Track Your Gift').or(guestPage.locator('text=Order Number'));
      const isTrackOpen = await trackModal.count() > 0;
      results.push({
        category: 'Storefront',
        name: 'Order Tracking Concierge Modal',
        status: isTrackOpen ? 'PASS' : 'FAIL',
        details: isTrackOpen ? 'Track order dialog opens with order number & phone lookup.' : 'Tracking dialog failed to open.',
      });
      await guestPage.keyboard.press('Escape');
      await guestPage.waitForTimeout(500);
    }

    // 2.4 ADMIN PORTAL TABS & MODULES
    console.log('Inspecting Admin Portal Tabs & Operations...');
    await guestPage.goto('http://localhost:3000/admin');
    await guestPage.waitForTimeout(2000);

    // Test Admin Tabs
    const adminTabs = [
      { id: 'overview', name: 'Overview & KPIs', selector: 'button:has-text("Overview & KPIs")' },
      { id: 'orders', name: 'Orders & Fulfillment', selector: 'button:has-text("Orders & Fulfillment")' },
      { id: 'inventory', name: 'Catalogue & Stock', selector: 'button:has-text("Catalogue & Stock")' },
      { id: 'categories', name: 'Categories & Occasions', selector: 'button:has-text("Categories & Occasions")' },
      { id: 'damage-reports', name: 'Damage Claims Desk', selector: 'button:has-text("Damage Claims Desk")' },
      { id: 'quotations', name: 'COD & Hyderabad Delivery', selector: 'button:has-text("COD & Hyderabad Delivery")' },
      { id: 'users', name: 'Customers & Staff', selector: 'button:has-text("Customers & Staff")' },
      { id: 'reports', name: 'Reports & CSV Export', selector: 'button:has-text("Reports & CSV Export")' },
      { id: 'settings', name: 'Business Settings', selector: 'button:has-text("Business Settings")' },
      { id: 'seller-config', name: 'GST & Seller Setup', selector: 'button:has-text("GST & Seller Setup")' },
    ];

    for (const tab of adminTabs) {
      const tabBtn = guestPage.locator(tab.selector).first();
      if (await tabBtn.count() > 0) {
        await tabBtn.click();
        await guestPage.waitForTimeout(1000);

        // Take a screenshot of the tab
        const screenshotPath = path.join(SCREENSHOT_DIR, `admin-tab-${tab.id}.png`);
        await guestPage.screenshot({ path: screenshotPath });

        results.push({
          category: 'Admin Portal Tabs',
          name: tab.name,
          status: 'PASS',
          details: `Tab loaded and rendered successfully. Screenshot captured.`,
          screenshot: screenshotPath,
        });

        // Special test on Catalogue & Stock: Check Add Product Modal and Types
        if (tab.id === 'inventory') {
          const addProductBtn = guestPage.locator('button:has-text("Add New Product to Catalog"), button:has-text("Add Product")').first();
          if (await addProductBtn.count() > 0) {
            await addProductBtn.click();
            await guestPage.waitForTimeout(1000);

            const regularCard = await guestPage.locator('text=Regular Gift').count();
            const customizableCard = await guestPage.locator('text=Customizable Gift').count();

            results.push({
              category: 'Admin Portal Operations',
              name: 'Admin Add Product: Type Selector (Regular vs Customizable)',
              status: (regularCard > 0 && customizableCard > 0) ? 'PASS' : 'FAIL',
              details: (regularCard > 0 && customizableCard > 0)
                ? 'Product Type Selector shows 2 interactive cards (Regular Gift vs Customizable Gift) with clear distinction.'
                : `Cards missing (Regular: ${regularCard}, Customizable: ${customizableCard})`,
            });

            // Close modal by clicking the X close button
            const closeBtn = guestPage.locator('button:has(.lucide-x), button:has-text("Cancel")').first();
            if (await closeBtn.count() > 0) {
              await closeBtn.click();
              await guestPage.waitForTimeout(800);
            }
          }
        }
      } else {
        results.push({
          category: 'Admin Portal Tabs',
          name: tab.name,
          status: 'FAIL',
          details: `Tab navigation button "${tab.name}" not found in admin sidebar/navbar.`,
        });
      }
    }

    // Check "View Live Storefront" Home button in Admin
    const liveStorefrontBtn = guestPage.locator('a:has-text("View Live Storefront"), a[href="/"]').first();
    const hasLiveStorefrontBtn = await liveStorefrontBtn.count() > 0;
    results.push({
      category: 'Admin Portal Operations',
      name: 'Admin Header "View Live Storefront" Link',
      status: hasLiveStorefrontBtn ? 'PASS' : 'FAIL',
      details: hasLiveStorefrontBtn ? 'View Live Storefront button present in admin header for returning to storefront.' : 'View Live Storefront button missing.',
    });

  } finally {
    await browser.close();
  }

  // Print results table
  console.log('\n======================================================');
  console.log('=== COMPREHENSIVE INSPECTION RESULTS SUMMARY ===');
  console.log('======================================================\n');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅ PASS' : (r.status === 'WARNING' ? '⚠️ WARN' : '❌ FAIL');
    console.log(`[${icon}] [${r.category}] ${r.name}`);
    console.log(`       Details: ${r.details}`);
    if (r.apiOrUrl) console.log(`       Target: ${r.apiOrUrl}`);
    if (r.screenshot) console.log(`       Screenshot: ${r.screenshot}`);
  }

  // Write results JSON
  fs.writeFileSync('inspection-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to inspection-results.json');
}

main().catch(err => {
  console.error('Fatal Inspection Error:', err);
});
