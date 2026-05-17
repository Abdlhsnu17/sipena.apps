-- Add extension/renewal columns to borrowing_records
-- Tracks when user extends borrowing time and how many times they've extended

ALTER TABLE `borrowing_records`
ADD COLUMN `extension_count` INT NOT NULL DEFAULT 0 COMMENT 'Jumlah perpanjangan waktu peminjaman' AFTER `sanction_applied_at`,
ADD COLUMN `last_extended_date` DATETIME NULL COMMENT 'Tanggal terakhir perpanjangan dilakukan' AFTER `extension_count`,
ADD COLUMN `extension_notes` TEXT NULL COMMENT 'Catatan perpanjangan terbaru' AFTER `last_extended_date`,
ADD COLUMN `is_extension_blocked` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Flag untuk blok perpanjangan lebih lanjut' AFTER `extension_notes`;

-- Create index for better query performance
CREATE INDEX idx_user_overdue_status ON `borrowing_records` (`user_id`, `status`, `sanction_status`);
CREATE INDEX idx_user_extension_status ON `borrowing_records` (`user_id`, `sanction_status`, `is_extension_blocked`);
