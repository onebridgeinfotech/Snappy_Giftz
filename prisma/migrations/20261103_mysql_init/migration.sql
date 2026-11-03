-- SNAPPY GIFTZ — MySQL 8+ Initial Schema Migration
-- Migration Name: 20261103_mysql_init
-- Target: Hostinger / MySQL 8.0+
-- Invariant: Zero floating-point currency. All monetary fields are BIGINT or INT paise.

-- Disable foreign key checks during table creation
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NULL,
  `role` ENUM('CUSTOMER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  `isEmailVerified` BOOLEAN NOT NULL DEFAULT FALSE,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`),
  KEY `User_role_idx` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Session` (
  `id` VARCHAR(191) NOT NULL,
  `sessionToken` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `ipAddress` VARCHAR(191) NULL,
  `userAgent` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Session_sessionToken_key` (`sessionToken`),
  KEY `Session_userId_idx` (`userId`),
  CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OtpChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `otpHash` VARCHAR(191) NOT NULL,
  `purpose` VARCHAR(191) NOT NULL DEFAULT 'LOGIN',
  `attempts` INT NOT NULL DEFAULT 0,
  `maxAttempts` INT NOT NULL DEFAULT 3,
  `isUsed` BOOLEAN NOT NULL DEFAULT FALSE,
  `expiresAt` DATETIME(3) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `OtpChallenge_email_idx` (`email`),
  KEY `OtpChallenge_email_purpose_isUsed_idx` (`email`, `purpose`, `isUsed`),
  KEY `OtpChallenge_userId_idx` (`userId`),
  CONSTRAINT `OtpChallenge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Address` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `company` VARCHAR(191) NULL,
  `street` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL,
  `stateCode` VARCHAR(191) NOT NULL,
  `pincode` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Address_userId_idx` (`userId`),
  KEY `Address_pincode_idx` (`pincode`),
  CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Catalog & Products
CREATE TABLE IF NOT EXISTS `Category` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `imageUrl` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Category_name_key` (`name`),
  UNIQUE KEY `Category_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Product` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `tagline` VARCHAR(191) NULL,
  `description` TEXT NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `productType` VARCHAR(191) NOT NULL DEFAULT 'REGULAR',
  `occasions` JSON NULL,
  `recipients` JSON NULL,
  `hsnCode` VARCHAR(191) NOT NULL,
  `taxRatePercent` INT NOT NULL DEFAULT 18,
  `isTaxInclusive` BOOLEAN NOT NULL DEFAULT FALSE,
  `basePricePaise` INT NOT NULL,
  `mrpPaise` INT NOT NULL,
  `costPricePaise` INT NULL,
  `isCustomizable` BOOLEAN NOT NULL DEFAULT FALSE,
  `customizationType` VARCHAR(191) NULL,
  `customizationFeePaise` INT NOT NULL DEFAULT 0,
  `customizationConfig` JSON NULL,
  `minOrderQty` INT NOT NULL DEFAULT 1,
  `images` JSON NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `isArchived` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Product_slug_key` (`slug`),
  KEY `Product_categoryId_idx` (`categoryId`),
  KEY `Product_productType_idx` (`productType`),
  KEY `Product_isActive_idx` (`isActive`),
  CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Occasion` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `imageUrl` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Occasion_name_key` (`name`),
  UNIQUE KEY `Occasion_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProductOccasion` (
  `productId` VARCHAR(191) NOT NULL,
  `occasionId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`productId`, `occasionId`),
  KEY `ProductOccasion_occasionId_idx` (`occasionId`),
  KEY `ProductOccasion_productId_idx` (`productId`),
  CONSTRAINT `ProductOccasion_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ProductOccasion_occasionId_fkey` FOREIGN KEY (`occasionId`) REFERENCES `Occasion` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProductImage` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `url` VARCHAR(191) NOT NULL,
  `altText` VARCHAR(191) NULL,
  `displayOrder` INT NOT NULL DEFAULT 0,
  `isPrimary` BOOLEAN NOT NULL DEFAULT FALSE,
  `storageKey` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ProductImage_productId_idx` (`productId`),
  KEY `ProductImage_productId_displayOrder_idx` (`productId`, `displayOrder`),
  CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProductVariant` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `attributes` JSON NOT NULL,
  `pricePaise` INT NOT NULL,
  `stockQuantity` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `isArchived` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ProductVariant_sku_key` (`sku`),
  KEY `ProductVariant_productId_idx` (`productId`),
  CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InventoryAdjustment` (
  `id` VARCHAR(191) NOT NULL,
  `variantId` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NOT NULL,
  `productName` VARCHAR(191) NULL,
  `previousStock` INT NOT NULL,
  `adjustedQty` INT NOT NULL,
  `newStock` INT NOT NULL,
  `reason` ENUM('RESTOCK', 'MANUAL_CORRECTION', 'DAMAGE_WRITE_OFF', 'RETURN_RESTOCK', 'ORDER_RESERVATION', 'RESERVATION_EXPIRED', 'ORDER_FULFILLMENT', 'AUDIT_RECONCILIATION') NOT NULL DEFAULT 'MANUAL_CORRECTION',
  `referenceId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `InventoryAdjustment_variantId_idx` (`variantId`),
  KEY `InventoryAdjustment_createdAt_idx` (`createdAt`),
  KEY `InventoryAdjustment_reason_idx` (`reason`),
  KEY `InventoryAdjustment_userId_idx` (`userId`),
  CONSTRAINT `InventoryAdjustment_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `InventoryAdjustment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BulkTier` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `minQty` INT NOT NULL,
  `maxQty` INT NULL,
  `discountPercentage` INT NOT NULL,
  `pricePerUnitPaise` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `BulkTier_productId_idx` (`productId`),
  CONSTRAINT `BulkTier_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Persistent Cart System
