SET @schema_name = DATABASE();

SET @has_owner_user_id = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'owner_user_id'
);
SET @sql = IF(
  @has_owner_user_id = 0,
  'ALTER TABLE borrowing_records ADD COLUMN owner_user_id INT(11) NULL AFTER borrower_work_unit',
  'SELECT 1'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @has_owner_nip = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'owner_nip'
);
SET @sql = IF(
  @has_owner_nip = 0,
  'ALTER TABLE borrowing_records ADD COLUMN owner_nip VARCHAR(30) NULL AFTER owner_name',
  'SELECT 1'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @has_owner_user_index = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'borrowing_records'
    AND INDEX_NAME = 'idx_borrowing_owner_user'
);
SET @sql = IF(
  @has_owner_user_index = 0,
  'CREATE INDEX idx_borrowing_owner_user ON borrowing_records (owner_user_id)',
  'SELECT 1'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @has_owner_user_fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'borrowing_records'
    AND CONSTRAINT_NAME = 'fk_borrowing_owner_user'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql = IF(
  @has_owner_user_fk = 0,
  'ALTER TABLE borrowing_records ADD CONSTRAINT fk_borrowing_owner_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
