/**
 * Production smoke: catalog, pricing, checkout order (no payment capture).
 * Usage: npx tsx scripts/qa-production-smoke.ts
 */
const BASE = process.env.QA_BASE_URL || 'https://snappygiftz.com';

type Json = Record<string, unknown>;

async function jfetch(path: string, init?: RequestInit): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE}${path}`, init);
  let json: Json = {};
  try {
    json = (await res.json()) as Json;
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const run = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`✓ ${name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name, ok: false, detail: msg });
      console.log(`✗ ${name}: ${msg}`);
    }
  };

  let teddyId = '';
  let teddyBasePaise = 0;

  await run('GET /api/catalog/products', async () => {
    const { status, json } = await jfetch('/api/catalog/products?limit=20');
    assert(status === 200, `HTTP ${status}`);
    assert(json.success === true, 'success flag missing');
    const products = (json.data as Json)?.products as Json[] | undefined;
    assert(Array.isArray(products) && products.length > 0, 'no products');
    const teddy = products!.find((p) => String(p.name).toLowerCase() === 'teddy');
    assert(!!teddy, 'teddy product not in catalog API');
    teddyId = String(teddy!.id);
    teddyBasePaise = Number(teddy!.basePricePaise);
    assert(teddyBasePaise === 1000, `expected teddy base 1000 paise, got ${teddyBasePaise}`);
  });

  await run('GET /api/catalog/products/[slug] teddy-cgzr', async () => {
    const { status, json } = await jfetch('/api/catalog/products/teddy-cgzr');
    assert(status === 200, `HTTP ${status}`);
    assert(json.success === true, 'success flag missing');
    const p = json.data as Json;
    assert(Number(p?.basePricePaise) === 1000, 'slug product price mismatch');
  });

  await run('POST /api/checkout/quote (teddy x1)', async () => {
    const { status, json } = await jfetch('/api/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinationStateCode: '36',
        items: [{ productId: teddyId || 'prod-1794014823165', quantity: 1 }],
      }),
    });
    assert(status === 200, `HTTP ${status}`);
    const data = json.data as Json;
    assert(Number(data?.grandTotalPaise) === 1180, `grand total expected 1180, got ${data?.grandTotalPaise}`);
  });

  await run('POST /api/checkout/orders (guest, no pay)', async () => {
    const idemp = `qa-smoke-${Date.now()}`;
    const { status, json } = await jfetch('/api/checkout/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'QA Smoke Test',
        customerEmail: 'qa-smoke@snappygiftz.com',
        customerPhone: '9876543210',
        shippingAddress: {
          name: 'QA Smoke Test',
          street: 'QA Street AS Rao Nagar',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500062',
          phone: '9876543210',
        },
        items: [{ productId: teddyId || 'prod-1794014823165', quantity: 1 }],
        paymentMethod: 'RAZORPAY',
        idempotencyKey: idemp,
      }),
    });
    assert(status === 201, `HTTP ${status} ${JSON.stringify(json)}`);
    const data = json.data as Json;
    assert(Number(data?.grandTotalPaise) === 1180, 'order grand total mismatch');
    assert(String(data?.orderNumber).startsWith('SG-'), 'missing order number');
  });

  await run('POST /api/auth/login invalid (expect 401)', async () => {
    const { status } = await jfetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'udaych123@gmail.com', password: 'invalid-test-password' }),
    });
    assert(status === 401, `expected 401, got ${status}`);
  });

  await run('GET /api/health/payments', async () => {
    const { status, json } = await jfetch('/api/health/payments');
    assert(status === 200, `HTTP ${status}`);
    console.log('   payments health:', JSON.stringify(json).slice(0, 200));
  });

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Summary ---');
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
