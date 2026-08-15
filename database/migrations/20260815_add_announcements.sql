-- Siaran pemberitahuan yang ditulis admin.
--
-- Isi siaran disimpan sekali di sini, lalu disebar ke `notifications` sebagai
-- satu baris per penerima yang menunjuk balik lewat reference_type/reference_id.
-- Tanpa tabel ini, gambar lampiran tidak punya baris pemilik: path-nya akan
-- terduplikasi di setiap baris notifikasi dan filenya tidak pernah bisa dihapus
-- dengan aman karena penerima lain masih memakainya.

CREATE TABLE IF NOT EXISTS `announcements` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_announcements_created_at` (`created_at`),
  KEY `idx_announcements_created_by` (`created_by`),
  CONSTRAINT `fk_announcements_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
