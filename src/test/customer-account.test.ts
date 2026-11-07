// Tests use the built-in demo catalog when the database is offline.
if (!process.env.SHOW_DEMO_PRODUCTS) process.env.SHOW_DEMO_PRODUCTS = 'true';
import assert from 'node:assert';
import {
  getCustomerProfile,
  updateCustomerProfile,
  changeCustomerPassword,
  listCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  DEV_ADDRESSES_STORE,
} from '../lib/account/account.service';
import { DEV_SESSIONS_STORE } from '../lib/auth/session';
import { Role } from '@prisma/client';

async function runAccountTestSuite() {
  console.log('--- STARTING CUSTOMER ACCOUNT TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`  [PASS] ${name}`);
        passed++;
      })
      .catch((err) => {
        console.error(`  [FAIL] ${name}:`, err.message || err);
        failed++;
      });
  }

  const testUserId = 'usr-account-test-101';
  const testUserEmail = 'customer.account@snappygiftz.com';

  // Seed session in dev store
  DEV_SESSIONS_STORE.set('dummy-account-token', {
    session: {
      id: 'sess-acc-101',
      sessionToken: 'hash-acc-101',
      userId: testUserId,
      expiresAt: new Date(Date.now() + 86400000),
      ipAddress: '127.0.0.1',
      userAgent: 'TestBrowser',
      createdAt: new Date(),
    },
    user: {
      id: testUserId,
      email: testUserEmail,
      passwordHash: 'dummy-hash',
      name: 'Aditi Rao',
      phone: '9876543210',
      role: Role.CUSTOMER,
      isEmailVerified: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Clean address store for test user
  DEV_ADDRESSES_STORE.delete(testUserId);

  // Test 1: Get Customer Profile
  await test('1. getCustomerProfile returns profile for authenticated user', async () => {
    const profile = await getCustomerProfile(testUserId);
    assert.ok(profile, 'Profile should exist');
    assert.strictEqual(profile?.name, 'Aditi Rao');
    assert.strictEqual(profile?.email, testUserEmail);
    assert.strictEqual(profile?.role, Role.CUSTOMER);
  });

  // Test 2: Update Profile (valid inputs)
  await test('2. updateCustomerProfile updates name and phone correctly', async () => {
    const updated = await updateCustomerProfile(testUserId, {
      name: 'Aditi Sharma Rao',
      phone: '9988776655',
    });
    assert.strictEqual(updated.name, 'Aditi Sharma Rao');
    assert.strictEqual(updated.phone, '9988776655');

    const fresh = await getCustomerProfile(testUserId);
    assert.strictEqual(fresh?.name, 'Aditi Sharma Rao');
    assert.strictEqual(fresh?.phone, '9988776655');
  });

  // Test 3: Update Profile validation (short name)
  await test('3. updateCustomerProfile rejects short name (< 2 characters)', async () => {
    await assert.rejects(
      async () => {
        await updateCustomerProfile(testUserId, { name: 'A' });
      },
      /Name must be at least 2 characters/
    );
  });

  // Test 4: Update Profile validation (invalid phone)
  await test('4. updateCustomerProfile rejects malformed phone number', async () => {
    await assert.rejects(
      async () => {
        await updateCustomerProfile(testUserId, { phone: '1234' });
      },
      /valid 10-digit mobile number/
    );
  });

  // Test 5: Change Password validation (complexity checks)
  await test('5. changeCustomerPassword rejects passwords under 8 characters', async () => {
    await assert.rejects(
      async () => {
        await changeCustomerPassword(testUserId, 'oldPass', 'short1', 'short1');
      },
      /at least 8 characters/i
    );
  });

  // Test 6: Change Password validation (mismatch confirmation)
  await test('6. changeCustomerPassword rejects mismatched password confirmation', async () => {
    await assert.rejects(
      async () => {
        await changeCustomerPassword(testUserId, 'oldPass', 'ValidPass123!', 'DifferentPass123!');
      },
      /New password and confirmation do not match/i
    );
  });

  // Test 7: Address Creation (first address becomes default)
  await test('7. createCustomerAddress creates address and marks first as default', async () => {
    const addr1 = await createCustomerAddress(testUserId, {
      name: 'Aditi Home',
      company: 'Snappy Heights Flat 3B',
      street: 'Plot 44, Jubilee Hills Road 36',
      city: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      pincode: '500033',
      phone: '9988776655',
      isDefault: false, // Should automatically become default if first
    });

    assert.ok(addr1.id, 'Address should have an ID');
    assert.strictEqual(addr1.name, 'Aditi Home');
    assert.strictEqual(addr1.pincode, '500033');
    assert.strictEqual(addr1.isDefault, true);

    const list = await listCustomerAddresses(testUserId);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, addr1.id);
  });

  // Test 8: Address Creation (PIN code validation)
  await test('8. createCustomerAddress rejects invalid 5-digit PIN code', async () => {
    await assert.rejects(
      async () => {
        await createCustomerAddress(testUserId, {
          name: 'Office',
          street: 'HITEC City Phase 2',
          city: 'Hyderabad',
          state: 'Telangana',
          stateCode: '36',
          pincode: '50003', // 5 digits only
          phone: '9988776655',
        });
      },
      /valid 6-digit Indian PIN code/i
    );
  });

  // Test 9: Address Creation (setting second address as default resets first)
  await test('9. createCustomerAddress with isDefault=true sets previous default to false', async () => {
    const addr2 = await createCustomerAddress(testUserId, {
      name: 'Aditi Studio Work',
      street: 'Mindspace Cyberabad IT Park',
      city: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      pincode: '500081',
      phone: '9988776655',
      isDefault: true,
    });

    assert.strictEqual(addr2.isDefault, true);

    const list = await listCustomerAddresses(testUserId);
    assert.strictEqual(list.length, 2);
    const first = list.find((a) => a.id !== addr2.id);
    assert.strictEqual(first?.isDefault, false, 'First address should no longer be default');
    assert.strictEqual(list[0].id, addr2.id, 'Default address should appear first in list');
  });

  // Test 10: Update Address
  await test('10. updateCustomerAddress updates address fields successfully', async () => {
    const list = await listCustomerAddresses(testUserId);
    const target = list[1]; // non-default
    const updated = await updateCustomerAddress(testUserId, target.id, {
      name: 'Aditi Luxury Residence',
      company: 'Villa 12',
    });

    assert.strictEqual(updated.name, 'Aditi Luxury Residence');
    assert.strictEqual(updated.company, 'Villa 12');
  });

  // Test 11: Delete Address
  await test('11. deleteCustomerAddress removes the specified address', async () => {
    const list = await listCustomerAddresses(testUserId);
    assert.strictEqual(list.length, 2);
    const toDelete = list[1].id;

    const success = await deleteCustomerAddress(testUserId, toDelete);
    assert.strictEqual(success, true);

    const freshList = await listCustomerAddresses(testUserId);
    assert.strictEqual(freshList.length, 1);
    assert.ok(!freshList.some((a) => a.id === toDelete));
  });

  // Test 12: Isolation - cannot modify another user's address
  await test('12. cannot modify or delete addresses belonging to another user', async () => {
    const list = await listCustomerAddresses(testUserId);
    const existingAddrId = list[0].id;
    const attackerUserId = 'usr-hacker-999';

    await assert.rejects(
      async () => {
        await updateCustomerAddress(attackerUserId, existingAddrId, { name: 'Hacked' });
      },
      /Address not found/i
    );

    await assert.rejects(
      async () => {
        await deleteCustomerAddress(attackerUserId, existingAddrId);
      },
      /Address not found/i
    );
  });

  console.log(`\nCustomer Account Tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAccountTestSuite().catch((e) => {
  console.error('Fatal Test Error:', e);
  process.exit(1);
});

