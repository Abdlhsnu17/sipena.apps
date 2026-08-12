-- Index pendukung agregasi SPK (idempotent).
--
-- Modul SPK menghitung frekuensi pemakaian dan riwayat/biaya pemeliharaan
-- dengan GROUP BY (asset_type, asset_id, asset_detail_id, asset_detail_code)
-- sambil menyaring baris yang dihapus lunak. Index komposit berikut membuat
-- agregasi tersebut terlayani langsung dari index, tanpa full table scan yang
-- makin berat seiring bertambahnya log pemakaian.

SET @usage_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_usage_logs'
    AND INDEX_NAME = 'idx_asset_usage_dss_group'
);

SET @sql := IF(
  @usage_index_exists = 0,
  'ALTER TABLE asset_usage_logs ADD KEY `idx_asset_usage_dss_group` (`deleted_at`,`asset_type`,`asset_id`,`asset_detail_id`,`asset_detail_code`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @maintenance_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_records'
    AND INDEX_NAME = 'idx_maintenance_dss_group'
);

SET @sql := IF(
  @maintenance_index_exists = 0,
  'ALTER TABLE maintenance_records ADD KEY `idx_maintenance_dss_group` (`deleted_at`,`status`,`asset_type`,`asset_id`,`asset_detail_id`,`asset_detail_code`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
