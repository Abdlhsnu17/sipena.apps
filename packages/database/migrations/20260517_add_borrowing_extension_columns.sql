-- Add extension/renewal columns to borrowing_records
-- Tracks when user extends borrowing time and how many times they've extended

SET @extension_count_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'extension_count'
);

SET @add_extension_count_sql := IF(
  @extension_count_exists = 0,
  'ALTER TABLE `borrowing_records` ADD COLUMN `extension_count` INT NOT NULL DEFAULT 0 COMMENT ''Jumlah perpanjangan waktu peminjaman'' AFTER `sanction_applied_at`',
  'SELECT "borrowing_records.extension_count already exists"'
);

PREPARE add_extension_count_stmt FROM @add_extension_count_sql;
EXECUTE add_extension_count_stmt;
DEALLOCATE PREPARE add_extension_count_stmt;

SET @last_extended_date_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'last_extended_date'
);

SET @add_last_extended_date_sql := IF(
  @last_extended_date_exists = 0,
  'ALTER TABLE `borrowing_records` ADD COLUMN `last_extended_date` DATETIME NULL COMMENT ''Tanggal terakhir perpanjangan dilakukan'' AFTER `extension_count`',
  'SELECT "borrowing_records.last_extended_date already exists"'
);

PREPARE add_last_extended_date_stmt FROM @add_last_extended_date_sql;
EXECUTE add_last_extended_date_stmt;
DEALLOCATE PREPARE add_last_extended_date_stmt;

SET @extension_notes_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'extension_notes'
);

SET @add_extension_notes_sql := IF(
  @extension_notes_exists = 0,
  'ALTER TABLE `borrowing_records` ADD COLUMN `extension_notes` TEXT NULL COMMENT ''Catatan perpanjangan terbaru'' AFTER `last_extended_date`',
  'SELECT "borrowing_records.extension_notes already exists"'
);

PREPARE add_extension_notes_stmt FROM @add_extension_notes_sql;
EXECUTE add_extension_notes_stmt;
DEALLOCATE PREPARE add_extension_notes_stmt;

SET @is_extension_blocked_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND COLUMN_NAME = 'is_extension_blocked'
);

SET @add_is_extension_blocked_sql := IF(
  @is_extension_blocked_exists = 0,
  'ALTER TABLE `borrowing_records` ADD COLUMN `is_extension_blocked` BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''Flag untuk blok perpanjangan lebih lanjut'' AFTER `extension_notes`',
  'SELECT "borrowing_records.is_extension_blocked already exists"'
);

PREPARE add_is_extension_blocked_stmt FROM @add_is_extension_blocked_sql;
EXECUTE add_is_extension_blocked_stmt;
DEALLOCATE PREPARE add_is_extension_blocked_stmt;

-- Create index for better query performance
SET @idx_user_overdue_status_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND INDEX_NAME = 'idx_user_overdue_status'
);

SET @add_idx_user_overdue_status_sql := IF(
  @idx_user_overdue_status_exists = 0,
  'CREATE INDEX `idx_user_overdue_status` ON `borrowing_records` (`user_id`, `status`, `sanction_status`)',
  'SELECT "idx_user_overdue_status already exists"'
);

PREPARE add_idx_user_overdue_status_stmt FROM @add_idx_user_overdue_status_sql;
EXECUTE add_idx_user_overdue_status_stmt;
DEALLOCATE PREPARE add_idx_user_overdue_status_stmt;

SET @idx_user_extension_status_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowing_records'
    AND INDEX_NAME = 'idx_user_extension_status'
);

SET @add_idx_user_extension_status_sql := IF(
  @idx_user_extension_status_exists = 0,
  'CREATE INDEX `idx_user_extension_status` ON `borrowing_records` (`user_id`, `sanction_status`, `is_extension_blocked`)',
  'SELECT "idx_user_extension_status already exists"'
);

PREPARE add_idx_user_extension_status_stmt FROM @add_idx_user_extension_status_sql;
EXECUTE add_idx_user_extension_status_stmt;
DEALLOCATE PREPARE add_idx_user_extension_status_stmt;
