ALTER TABLE `asset_usage_logs`
  ADD COLUMN `borrowing_id` INT(11) DEFAULT NULL AFTER `no`;

CREATE INDEX `idx_asset_usage_borrowing` ON `asset_usage_logs` (`borrowing_id`);
