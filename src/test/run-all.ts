// Ensure local test runs execute in test environment and fail-fast into dev stores when remote DB is offline
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.ALLOW_DEMO_FALLBACK = 'true';
if (!process.env.CI) {
  process.env.DATABASE_URL = 'mysql://127.0.0.1:3306/dev_fallback';
}

import { runTestSuite } from './auth.test';
import { runCatalogTestSuite } from './catalog.test';
import { runStorefrontTestSuite } from './storefront.test';
import { runCheckoutTestSuite } from './checkout.test';
import { runPaymentTestSuite } from './payment.test';
import { runFulfillmentTestSuite } from './fulfillment.test';
import { runPersonalizationTestSuite } from './personalization.test';
import { runInvoicingTestSuite } from './invoicing.test';
import { runCorporateTestSuite } from './corporate.test';
import { runAdminTestSuite } from './admin.test';
import { runSecurityTestSuite } from './security.test';
import { runE2EJourneysTestSuite } from './e2e-journeys.test';
import { runLoginPageTests } from './login-page.test';
import { runPasswordResetTestSuite } from './password-reset.test';
import { runGoogleDriveTestSuite } from './google-drive.test';
import { runAdminPortalTestSuite } from './admin-portal.test';

async function main() {
  console.log('====================================================');
  console.log('   Snappy Gifts — Master Test Verification Suite    ');
  console.log('====================================================\n');

  // Run Auth & RBAC Suite
  const authResults = await runTestSuite();

  // Run Catalog & Inventory Suite
  const catalogResults = await runCatalogTestSuite();

  // Run Storefront & SEO Suite
  const storefrontResults = await runStorefrontTestSuite();

  // Run Checkout & Pricing Suite (Batch 4)
  const checkoutResults = await runCheckoutTestSuite();

  // Run Payment & Razorpay Suite (Batch 5)
  const paymentResults = await runPaymentTestSuite();

  // Run Fulfillment & Tracking Suite (Batch 6)
  const fulfillmentResults = await runFulfillmentTestSuite();

  // Run Personalization & Proofs Suite (Batch 7)
  const personalizationResults = await runPersonalizationTestSuite();

  // Run Invoicing, GST & Emails Suite (Batch 8)
  const invoicingResults = await runInvoicingTestSuite();

  // Run Corporate B2B & RFQ Suite (Batch 9A)
  const corporateResults = await runCorporateTestSuite();

  // Run Admin Dashboard & Ops Suite (Batch 10)
  const adminResults = await runAdminTestSuite();

  // Run Security Audit, QA & Reliability Suite (Batch 11)
  const securityResults = await runSecurityTestSuite();

  // Run E2E User Journeys Suite (Batch 11)
  const e2eResults = await runE2EJourneysTestSuite();

  // Run Customer Login Page & OAuth Architecture Suite
  const loginResults = await runLoginPageTests();

  // Run Forgot Password & Password Reset Suite (Batch 14)
  const passwordResetResults = await runPasswordResetTestSuite();

  // Run Google Drive Integration Suite (Batch 15)
  const googleDriveResults = await runGoogleDriveTestSuite();

  // Run Admin Portal & Logistics Suite (Phase 3)
  const adminPortalResults = await runAdminPortalTestSuite();

  const totalPassed =
    authResults.passed +
    catalogResults.passed +
    storefrontResults.passed +
    checkoutResults.passed +
    paymentResults.passed +
    fulfillmentResults.passed +
    personalizationResults.passed +
    invoicingResults.passed +
    corporateResults.passed +
    adminResults.passed +
    securityResults.passed +
    e2eResults.passed +
    loginResults.passed +
    passwordResetResults.passed +
    googleDriveResults.passed +
    adminPortalResults.passed;

  const totalFailed =
    authResults.failed +
    catalogResults.failed +
    storefrontResults.failed +
    checkoutResults.failed +
    paymentResults.failed +
    fulfillmentResults.failed +
    personalizationResults.failed +
    invoicingResults.failed +
    corporateResults.failed +
    adminResults.failed +
    securityResults.failed +
    e2eResults.failed +
    loginResults.failed +
    passwordResetResults.failed +
    googleDriveResults.failed +
    adminPortalResults.failed;

  console.log('====================================================');
  console.log('            MASTER TEST EXECUTION SUMMARY           ');
  console.log('====================================================');
  console.log(`  1. Auth & RBAC Suite:         ${authResults.passed} passed, ${authResults.failed} failed`);
  console.log(`  2. Catalog & Inventory Suite: ${catalogResults.passed} passed, ${catalogResults.failed} failed`);
  console.log(`  3. Storefront & SEO Suite:    ${storefrontResults.passed} passed, ${storefrontResults.failed} failed`);
  console.log(`  4. Checkout & Pricing Suite:  ${checkoutResults.passed} passed, ${checkoutResults.failed} failed`);
  console.log(`  5. Payment & Gateway Suite:   ${paymentResults.passed} passed, ${paymentResults.failed} failed`);
  console.log(`  6. Fulfillment & Tracking:    ${fulfillmentResults.passed} passed, ${fulfillmentResults.failed} failed`);
  console.log(`  7. Personalization & Proofs:  ${personalizationResults.passed} passed, ${personalizationResults.failed} failed`);
  console.log(`  8. GST Invoices & Emails:     ${invoicingResults.passed} passed, ${invoicingResults.failed} failed`);
  console.log(`  9. Corporate B2B & RFQ (9A):  ${corporateResults.passed} passed, ${corporateResults.failed} failed`);
  console.log(` 10. Admin & Business Ops (10): ${adminResults.passed} passed, ${adminResults.failed} failed`);
  console.log(` 11. Security Audit & QA (11):  ${securityResults.passed} passed, ${securityResults.failed} failed`);
  console.log(` 12. E2E User Journeys (11):   ${e2eResults.passed} passed, ${e2eResults.failed} failed`);
  console.log(` 13. Customer Login & OAuth:    ${loginResults.passed} passed, ${loginResults.failed} failed`);
  console.log(` 14. Password Reset & OTP (14): ${passwordResetResults.passed} passed, ${passwordResetResults.failed} failed`);
  console.log(` 15. Google Drive Cloud Storage:${googleDriveResults.passed} passed, ${googleDriveResults.failed} failed`);
  console.log(` 16. Admin Portal & Logistics:  ${adminPortalResults.passed} passed, ${adminPortalResults.failed} failed`);
  console.log('----------------------------------------------------');
  console.log(`  TOTAL VERIFIED TESTS:         ${totalPassed} passed, ${totalFailed} failed`);
  console.log('====================================================\n');

  if (totalFailed > 0) {
    throw new Error(`Master test verification failed: ${totalFailed} test(s) failed.`);
  }

  console.log(`✨ All test suites completed successfully with ${totalPassed} passed and 0 failures!\n`);
}

main().catch((err) => {
  console.error('\n❌ Test suite failed:', err.message);
  process.exit(1);
});
