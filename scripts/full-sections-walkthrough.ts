import { chromium, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\Users\\lolla\\.gemini\\antigravity\\brain\\88a22714-cdaa-4b84-9000-22cdc0e6eb02\\screenshots\\sections';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface SectionAudit {
  sectionId: string;
  name: string;
  pageUrl: string;
  visible: boolean;
  interactiveElements: string[];
  screenshotPath: string;
  notes: string;
}

const auditLog: SectionAudit[] = [];

async function capture(page: Page, sectionId: string, name: string, pageUrl: string, selector: string, notes: string) {
  const loc = page.locator(selector).first();
  const count = await loc.count();
  const visible = count > 0 && await loc.isVisible().catch(() => false);
  const screenshotName = `${sectionId}.png`;
  const filePath = path.join(SCREENSHOT_DIR, screenshotName);

  if (visible) {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await loc.screenshot({ path: filePath }).catch(async () => {
      await page.screenshot({ path: filePath });
    });
  } else {
    await page.screenshot({ path: filePath });
  }

  // Count buttons & links inside
  const btnCount = await loc.locator('button, a').count().catch(() => 0);
  const interactiveElements: string[] = [];
  for (let i = 0; i < Math.min(btnCount, 6); i++) {
    const txt = await loc.locator('button, a').nth(i).innerText().catch(() => '');
    if (txt.trim()) interactiveElements.push(txt.trim().replace(/\n/g, ' '));
  }

  auditLog.push({
    sectionId,
    name,
    pageUrl,
    visible,
    interactiveElements,
    screenshotPath: filePath,
    notes,
  });

  console.log(`[${visible ? '✅ VISIBLE' : '❌ NOT VISIBLE'}] ${name}`);
  if (interactiveElements.length > 0) {
    console.log(`   Interactive: ${interactiveElements.join(' | ')}`);
  }
}

