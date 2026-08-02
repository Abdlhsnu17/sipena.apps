SET @asset_usage_no_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND COLUMN_NAME = 'no'
);

SET @add_asset_usage_no_sql := IF(
  @asset_usage_no_exists = 0,
  'ALTER TABLE `asset_usage_logs` ADD COLUMN `no` VARCHAR(50) DEFAULT NULL AFTER `id`',
  'SELECT "asset_usage_logs.no already exists"'
);

PREPARE add_asset_usage_no_stmt FROM @add_asset_usage_no_sql;
EXECUTE add_asset_usage_no_stmt;
DEALLOCATE PREPARE add_asset_usage_no_stmt;

SET @asset_usage_no_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND INDEX_NAME IN ('uniq_asset_usage_no', 'uniq_asset_usage_logs_no')
);

SET @add_asset_usage_no_index_sql := IF(
  @asset_usage_no_index_exists = 0,
  'CREATE UNIQUE INDEX `uniq_asset_usage_logs_no` ON `asset_usage_logs` (`no`)',
  'SELECT "asset_usage_logs no unique index already exists"'
);

PREPARE add_asset_usage_no_index_stmt FROM @add_asset_usage_no_index_sql;
EXECUTE add_asset_usage_no_index_stmt;
DEALLOCATE PREPARE add_asset_usage_no_index_stmt;
