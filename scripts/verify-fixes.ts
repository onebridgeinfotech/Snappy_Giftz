import { chromium } from '@playwright/test';
import fs from 'fs';

async function verifyFixes() {
  console.log('=== VERIFYING APPLIED FIXES ===\n');

  // 1. Test Guest Access to /
  console.log('1. Testing Guest Direct Access to Storefront (http://localhost:3000/)...');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const currentUrl = page.url();
    console.log('   Landing URL for guest:', currentUrl);
    if (!currentUrl.includes('/login')) {
      console.log('   ✅ PASS: Storefront is openly accessible to guests without login redirect!');
    } else {
      console.log('   ❌ FAIL: Guest still redirected to /login');
    }

    // 2. Test "Browse Storefront" on /login
    console.log('\n2. Testing "Browse Storefront" link on /login...');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(1000);
    const browseLink = page.locator('a:has-text("Browse Storefront")').first();
    if (await browseLink.count() > 0) {
      await browseLink.click();
      await page.waitForTimeout(1500);
      const afterClickUrl = page.url();
      console.log('   URL after clicking "Browse Storefront":', afterClickUrl);
      if (!afterClickUrl.includes('/login')) {
        console.log('   ✅ PASS: "Browse Storefront" navigates cleanly to storefront without looping!');
      } else {
        console.log('   ❌ FAIL: Inescapable loop still active.');
      }
    }

    // 3. Test Public APIs
    console.log('\n3. Testing Public APIs for Unauthenticated Visitors...');
    const catRes = await fetch('http://localhost:3000/api/catalog/products');
    console.log('   /api/catalog/products -> HTTP', catRes.status);
    const shipRes = await fetch('http://localhost:3000/api/shipping/pincode?pincode=500001');
    console.log('   /api/shipping/pincode -> HTTP', shipRes.status);
    const googleRes = await fetch('http://localhost:3000/api/auth/google', { headers: { Accept: 'application/json' } });
    console.log('   /api/auth/google -> HTTP', googleRes.status);

    // 4. Test Protected API (Account should still require login)
    console.log('\n4. Testing Protected Customer Endpoints...');
    const accRes = await fetch('http://localhost:3000/api/account/profile');
    console.log('   /api/account/profile (Unauthenticated) -> HTTP', accRes.status, accRes.status === 401 ? '(✅ Expected 401)' : '');

    // 5. Test Admin Login and Modal Escape Dismissal
    console.log('\n5. Testing Admin Portal & Modal Dismissal...');
    const envContent = fs.readFileSync('.env', 'utf8');
    let email = '', password = '';
    for (const line of envContent.split('\n')) {
      if (line.startsWith('ADMIN_EMAIL=')) email = line.replace('ADMIN_EMAIL=', '').trim().replace(/^["']|["']$/g, '');
      if (line.startsWith('ADMIN_BOOTSTRAP_PASSWORD=')) password = line.replace('ADMIN_BOOTSTRAP_PASSWORD=', '').trim().replace(/^["']|["']$/g, '');
    }

    await page.goto('http://localhost:3000/login');
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Open Add Product modal
    const addProdBtn = page.locator('button:has-text("Add New Product to Catalog")').first();
    if (await addProdBtn.count() > 0) {
      await addProdBtn.click();
      await page.waitForTimeout(1000);
      const isModalOpenBefore = await page.locator('.fixed.inset-0.z-\\[90\\]').count() > 0;
      console.log('   Add Product Modal opened:', isModalOpenBefore);

      // Press Escape to dismiss
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const isModalOpenAfter = await page.locator('.fixed.inset-0.z-\\[90\\]').count() > 0;
      console.log('   Add Product Modal open after pressing Escape:', isModalOpenAfter);
      if (!isModalOpenAfter) {
        console.log('   ✅ PASS: Admin modal dismissed cleanly via Escape key!');
      } else {
        console.log('   ❌ FAIL: Modal did not close on Escape.');
      }
    }
  } finally {
    await browser.close();
  }
}

verifyFixes().catch(console.error);
