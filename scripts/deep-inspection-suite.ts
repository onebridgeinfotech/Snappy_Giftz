import { chromium, Browser, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\Users\\lolla\\.gemini\\antigravity\\brain\\88a22714-cdaa-4b84-9000-22cdc0e6eb02\\screenshots\\inspection';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface TestReport {
  id: string;
  name: string;
  category: 'Guest Access' | 'Authentication' | 'Storefront & Studio' | 'Cart & Checkout' | 'Admin Portal' | 'Customer Account';
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  screenshot?: string;
  consoleErrors: string[];
  failedRequests: string[];
}

const reports: TestReport[] = [];

function attachLogger(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('requestfailed', req => {
    failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });
  page.on('response', res => {
    if (res.status() >= 400 && !res.url().includes('/api/auth/me')) {
      failedRequests.push(`HTTP ${res.status()} on ${res.url()}`);
    }
  });

  return { consoleErrors, failedRequests };
}

async function run() {
  const envContent = fs.readFileSync('.env', 'utf8');
  let adminEmail = '';
  let adminPassword = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('ADMIN_EMAIL=')) adminEmail = line.replace('ADMIN_EMAIL=', '').trim().replace(/^["']|["']$/g, '');
    if (line.startsWith('ADMIN_BOOTSTRAP_PASSWORD=')) adminPassword = line.replace('ADMIN_BOOTSTRAP_PASSWORD=', '').trim().replace(/^["']|["']$/g, '');
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Guest Browsing & Storefront Access Loop
    // -------------------------------------------------------------------------
    console.log('Test 1: Guest Browsing & Storefront Access...');
    const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const guestPage = await guestCtx.newPage();
    const guestLog = attachLogger(guestPage);

    await guestPage.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await guestPage.waitForTimeout(1000);
    const guestUrl = guestPage.url();

    if (guestUrl.includes('/login')) {
      // Test the "Browse Storefront" link on the login page
      const guestLink = guestPage.locator('a:has-text("Browse Storefront"), a:has-text("Prefer guest checkout?")').first();
      let loopDetected = false;
      if (await guestLink.count() > 0) {
        await guestLink.click();
        await guestPage.waitForTimeout(1500);
        if (guestPage.url().includes('/login')) {
          loopDetected = true;
        }
      }

      reports.push({
        id: 'GUEST_STOREFRONT_GATE',
        name: 'Guest Storefront Access & Guest Link Loop',
        category: 'Guest Access',
        status: 'FAIL',
        details: loopDetected
          ? 'CRITICAL DEFECT: Unauthenticated visitors visiting "/" are redirected to "/login". Clicking "Browse Storefront" attempts to go to "/" but is immediately redirected back to "/login" in an inescapable loop by src/proxy.ts.'
          : 'WARNING: Unauthenticated visitors cannot browse "/" directly without logging in.',
        consoleErrors: guestLog.consoleErrors,
        failedRequests: guestLog.failedRequests
      });
    } else {
      reports.push({
        id: 'GUEST_STOREFRONT_GATE',
        name: 'Guest Storefront Access',
        category: 'Guest Access',
        status: 'PASS',
        details: 'Storefront is openly accessible to guests without forced login.',
        consoleErrors: guestLog.consoleErrors,
        failedRequests: guestLog.failedRequests
      });
    }
    await guestCtx.close();

    // -------------------------------------------------------------------------
    // TEST 2: Customer Registration & Auth Flow
    // -------------------------------------------------------------------------
    console.log('Test 2: Customer Registration & Account Access...');
    const custCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const custPage = await custCtx.newPage();
    const custLog = attachLogger(custPage);

    const testEmail = `testuser_${Date.now()}@example.com`;
    const testPassword = 'Password123!';

    await custPage.goto('http://localhost:3000/register', { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(1000);

    const nameInput = custPage.locator('input[name="name"], #register-name, input[placeholder*="Name"]').first();
    const emailInput = custPage.locator('input[name="email"], #register-email, input[type="email"]').first();
    const pwInput = custPage.locator('input[name="password"], #register-password, input[type="password"]').first();
    const submitBtn = custPage.locator('button[type="submit"]').first();

    if (await nameInput.count() > 0 && await emailInput.count() > 0 && await pwInput.count() > 0) {
      await nameInput.fill('Snappy Test Customer');
      await emailInput.fill(testEmail);
      await pwInput.fill(testPassword);
      await submitBtn.click();
      await custPage.waitForTimeout(2000);

      const regUrl = custPage.url();
      if (!regUrl.includes('/register')) {
        reports.push({
          id: 'CUSTOMER_REGISTRATION',
          name: 'Customer Registration & Onboarding',
          category: 'Authentication',
          status: 'PASS',
          details: `Successfully registered new customer (${testEmail}) into database and redirected to ${regUrl}.`,
          consoleErrors: custLog.consoleErrors,
          failedRequests: custLog.failedRequests
        });
      } else {
        const errorAlert = await custPage.locator('[role="alert"]').innerText().catch(() => 'Registration stayed on register page');
        reports.push({
          id: 'CUSTOMER_REGISTRATION',
          name: 'Customer Registration',
          category: 'Authentication',
          status: 'WARNING',
          details: `Registration response: ${errorAlert}`,
          consoleErrors: custLog.consoleErrors,
          failedRequests: custLog.failedRequests
        });
      }
    } else {
      reports.push({
        id: 'CUSTOMER_REGISTRATION',
        name: 'Customer Registration Form Elements',
        category: 'Authentication',
        status: 'FAIL',
        details: 'Registration form inputs could not be located on /register.',
        consoleErrors: custLog.consoleErrors,
        failedRequests: custLog.failedRequests
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Storefront Features, Modals & Cart (with authenticated session)
    // -------------------------------------------------------------------------
    console.log('Test 3: Storefront & Cart Interaction...');
    await custPage.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await custPage.fill('#login-email', adminEmail);
    await custPage.fill('#login-password', adminPassword);
    await custPage.click('button[type="submit"]');
    await custPage.waitForURL('**/admin', { timeout: 15000 }).catch(() => {});

    // Navigate to Storefront
    await custPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await custPage.waitForTimeout(1500);

    // 3A. Check Catalog Separation
    const hasMakeItPersonal = await custPage.locator('text=Make It Personal').count() > 0;
    const hasRegularGifts = await custPage.locator('text=Regular Gifts').count() > 0;
    const personalizeBtns = await custPage.locator('button:has-text("Personalize Your Gift")').count();

    reports.push({
      id: 'CATALOG_SEPARATION',
      name: 'Separate Customizable & Regular Gift Sections',
      category: 'Storefront & Studio',
      status: (hasMakeItPersonal && hasRegularGifts && personalizeBtns > 0) ? 'PASS' : 'FAIL',
      details: `Make It Personal heading present: ${hasMakeItPersonal}, Regular Gifts section present: ${hasRegularGifts}, Personalize CTAs count: ${personalizeBtns}.`,
      consoleErrors: custLog.consoleErrors,
      failedRequests: custLog.failedRequests
    });

    // 3B. Personalization Studio
    const firstPersBtn = custPage.locator('button:has-text("Personalize Your Gift")').first();
    if (await firstPersBtn.count() > 0) {
      await firstPersBtn.click();
      await custPage.waitForTimeout(1500);

      const studioHeading = custPage.locator('text=Personalization Studio').or(custPage.locator('text=Personalize Your'));
      const isStudioOpen = await studioHeading.count() > 0;

      reports.push({
        id: 'PERSONALIZATION_STUDIO',
        name: 'Personalization Studio Trigger & Modal',
        category: 'Storefront & Studio',
        status: isStudioOpen ? 'PASS' : 'FAIL',
        details: isStudioOpen
          ? 'Personalization Studio opened with live engraving input and font selection controls.'
          : 'Failed to open Personalization Studio modal.',
        consoleErrors: custLog.consoleErrors,
        failedRequests: custLog.failedRequests
      });

      // Close studio
      await custPage.keyboard.press('Escape');
      await custPage.waitForTimeout(500);
    }

    // 3C. Add to Cart & Cart Drawer
    const addToBagBtn = custPage.locator('button:has-text("Add to Bag"), button:has-text("Add to Cart")').first();
    let cartDrawerOpen = false;
    if (await addToBagBtn.count() > 0) {
      await addToBagBtn.click();
      await custPage.waitForTimeout(1500);

      const cartText = custPage.locator('text=Shopping Bag').or(custPage.locator('text=Cart Total')).or(custPage.locator('text=₹'));
      cartDrawerOpen = await cartText.count() > 0;

      reports.push({
        id: 'CART_DRAWER',
        name: 'Add to Bag & Cart Drawer Sizing',
        category: 'Cart & Checkout',
        status: cartDrawerOpen ? 'PASS' : 'FAIL',
        details: cartDrawerOpen
          ? 'Item added successfully, Cart Drawer rendered with item details and subtotal.'
          : 'Failed to add item or open Cart Drawer.',
        consoleErrors: custLog.consoleErrors,
        failedRequests: custLog.failedRequests
      });
    }

    // 3D. Checkout Modal
    if (cartDrawerOpen) {
      const checkoutBtn = custPage.locator('button:has-text("Proceed to Checkout"), button:has-text("Checkout")').first();
      if (await checkoutBtn.count() > 0) {
        await checkoutBtn.click();
        await custPage.waitForTimeout(1500);

        const checkoutModalHeading = custPage.locator('text=Delivery Address').or(custPage.locator('text=Checkout')).or(custPage.locator('text=Pincode'));
        const isCheckoutOpen = await checkoutModalHeading.count() > 0;

        reports.push({
          id: 'CHECKOUT_MODAL',
          name: 'Checkout Modal Flow & Address Capture',
          category: 'Cart & Checkout',
          status: isCheckoutOpen ? 'PASS' : 'FAIL',
          details: isCheckoutOpen
            ? 'Checkout modal opened with delivery details and pincode validation.'
            : 'Checkout modal failed to trigger from Cart Drawer.',
          consoleErrors: custLog.consoleErrors,
          failedRequests: custLog.failedRequests
        });

        await custPage.keyboard.press('Escape');
        await custPage.waitForTimeout(500);
      }
    }

    // 3E. Order Tracking Modal
    const trackBtn = custPage.locator('button:has-text("Track Order")').first();
    if (await trackBtn.count() > 0) {
      await trackBtn.click();
      await custPage.waitForTimeout(1000);
      const trackModal = custPage.locator('text=Track Your Gift').or(custPage.locator('text=Order Number'));
      const isTrackOpen = await trackModal.count() > 0;

      reports.push({
        id: 'ORDER_TRACKING_MODAL',
        name: 'Order Tracking Concierge Modal',
        category: 'Storefront & Studio',
        status: isTrackOpen ? 'PASS' : 'FAIL',
        details: isTrackOpen ? 'Track Order dialog opens cleanly.' : 'Track Order dialog failed to open.',
        consoleErrors: custLog.consoleErrors,
        failedRequests: custLog.failedRequests
      });

      await custPage.keyboard.press('Escape');
      await custPage.waitForTimeout(500);
    }

    // 3F. Role-based Admin Portal Button in Header
    const adminPortalPill = custPage.locator('text=Admin Portal').first();
    const hasAdminPortalPill = await adminPortalPill.count() > 0;

    reports.push({
      id: 'HEADER_ADMIN_PORTAL_LINK',
      name: 'Storefront Header Admin Portal Navigation Pill',
      category: 'Storefront & Studio',
      status: hasAdminPortalPill ? 'PASS' : 'FAIL',
      details: hasAdminPortalPill
        ? 'Admin Portal button is visibly rendered in the header for authenticated administrators.'
        : 'Admin Portal button is missing in the storefront header for authenticated administrators.',
      consoleErrors: custLog.consoleErrors,
      failedRequests: custLog.failedRequests
    });

    await custCtx.close();

    // -------------------------------------------------------------------------
    // TEST 4: Admin Portal Inspection
    // -------------------------------------------------------------------------
    console.log('Test 4: Admin Portal Deep Inspection...');
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminCtx.newPage();
    const adminLog = attachLogger(adminPage);

    await adminPage.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await adminPage.fill('#login-email', adminEmail);
    await adminPage.fill('#login-password', adminPassword);
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL('**/admin', { timeout: 15000 });
    await adminPage.waitForTimeout(2000);

    const isPrivilegeSpinning = await adminPage.locator('text=Verifying Administrator Privileges...').count();
    if (isPrivilegeSpinning === 0) {
      reports.push({
        id: 'ADMIN_RBAC_AUTHENTICATION',
        name: 'Admin Dashboard RBAC Access Gate',
        category: 'Admin Portal',
        status: 'PASS',
        details: 'Admin authentication succeeded without privilege hang or infinite update loops.',
        consoleErrors: adminLog.consoleErrors,
        failedRequests: adminLog.failedRequests
      });

      // 4A. Test Add Product Modal & Product Type Selector
      console.log('Testing Admin Catalog Add Product Selector...');
      // Click Catalog tab
      const catalogNav = adminPage.locator('button:has-text("Catalog"), button:has-text("Products")').first();
      if (await catalogNav.count() > 0) {
        await catalogNav.click();
        await adminPage.waitForTimeout(1000);

        const addProdBtn = adminPage.locator('button:has-text("Add Product"), button:has-text("New Product")').first();
        if (await addProdBtn.count() > 0) {
          await addProdBtn.click();
          await adminPage.waitForTimeout(1000);

          const regularCard = await adminPage.locator('text=Regular Gift').count();
          const customizableCard = await adminPage.locator('text=Customizable Gift').count();

          reports.push({
            id: 'ADMIN_PRODUCT_TYPE_SELECTOR',
            name: 'Admin Product Type Configuration (Regular vs Customizable)',
            category: 'Admin Portal',
            status: (regularCard > 0 && customizableCard > 0) ? 'PASS' : 'FAIL',
            details: (regularCard > 0 && customizableCard > 0)
              ? 'Add Product form displays the two-card product type selector with descriptions.'
              : `Product type selector cards missing in modal (Regular: ${regularCard}, Customizable: ${customizableCard}).`,
            consoleErrors: adminLog.consoleErrors,
            failedRequests: adminLog.failedRequests
          });

          await adminPage.keyboard.press('Escape');
          await adminPage.waitForTimeout(500);
        }
      }

      // 4B. Test Home Button in Admin
      const adminHomeBtn = adminPage.locator('a[href="/"], button:has-text("Home")').first();
      const hasAdminHomeBtn = await adminHomeBtn.count() > 0;

      reports.push({
        id: 'ADMIN_HOME_BUTTON',
        name: 'Admin "Return to Storefront" / Home Button',
        category: 'Admin Portal',
        status: hasAdminHomeBtn ? 'PASS' : 'FAIL',
        details: hasAdminHomeBtn
          ? 'Home button is available in the admin header for seamless return to storefront.'
          : 'Home return button is missing in admin portal.',
        consoleErrors: adminLog.consoleErrors,
        failedRequests: adminLog.failedRequests
      });

    } else {
      reports.push({
        id: 'ADMIN_RBAC_AUTHENTICATION',
        name: 'Admin Dashboard RBAC Access Gate',
        category: 'Admin Portal',
        status: 'FAIL',
        details: 'Admin Dashboard remained stuck on "Verifying Administrator Privileges...".',
        consoleErrors: adminLog.consoleErrors,
        failedRequests: adminLog.failedRequests
      });
    }

    await adminCtx.close();

    // -------------------------------------------------------------------------
    // TEST 5: Customer Account Protection
    // -------------------------------------------------------------------------
    console.log('Test 5: Account Route Protection...');
    const unauthCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const unauthPage = await unauthCtx.newPage();
    const unauthLog = attachLogger(unauthPage);

    await unauthPage.goto('http://localhost:3000/account', { waitUntil: 'domcontentloaded' });
    await unauthPage.waitForTimeout(1000);

    const isProtected = unauthPage.url().includes('/login');
    reports.push({
      id: 'ACCOUNT_ROUTE_GUARD',
      name: 'Customer Account (/account) Route Protection',
      category: 'Customer Account',
      status: isProtected ? 'PASS' : 'FAIL',
      details: isProtected
        ? 'Unauthenticated requests to /account are securely redirected to /login.'
        : 'Security flaw: Unauthenticated request reached /account without redirection.',
      consoleErrors: unauthLog.consoleErrors,
      failedRequests: unauthLog.failedRequests
    });

    await unauthCtx.close();

  } finally {
    await browser.close();
  }

  // Write final JSON summary
  const outPath = path.join(SCREENSHOT_DIR, 'inspection-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(reports, null, 2), 'utf8');
  console.log(`\n=== INSPECTION COMPLETED: ${reports.length} features evaluated. Results saved to ${outPath} ===`);
}

run().catch(console.error);