CREATE TABLE IF NOT EXISTS `Cart` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `sessionToken` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Cart_sessionToken_key` (`sessionToken`),
  KEY `Cart_userId_idx` (`userId`),
  CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CartItem` (
  `id` VARCHAR(191) NOT NULL,
  `cartId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `variantId` VARCHAR(191) NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `isCustomized` BOOLEAN NOT NULL DEFAULT FALSE,
  `customizationData` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `CartItem_cartId_idx` (`cartId`),
  KEY `CartItem_productId_idx` (`productId`),
  KEY `CartItem_variantId_idx` (`variantId`),
  CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart` (`id`) ON DELETE CASCADE,
  CONSTRAINT `CartItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE,
  CONSTRAINT `CartItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Orders, Payments, COD & Hyderabad Delivery
CREATE TABLE IF NOT EXISTS `Order` (
  `id` VARCHAR(191) NOT NULL,
  `orderNumber` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `customerName` VARCHAR(191) NOT NULL,
  `customerEmail` VARCHAR(191) NOT NULL,
  `customerPhone` VARCHAR(191) NOT NULL,
  `gstin` VARCHAR(191) NULL,
  `shippingAddress` JSON NOT NULL,
  `destinationStateCode` VARCHAR(191) NOT NULL,
  `itemsSubtotalPaise` BIGINT NOT NULL,
  `customizationTotalPaise` BIGINT NOT NULL DEFAULT 0,
  `discountTotalPaise` BIGINT NOT NULL DEFAULT 0,
  `taxableAmountPaise` BIGINT NOT NULL,
  `taxTotalPaise` BIGINT NOT NULL,
  `cgstPaise` BIGINT NOT NULL DEFAULT 0,
  `sgstPaise` BIGINT NOT NULL DEFAULT 0,
  `igstPaise` BIGINT NOT NULL DEFAULT 0,
  `shippingTotalPaise` BIGINT NOT NULL DEFAULT 0,
  `grandTotalPaise` BIGINT NOT NULL,
  `orderStatus` ENUM('PENDING', 'PENDING_PAYMENT', 'PENDING_COD_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'IN_CUSTOMIZATION', 'QUALITY_CHECK', 'OUT_FOR_DELIVERY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  `paymentStatus` ENUM('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
  `paymentMethod` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `reservationExpiresAt` DATETIME(3) NULL,
  `guestLookupToken` VARCHAR(191) NULL,
  `fulfillmentMethod` VARCHAR(191) NOT NULL DEFAULT 'DELIVERY',
  `shippingPincode` VARCHAR(191) NULL,
  `deliveryFeeRuleId` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `cancellationReason` TEXT NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledBy` VARCHAR(191) NULL,
  `pickupOtpHash` VARCHAR(191) NULL,
  `pickupOtpExpiresAt` DATETIME(3) NULL,
  `pickupVerifiedAt` DATETIME(3) NULL,
  `pickupVerifiedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Order_orderNumber_key` (`orderNumber`),
  UNIQUE KEY `Order_idempotencyKey_key` (`idempotencyKey`),
  KEY `Order_customerEmail_idx` (`customerEmail`),
  KEY `Order_customerPhone_idx` (`customerPhone`),
  KEY `Order_orderStatus_idx` (`orderStatus`),
  KEY `Order_paymentStatus_idx` (`paymentStatus`),
  KEY `Order_reservationExpiresAt_idx` (`reservationExpiresAt`),
  KEY `Order_shippingPincode_idx` (`shippingPincode`),
  KEY `Order_userId_idx` (`userId`),
  CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OrderItem` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `variantId` VARCHAR(191) NULL,
  `productName` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NOT NULL,
  `hsnCode` VARCHAR(191) NOT NULL,
  `taxRatePercent` INT NOT NULL,
  `unitPricePaise` INT NOT NULL,
  `quantity` INT NOT NULL,
  `subtotalPaise` BIGINT NOT NULL,
  `isCustomized` BOOLEAN NOT NULL DEFAULT FALSE,
  `customizationNote` TEXT NULL,
  `customizationFeePaise` INT NOT NULL DEFAULT 0,
  `proofImageUrl` VARCHAR(191) NULL,
  `customizationMeta` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `OrderItem_orderId_idx` (`orderId`),
  KEY `OrderItem_variantId_idx` (`variantId`),
  CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE,
  CONSTRAINT `OrderItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Payment` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `gateway` VARCHAR(191) NOT NULL,
  `gatewayOrderId` VARCHAR(191) NOT NULL,
  `gatewayPaymentId` VARCHAR(191) NULL,
  `gatewaySignature` VARCHAR(191) NULL,
  `amountPaise` BIGINT NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  `status` ENUM('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
  `capturedAt` DATETIME(3) NULL,
  `errorMessage` TEXT NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `rawEventPayload` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Payment_idempotencyKey_key` (`idempotencyKey`),
  KEY `Payment_orderId_idx` (`orderId`),
  KEY `Payment_gatewayOrderId_idx` (`gatewayOrderId`),
  KEY `Payment_gatewayPaymentId_idx` (`gatewayPaymentId`),
  KEY `Payment_status_idx` (`status`),
  CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WebhookEvent` (
  `id` VARCHAR(191) NOT NULL,
  `gateway` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `payloadHash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PROCESSED',
  `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `WebhookEvent_eventId_key` (`eventId`),
  KEY `WebhookEvent_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PaymentReconciliation` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `orderNumber` VARCHAR(191) NULL,
  `gatewayPaymentId` VARCHAR(191) NOT NULL,
  `gatewayOrderId` VARCHAR(191) NULL,
  `expectedAmountPaise` BIGINT NULL,
  `receivedAmountPaise` BIGINT NOT NULL,
  `discrepancyType` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
  `notes` TEXT NULL,
  `rawEvent` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `PaymentReconciliation_gatewayPaymentId_idx` (`gatewayPaymentId`),
  KEY `PaymentReconciliation_orderNumber_idx` (`orderNumber`),
  KEY `PaymentReconciliation_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CodCollectionRecord` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `amountCollectedPaise` BIGINT NOT NULL,
  `collectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `collectedBy` VARCHAR(191) NOT NULL,
  `collectionMethod` VARCHAR(191) NOT NULL DEFAULT 'CASH',
  `receiptNumber` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `CodCollectionRecord_orderId_key` (`orderId`),
  KEY `CodCollectionRecord_collectedAt_idx` (`collectedAt`),
  CONSTRAINT `CodCollectionRecord_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RefundRecord` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `paymentId` VARCHAR(191) NULL,
  `amountPaise` BIGINT NOT NULL,
  `reason` TEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `gatewayRefundId` VARCHAR(191) NULL,
  `processedBy` VARCHAR(191) NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `failureReason` TEXT NULL,
  `rawResponse` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `RefundRecord_idempotencyKey_key` (`idempotencyKey`),
  KEY `RefundRecord_orderId_idx` (`orderId`),
  KEY `RefundRecord_paymentId_idx` (`paymentId`),
  KEY `RefundRecord_gatewayRefundId_idx` (`gatewayRefundId`),
  KEY `RefundRecord_status_idx` (`status`),
  CONSTRAINT `RefundRecord_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE,
  CONSTRAINT `RefundRecord_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Hyderabad Delivery System
CREATE TABLE IF NOT EXISTS `DeliveryZone` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL DEFAULT 'Hyderabad',
  `state` VARCHAR(191) NOT NULL DEFAULT 'Telangana',
  `stateCode` VARCHAR(191) NOT NULL DEFAULT '36',
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DeliveryZone_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ServiceablePincode` (
  `id` VARCHAR(191) NOT NULL,
  `pincode` VARCHAR(191) NOT NULL,
  `areaName` VARCHAR(191) NULL,
  `city` VARCHAR(191) NOT NULL DEFAULT 'Hyderabad',
  `state` VARCHAR(191) NOT NULL DEFAULT 'Telangana',
  `stateCode` VARCHAR(191) NOT NULL DEFAULT '36',
  `zoneId` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `deliveryDays` INT NOT NULL DEFAULT 1,
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ServiceablePincode_pincode_key` (`pincode`),
  KEY `ServiceablePincode_zoneId_idx` (`zoneId`),
  KEY `ServiceablePincode_isActive_idx` (`isActive`),
  CONSTRAINT `ServiceablePincode_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `DeliveryZone` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DeliveryFeeRule` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `minOrderAmountPaise` BIGINT NOT NULL DEFAULT 0,
  `maxOrderAmountPaise` BIGINT NULL,
  `feePaise` BIGINT NOT NULL DEFAULT 0,
  `priority` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `DeliveryFeeRule_isActive_priority_idx` (`isActive`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DeliveryRecord` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `assignedPerson` VARCHAR(191) NULL,
  `assignedPhone` VARCHAR(191) NULL,
  `deliveryStatus` VARCHAR(191) NOT NULL DEFAULT 'ASSIGNED',
  `deliveryNotes` TEXT NULL,
  `startedAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `recipientName` VARCHAR(191) NULL,
  `recipientPhone` VARCHAR(191) NULL,
  `codAmountDuePaise` BIGINT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DeliveryRecord_orderId_key` (`orderId`),
  KEY `DeliveryRecord_deliveryStatus_idx` (`deliveryStatus`),
  CONSTRAINT `DeliveryRecord_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Shipment` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `recipientName` VARCHAR(191) NOT NULL,
  `recipientEmail` VARCHAR(191) NULL,
  `recipientPhone` VARCHAR(191) NOT NULL,
  `addressStreet` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL,
  `pincode` VARCHAR(191) NOT NULL,
  `carrierPartner` VARCHAR(191) NULL,
  `awbNumber` VARCHAR(191) NULL,
  `trackingUrl` VARCHAR(191) NULL,
  `dispatchStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `dispatchedAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `invoicePhysicallySignedBy` VARCHAR(191) NULL,
  `invoicePhysicallySignedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Shipment_awbNumber_key` (`awbNumber`),
  KEY `Shipment_orderId_idx` (`orderId`),
  CONSTRAINT `Shipment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OrderStatusHistory` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('PENDING', 'PENDING_PAYMENT', 'PENDING_COD_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'IN_CUSTOMIZATION', 'QUALITY_CHECK', 'OUT_FOR_DELIVERY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'EXPIRED') NOT NULL,
  `toStatus` ENUM('PENDING', 'PENDING_PAYMENT', 'PENDING_COD_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'IN_CUSTOMIZATION', 'QUALITY_CHECK', 'OUT_FOR_DELIVERY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'EXPIRED') NOT NULL,
  `changedBy` VARCHAR(191) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `OrderStatusHistory_orderId_idx` (`orderId`),
  CONSTRAINT `OrderStatusHistory_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `resource` VARCHAR(191) NOT NULL,
  `details` JSON NULL,
  `ipAddress` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AuditLog_userId_idx` (`userId`),
  KEY `AuditLog_action_idx` (`action`),
  KEY `AuditLog_createdAt_idx` (`createdAt`),
  CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Customization & Artwork Uploads (Private Storage)
CREATE TABLE IF NOT EXISTS `ArtworkUpload` (
  `id` VARCHAR(191) NOT NULL,
  `fileKey` VARCHAR(191) NOT NULL,
  `originalFilename` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `sizeBytes` INT NOT NULL,
  `fileHash` VARCHAR(191) NULL,
  `storageFolder` VARCHAR(191) NOT NULL DEFAULT 'customizations',
  `cartItemId` VARCHAR(191) NULL,
  `orderItemId` VARCHAR(191) NULL,
  `uploadedByUserId` VARCHAR(191) NULL,
  `guestSessionToken` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ArtworkUpload_fileKey_key` (`fileKey`),
  KEY `ArtworkUpload_cartItemId_idx` (`cartItemId`),
  KEY `ArtworkUpload_orderItemId_idx` (`orderItemId`),
  KEY `ArtworkUpload_uploadedByUserId_idx` (`uploadedByUserId`),
  KEY `ArtworkUpload_guestSessionToken_idx` (`guestSessionToken`),
  KEY `ArtworkUpload_status_idx` (`status`),
  CONSTRAINT `ArtworkUpload_cartItemId_fkey` FOREIGN KEY (`cartItemId`) REFERENCES `CartItem` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ArtworkUpload_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ArtworkUpload_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OrderPersonalization` (
  `id` VARCHAR(191) NOT NULL,
  `orderItemId` VARCHAR(191) NOT NULL,
  `personalizationType` VARCHAR(191) NOT NULL DEFAULT 'TEXT_ENGRAVING',
  `engravedText` VARCHAR(191) NULL,
  `fontFamily` VARCHAR(191) NULL,
  `giftNote` VARCHAR(191) NULL,
  `ribbonColor` VARCHAR(191) NULL,
  `boxWrapStyle` VARCHAR(191) NULL,
  `waxSealColor` VARCHAR(191) NULL,
  `artworkUploadId` VARCHAR(191) NULL,
  `cropSettings` JSON NULL,
  `placementSettings` JSON NULL,
  `proofImageUrl` VARCHAR(191) NULL,
  `proofAssetKey` VARCHAR(191) NULL,
  `proofVersion` INT NOT NULL DEFAULT 1,
  `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'APPROVED_BY_CUSTOMER',
  `approvedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `customerApprovalStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `customerApprovedAt` DATETIME(3) NULL,
  `customerApprovedBy` VARCHAR(191) NULL,
  `staffReviewStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING_REVIEW',
  `staffReviewedAt` DATETIME(3) NULL,
  `staffReviewedBy` VARCHAR(191) NULL,
  `customizationFeePaise` INT NOT NULL DEFAULT 0,
  `staffNotes` TEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `OrderPersonalization_orderItemId_key` (`orderItemId`),
  KEY `OrderPersonalization_artworkUploadId_idx` (`artworkUploadId`),
  KEY `OrderPersonalization_approvalStatus_idx` (`approvalStatus`),
  KEY `OrderPersonalization_customerApprovalStatus_idx` (`customerApprovalStatus`),
  KEY `OrderPersonalization_staffReviewStatus_idx` (`staffReviewStatus`),
  CONSTRAINT `OrderPersonalization_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem` (`id`) ON DELETE CASCADE,
  CONSTRAINT `OrderPersonalization_artworkUploadId_fkey` FOREIGN KEY (`artworkUploadId`) REFERENCES `ArtworkUpload` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Invoicing & Sequences
CREATE TABLE IF NOT EXISTS `Invoice` (
  `id` VARCHAR(191) NOT NULL,
  `invoiceNumber` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `orderNumber` VARCHAR(191) NOT NULL,
  `invoiceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `financialYear` VARCHAR(191) NOT NULL,
  `series` VARCHAR(191) NOT NULL DEFAULT 'SG',
  `sequenceNumber` INT NOT NULL,
  `supplierLegalName` VARCHAR(191) NOT NULL,
  `supplierTradeName` VARCHAR(191) NULL,
  `supplierGstin` VARCHAR(191) NOT NULL,
  `supplierAddress` JSON NOT NULL,
  `supplierState` VARCHAR(191) NOT NULL,
  `supplierStateCode` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(191) NOT NULL,
  `customerEmail` VARCHAR(191) NOT NULL,
  `customerPhone` VARCHAR(191) NULL,
  `customerGstin` VARCHAR(191) NULL,
  `billingAddress` JSON NOT NULL,
  `shippingAddress` JSON NOT NULL,
  `placeOfSupply` VARCHAR(191) NOT NULL,
  `placeOfSupplyStateCode` VARCHAR(191) NOT NULL,
  `isIntraState` BOOLEAN NOT NULL,
  `itemsSubtotalPaise` BIGINT NOT NULL,
  `customizationTotalPaise` BIGINT NOT NULL DEFAULT 0,
  `discountTotalPaise` BIGINT NOT NULL DEFAULT 0,
  `taxableAmountPaise` BIGINT NOT NULL,
  `cgstPaise` BIGINT NOT NULL DEFAULT 0,
  `sgstPaise` BIGINT NOT NULL DEFAULT 0,
  `igstPaise` BIGINT NOT NULL DEFAULT 0,
  `taxTotalPaise` BIGINT NOT NULL,
  `shippingTotalPaise` BIGINT NOT NULL DEFAULT 0,
  `grandTotalPaise` BIGINT NOT NULL,
  `itemsJson` JSON NOT NULL,
  `pdfStorageKey` VARCHAR(191) NULL,
  `pdfGeneratedAt` DATETIME(3) NULL,
  `isSample` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ISSUED',
  `eInvoiceStatus` VARCHAR(191) NOT NULL DEFAULT 'EXEMPT_BELOW_THRESHOLD',
  `irn` VARCHAR(191) NULL,
  `signedQrData` TEXT NULL,
  `rule46Declaration` TEXT NULL,
  `signatureMode` VARCHAR(191) NOT NULL DEFAULT 'PHYSICAL_SIGNATURE_ON_PRINT',
  `physicalSignatureConfirmedBy` VARCHAR(191) NULL,
  `physicalSignatureConfirmedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Invoice_invoiceNumber_key` (`invoiceNumber`),
  UNIQUE KEY `Invoice_financialYear_series_sequenceNumber_key` (`financialYear`, `series`, `sequenceNumber`),
  KEY `Invoice_orderId_idx` (`orderId`),
  KEY `Invoice_orderNumber_idx` (`orderNumber`),
  KEY `Invoice_financialYear_idx` (`financialYear`),
  CONSTRAINT `Invoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InvoiceSequence` (
  `id` VARCHAR(191) NOT NULL,
  `financialYear` VARCHAR(191) NOT NULL,
  `series` VARCHAR(191) NOT NULL DEFAULT 'SG',
  `currentSequence` INT NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `InvoiceSequence_financialYear_series_key` (`financialYear`, `series`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Email Outbox & Settings
CREATE TABLE IF NOT EXISTS `EmailOutbox` (
  `id` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `orderNumber` VARCHAR(191) NULL,
  `recipientEmail` VARCHAR(191) NOT NULL,
  `recipientName` VARCHAR(191) NULL,
  `subject` VARCHAR(191) NOT NULL,
  `htmlBody` TEXT NOT NULL,
  `textBody` TEXT NULL,
  `attachmentKey` VARCHAR(191) NULL,
  `attachmentFilename` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `attempts` INT NOT NULL DEFAULT 0,
  `maxAttempts` INT NOT NULL DEFAULT 5,
  `lastError` TEXT NULL,
  `nextRetryAt` DATETIME(3) NULL,
  `lockedAt` DATETIME(3) NULL,
  `lockedBy` VARCHAR(191) NULL,
  `sentAt` DATETIME(3) NULL,
  `messageId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `EmailOutbox_idempotencyKey_key` (`idempotencyKey`),
  KEY `EmailOutbox_status_nextRetryAt_idx` (`status`, `nextRetryAt`),
  KEY `EmailOutbox_orderNumber_idx` (`orderNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SellerConfig` (
  `id` VARCHAR(191) NOT NULL DEFAULT 'default',
  `legalName` VARCHAR(191) NOT NULL,
  `tradeName` VARCHAR(191) NULL,
  `gstin` VARCHAR(191) NOT NULL,
  `pan` VARCHAR(191) NULL,
  `registeredStreet` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL DEFAULT 'Telangana',
  `stateCode` VARCHAR(191) NOT NULL DEFAULT '36',
  `pincode` VARCHAR(191) NOT NULL,
  `contactEmail` VARCHAR(191) NOT NULL,
  `contactPhone` VARCHAR(191) NOT NULL,
  `invoicePrefix` VARCHAR(191) NOT NULL DEFAULT 'SG',
  `authorizedSignatoryName` VARCHAR(191) NULL,
  `authorizedSignatoryDesignation` VARCHAR(191) NULL,
  `invoiceFooterTerms` TEXT NULL,
  `isVerified` BOOLEAN NOT NULL DEFAULT FALSE,
  `eInvoiceStatus` VARCHAR(191) NOT NULL DEFAULT 'EXEMPT_BELOW_THRESHOLD',
  `eInvoiceExemptionReason` VARCHAR(191) NULL,
  `eInvoiceConfirmedBy` VARCHAR(191) NULL,
  `eInvoiceConfirmedAt` DATETIME(3) NULL,
  `panAggregateTurnoverExceeds5Cr` BOOLEAN NOT NULL DEFAULT FALSE,
  `signatureMode` VARCHAR(191) NOT NULL DEFAULT 'PHYSICAL_SIGNATURE_ON_PRINT',
  `digitalSignatureConfigured` BOOLEAN NOT NULL DEFAULT FALSE,
  `electronicInvoiceSignatureExemptionConfirmed` BOOLEAN NOT NULL DEFAULT FALSE,
  `electronicInvoiceExemptionConfirmedBy` VARCHAR(191) NULL,
  `electronicInvoiceExemptionConfirmedAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `updatedBy` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `StoreConfig` (
  `id` VARCHAR(191) NOT NULL DEFAULT 'default',
  `storeName` VARCHAR(191) NOT NULL DEFAULT 'SNAPPY GIFTZ',
  `supportEmail` VARCHAR(191) NOT NULL DEFAULT 'support@snappygiftz.com',
  `supportPhone` VARCHAR(191) NOT NULL DEFAULT '+91 90000 00000',
  `operatingHours` VARCHAR(191) NOT NULL DEFAULT 'Mon-Sat 10:00 AM - 8:00 PM IST',
  `headquartersAddress` VARCHAR(191) NOT NULL DEFAULT 'Hyderabad, Telangana - 500001',
  `standardShippingFeePaise` BIGINT NOT NULL DEFAULT 9900,
  `freeShippingThresholdPaise` BIGINT NOT NULL DEFAULT 99900,
  `expressShippingFeePaise` BIGINT NOT NULL DEFAULT 19900,
  `shippingInstructions` TEXT NULL,
  `lowStockThreshold` INT NOT NULL DEFAULT 10,
  `outOfStockThreshold` INT NOT NULL DEFAULT 0,
  `autoNotifyLowStock` BOOLEAN NOT NULL DEFAULT TRUE,
  `allowCustomText` BOOLEAN NOT NULL DEFAULT TRUE,
  `allowArtworkUpload` BOOLEAN NOT NULL DEFAULT TRUE,
  `maxArtworkUploadBytes` INT NOT NULL DEFAULT 10485760,
  `woodenCrateSurchargePaise` BIGINT NOT NULL DEFAULT 15000,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `updatedBy` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

