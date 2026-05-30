-- Add overdue/sanction tracking fields to borrowing_records.

SET @overdue_days_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'overdue_days'
);

SET @sanction_status_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'sanction_status'
);

SET @sanction_notes_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'sanction_notes'
);

SET @sanction_applied_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'sanction_applied_at'
);

SET @add_overdue_days_sql := IF(
  @overdue_days_exists = 0,
  'ALTER TABLE borrowing_records ADD COLUMN overdue_days INT NOT NULL DEFAULT 0 AFTER returned_by',
  'SELECT "borrowing_records.overdue_days already exists"'
);

PREPARE add_overdue_days_stmt FROM @add_overdue_days_sql;
EXECUTE add_overdue_days_stmt;
DEALLOCATE PREPARE add_overdue_days_stmt;

SET @add_sanction_status_sql := IF(
  @sanction_status_exists = 0,
  'ALTER TABLE borrowing_records ADD COLUMN sanction_status VARCHAR(20) NOT NULL DEFAULT ''none'' AFTER overdue_days',
  'SELECT "borrowing_records.sanction_status already exists"'
);

PREPARE add_sanction_status_stmt FROM @add_sanction_status_sql;
EXECUTE add_sanction_status_stmt;
DEALLOCATE PREPARE add_sanction_status_stmt;

SET @add_sanction_notes_sql := IF(
  @sanction_notes_exists = 0,
  'ALTER TABLE borrowing_records ADD COLUMN sanction_notes TEXT NULL AFTER sanction_status',
  'SELECT "borrowing_records.sanction_notes already exists"'
);

PREPARE add_sanction_notes_stmt FROM @add_sanction_notes_sql;
EXECUTE add_sanction_notes_stmt;
DEALLOCATE PREPARE add_sanction_notes_stmt;

SET @add_sanction_applied_at_sql := IF(
  @sanction_applied_at_exists = 0,
  'ALTER TABLE borrowing_records ADD COLUMN sanction_applied_at DATETIME NULL AFTER sanction_notes',
  'SELECT "borrowing_records.sanction_applied_at already exists"'
);

PREPARE add_sanction_applied_at_stmt FROM @add_sanction_applied_at_sql;
EXECUTE add_sanction_applied_at_stmt;
DEALLOCATE PREPARE add_sanction_applied_at_stmt;

-- Optional index to speed up dashboard sanction count queries.
SET @idx_borrowing_sanction_status_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND INDEX_NAME = 'idx_borrowing_sanction_status'
);

SET @add_idx_borrowing_sanction_status_sql := IF(
  @idx_borrowing_sanction_status_exists = 0,
  'CREATE INDEX idx_borrowing_sanction_status ON borrowing_records (sanction_status)',
  'SELECT "borrowing_records.idx_borrowing_sanction_status already exists"'
);

PREPARE add_idx_borrowing_sanction_status_stmt FROM @add_idx_borrowing_sanction_status_sql;
EXECUTE add_idx_borrowing_sanction_status_stmt;
DEALLOCATE PREPARE add_idx_borrowing_sanction_status_stmt;
