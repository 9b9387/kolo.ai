-- AlterTable
ALTER TABLE `body_metric` ADD COLUMN `timezone` VARCHAR(40) NOT NULL;

-- AlterTable
ALTER TABLE `goal` ADD COLUMN `activeKey` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `goal_activeKey_key` ON `goal`(`activeKey`);
