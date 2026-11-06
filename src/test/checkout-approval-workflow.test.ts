Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';

import assert from 'node:assert/strict';
import { distanceService, validateDeliveryDate } from '../lib/shipping/distance.service';
import {
  createOrder,
  DEV_ORDERS_STORE,
} from '../lib/orders/order.service';
import {
  getOrderApprovalStage,
  customerProcessFinalAmount,
} from '../lib/orders/order-approval.service';
import { updateOrderDeliveryCharge } from '../lib/delivery/delivery.service';
import {
  initiatePayment,
  DeliveryChargeNotApprovedError,
} from '../lib/payments/payment.service';
import {
  confirmOrderDelivery,
  recordOrderDispatch,
  transitionOrderStatus,
} from '../lib/orders/order-lifecycle.service';
import { INITIAL_PRODUCTS } from '../data/initialData';
import { OrderStatus } from '@prisma/client';

/**
 * SNAPPY GIFTZ — Checkout, Distance Calculation, Approval Lifecycle & COD Inventory Tests
 */
async function runCheckoutApprovalWorkflowTests() {
  console.log('🧪 Starting Checkout & Approval Workflow Tests...\n');

  // Test 1: Distance calculation from A S Rao Nagar studio hub (500062)
  console.log('1. Testing Hyderabad distance calculator & 20km radius boundary...');
  // A S Rao Nagar itself (0 km)
  const originResult = await distanceService.calculateDistance('500062');
  assert.equal(originResult.isServiceable, true, 'Hub PIN 500062 must be eligible');
  assert.equal(originResult.estimatedDistanceKm, 0, 'Hub PIN 500062 must be 0 km');

  // Secunderabad (close by, ~7.5 km)
  const secResult = await distanceService.calculateDistance('500003');
  assert.equal(secResult.isServiceable, true, 'Secunderabad 500003 must be eligible');
  assert.ok(secResult.estimatedDistanceKm <= 20, 'Secunderabad must be within 20km');

  // Far/Invalid PIN outside coverage
  const farResult = await distanceService.calculateDistance('110001'); // New Delhi
  assert.equal(farResult.isServiceable, false, 'New Delhi 110001 must NOT be eligible for studio delivery');
  console.log('   ✓ 20km radius boundary enforcement verified.');

  // Test 2: Minimum 2-day preparation time enforcement
  console.log('2. Testing handcrafted preparation time enforcement (minimum 2 days)...');
  const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const invalidDateCheck = validateDeliveryDate(tomorrow);
  assert.equal(invalidDateCheck.isValid, false, 'Delivery 1 day later must be rejected (needs 2 days min)');

  const validDateCheck = validateDeliveryDate(threeDaysLater);
  assert.equal(validDateCheck.isValid, true, 'Delivery 3 days later must be accepted');
  console.log('   ✓ 2-day preparation time constraint verified.');

  // Test 3: Order Creation with Pending Delivery Charge
  console.log('3. Testing initial order creation & stage resolution...');
  const testOrder = await createOrder({
    customerName: 'Aarav Malhotra',
    customerEmail: 'aarav.malhotra@example.com',
    customerPhone: '9876543210',
    shippingAddress: {
      name: 'Aarav Malhotra',
      street: 'Flat 402, Sainikpuri',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500062',
    },
    items: [
      {
        productId: 'prod-1',
        quantity: 1,
        isGiftWrapped: true,
      },
    ],
    paymentMethod: 'RAZORPAY',
    idempotencyKey: `test-order-${Date.now()}`,
  });

  assert.ok(testOrder.orderNumber, 'Order number must be generated');
  
  // Check initial approval stage
  const stage1 = await getOrderApprovalStage(testOrder.orderNumber);
  assert.equal(stage1.stage, 'ORDER_AWAITING_OWNER_REVIEW', 'Initial stage must be ORDER_AWAITING_OWNER_REVIEW');
  assert.equal(stage1.actionsAllowed.canOwnerSetDeliveryCharge, true);
  assert.equal(stage1.actionsAllowed.canCustomerApprove, false, 'Customer cannot approve before charge is assigned');
  assert.equal(stage1.actionsAllowed.canInitiatePayment, false, 'Payment must NOT be allowed before customer approval');
  console.log(`   ✓ Order ${testOrder.orderNumber} created in stage: ${stage1.stage}`);

  // Test 4: Payment initiation blocked before customer approval
  console.log('4. Testing payment gate: Payment MUST be rejected before customer approval...');
  let paymentBlocked = false;
  try {
    await initiatePayment({
      orderNumber: testOrder.orderNumber,
      guestToken: testOrder.guestLookupToken,
      customerAcceptedDeliveryCharge: false,
    });
  } catch (err: any) {
    if (err instanceof DeliveryChargeNotApprovedError || err.name === 'DeliveryChargeNotApprovedError') {
      paymentBlocked = true;
    }
  }
  assert.ok(paymentBlocked, 'initiatePayment must throw DeliveryChargeNotApprovedError before approval');
  console.log('   ✓ Payment successfully blocked: DeliveryChargeNotApprovedError thrown.');

  // Test 5: Owner assigns delivery charge
  console.log('5. Testing owner assigning delivery charge via admin service...');
  const updatedByOwner = await updateOrderDeliveryCharge(
    testOrder.id,
    15000, // ₹150.00
    'Studio Owner'
  );
  assert.equal(Number(updatedByOwner.shippingTotalPaise), 15000, 'Shipping total should be 15,000 paise');

  const stage2 = await getOrderApprovalStage(testOrder.orderNumber);
  assert.equal(stage2.stage, 'AWAITING_CUSTOMER_APPROVAL', 'Stage must now be AWAITING_CUSTOMER_APPROVAL');
  assert.equal(stage2.actionsAllowed.canCustomerApprove, true, 'Customer approval action must now be unlocked');
  assert.equal(stage2.actionsAllowed.canInitiatePayment, false, 'Payment still blocked until customer approves');
  console.log(`   ✓ Owner assigned delivery fee of ₹150.00; Stage transitioned to: ${stage2.stage}`);

  // Test 6: Customer explicitly approves the final amount
  console.log('6. Testing customer approving the final amount...');
  const approvalResult = await customerProcessFinalAmount(testOrder.orderNumber, 'APPROVE');
  assert.equal(approvalResult.success, true);
  assert.equal(approvalResult.stage, 'CUSTOMER_APPROVED');

  const stage3 = await getOrderApprovalStage(testOrder.orderNumber);
  assert.equal(stage3.stage, 'CUSTOMER_APPROVED');
  assert.equal(stage3.actionsAllowed.canInitiatePayment, true, 'Payment now unlocked after customer approval');
  console.log(`   ✓ Customer approved final amount. Stage: ${stage3.stage}`);

  // Test 7: Post-Approval Payment Initiation
  console.log('7. Testing payment initialization now succeeds after approval...');
  const pmtConfig = await initiatePayment({
    orderNumber: testOrder.orderNumber,
    guestToken: testOrder.guestLookupToken,
    customerAcceptedDeliveryCharge: true,
  });
  assert.ok(pmtConfig.gatewayOrderId, 'Gateway order ID should be returned');
  assert.equal(pmtConfig.orderNumber, testOrder.orderNumber);
  console.log(`   ✓ Payment initiated successfully with Gateway Order: ${pmtConfig.gatewayOrderId}`);

  // Test 8: COD Order Inventory Invariant (Deduction ONLY upon DELIVERED)
  console.log('8. Testing Cash on Delivery (COD) inventory deduction upon DELIVERED status...');
  const codProduct = INITIAL_PRODUCTS[0];
  const initialStock = codProduct.stock;

  const codOrder = await createOrder({
    customerName: 'Meera Reddy',
    customerEmail: 'meera.reddy@example.com',
    customerPhone: '9848012345',
    shippingAddress: {
      name: 'Meera Reddy',
      street: 'Plot 12, Kapra',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500062',
    },
    items: [
      {
        productId: codProduct.id,
        quantity: 2,
        isGiftWrapped: false,
      },
    ],
    paymentMethod: 'COD',
    idempotencyKey: `cod-order-${Date.now()}`,
  });

  // Verify stock is NOT deducted on order placement
  assert.equal(codProduct.stock, initialStock, 'Stock must NOT be deducted at COD order placement');

  // Owner sets delivery charge
  await updateOrderDeliveryCharge(codOrder.id, 8000, 'Studio Owner');
  assert.equal(codProduct.stock, initialStock, 'Stock must NOT be deducted at delivery charge assignment');

  // Customer approves
  await customerProcessFinalAmount(codOrder.orderNumber, 'APPROVE');
  assert.equal(codProduct.stock, initialStock, 'Stock must NOT be deducted at customer approval');

  // Progress through pipeline: CONFIRMED -> QUALITY_CHECK -> DISPATCHED
  await transitionOrderStatus(codOrder.id, OrderStatus.CONFIRMED, 'STAFF');
  assert.equal(codProduct.stock, initialStock, 'Stock must NOT be deducted at CONFIRMED status');

  await transitionOrderStatus(codOrder.id, OrderStatus.QUALITY_CHECK, 'STAFF');
  assert.equal(codProduct.stock, initialStock, 'Stock must NOT be deducted at QUALITY_CHECK status');

  await recordOrderDispatch(
    codOrder.id,
    {
      carrierPartner: 'BlueDart Air',
      awbNumber: 'BD12345678',
      invoicePhysicalSignatureConfirmed: true,
    },
    'STAFF'
  );
  assert.equal(codProduct.stock, initialStock, 'Stock must NOT be deducted at DISPATCHED status');

  // Mark DELIVERED -> Triggers stock deduction exactly once
  await confirmOrderDelivery(codOrder.id, { notes: 'Delivered and cash collected.' }, 'STAFF');
  assert.equal(
    codProduct.stock,
    initialStock - 2,
    `Stock must be deducted by 2 upon DELIVERED status (Expected ${initialStock - 2}, got ${codProduct.stock})`
  );
  console.log(`   ✓ COD stock invariant verified: Initial(${initialStock}) -> Delivered(${codProduct.stock})`);

  // Test 9: Customer rejection / cancellation flow
  console.log('9. Testing customer rejection / cancellation flow...');
  const rejectOrder = await createOrder({
    customerName: 'Vikram Seth',
    customerEmail: 'vikram.seth@example.com',
    customerPhone: '9849054321',
    shippingAddress: {
      name: 'Vikram Seth',
      street: 'Road No 36, Jubilee Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500033',
    },
    items: [
      {
        productId: 'prod-2',
        quantity: 1,
        isGiftWrapped: false,
      },
    ],
    paymentMethod: 'RAZORPAY',
    idempotencyKey: `reject-order-${Date.now()}`,
  });

  await updateOrderDeliveryCharge(rejectOrder.id, 25000, 'Studio Owner');
  const rejectResult = await customerProcessFinalAmount(rejectOrder.orderNumber, 'REJECT');
  assert.equal(rejectResult.success, true);
  assert.equal(rejectResult.stage, 'CANCELLED');

  const stageReject = await getOrderApprovalStage(rejectOrder.orderNumber);
  assert.equal(stageReject.stage, 'CANCELLED');
  assert.equal(stageReject.actionsAllowed.canInitiatePayment, false);
  console.log('   ✓ Customer rejection correctly transitions order to CANCELLED.');

  console.log('\n✅ All Checkout & Approval Workflow tests passed successfully (9/9).\n');
}

runCheckoutApprovalWorkflowTests().catch((err) => {
  console.error('❌ Checkout & Approval Workflow tests failed:', err);
  process.exit(1);
});
