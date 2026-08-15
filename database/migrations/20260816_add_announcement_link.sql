-- Tautan tujuan opsional pada siaran pemberitahuan, misalnya /unggahan.
ALTER TABLE `announcements`
  ADD COLUMN `link` varchar(500) DEFAULT NULL AFTER `message`;
