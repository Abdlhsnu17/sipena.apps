-- Tabel pengaturan global aplikasi (key-value).
-- Dipakai pertama kali oleh teks pemberitahuan berjalan di topbar, yang sebelumnya
-- di-hardcode di frontend sehingga hanya bisa diubah lewat rilis kode.

CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` varchar(80) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_key`),
  KEY `idx_app_settings_updated_by` (`updated_by`),
  CONSTRAINT `fk_app_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed teks default agar marquee tetap sama seperti sebelum perubahan ini.
-- INSERT IGNORE supaya migrasi tidak menimpa teks yang sudah diubah admin bila
-- migrasi dijalankan ulang di environment yang sama.
INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`) VALUES
  ('topbar_announcement', 'Selamat datang di Sistem Informasi Manajemen Sarana dan Prasarana. Periksa pemberitahuan secara berkala agar informasi penting tidak terlewat. Terima Kasih');