async function run() {
  console.log('=== STARTING SECTION-BY-SECTION COMPREHENSIVE AUDIT ===\n');

  const envContent = fs.readFileSync('.env', 'utf8');
  let adminEmail = '';
  let adminPassword = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('ADMIN_EMAIL=')) adminEmail = line.replace('ADMIN_EMAIL=', '').trim().replace(/^["']|["']$/g, '');
    if (line.startsWith('ADMIN_BOOTSTRAP_PASSWORD=')) adminPassword = line.replace('ADMIN_BOOTSTRAP_PASSWORD=', '').trim().replace(/^["']|["']$/g, '');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // =========================================================================
    // PART A: STOREFRONT HOMEPAGE SECTIONS
    // =========================================================================
    console.log('\n--- Auditing Storefront (http://localhost:3000/) ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 1. Top Announcement Bar
    await capture(page, '01_announcement_bar', 'Top Announcement Bar', 'http://localhost:3000/', 'div.bg-\\[\\#17181C\\]\\/95.border-t, div:has-text("HYDERABAD BESPOKE DELIVERY")', 'Displays Hyderabad 24-48h delivery notice and boutique crafting schedule');

    // 2. Main Header & Navigation
    await capture(page, '02_main_header', 'Main Header & Navigation Bar', 'http://localhost:3000/', 'header', 'Contains brand identity, real-time search, Track Order button, wishlist, and bag counters');

    // 3. Hero Banner & CTAs
    await capture(page, '03_hero_banner', 'Hero Banner & Core CTAs', 'http://localhost:3000/', 'section:has-text("Crafting Luxury Memories"), section:has-text("Personalize a Gift")', 'Hero banner with luxury gold gradients and direct catalog navigation CTAs');

    // 4. Category Filter Pills
    await capture(page, '04_category_filters', 'Curated Collection / Category Pills', 'http://localhost:3000/', 'div:has-text("Browse Curations"), div.scrollbar-none', 'Scrollable horizontal pill bar for instant collection filtering');

    // 5. Occasions Filter Bar
    await capture(page, '05_occasion_filters', 'Occasion Tags Filter Bar', 'http://localhost:3000/', 'div:has-text("Celebrate Occasion"), div.flex-wrap:has(button:has-text("Birthday"))', 'Occasion selector covering Birthday, Anniversary, Wedding, Festival, Corporate');

    // 6. Section 1: "Make It Personal" (Customizable Gifts)
    await capture(page, '06_customizable_gifts_section', 'Section 1: Make It Personal (Customizable Atelier)', 'http://localhost:3000/', '#customizable-gifts-section', 'Grid of customizable gifts with 3D Atelier badges and "Personalize Your Gift" buttons');

    // 7. Section 2: "Regular Gifts & Ready Hampers"
    await capture(page, '07_regular_gifts_section', 'Section 2: Ready-to-Ship Regular Gifts', 'http://localhost:3000/', '#regular-gifts-section', 'Grid of non-customized artisanal gifts with quick "Add to Bag" buttons');

    // 8. Artisan Charter & Heritage Featurette
    await capture(page, '08_artisan_charter', 'Artisan Charter & Quality Pledge', 'http://localhost:3000/', '#brand-story-section', 'Craftsmanship story, stats (50K+ givers), and transit replacement guarantee');

    // 9. Customer Stories & Reviews
    await capture(page, '09_customer_reviews', 'Customer Stories & Social Proof', 'http://localhost:3000/', '#reviews-section', 'Customer testimonial cards with star ratings and verified buyer badges');

    // 10. FAQ Accordion
    await capture(page, '10_faq_accordion', 'Frequently Asked Questions (FAQ)', 'http://localhost:3000/', '#faq-section', 'Accordion answering personalization, unboxing video policy, and Hyderabad delivery');

    // 11. Footer
    await capture(page, '11_storefront_footer', 'Storefront Footer & Legal Links', 'http://localhost:3000/', 'footer', 'Hyderabad atelier address, contact email, GST compliance notes, and legal policies');

    // =========================================================================
    // PART B: STOREFRONT INTERACTIVE MODALS & DRAWERS
    // =========================================================================
    console.log('\n--- Auditing Storefront Modals & Drawers ---');

    // 12. Personalization Studio Modal
    const persBtn = page.locator('button:has-text("Personalize Your Gift")').first();
    if (await persBtn.count() > 0) {
      await persBtn.click();
      await page.waitForTimeout(1500);
      await capture(page, '12_personalization_studio_modal', 'Live Personalization Studio Modal', 'http://localhost:3000/', '.fixed.inset-0.z-\\[80\\], div[role="dialog"]', 'Live engraving inputs, font options, photo uploaders, and 3D proof canvas');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // 13. Product Details Modal
    const prodImg = page.locator('.aspect-square.cursor-pointer').first();
    if (await prodImg.count() > 0) {
      await prodImg.click();
      await page.waitForTimeout(1000);
      await capture(page, '13_product_detail_modal', 'Product Detail Specifications Modal', 'http://localhost:3000/', '.fixed.inset-0.z-\\[80\\], div[role="dialog"]', 'High-res image gallery, specifications, delivery estimator, and pricing breakdown');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // 14. Cart Drawer
    const addBtn = page.locator('button:has-text("Add to Bag"), button:has-text("Add to Cart")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await capture(page, '14_cart_drawer', 'Shopping Bag Slide-Over Drawer', 'http://localhost:3000/', '.fixed.inset-y-0.right-0, div:has-text("Shopping Bag")', 'Cart items, quantity buttons, subtotal, free delivery progress, and checkout CTA');

      // 15. Checkout Modal
      const checkoutBtn = page.locator('button:has-text("Proceed to Checkout"), button:has-text("Checkout")').first();
      if (await checkoutBtn.count() > 0) {
        await checkoutBtn.click();
        await page.waitForTimeout(1500);
        await capture(page, '15_checkout_modal', 'Customer Checkout & Delivery Address Modal', 'http://localhost:3000/', '.fixed.inset-0.z-\\[90\\], div[role="dialog"]', 'Pincode validation, shipping address form, and Razorpay/COD payment selectors');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // 16. Order Tracking Concierge Modal
    const trackBtn = page.locator('button:has-text("Track Order")').first();
    if (await trackBtn.count() > 0) {
      await trackBtn.click();
      await page.waitForTimeout(1000);
      await capture(page, '16_order_tracking_modal', 'Order Tracking Concierge Modal', 'http://localhost:3000/', '.fixed.inset-0.z-\\[80\\], div[role="dialog"]', 'Order lookup by Order Number & Phone with shipment milestone timeline');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // =========================================================================
    // PART C: AUTHENTICATION PAGES & FLOWS
    // =========================================================================
    console.log('\n--- Auditing Authentication Pages ---');

    // 17. Login Page
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(1000);
    await capture(page, '17_login_page', 'Customer & Staff Login Page', 'http://localhost:3000/login', 'main', 'Email/password form, Google OAuth button, Remember Me, Forgot Password link');

    // 18. Forgot Password Modal
    const forgotBtn = page.locator('button:has-text("Forgot password?")').first();
    if (await forgotBtn.count() > 0) {
      await forgotBtn.click();
      await page.waitForTimeout(800);
      await capture(page, '18_forgot_password_modal', 'Forgot Password 3-Step Recovery Modal', 'http://localhost:3000/login', '.fixed.inset-0.z-\\[60\\], div[role="dialog"]', 'Email submission, OTP code verification, and secure password reset form');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // 19. Customer Registration Page
    await page.goto('http://localhost:3000/register');
    await page.waitForTimeout(1000);
    await capture(page, '19_register_page', 'Customer Registration & Onboarding Page', 'http://localhost:3000/register', 'main', 'Full Name, Email, Phone, Password, and policy acceptance inputs');

    // =========================================================================
    // PART D: ADMIN OPERATIONS PORTAL (ALL 10 TABS)
    // =========================================================================
    console.log('\n--- Auditing Admin Operations Portal ---');
    await page.goto('http://localhost:3000/login');
    await page.fill('#login-email', adminEmail);
    await page.fill('#login-password', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const adminTabs = [
      { id: '20_admin_tab_overview', name: 'Admin: Overview & KPIs', selector: 'button:has-text("Overview & KPIs")' },
      { id: '21_admin_tab_orders', name: 'Admin: Orders & Fulfillment', selector: 'button:has-text("Orders & Fulfillment")' },
      { id: '22_admin_tab_catalogue', name: 'Admin: Catalogue & Stock', selector: 'button:has-text("Catalogue & Stock")' },
      { id: '23_admin_tab_categories', name: 'Admin: Categories & Occasions', selector: 'button:has-text("Categories & Occasions")' },
      { id: '24_admin_tab_damage_claims', name: 'Admin: Damage Claims Desk', selector: 'button:has-text("Damage Claims Desk")' },
      { id: '25_admin_tab_hyderabad_delivery', name: 'Admin: COD & Hyderabad Delivery', selector: 'button:has-text("COD & Hyderabad Delivery")' },
      { id: '26_admin_tab_users_staff', name: 'Admin: Customers & Staff', selector: 'button:has-text("Customers & Staff")' },
      { id: '27_admin_tab_reports_csv', name: 'Admin: Reports & CSV Export', selector: 'button:has-text("Reports & CSV Export")' },
      { id: '28_admin_tab_business_settings', name: 'Admin: Business Settings & Google Drive', selector: 'button:has-text("Business Settings")' },
      { id: '29_admin_tab_seller_setup', name: 'Admin: GST & Seller Setup', selector: 'button:has-text("GST & Seller Setup")' },
    ];

    for (const tab of adminTabs) {
      const btn = page.locator(tab.selector).first();
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(1000);
        await capture(page, tab.id, tab.name, 'http://localhost:3000/admin', 'main', `Administrative operations tab for ${tab.name}`);

        // If on Catalogue, open Add Product Modal to capture the Regular vs Customizable selector
        if (tab.id === '22_admin_tab_catalogue') {
          const addProdBtn = page.locator('button:has-text("Add New Product to Catalog")').first();
          if (await addProdBtn.count() > 0) {
            await addProdBtn.click();
            await page.waitForTimeout(1000);
            await capture(page, '22b_admin_add_product_modal', 'Admin: Add Product Modal (Regular vs Customizable)', 'http://localhost:3000/admin', '.fixed.inset-0.z-\\[90\\]', 'Interactive two-card selector for Regular Gift vs Customizable Gift');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(600);
          }
        }
      }
    }

  } finally {
    await browser.close();
  }

  // Save audit log
  fs.writeFileSync('sections-audit-log.json', JSON.stringify(auditLog, null, 2));
  console.log('\n========================================================');
  console.log(`=== AUDIT COMPLETE: ${auditLog.filter(a => a.visible).length} of ${auditLog.length} SECTIONS VERIFIED ===`);
  console.log('========================================================');
}

run().catch(console.error);

