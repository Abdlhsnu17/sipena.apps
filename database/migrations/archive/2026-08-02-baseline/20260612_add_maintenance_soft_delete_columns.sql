SET @maintenance_records_deleted_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_records'
    AND COLUMN_NAME = 'deleted_at'
);

SET @add_maintenance_records_deleted_at_sql := IF(
  @maintenance_records_deleted_at_exists = 0,
  'ALTER TABLE `maintenance_records` ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `updated_at`',
  'SELECT "maintenance_records.deleted_at already exists"'
);
PREPARE add_maintenance_records_deleted_at_stmt FROM @add_maintenance_records_deleted_at_sql;
EXECUTE add_maintenance_records_deleted_at_stmt;
DEALLOCATE PREPARE add_maintenance_records_deleted_at_stmt;

SET @maintenance_records_deleted_by_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_records'
    AND COLUMN_NAME = 'deleted_by'
);

SET @add_maintenance_records_deleted_by_sql := IF(
  @maintenance_records_deleted_by_exists = 0,
  'ALTER TABLE `maintenance_records` ADD COLUMN `deleted_by` int(11) DEFAULT NULL AFTER `deleted_at`',
  'SELECT "maintenance_records.deleted_by already exists"'
);
PREPARE add_maintenance_records_deleted_by_stmt FROM @add_maintenance_records_deleted_by_sql;
EXECUTE add_maintenance_records_deleted_by_stmt;
DEALLOCATE PREPARE add_maintenance_records_deleted_by_stmt;

SET @maintenance_records_delete_reason_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_records'
    AND COLUMN_NAME = 'delete_reason'
);

SET @add_maintenance_records_delete_reason_sql := IF(
  @maintenance_records_delete_reason_exists = 0,
  'ALTER TABLE `maintenance_records` ADD COLUMN `delete_reason` text DEFAULT NULL AFTER `deleted_by`',
  'SELECT "maintenance_records.delete_reason already exists"'
);
PREPARE add_maintenance_records_delete_reason_stmt FROM @add_maintenance_records_delete_reason_sql;
EXECUTE add_maintenance_records_delete_reason_stmt;
DEALLOCATE PREPARE add_maintenance_records_delete_reason_stmt;

SET @maintenance_history_deleted_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history'
    AND COLUMN_NAME = 'deleted_at'
);

SET @add_maintenance_history_deleted_at_sql := IF(
  @maintenance_history_deleted_at_exists = 0,
  'ALTER TABLE `maintenance_history` ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `updated_at`',
  'SELECT "maintenance_history.deleted_at already exists"'
);
PREPARE add_maintenance_history_deleted_at_stmt FROM @add_maintenance_history_deleted_at_sql;
EXECUTE add_maintenance_history_deleted_at_stmt;
DEALLOCATE PREPARE add_maintenance_history_deleted_at_stmt;

SET @maintenance_history_deleted_by_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history'
    AND COLUMN_NAME = 'deleted_by'
);

SET @add_maintenance_history_deleted_by_sql := IF(
  @maintenance_history_deleted_by_exists = 0,
  'ALTER TABLE `maintenance_history` ADD COLUMN `deleted_by` int(11) DEFAULT NULL AFTER `deleted_at`',
  'SELECT "maintenance_history.deleted_by already exists"'
);
PREPARE add_maintenance_history_deleted_by_stmt FROM @add_maintenance_history_deleted_by_sql;
EXECUTE add_maintenance_history_deleted_by_stmt;
DEALLOCATE PREPARE add_maintenance_history_deleted_by_stmt;

SET @maintenance_history_delete_reason_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history'
    AND COLUMN_NAME = 'delete_reason'
);

SET @add_maintenance_history_delete_reason_sql := IF(
  @maintenance_history_delete_reason_exists = 0,
  'ALTER TABLE `maintenance_history` ADD COLUMN `delete_reason` text DEFAULT NULL AFTER `deleted_by`',
  'SELECT "maintenance_history.delete_reason already exists"'
);
PREPARE add_maintenance_history_delete_reason_stmt FROM @add_maintenance_history_delete_reason_sql;
EXECUTE add_maintenance_history_delete_reason_stmt;
DEALLOCATE PREPARE add_maintenance_history_delete_reason_stmt;
