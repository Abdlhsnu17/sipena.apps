SET @users_deleted_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'deleted_at'
);

SET @add_users_deleted_at_sql := IF(
  @users_deleted_at_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `updated_at`',
  'SELECT "users.deleted_at already exists"'
);
PREPARE add_users_deleted_at_stmt FROM @add_users_deleted_at_sql;
EXECUTE add_users_deleted_at_stmt;
DEALLOCATE PREPARE add_users_deleted_at_stmt;

SET @users_deleted_by_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'deleted_by'
);

SET @add_users_deleted_by_sql := IF(
  @users_deleted_by_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `deleted_by` int(11) DEFAULT NULL AFTER `deleted_at`',
  'SELECT "users.deleted_by already exists"'
);
PREPARE add_users_deleted_by_stmt FROM @add_users_deleted_by_sql;
EXECUTE add_users_deleted_by_stmt;
DEALLOCATE PREPARE add_users_deleted_by_stmt;

SET @users_delete_reason_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'delete_reason'
);

SET @add_users_delete_reason_sql := IF(
  @users_delete_reason_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `delete_reason` text DEFAULT NULL AFTER `deleted_by`',
  'SELECT "users.delete_reason already exists"'
);
PREPARE add_users_delete_reason_stmt FROM @add_users_delete_reason_sql;
EXECUTE add_users_delete_reason_stmt;
DEALLOCATE PREPARE add_users_delete_reason_stmt;

SET @borrowing_records_deleted_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'deleted_at'
);

SET @add_borrowing_records_deleted_at_sql := IF(
  @borrowing_records_deleted_at_exists = 0,
  'ALTER TABLE `borrowing_records` ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `updated_at`',
  'SELECT "borrowing_records.deleted_at already exists"'
);
PREPARE add_borrowing_records_deleted_at_stmt FROM @add_borrowing_records_deleted_at_sql;
EXECUTE add_borrowing_records_deleted_at_stmt;
DEALLOCATE PREPARE add_borrowing_records_deleted_at_stmt;

SET @borrowing_records_deleted_by_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'deleted_by'
);

SET @add_borrowing_records_deleted_by_sql := IF(
  @borrowing_records_deleted_by_exists = 0,
  'ALTER TABLE `borrowing_records` ADD COLUMN `deleted_by` int(11) DEFAULT NULL AFTER `deleted_at`',
  'SELECT "borrowing_records.deleted_by already exists"'
);
PREPARE add_borrowing_records_deleted_by_stmt FROM @add_borrowing_records_deleted_by_sql;
EXECUTE add_borrowing_records_deleted_by_stmt;
DEALLOCATE PREPARE add_borrowing_records_deleted_by_stmt;

SET @borrowing_records_delete_reason_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'delete_reason'
);

SET @add_borrowing_records_delete_reason_sql := IF(
  @borrowing_records_delete_reason_exists = 0,
  'ALTER TABLE `borrowing_records` ADD COLUMN `delete_reason` text DEFAULT NULL AFTER `deleted_by`',
  'SELECT "borrowing_records.delete_reason already exists"'
);
PREPARE add_borrowing_records_delete_reason_stmt FROM @add_borrowing_records_delete_reason_sql;
EXECUTE add_borrowing_records_delete_reason_stmt;
DEALLOCATE PREPARE add_borrowing_records_delete_reason_stmt;

SET @return_records_deleted_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'return_records'
    AND COLUMN_NAME = 'deleted_at'
);

SET @add_return_records_deleted_at_sql := IF(
  @return_records_deleted_at_exists = 0,
  'ALTER TABLE `return_records` ADD COLUMN `deleted_at` datetime DEFAULT NULL AFTER `created_at`',
  'SELECT "return_records.deleted_at already exists"'
);
PREPARE add_return_records_deleted_at_stmt FROM @add_return_records_deleted_at_sql;
EXECUTE add_return_records_deleted_at_stmt;
DEALLOCATE PREPARE add_return_records_deleted_at_stmt;

SET @return_records_deleted_by_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'return_records'
    AND COLUMN_NAME = 'deleted_by'
);

SET @add_return_records_deleted_by_sql := IF(
  @return_records_deleted_by_exists = 0,
  'ALTER TABLE `return_records` ADD COLUMN `deleted_by` int(11) DEFAULT NULL AFTER `deleted_at`',
  'SELECT "return_records.deleted_by already exists"'
);
PREPARE add_return_records_deleted_by_stmt FROM @add_return_records_deleted_by_sql;
EXECUTE add_return_records_deleted_by_stmt;
DEALLOCATE PREPARE add_return_records_deleted_by_stmt;

SET @return_records_delete_reason_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'return_records'
    AND COLUMN_NAME = 'delete_reason'
);

SET @add_return_records_delete_reason_sql := IF(
  @return_records_delete_reason_exists = 0,
  'ALTER TABLE `return_records` ADD COLUMN `delete_reason` text DEFAULT NULL AFTER `deleted_by`',
  'SELECT "return_records.delete_reason already exists"'
);
PREPARE add_return_records_delete_reason_stmt FROM @add_return_records_delete_reason_sql;
EXECUTE add_return_records_delete_reason_stmt;
DEALLOCATE PREPARE add_return_records_delete_reason_stmt;
