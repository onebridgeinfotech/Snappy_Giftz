import { prisma } from '../src/lib/prisma';
import { googleDriveService, BUSINESS_DRIVE_FOLDERS } from '../src/services/storage/google-drive.service';

async function testBothDatabases() {
  console.log('========================================================');
  console.log('=== 1. VERIFYING HOSTINGER MARIADB DATABASE ===');
  console.log('========================================================');

  try {
    const startTime = Date.now();
    const [productsCount, categoriesCount, ordersCount, usersCount] = await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count(),
      prisma.user.count(),
    ]);
    const duration = Date.now() - startTime;

    console.log(`✅ Hostinger MariaDB Connected successfully in ${duration}ms!`);
    console.log(`   - Products Table: ${productsCount} records`);
    console.log(`   - Categories Table: ${categoriesCount} records`);
    console.log(`   - Orders Table: ${ordersCount} records`);
    console.log(`   - Users Table: ${usersCount} records`);

    // Fetch sample products
    const sampleProducts = await prisma.product.findMany({
      take: 4,
      select: { id: true, name: true, basePricePaise: true, isCustomizable: true, productType: true }
    });
    console.log('\n   Live Products in DB:');
    for (const p of sampleProducts) {
      console.log(`     • [${p.productType}] ${p.name} - ₹${(Number(p.basePricePaise) / 100).toFixed(2)} (Customizable: ${p.isCustomizable})`);
    }

    // Fetch sample users
    const sampleUsers = await prisma.user.findMany({
      take: 4,
      select: { id: true, email: true, role: true, name: true }
    });
    console.log('\n   Live Users in DB:');
    for (const u of sampleUsers) {
      console.log(`     • [${u.role}] ${u.name} (${u.email})`);
    }
  } catch (dbErr: any) {
    console.error('❌ Hostinger MariaDB Connection Failed:', dbErr.message);
  }

  console.log('\n========================================================');
  console.log('=== 2. VERIFYING GOOGLE DRIVE STORAGE & DATABASE ===');
  console.log('========================================================');

  try {
    const creds = googleDriveService.getCredentials();
    console.log('Google Drive OAuth Configuration:');
    console.log(`   - Client ID Configured: ${creds.clientId ? 'YES (' + creds.clientId.slice(0, 15) + '...)' : 'NO'}`);
    console.log(`   - Client Secret Configured: ${creds.clientSecret ? 'YES (' + creds.clientSecret.slice(0, 6) + '...)' : 'NO'}`);
    console.log(`   - Redirect URI: ${creds.redirectUri}`);
    console.log(`   - Developer Key (Picker): ${creds.developerKey ? 'YES' : 'NO'}`);
    console.log(`   - Is Fully Configured: ${creds.isConfigured}`);

    console.log('\nGoogle Drive Target Folders:');
    const folderIds = googleDriveService.getConfiguredFolderIds();
    console.log(`   - Root Folder: ${folderIds.rootFolderId} (${BUSINESS_DRIVE_FOLDERS.root.name})`);
    console.log(`   - Product Images: ${folderIds.productImagesFolderId} (${BUSINESS_DRIVE_FOLDERS.productImages.name})`);
    console.log(`   - Customer Photos: ${folderIds.customerPhotosFolderId} (${BUSINESS_DRIVE_FOLDERS.customerPhotos.name})`);
    console.log(`   - Order Attachments: ${folderIds.orderAttachmentsFolderId} (${BUSINESS_DRIVE_FOLDERS.orderAttachments.name})`);
    console.log(`   - Invoices: ${folderIds.invoicesFolderId} (${BUSINESS_DRIVE_FOLDERS.invoices.name})`);

    const status = await googleDriveService.getConnectionStatus();
    console.log('\nGoogle Drive Connection Status:');
    console.log(`   - isConfigured: ${status.isConfigured}`);
    console.log(`   - isConnected: ${status.isConnected}`);
    console.log(`   - accountEmail: ${status.accountEmail || 'None (Awaiting Admin One-Click OAuth Authorization)'}`);
    console.log(`   - lastSyncedAt: ${status.lastSyncedAt || 'Not yet synced'}`);
    console.log(`   - lastError: ${status.lastError || 'None'}`);

    if (!status.isConnected) {
      console.log('\nℹ️ How to activate Google Drive live connection:');
      console.log('   The OAuth credentials and 5 target folder IDs are 100% configured in .env.');
      console.log('   To complete the OAuth handshake and grant the Google Drive access token:');
      console.log('   1. Open the Admin Portal: http://localhost:3000/admin (or https://snappygiftz.com/admin)');
      console.log('   2. Navigate to "Business Settings" tab');
      console.log('   3. In the Google Drive Cloud Storage card, click "Connect Google Drive with Google OAuth"');
      console.log('   4. Sign in with the Google Account that owns these folders.');
      console.log('   Once authorized, tokens are encrypted with GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY and stored in MariaDB.');
    } else {
      console.log('✅ Google Drive is fully connected and ready for uploads!');
    }
  } catch (driveErr: any) {
    console.error('❌ Google Drive Verification Error:', driveErr.message);
  }
}

testBothDatabases().catch(console.error);
