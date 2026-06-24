SET @sub_work_unit_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'sub_work_unit'
);

SET @add_sub_work_unit_sql := IF(
  @sub_work_unit_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `sub_work_unit` varchar(255) DEFAULT NULL AFTER `work_unit`',
  'SELECT "users.sub_work_unit already exists"'
);

PREPARE add_sub_work_unit_stmt FROM @add_sub_work_unit_sql;
EXECUTE add_sub_work_unit_stmt;
DEALLOCATE PREPARE add_sub_work_unit_stmt;
