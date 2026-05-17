START TRANSACTION;

SET @phone_number_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'phone_number'
);

SET @session_version_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'session_version'
);

SET @add_phone_number_sql := IF(
  @phone_number_exists = 0,
  'ALTER TABLE users ADD COLUMN phone_number VARCHAR(25) DEFAULT NULL AFTER home_address',
  'SELECT "users.phone_number already exists"'
);

PREPARE add_phone_number_stmt FROM @add_phone_number_sql;
EXECUTE add_phone_number_stmt;
DEALLOCATE PREPARE add_phone_number_stmt;

SET @add_session_version_sql := IF(
  @session_version_exists = 0,
  'ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 0 AFTER last_login',
  'SELECT "users.session_version already exists"'
);

PREPARE add_session_version_stmt FROM @add_session_version_sql;
EXECUTE add_session_version_stmt;
DEALLOCATE PREPARE add_session_version_stmt;

COMMIT;
