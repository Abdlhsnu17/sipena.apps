SET @asset_usage_borrowing_id_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND COLUMN_NAME = 'borrowing_id'
);

SET @add_asset_usage_borrowing_id_sql := IF(
  @asset_usage_borrowing_id_exists = 0,
  'ALTER TABLE `asset_usage_logs` ADD COLUMN `borrowing_id` INT(11) DEFAULT NULL AFTER `no`',
  'SELECT "asset_usage_logs.borrowing_id already exists"'
);

PREPARE add_asset_usage_borrowing_id_stmt FROM @add_asset_usage_borrowing_id_sql;
EXECUTE add_asset_usage_borrowing_id_stmt;
DEALLOCATE PREPARE add_asset_usage_borrowing_id_stmt;

SET @idx_asset_usage_borrowing_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND INDEX_NAME = 'idx_asset_usage_borrowing'
);

SET @add_idx_asset_usage_borrowing_sql := IF(
  @idx_asset_usage_borrowing_exists = 0,
  'CREATE INDEX `idx_asset_usage_borrowing` ON `asset_usage_logs` (`borrowing_id`)',
  'SELECT "idx_asset_usage_borrowing already exists"'
);

PREPARE add_idx_asset_usage_borrowing_stmt FROM @add_idx_asset_usage_borrowing_sql;
EXECUTE add_idx_asset_usage_borrowing_stmt;
DEALLOCATE PREPARE add_idx_asset_usage_borrowing_stmt;
