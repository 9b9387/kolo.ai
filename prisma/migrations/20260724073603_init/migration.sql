-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `image` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ipAddress` TEXT NULL,
    `userAgent` TEXT NULL,
    `userId` VARCHAR(191) NOT NULL,

    INDEX `session_userId_idx`(`userId`(191)),
    UNIQUE INDEX `session_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` TEXT NOT NULL,
    `providerId` TEXT NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `idToken` TEXT NULL,
    `accessTokenExpiresAt` DATETIME(3) NULL,
    `refreshTokenExpiresAt` DATETIME(3) NULL,
    `scope` TEXT NULL,
    `password` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `account_userId_idx`(`userId`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` TEXT NOT NULL,
    `value` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `verification_identifier_idx`(`identifier`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personal_access_token` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `lastFour` CHAR(4) NOT NULL,
    `scopes` JSON NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `personal_access_token_tokenHash_key`(`tokenHash`),
    INDEX `personal_access_token_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_profile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sex` ENUM('male', 'female', 'other') NULL,
    `calcAs` ENUM('male', 'female', 'average') NULL,
    `birthDate` DATE NULL,
    `heightCm` DECIMAL(4, 1) NULL,
    `activityLevel` ENUM('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active') NULL,
    `customActivityFactor` DECIMAL(3, 2) NULL,
    `timezone` VARCHAR(40) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_profile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `goalType` ENUM('fat_loss', 'muscle_gain', 'maintenance', 'recomposition', 'performance', 'health') NOT NULL,
    `targetWeightKg` DECIMAL(5, 2) NULL,
    `weeklyRateKg` DECIMAL(4, 2) NULL,
    `targetDate` DATE NULL,
    `dailyCalorieTarget` INTEGER NULL,
    `proteinTargetG` DECIMAL(6, 1) NULL,
    `carbTargetG` DECIMAL(6, 1) NULL,
    `fatTargetG` DECIMAL(6, 1) NULL,
    `fiberTargetG` DECIMAL(6, 1) NULL,
    `waterTargetMl` INTEGER NULL,
    `rationale` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `goal_userId_isActive_idx`(`userId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dietary_preference` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `dietType` ENUM('omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'lacto_ovo_vegetarian', 'lacto_vegetarian', 'ovo_vegetarian', 'vegan') NULL,
    `religiousDiets` JSON NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dietary_preference_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_allergen` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `allergen` VARCHAR(64) NOT NULL,
    `severity` ENUM('allergy', 'intolerance', 'avoid') NOT NULL DEFAULT 'allergy',
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_allergen_userId_allergen_key`(`userId`, `allergen`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `preference_tag` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('like', 'dislike', 'avoid_ingredient', 'cuisine', 'texture', 'other') NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `preference_tag_userId_kind_label_key`(`userId`, `kind`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `body_metric` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `metricType` VARCHAR(32) NOT NULL,
    `value` DECIMAL(7, 2) NOT NULL,
    `measuredAt` DATETIME(3) NOT NULL,
    `measuredDate` DATE NOT NULL,
    `source` ENUM('manual', 'smart_scale', 'agent', 'import') NOT NULL DEFAULT 'agent',
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `body_metric_userId_metricType_measuredAt_idx`(`userId`, `metricType`, `measuredAt` DESC),
    UNIQUE INDEX `body_metric_userId_metricType_measuredDate_key`(`userId`, `metricType`, `measuredDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_source` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `license` VARCHAR(64) NOT NULL,
    `licenseUrl` VARCHAR(255) NULL,
    `attributionText` TEXT NOT NULL,
    `attributionUrl` VARCHAR(255) NULL,
    `requiresShareAlike` BOOLEAN NOT NULL DEFAULT false,
    `redistributable` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `data_source_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_run` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sourceCode` VARCHAR(32) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `datasetVersion` VARCHAR(128) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'running',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `stats` JSON NULL,
    `notes` TEXT NULL,

    INDEX `import_run_sourceCode_status_idx`(`sourceCode`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `food` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sourceId` INTEGER NOT NULL,
    `sourceKey` VARCHAR(64) NOT NULL,
    `dataType` VARCHAR(24) NOT NULL,
    `name` VARCHAR(512) NOT NULL,
    `nameEn` VARCHAR(512) NULL,
    `nameZh` VARCHAR(512) NULL,
    `aliases` TEXT NULL,
    `brand` VARCHAR(255) NULL,
    `category` VARCHAR(255) NULL,
    `barcode` VARCHAR(32) NULL,
    `ediblePct` DECIMAL(5, 1) NULL,
    `searchText` TEXT NULL,
    `completeness` DECIMAL(3, 2) NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('active', 'retired') NOT NULL DEFAULT 'active',
    `contentHash` CHAR(40) NULL,
    `lastImportRunId` BIGINT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `sourceMeta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `food_barcode_idx`(`barcode`),
    INDEX `food_name_idx`(`name`(191)),
    INDEX `food_createdByUserId_idx`(`createdByUserId`),
    INDEX `food_status_sourceId_idx`(`status`, `sourceId`),
    UNIQUE INDEX `food_sourceId_sourceKey_key`(`sourceId`, `sourceKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `food_nutrients` (
    `foodId` BIGINT NOT NULL,
    `energyKcal` DECIMAL(9, 3) NULL,
    `proteinG` DECIMAL(9, 3) NULL,
    `fatG` DECIMAL(9, 3) NULL,
    `carbG` DECIMAL(9, 3) NULL,
    `fiberG` DECIMAL(9, 3) NULL,
    `sugarsG` DECIMAL(9, 3) NULL,
    `waterG` DECIMAL(9, 3) NULL,
    `alcoholG` DECIMAL(9, 3) NULL,
    `cholesterolMg` DECIMAL(9, 3) NULL,
    `satFatG` DECIMAL(9, 3) NULL,
    `mufaG` DECIMAL(9, 3) NULL,
    `pufaG` DECIMAL(9, 3) NULL,
    `transFatG` DECIMAL(9, 3) NULL,
    `sodiumMg` DECIMAL(9, 3) NULL,
    `calciumMg` DECIMAL(9, 3) NULL,
    `ironMg` DECIMAL(9, 3) NULL,
    `potassiumMg` DECIMAL(9, 3) NULL,
    `magnesiumMg` DECIMAL(9, 3) NULL,
    `phosphorusMg` DECIMAL(9, 3) NULL,
    `zincMg` DECIMAL(9, 3) NULL,
    `copperMg` DECIMAL(9, 3) NULL,
    `manganeseMg` DECIMAL(9, 3) NULL,
    `seleniumUg` DECIMAL(9, 3) NULL,
    `vitAUgRae` DECIMAL(9, 3) NULL,
    `caroteneUg` DECIMAL(9, 3) NULL,
    `retinolUg` DECIMAL(9, 3) NULL,
    `vitCMg` DECIMAL(9, 3) NULL,
    `vitDUg` DECIMAL(9, 3) NULL,
    `vitEMg` DECIMAL(9, 3) NULL,
    `vitKUg` DECIMAL(9, 3) NULL,
    `thiaminMg` DECIMAL(9, 3) NULL,
    `riboflavinMg` DECIMAL(9, 3) NULL,
    `niacinMg` DECIMAL(9, 3) NULL,
    `pantothenicMg` DECIMAL(9, 3) NULL,
    `vitB6Mg` DECIMAL(9, 3) NULL,
    `folateUg` DECIMAL(9, 3) NULL,
    `vitB12Ug` DECIMAL(9, 3) NULL,
    `cholineMg` DECIMAL(9, 3) NULL,
    `caffeineMg` DECIMAL(9, 3) NULL,
    `traceFlags` JSON NULL,
    `extras` JSON NULL,

    PRIMARY KEY (`foodId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `food_portion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `foodId` BIGINT NOT NULL,
    `seq` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(255) NOT NULL,
    `gramWeight` DECIMAL(9, 2) NOT NULL,
    `sourcePortionId` VARCHAR(32) NULL,

    INDEX `food_portion_foodId_idx`(`foodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `diet_log` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `foodId` BIGINT NULL,
    `description` VARCHAR(500) NULL,
    `mealType` ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
    `mealLabel` VARCHAR(50) NULL,
    `amountInput` DECIMAL(8, 2) NULL,
    `unitInput` VARCHAR(50) NULL,
    `grams` DECIMAL(8, 2) NULL,
    `energyKcal` DECIMAL(7, 1) NOT NULL,
    `proteinG` DECIMAL(7, 2) NOT NULL,
    `carbG` DECIMAL(7, 2) NOT NULL,
    `fatG` DECIMAL(7, 2) NOT NULL,
    `fiberG` DECIMAL(7, 2) NULL,
    `sugarG` DECIMAL(7, 2) NULL,
    `satFatG` DECIMAL(7, 2) NULL,
    `sodiumMg` DECIMAL(8, 1) NULL,
    `extraNutrients` JSON NULL,
    `eatenAt` DATETIME(3) NOT NULL,
    `localDate` DATE NOT NULL,
    `timezone` VARCHAR(40) NOT NULL,
    `source` ENUM('photo', 'text', 'barcode', 'manual', 'import') NOT NULL,
    `confidence` DECIMAL(3, 2) NULL,
    `originalDescription` TEXT NULL,
    `createdBy` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `diet_log_userId_localDate_idx`(`userId`, `localDate`),
    INDEX `diet_log_userId_eatenAt_idx`(`userId`, `eatenAt`),
    INDEX `diet_log_foodId_idx`(`foodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account` ADD CONSTRAINT `account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `personal_access_token` ADD CONSTRAINT `personal_access_token_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_profile` ADD CONSTRAINT `user_profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dietary_preference` ADD CONSTRAINT `dietary_preference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_allergen` ADD CONSTRAINT `user_allergen_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `preference_tag` ADD CONSTRAINT `preference_tag_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `body_metric` ADD CONSTRAINT `body_metric_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `food` ADD CONSTRAINT `food_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `data_source`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `food` ADD CONSTRAINT `food_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `food_nutrients` ADD CONSTRAINT `food_nutrients_foodId_fkey` FOREIGN KEY (`foodId`) REFERENCES `food`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `food_portion` ADD CONSTRAINT `food_portion_foodId_fkey` FOREIGN KEY (`foodId`) REFERENCES `food`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diet_log` ADD CONSTRAINT `diet_log_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `diet_log` ADD CONSTRAINT `diet_log_foodId_fkey` FOREIGN KEY (`foodId`) REFERENCES `food`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
