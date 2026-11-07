-- Automatic distance-based delivery charges (Admin > Settings > Delivery charges)
CREATE TABLE IF NOT EXISTS `DeliveryFeeSlab` (
    `id` VARCHAR(191) NOT NULL,
    `maxDistanceKm` INTEGER NOT NULL,
    `feePaise` BIGINT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    INDEX `DeliveryFeeSlab_isActive_maxDistanceKm_idx`(`isActive`, `maxDistanceKm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Studio / delivery hub location + delivery radius (single row "default")
CREATE TABLE IF NOT EXISTS `DeliverySettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `hubName` VARCHAR(191) NOT NULL DEFAULT 'SNAPPY GIFTZ Studio',
    `hubAddress` TEXT NOT NULL,
    `hubPincode` VARCHAR(191) NOT NULL,
    `hubLatitude` DOUBLE NOT NULL,
    `hubLongitude` DOUBLE NOT NULL,
    `maxRadiusKm` INTEGER NOT NULL DEFAULT 20,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
