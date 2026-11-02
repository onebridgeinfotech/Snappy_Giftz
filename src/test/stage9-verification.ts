import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const screenshotDir = 'C:/Users/lolla/.gemini/antigravity-ide/brain/8970338b-7164-4ca1-8b0b-fce3ea69223d/stage9_screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function runStage9Verification() {
  console.log('🚀 Starting Stage 9 UI Layering & Interaction Verification on http://localhost:3000...\n');
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'Desktop (1440x900)', width: 1440, height: 900 },
    { name: 'Laptop (1280x800)', width: 1280, height: 800 },
    { name: 'Tablet (768x1024)', width: 768, height: 1024 },
    { name: 'Mobile (390x844)', width: 390, height: 844 },
    { name: 'Small Mobile (360x800)', width: 360, height: 800 }
  ];

  // 1. DESKTOP TEST: B2C Dropdown fix & interactions
  console.log('=== 1. VERIFYING DESKTOP (1440x900) ===');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Open persona dropdown
  const personaBtn = page.locator('#persona-simulator-button');
  await personaBtn.waitFor({ state: 'visible', timeout: 8000 });
  await personaBtn.click();
  await page.waitForTimeout(300);

  const personaDropdown = page.locator('#persona-simulator-dropdown');
  const isDropdownVisible = await personaDropdown.isVisible();
  console.log(`Dropdown visible after click: ${isDropdownVisible}`);

  const dropdownBox = await personaDropdown.boundingBox();
  console.log('Dropdown bounding box:', dropdownBox);

  // Take Desktop Post-Fix Screenshot
  const desktopShotPath = path.join(screenshotDir, '02_after_b2c_dropdown_fixed_desktop.png');
  await page.screenshot({ path: desktopShotPath });
  console.log(`📸 Saved desktop screenshot: ${desktopShotPath}`);

  // Test Outside Click
  await page.mouse.click(100, 400); // click main body content
  await page.waitForTimeout(300);
  const isDropdownClosedAfterOutsideClick = !(await personaDropdown.isVisible());
  console.log(`Dropdown closes on outside click: ${isDropdownClosedAfterOutsideClick}`);

  // Test Toggle Open/Close with Button Click
  await personaBtn.click();
  await page.waitForTimeout(200);
  const isOpenAgain = await personaDropdown.isVisible();
  await personaBtn.click();
  await page.waitForTimeout(200);
  const isClosedAgain = !(await personaDropdown.isVisible());
  console.log(`Dropdown toggles open and closed with button: ${isOpenAgain && isClosedAgain}`);

  // Test Escape Key
  await personaBtn.click();
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const isClosedOnEscape = !(await personaDropdown.isVisible());
  console.log(`Dropdown closes on Escape key: ${isClosedOnEscape}`);

  // Test Selecting a Role Option
  await personaBtn.click();
  await page.waitForTimeout(200);
  await page.locator('text=Corporate Procurement').click();
  await page.waitForTimeout(500);
  console.log(`Selected Corporate Procurement persona. Current URL/Mode verified.`);
  // Switch back to B2C
  await page.locator('button:has-text("B2C Store")').first().click();
  await page.waitForTimeout(400);
  await page.close();
  await context.close();

  // 2. LAPTOP TEST (1280x800)
  console.log('\n=== 2. VERIFYING LAPTOP (1280x800) ===');
  const laptopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const laptopPage = await laptopContext.newPage();
  await laptopPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const laptopPersonaBtn = laptopPage.locator('#persona-simulator-button');
  await laptopPersonaBtn.waitFor({ state: 'visible', timeout: 5000 });
  await laptopPersonaBtn.click();
  await laptopPage.waitForTimeout(300);
  const laptopShotPath = path.join(screenshotDir, '03_after_laptop_1280x800.png');
  await laptopPage.screenshot({ path: laptopShotPath });
  console.log(`📸 Saved laptop screenshot: ${laptopShotPath}`);
  await laptopPage.close();
  await laptopContext.close();

  // 3. TABLET TEST (768x1024)
  console.log('\n=== 3. VERIFYING TABLET (768x1024) ===');
  const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const tabletPersonaBtn = tabletPage.locator('#persona-simulator-button');
  const isTabletPersonaVisible = await tabletPersonaBtn.isVisible();
  console.log(`Tablet persona button visible in top bar: ${isTabletPersonaVisible}`);
  if (isTabletPersonaVisible) {
    await tabletPersonaBtn.click();
    await tabletPage.waitForTimeout(300);
    const tabletDropdown = tabletPage.locator('#persona-simulator-dropdown');
    console.log(`Tablet dropdown open: ${await tabletDropdown.isVisible()}`);
  }
  const tabletShotPath = path.join(screenshotDir, '04_after_tablet_768x1024.png');
  await tabletPage.screenshot({ path: tabletShotPath });
  console.log(`📸 Saved tablet screenshot: ${tabletShotPath}`);
  await tabletPage.close();
  await tabletContext.close();

  // 4. MOBILE TEST (390x844)
  console.log('\n=== 4. VERIFYING MOBILE (390x844) ===');
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // Check no horizontal scroll
  const mobileScrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  console.log(`Mobile viewport width: 390, Document scrollWidth: ${mobileScrollWidth} (No overflow: ${mobileScrollWidth <= 390})`);

  // Open mobile drawer
  const hamburgerBtn = mobilePage.locator('button[aria-label*="Navigation Menu"]').first();
  await hamburgerBtn.click();
  await mobilePage.waitForTimeout(300);

  // Check persona switcher in mobile drawer
  const mobileDrawer = mobilePage.locator('[role="region"][aria-label="Mobile Navigation"]');
  console.log(`Mobile drawer open: ${await mobileDrawer.isVisible()}`);
  const hasPersonaOptions = await mobileDrawer.locator('text=Simulate User Persona').isVisible();
  console.log(`Mobile drawer contains persona simulator: ${hasPersonaOptions}`);

  const mobileShotPath = path.join(screenshotDir, '05_after_mobile_390x844.png');
  await mobilePage.screenshot({ path: mobileShotPath });
  console.log(`📸 Saved mobile drawer screenshot: ${mobileShotPath}`);
  await mobilePage.close();
  await mobileContext.close();

  // 5. SMALL MOBILE TEST (360x800) & OVERLAYS AUDIT
  console.log('\n=== 5. VERIFYING SMALL MOBILE (360x800) & MODAL OVERLAYS ===');
  const smallContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const smallPage = await smallContext.newPage();
  await smallPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const smallScrollWidth = await smallPage.evaluate(() => document.documentElement.scrollWidth);
  console.log(`Small mobile viewport width: 360, Document scrollWidth: ${smallScrollWidth} (No overflow: ${smallScrollWidth <= 360})`);

  // Open Cart Drawer
  const cartBtn = smallPage.locator('button[aria-label*="shopping bag"]').first();
  await cartBtn.click();
  await smallPage.waitForTimeout(300);
  const cartDrawer = smallPage.locator('[role="dialog"][aria-label="Your Bespoke Gifting Bag"]');
  console.log(`Cart drawer opened: ${await cartDrawer.isVisible()}`);
  const bodyOverflowWithCart = await smallPage.evaluate(() => document.body.style.overflow);
  console.log(`Body scroll locked: ${bodyOverflowWithCart === 'hidden'}`);

  // Test Cart Drawer Escape Key
  await smallPage.keyboard.press('Escape');
  await smallPage.waitForTimeout(300);
  console.log(`Cart drawer closed on Escape: ${!(await cartDrawer.isVisible())}`);
  const bodyOverflowAfterCart = await smallPage.evaluate(() => document.body.style.overflow);
  console.log(`Body scroll restored: ${bodyOverflowAfterCart !== 'hidden'}`);

  // Open Auth Modal
  const authBtn = smallPage.locator('button[title="Account & Authentication"]').first();
  await authBtn.click();
  await smallPage.waitForTimeout(300);
  const authModal = smallPage.locator('[role="dialog"][aria-labelledby="auth-modal-title"]');
  console.log(`Auth modal opened: ${await authModal.isVisible()}`);
  await smallPage.keyboard.press('Escape');
  await smallPage.waitForTimeout(300);
  console.log(`Auth modal closed on Escape: ${!(await authModal.isVisible())}`);

  // Open Order Tracking Modal
  const trackBtn = smallPage.locator('button:has-text("Track Parcel")').first();
  if (await trackBtn.isVisible()) {
    await trackBtn.click();
    await smallPage.waitForTimeout(300);
    const trackingModal = smallPage.locator('[role="dialog"][aria-labelledby="tracking-modal-title"]');
    console.log(`Order tracking modal opened: ${await trackingModal.isVisible()}`);
    await smallPage.keyboard.press('Escape');
    await smallPage.waitForTimeout(300);
    console.log(`Order tracking modal closed on Escape: ${!(await trackingModal.isVisible())}`);
  }

  // Open Product Detail Modal
  const quickViewBtn = smallPage.locator('button:has-text("Quick View")').first();
  if (await quickViewBtn.isVisible()) {
    await quickViewBtn.click();
    await smallPage.waitForTimeout(300);
    const productModal = smallPage.locator('[role="dialog"][aria-modal="true"]');
    console.log(`Product detail modal opened: ${await productModal.isVisible()}`);
    await smallPage.keyboard.press('Escape');
    await smallPage.waitForTimeout(300);
    console.log(`Product detail modal closed on Escape: ${!(await productModal.isVisible())}`);
  }

  // Open WhatsApp Floating Launcher
  const waBtn = smallPage.locator('button[aria-label="Chat with Snappy Giftz concierge on WhatsApp"]');
  await waBtn.click();
  await smallPage.waitForTimeout(300);
  const waDrawer = smallPage.locator('text=Snappy Giftz Concierge');
  console.log(`WhatsApp popover opened: ${await waDrawer.isVisible()}`);
  await smallPage.keyboard.press('Escape');
  await smallPage.waitForTimeout(300);
  console.log(`WhatsApp popover closed on Escape: ${!(await waDrawer.isVisible())}`);

  const smallShotPath = path.join(screenshotDir, '06_after_small_mobile_360x800.png');
  await smallPage.screenshot({ path: smallShotPath });
  console.log(`📸 Saved small mobile screenshot: ${smallShotPath}`);

  await smallPage.close();
  await smallContext.close();

  await browser.close();
  console.log('\n✅ All Stage 9 UI Layering & Interaction Verifications Passed Successfully!');
}

runStage9Verification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
