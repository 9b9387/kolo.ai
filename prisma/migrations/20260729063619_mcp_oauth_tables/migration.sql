-- CreateTable
CREATE TABLE `oauth_application` (
    `id` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `icon` TEXT NULL,
    `metadata` TEXT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientSecret` TEXT NULL,
    `redirectUrls` TEXT NOT NULL,
    `type` TEXT NOT NULL,
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `oauth_application_userId_idx`(`userId`),
    UNIQUE INDEX `oauth_application_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_access_token` (
    `id` VARCHAR(191) NOT NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `refreshToken` VARCHAR(191) NOT NULL,
    `accessTokenExpiresAt` DATETIME(3) NOT NULL,
    `refreshTokenExpiresAt` DATETIME(3) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `scopes` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `oauth_access_token_clientId_idx`(`clientId`),
    INDEX `oauth_access_token_userId_idx`(`userId`),
    UNIQUE INDEX `oauth_access_token_accessToken_key`(`accessToken`),
    UNIQUE INDEX `oauth_access_token_refreshToken_key`(`refreshToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_consent` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scopes` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `consentGiven` BOOLEAN NOT NULL,

    INDEX `oauth_consent_clientId_idx`(`clientId`),
    INDEX `oauth_consent_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `oauth_application` ADD CONSTRAINT `oauth_application_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_access_token` ADD CONSTRAINT `oauth_access_token_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `oauth_application`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_access_token` ADD CONSTRAINT `oauth_access_token_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_consent` ADD CONSTRAINT `oauth_consent_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `oauth_application`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauth_consent` ADD CONSTRAINT `oauth_consent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
