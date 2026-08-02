SET @asset_usage_deleted_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND COLUMN_NAME = 'deleted_at'
);

SET @add_asset_usage_deleted_at_sql := IF(
  @asset_usage_deleted_at_exists = 0,
  'ALTER TABLE `asset_usage_logs` ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `updated_at`',
  'SELECT "asset_usage_logs.deleted_at already exists"'
);
PREPARE add_asset_usage_deleted_at_stmt FROM @add_asset_usage_deleted_at_sql;
EXECUTE add_asset_usage_deleted_at_stmt;
DEALLOCATE PREPARE add_asset_usage_deleted_at_stmt;

SET @asset_usage_deleted_by_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND COLUMN_NAME = 'deleted_by'
);

SET @add_asset_usage_deleted_by_sql := IF(
  @asset_usage_deleted_by_exists = 0,
  'ALTER TABLE `asset_usage_logs` ADD COLUMN `deleted_by` int(11) DEFAULT NULL AFTER `deleted_at`',
  'SELECT "asset_usage_logs.deleted_by already exists"'
);
PREPARE add_asset_usage_deleted_by_stmt FROM @add_asset_usage_deleted_by_sql;
EXECUTE add_asset_usage_deleted_by_stmt;
DEALLOCATE PREPARE add_asset_usage_deleted_by_stmt;

SET @asset_usage_delete_reason_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND COLUMN_NAME = 'delete_reason'
);

SET @add_asset_usage_delete_reason_sql := IF(
  @asset_usage_delete_reason_exists = 0,
  'ALTER TABLE `asset_usage_logs` ADD COLUMN `delete_reason` text DEFAULT NULL AFTER `deleted_by`',
  'SELECT "asset_usage_logs.delete_reason already exists"'
);
PREPARE add_asset_usage_delete_reason_stmt FROM @add_asset_usage_delete_reason_sql;
EXECUTE add_asset_usage_delete_reason_stmt;
DEALLOCATE PREPARE add_asset_usage_delete_reason_stmt;

SET @asset_usage_source_type_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND COLUMN_NAME = 'source_type'
);

SET @add_asset_usage_source_type_sql := IF(
  @asset_usage_source_type_exists = 0,
  'ALTER TABLE `asset_usage_logs` ADD COLUMN `source_type` varchar(20) NOT NULL DEFAULT ''manual'' AFTER `delete_reason`',
  'SELECT "asset_usage_logs.source_type already exists"'
);
PREPARE add_asset_usage_source_type_stmt FROM @add_asset_usage_source_type_sql;
EXECUTE add_asset_usage_source_type_stmt;
DEALLOCATE PREPARE add_asset_usage_source_type_stmt;

SET @asset_usage_deleted_at_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND INDEX_NAME = 'idx_asset_usage_deleted_at'
);

SET @add_asset_usage_deleted_at_index_sql := IF(
  @asset_usage_deleted_at_index_exists = 0,
  'CREATE INDEX idx_asset_usage_deleted_at ON asset_usage_logs (deleted_at)',
  'SELECT "asset_usage_logs.idx_asset_usage_deleted_at already exists"'
);
PREPARE add_asset_usage_deleted_at_index_stmt FROM @add_asset_usage_deleted_at_index_sql;
EXECUTE add_asset_usage_deleted_at_index_stmt;
DEALLOCATE PREPARE add_asset_usage_deleted_at_index_stmt;

UPDATE asset_usage_logs
SET source_type = 'borrowing_sync'
WHERE borrowing_id IS NOT NULL
  AND source_type = 'manual';
