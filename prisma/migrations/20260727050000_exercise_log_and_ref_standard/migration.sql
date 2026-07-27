-- AlterTable
ALTER TABLE `user_profile` ADD COLUMN `nutrientRefStandard` VARCHAR(16) NULL;

-- CreateTable
CREATE TABLE `exercise_log` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `activity` VARCHAR(100) NOT NULL,
    `category` ENUM('cardio', 'strength', 'flexibility', 'sports', 'daily_activity', 'other') NULL,
    `intensity` ENUM('low', 'moderate', 'high') NULL,
    `durationMin` DECIMAL(6, 1) NULL,
    `distanceKm` DECIMAL(6, 2) NULL,
    `energyKcal` DECIMAL(7, 1) NOT NULL,
    `extraMetrics` JSON NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `localDate` DATE NOT NULL,
    `timezone` VARCHAR(40) NOT NULL,
    `source` ENUM('photo', 'text', 'device', 'manual', 'import') NOT NULL,
    `confidence` DECIMAL(3, 2) NULL,
    `originalDescription` TEXT NULL,
    `note` VARCHAR(500) NULL,
    `createdBy` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `exercise_log_userId_localDate_idx`(`userId`, `localDate`),
    INDEX `exercise_log_userId_startedAt_idx`(`userId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `exercise_log` ADD CONSTRAINT `exercise_log_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
