-- Label skenario pada riwayat perhitungan SPK (idempotent).
--
-- Riwayat sebelumnya hanya bertanda waktu, sehingga sulit dibaca sebagai daftar
-- skenario pembobotan. Kolom label memungkinkan pengguna memberi nama pada
-- konfigurasi bobot yang disimpan, mis. "Bobot kondisi dominan 30%".

SET @label_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'dss_ranking_history'
    AND COLUMN_NAME = 'label'
);

SET @sql := IF(
  @label_exists = 0,
  'ALTER TABLE dss_ranking_history ADD COLUMN `label` VARCHAR(120) NULL AFTER `asset_type`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
