SET @account_status_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'account_status'
);

SET @add_account_status_sql := IF(
  @account_status_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `account_status` VARCHAR(20) NOT NULL DEFAULT ''active'' AFTER `is_active`',
  'SELECT "users.account_status already exists"'
);
PREPARE add_account_status_stmt FROM @add_account_status_sql;
EXECUTE add_account_status_stmt;
DEALLOCATE PREPARE add_account_status_stmt;

SET @must_change_password_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'must_change_password'
);

SET @add_must_change_password_sql := IF(
  @must_change_password_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `account_status`',
  'SELECT "users.must_change_password already exists"'
);
PREPARE add_must_change_password_stmt FROM @add_must_change_password_sql;
EXECUTE add_must_change_password_stmt;
DEALLOCATE PREPARE add_must_change_password_stmt;

UPDATE `users`
SET `account_status` = CASE
  WHEN COALESCE(`is_active`, 1) = 1 THEN 'active'
  ELSE 'inactive'
END
WHERE `account_status` IS NULL OR `account_status` = '';
