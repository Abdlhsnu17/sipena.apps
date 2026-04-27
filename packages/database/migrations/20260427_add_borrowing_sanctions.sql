-- Add overdue/sanction tracking fields to borrowing_records.
-- Safe to run repeatedly on MySQL/MariaDB variants that support IF NOT EXISTS.

ALTER TABLE borrowing_records
  ADD COLUMN IF NOT EXISTS overdue_days INT NOT NULL DEFAULT 0 AFTER returned_by;

ALTER TABLE borrowing_records
  ADD COLUMN IF NOT EXISTS sanction_status VARCHAR(20) NOT NULL DEFAULT 'none' AFTER overdue_days;

ALTER TABLE borrowing_records
  ADD COLUMN IF NOT EXISTS sanction_notes TEXT NULL AFTER sanction_status;

ALTER TABLE borrowing_records
  ADD COLUMN IF NOT EXISTS sanction_applied_at DATETIME NULL AFTER sanction_notes;

-- Optional index to speed up dashboard sanction count queries.
CREATE INDEX IF NOT EXISTS idx_borrowing_sanction_status
  ON borrowing_records (sanction_status);
