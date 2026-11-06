import { test, expect } from '@playwright/test';

test('Full real browser login and Google Drive picker-config verification', async ({ page }) => {
  const netEvents: { method: string; url: string; status: number; setCookie?: string; cookieSent?: string }[] = [];

  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      netEvents.push({
        method: req.method(),
        url: req.url(),
        status: 0,
        cookieSent: req.headers()['cookie'],
      });
    }
  });

  page.on('response', (res) => {
    if (res.url().includes('/api/')) {
      const last = netEvents.find((e) => e.url === res.url() && e.method === res.request().method() && e.status === 0);
      if (last) {
        last.status = res.status();
        last.setCookie = res.headers()['set-cookie'];
      }
      console.log(`[NET] ${res.status()} ${res.request().method()} ${res.url()}`);
      if (res.headers()['set-cookie']) {
        console.log(`[SET-COOKIE] ${res.headers()['set-cookie']}`);
      }
    }
  });

  console.log('--- Step 1: Navigate to http://localhost:3000/admin ---');
  await page.goto('http://localhost:3000/admin');

  // Verify login screen appears
  const heading = page.locator('h2:has-text("SNAPPY GIFTZ Operations HQ")');
  await expect(heading).toBeVisible({ timeout: 10000 });

  console.log('--- Step 2: Fill credentials and Submit Login ---');
  const emailInput = page.locator('main input[type="email"]');
  const passInput = page.locator('main input[type="password"]');
  const submitBtn = page.locator('main button[type="submit"]');

  await emailInput.fill('admin@snappygiftz.com');
  await passInput.fill('Password123!');

  // Intercept login response
  const [loginResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/login')),
    submitBtn.click(),
  ]);

  console.log('Login Response Status:', loginResponse.status());
  const loginBody = await loginResponse.json();
  console.log('Login Response Body:', loginBody);
  expect(loginResponse.status()).toBe(200);
  expect(loginBody.success).toBe(true);

  // Check cookies directly from browser context
  const cookies = await page.context().cookies();
  console.log('Browser Stored Cookies:', cookies);
  const sessionCookie = cookies.find((c) => c.name === 'snappy_session_token');
  console.log('Session Cookie in Browser Context:', sessionCookie);

  const allHeaders = await loginResponse.allHeaders();
  console.log('Login Response allHeaders:', allHeaders);
  const setCookie = allHeaders['set-cookie'] || (await loginResponse.headerValue('set-cookie'));
  console.log('Login Set-Cookie Header:', setCookie);

  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.value.length).toBeGreaterThan(30);

  console.log('--- Step 3: Verify Admin Dashboard Loaded ---');
  // Wait for admin navigation tabs to appear
  const settingsTab = page.locator('button:has-text("Settings")');
  await expect(settingsTab).toBeVisible({ timeout: 10000 });

  console.log('--- Step 4: Navigate to Settings (Tab 7) ---');
  await settingsTab.click();

  // Find Google Drive section
  const gdriveSection = page.locator('text=Google Drive Cloud Storage');
  await expect(gdriveSection).toBeVisible({ timeout: 10000 });

  console.log('--- Step 5: Test Authenticated Google Drive Endpoint Call ---');
  // Click "Authorize via Google Picker"
  const pickerBtn = page.locator('button:has-text("Authorize via Google Picker")');
  await expect(pickerBtn).toBeVisible({ timeout: 10000 });

  const [pickerResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/integrations/google-drive/picker-config')),
    pickerBtn.click(),
  ]);

  console.log('Picker-Config Response Status:', pickerResponse.status());
  const pickerJson = await pickerResponse.json();
  console.log('Picker-Config Response Body:', pickerJson);

  expect(pickerResponse.status()).toBe(200);
  expect(pickerJson.success).toBe(true);
  expect(pickerJson.pickerEnabled).toBe(true);
  expect(pickerJson.requiredFolders).toBeDefined();
  expect(pickerJson.requiredFolders.root.id).toBe('1tyIZoYxyduRYjEmJARsCc_d4LfAYyFQ8');

  // Verify the cookie was in browser context and endpoint returned 200 (which requires admin session)
  const reqAllHeaders = await pickerResponse.request().allHeaders();
  console.log('picker-config request allHeaders:', reqAllHeaders);
  const cookieFromReq = reqAllHeaders['cookie'] || (await pickerResponse.request().headerValue('cookie'));
  console.log('Cookie resolved from picker-config request:', cookieFromReq);
  const cookiesInContext = await page.context().cookies();
  const tokenInContext = cookiesInContext.find((c) => c.name === 'snappy_session_token');
  expect(tokenInContext).toBeDefined();
  expect(tokenInContext?.value).toBe(sessionCookie?.value);

  console.log('--- Step 6: Test Validate Folders Endpoint ---');
  const validateBtn = page.locator('button:has-text("Verify Folder Permissions")');
  const [validateResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/integrations/google-drive/validate-folders')),
    validateBtn.click(),
  ]);

  console.log('Validate-Folders Response Status:', validateResponse.status());
  expect(validateResponse.status()).not.toBe(401);
  expect(validateResponse.status()).not.toBe(403);
  console.log('SUCCESS: All browser authentication and Google Drive checks verified!');
});
