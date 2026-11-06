import fs from 'fs';

async function testAdminApis() {
  const envContent = fs.readFileSync('.env', 'utf8');
  let email = '', password = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('ADMIN_EMAIL=')) email = line.replace('ADMIN_EMAIL=', '').trim().replace(/^["']|["']$/g, '');
    if (line.startsWith('ADMIN_BOOTSTRAP_PASSWORD=')) password = line.replace('ADMIN_BOOTSTRAP_PASSWORD=', '').trim().replace(/^["']|["']$/g, '');
  }

  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status, 'Cookie set:', Boolean(cookie));

  const endpoints = [
    '/api/admin/overview',
    '/api/admin/orders',
    '/api/admin/catalog',
    '/api/admin/catalog/categories',
    '/api/admin/catalog/occasions',
    '/api/admin/damage-reports',
    '/api/admin/delivery/pincodes',
    '/api/admin/delivery/rules',
    '/api/admin/users',
    '/api/admin/settings',
    '/api/admin/seller-config',
    '/api/admin/reports/orders',
    '/api/admin/reports/sales',
    '/api/admin/reports/inventory',
    '/api/admin/reports/taxes',
    '/api/admin/system/health'
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch('http://localhost:3000' + ep, {
        headers: { cookie: cookie || '' }
      });
      console.log(ep, '-> HTTP', res.status);
      if (res.status !== 200) {
        console.log('  Response:', (await res.text()).slice(0, 150));
      }
    } catch (err: any) {
      console.log(ep, '-> Error:', err.message);
    }
  }
}

testAdminApis().catch(console.error);
