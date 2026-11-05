import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = 'C:\\Users\\lolla\\.gemini\\antigravity\\brain\\88a22714-cdaa-4b84-9000-22cdc0e6eb02\\screenshots\\login';

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // ----------------------------------------------------------------
    // 1. Desktop 1440x900
    // ----------------------------------------------------------------
    console.log('[Capture] Capturing Desktop 1440x900...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await desktopPage.waitForSelector('input[name="email"]', { timeout: 10000 });

    // Desktop main view
    await desktopPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'customer-login-desktop.png'),
      fullPage: false,
    });

    // Desktop interaction: validation trigger
    console.log('[Capture] Capturing Desktop Validation State...');
    await desktopPage.fill('input[name="email"]', 'invalid-email');
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForTimeout(400);
    await desktopPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'customer-login-desktop-validation.png'),
      fullPage: false,
    });

    // Desktop interaction: Forgot Password Modal
    console.log('[Capture] Capturing Desktop Forgot Password Modal...');
    await desktopPage.click('text="Forgot password?"');
    await desktopPage.waitForSelector('#forgot-modal-title', { timeout: 5000 });
    await desktopPage.waitForTimeout(300);
    await desktopPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'customer-login-forgot-password-modal.png'),
      fullPage: false,
    });
    // Close modal
    await desktopPage.click('button[aria-label="Close dialog"]');
    await desktopPage.waitForTimeout(300);

    // Desktop interaction: Google OAuth Modal
    console.log('[Capture] Capturing Desktop Google OAuth Status Modal...');
    await desktopPage.click('text="Continue with Google"');
    await desktopPage.waitForSelector('#google-modal-title', { timeout: 5000 });
    await desktopPage.waitForTimeout(300);
    await desktopPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'customer-login-google-oauth-modal.png'),
      fullPage: false,
    });
    await desktopPage.click('button[aria-label="Close dialog"]');
    await desktopPage.waitForTimeout(300);

    await desktopContext.close();

    // ----------------------------------------------------------------
    // 2. Mobile 390x844 (iPhone 14)
    // ----------------------------------------------------------------
    console.log('[Capture] Capturing Mobile 390x844...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await mobilePage.waitForSelector('input[name="email"]', { timeout: 10000 });

    await mobilePage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'customer-login-mobile.png'),
      fullPage: true,
    });

    // Mobile Forgot Password
    await mobilePage.click('text="Forgot password?"');
    await mobilePage.waitForSelector('#forgot-modal-title', { timeout: 5000 });
    await mobilePage.waitForTimeout(300);
    await mobilePage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'customer-login-mobile-forgot-modal.png'),
      fullPage: false,
    });

    await mobileContext.close();

    // ----------------------------------------------------------------
    // 3. Tablet 768x1024 (iPad)
    // ----------------------------------------------------------------
    console.log('[Capture] Capturing Tablet 768x1024...');
    const tabletContext = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      deviceScaleFactor: 2,
    });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await tabletPage.waitForSelector('input[name="email"]', { timeout: 10000 });

    await tabletPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'customer-login-tablet.png'),
      fullPage: true,
    });

    await tabletContext.close();

    console.log('✔ All login page screenshots captured successfully in:', SCREENSHOT_DIR);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Screenshot capture error:', err);
  process.exit(1);
});

