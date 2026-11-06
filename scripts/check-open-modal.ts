import { chromium } from '@playwright/test';
import fs from 'fs';

async function checkAdminModal() {
  const envContent = fs.readFileSync('.env', 'utf8');
  let adminEmail = '';
  let adminPassword = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('ADMIN_EMAIL=')) adminEmail = line.replace('ADMIN_EMAIL=', '').trim().replace(/^["']|["']$/g, '');
    if (line.startsWith('ADMIN_BOOTSTRAP_PASSWORD=')) adminPassword = line.replace('ADMIN_BOOTSTRAP_PASSWORD=', '').trim().replace(/^["']|["']$/g, '');
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:3000/login');
    await page.fill('#login-email', adminEmail);
    await page.fill('#login-password', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Look for any open modal with z-[90]
    const modal = page.locator('.fixed.inset-0.z-\\[90\\]');
    console.log('Count of open z-[90] modals:', await modal.count());
    if (await modal.count() > 0) {
      console.log('Modal text content:\n', await modal.first().innerText());
    }

    await page.screenshot({ path: 'C:\\Users\\lolla\\.gemini\\antigravity\\brain\\88a22714-cdaa-4b84-9000-22cdc0e6eb02\\screenshots\\inspection\\open-modal-in-admin.png' });
  } finally {
    await browser.close();
  }
}

checkAdminModal().catch(console.error);

