ALTER TABLE `asset_usage_logs`
  ADD COLUMN `no` VARCHAR(50) DEFAULT NULL AFTER `id`;

CREATE UNIQUE INDEX `uniq_asset_usage_logs_no` ON `asset_usage_logs` (`no`);
