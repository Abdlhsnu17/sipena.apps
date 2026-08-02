-- Add resolution tracking fields used by SanctionsService.resolve / .waive,
-- which were missing from the original 20260427_add_borrowing_sanctions.sql migration.

SET @resolved_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'resolved_at'
);

SET @resolved_by_user_id_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'resolved_by_user_id'
);

SET @resolved_notes_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'resolved_notes'
);

SET @add_resolved_at_sql := IF(
  @resolved_at_exists = 0,
  'ALTER TABLE borrowing_records ADD COLUMN resolved_at DATETIME NULL AFTER sanction_applied_at',
  'SELECT "borrowing_records.resolved_at already exists"'
);

PREPARE add_resolved_at_stmt FROM @add_resolved_at_sql;
EXECUTE add_resolved_at_stmt;
DEALLOCATE PREPARE add_resolved_at_stmt;

SET @add_resolved_by_user_id_sql := IF(
  @resolved_by_user_id_exists = 0,
  'ALTER TABLE borrowing_records ADD COLUMN resolved_by_user_id INT NULL AFTER resolved_at',
  'SELECT "borrowing_records.resolved_by_user_id already exists"'
);

PREPARE add_resolved_by_user_id_stmt FROM @add_resolved_by_user_id_sql;
EXECUTE add_resolved_by_user_id_stmt;
DEALLOCATE PREPARE add_resolved_by_user_id_stmt;

SET @add_resolved_notes_sql := IF(
  @resolved_notes_exists = 0,
  'ALTER TABLE borrowing_records ADD COLUMN resolved_notes TEXT NULL AFTER resolved_by_user_id',
  'SELECT "borrowing_records.resolved_notes already exists"'
);

PREPARE add_resolved_notes_stmt FROM @add_resolved_notes_sql;
EXECUTE add_resolved_notes_stmt;
DEALLOCATE PREPARE add_resolved_notes_stmt;

SET @idx_borrowing_resolved_by_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND INDEX_NAME = 'idx_borrowing_resolved_by_user_id'
);

SET @add_idx_borrowing_resolved_by_sql := IF(
  @idx_borrowing_resolved_by_exists = 0,
  'CREATE INDEX idx_borrowing_resolved_by_user_id ON borrowing_records (resolved_by_user_id)',
  'SELECT "borrowing_records.idx_borrowing_resolved_by_user_id already exists"'
);

PREPARE add_idx_borrowing_resolved_by_stmt FROM @add_idx_borrowing_resolved_by_sql;
EXECUTE add_idx_borrowing_resolved_by_stmt;
DEALLOCATE PREPARE add_idx_borrowing_resolved_by_stmt;
