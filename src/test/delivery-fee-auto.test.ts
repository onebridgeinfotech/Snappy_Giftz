// Automatic distance-based delivery charges (default mode).
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';
delete process.env.DELIVERY_FEE_MODE;

import assert from 'node:assert/strict';
import { quoteDeliveryFee, DEFAULT_DELIVERY_FEE_SLABS, haversineKm, sanitizeGeoPoint } from '../lib/delivery/delivery-fee.service';
import { createOrder } from '../lib/orders/order.service';
import { getOrderApprovalStage } from '../lib/orders/order-approval.service';
import { initiatePayment } from '../lib/payments/payment.service';
import { INITIAL_PRODUCTS } from '../data/initialData';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  ✘ [FAIL] ${name}\n     Reason: ${err?.message}`);
  }
}

const baseOrder = (pincode: string, paymentMethod: string, key: string) => ({
  customerName: 'Ravi Kumar',
  customerEmail: 'ravi.kumar.test@snappygiftz.com',
  customerPhone: '9876543210',
  shippingAddress: { name: 'Ravi Kumar', street: 'Plot 4, Road 2', city: 'Hyderabad', state: 'Telangana', pincode },
  items: [{ productId: INITIAL_PRODUCTS[0].id, quantity: 1 }],
  paymentMethod,
  idempotencyKey: key,
});

async function main() {
  console.log('--- Automatic Delivery Charges ---');

  await test('Default slabs: up to 10 km = ₹200, 15 km = ₹250, 20 km = ₹300', async () => {
    assert.deepEqual(
      DEFAULT_DELIVERY_FEE_SLABS.map((s) => [s.maxDistanceKm, s.feePaise]),
      [[10, 20000], [15, 25000], [20, 30000]]
    );
  });

  await test('3 km PIN gets the first slab (₹200)', async () => {
    const q = await quoteDeliveryFee('500047');
    assert.equal(q.serviceable, true);
    assert.equal(q.isAutomatic, true);
    assert.equal(q.distanceKm, 3);
    assert.equal(q.feePaise, 20000);
  });

  await test('11 km PIN gets the second slab (₹250)', async () => {
    const q = await quoteDeliveryFee('500044');
    assert.equal(q.distanceKm, 11);
    assert.equal(q.feePaise, 25000);
  });

  await test('Online order: fee added on the server and ready to pay immediately', async () => {
    const order = await createOrder(baseOrder('500044', 'RAZORPAY', `auto-fee-online-${Date.now()}`) as any);
    assert.equal(order.shippingTotalPaise, 25000);
    assert.equal(order.orderStatus, 'PENDING');
    const stage = await getOrderApprovalStage(order.orderNumber);
    assert.equal(stage.stage, 'CUSTOMER_APPROVED', 'no owner review needed');
    const pay = await initiatePayment({ orderNumber: order.orderNumber, guestToken: order.guestLookupToken });
    assert.equal(pay.amountPaise, order.grandTotalPaise, 'payment amount = server total incl. delivery');
  });

  await test('COD order is confirmed immediately with the delivery charge included', async () => {
    const order = await createOrder(baseOrder('500047', 'COD', `auto-fee-cod-${Date.now()}`) as any);
    assert.equal(order.shippingTotalPaise, 20000);
    assert.equal(order.orderStatus, 'CONFIRMED');
  });

  await test('Current location near the studio cannot undercut a far PIN (anti-spoofing floor)', async () => {
    // PIN 500044 is 11 km in the PIN table; a faked location at the studio itself
    const q = await quoteDeliveryFee('500044', undefined, { latitude: 17.4789, longitude: 78.5492 });
    assert.equal(q.source, 'CURRENT_LOCATION');
    assert.equal(q.distanceKm, 9, 'floor = 11 km - 2 km');
    assert.equal(q.feePaise, 20000);
  });

  await test('Current location farther than the PIN uses the GPS road estimate', async () => {
    // ~7.5 km straight line north-east of the studio -> ~10 km road estimate
    const q = await quoteDeliveryFee('500047', undefined, { latitude: 17.53, longitude: 78.59 });
    const straight = haversineKm({ latitude: 17.4789, longitude: 78.5492 }, { latitude: 17.53, longitude: 78.59 });
    assert.equal(q.distanceKm, Math.ceil(straight * 1.3));
  });

  await test('Location beyond the delivery radius is not eligible', async () => {
    const q = await quoteDeliveryFee('500047', undefined, { latitude: 17.25, longitude: 78.40 }); // ~30 km away
    assert.equal(q.serviceable, false);
    assert.match(q.message, /Not eligible/);
  });

  await test('Coordinates outside India are ignored', async () => {
    assert.equal(sanitizeGeoPoint(51.5, -0.12), null);
    assert.equal(sanitizeGeoPoint('abc', 78), null);
    assert.deepEqual(sanitizeGeoPoint('17.4', '78.5'), { latitude: 17.4, longitude: 78.5 });
  });

  await test('Manual mode falls back to owner review', async () => {
    process.env.DELIVERY_FEE_MODE = 'manual';
    try {
      const q = await quoteDeliveryFee('500047');
      assert.equal(q.isAutomatic, false);
      assert.equal(q.feePaise, null);
    } finally {
      delete process.env.DELIVERY_FEE_MODE;
    }
  });

  console.log(`\nDelivery Fee Suite Results: ${passed} Passed, ${failed} Failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
