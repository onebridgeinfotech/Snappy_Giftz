import { prisma } from '../src/lib/prisma';

async function createGoogleDriveTable() {
  console.log('Creating GoogleDriveIntegration table in Hostinger MariaDB...');
  const sql = `
    CREATE TABLE IF NOT EXISTS \`GoogleDriveIntegration\` (
      \`id\` VARCHAR(191) NOT NULL DEFAULT 'default',
      \`isConnected\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`accountEmail\` VARCHAR(191) NULL,
      \`encryptedRefreshToken\` TEXT NULL,
      \`encryptedAccessToken\` TEXT NULL,
      \`accessTokenExpiresAt\` DATETIME(3) NULL,
      \`rootFolderId\` VARCHAR(191) NULL,
      \`productImagesFolderId\` VARCHAR(191) NULL,
      \`customerPhotosFolderId\` VARCHAR(191) NULL,
      \`orderAttachmentsFolderId\` VARCHAR(191) NULL,
      \`invoicesFolderId\` VARCHAR(191) NULL,
      \`connectedBy\` VARCHAR(191) NULL,
      \`connectedAt\` DATETIME(3) NULL,
      \`lastSyncedAt\` DATETIME(3) NULL,
      \`lastError\` TEXT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `;

  await prisma.$executeRawUnsafe(sql);
  console.log('✅ GoogleDriveIntegration table created successfully!');

  // Verify
  const record = await prisma.googleDriveIntegration.findUnique({
    where: { id: 'default' }
  });
  console.log('Verified table query via Prisma! Record exists:', Boolean(record));
}

createGoogleDriveTable().catch(console.error);

