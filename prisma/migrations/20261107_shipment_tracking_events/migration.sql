-- Courier tracking timeline (Shiprocket / courier webhook pushes)
CREATE TABLE `ShipmentTrackingEvent` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `awbNumber` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `rawStatus` VARCHAR(191) NULL,
    `activity` TEXT NULL,
    `location` VARCHAR(191) NULL,
    `eventAt` DATETIME(3) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'COURIER_WEBHOOK',
    `dedupeKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ShipmentTrackingEvent_dedupeKey_key`(`dedupeKey`),
    INDEX `ShipmentTrackingEvent_orderId_eventAt_idx`(`orderId`, `eventAt`),
    INDEX `ShipmentTrackingEvent_awbNumber_idx`(`awbNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ShipmentTrackingEvent` ADD CONSTRAINT `ShipmentTrackingEvent_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
