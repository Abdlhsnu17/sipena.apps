SET @maintenance_priority_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'priority');
SET @maintenance_priority_sql := IF(@maintenance_priority_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT ''normal'' AFTER type', 'SELECT 1');
PREPARE maintenance_priority_stmt FROM @maintenance_priority_sql; EXECUTE maintenance_priority_stmt; DEALLOCATE PREPARE maintenance_priority_stmt;

SET @maintenance_due_at_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'due_at');
SET @maintenance_due_at_sql := IF(@maintenance_due_at_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN due_at DATETIME NULL AFTER scheduled_date', 'SELECT 1');
PREPARE maintenance_due_at_stmt FROM @maintenance_due_at_sql; EXECUTE maintenance_due_at_stmt; DEALLOCATE PREPARE maintenance_due_at_stmt;

SET @maintenance_started_at_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'started_at');
SET @maintenance_started_at_sql := IF(@maintenance_started_at_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN started_at DATETIME NULL AFTER due_at', 'SELECT 1');
PREPARE maintenance_started_at_stmt FROM @maintenance_started_at_sql; EXECUTE maintenance_started_at_stmt; DEALLOCATE PREPARE maintenance_started_at_stmt;

SET @maintenance_technician_user_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'technician_user_id');
SET @maintenance_technician_user_sql := IF(@maintenance_technician_user_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN technician_user_id INT(11) NULL AFTER technician', 'SELECT 1');
PREPARE maintenance_technician_user_stmt FROM @maintenance_technician_user_sql; EXECUTE maintenance_technician_user_stmt; DEALLOCATE PREPARE maintenance_technician_user_stmt;

SET @maintenance_vendor_name_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'vendor_name');
SET @maintenance_vendor_name_sql := IF(@maintenance_vendor_name_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN vendor_name VARCHAR(255) NULL AFTER technician_user_id', 'SELECT 1');
PREPARE maintenance_vendor_name_stmt FROM @maintenance_vendor_name_sql; EXECUTE maintenance_vendor_name_stmt; DEALLOCATE PREPARE maintenance_vendor_name_stmt;

SET @maintenance_vendor_reference_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'vendor_reference');
SET @maintenance_vendor_reference_sql := IF(@maintenance_vendor_reference_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN vendor_reference VARCHAR(100) NULL AFTER vendor_name', 'SELECT 1');
PREPARE maintenance_vendor_reference_stmt FROM @maintenance_vendor_reference_sql; EXECUTE maintenance_vendor_reference_stmt; DEALLOCATE PREPARE maintenance_vendor_reference_stmt;

SET @maintenance_warranty_until_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'warranty_until');
SET @maintenance_warranty_until_sql := IF(@maintenance_warranty_until_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN warranty_until DATE NULL AFTER vendor_reference', 'SELECT 1');
PREPARE maintenance_warranty_until_stmt FROM @maintenance_warranty_until_sql; EXECUTE maintenance_warranty_until_stmt; DEALLOCATE PREPARE maintenance_warranty_until_stmt;

SET @maintenance_priority_due_index_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND INDEX_NAME = 'idx_maintenance_priority_due');
SET @maintenance_priority_due_index_sql := IF(@maintenance_priority_due_index_exists = 0, 'CREATE INDEX idx_maintenance_priority_due ON maintenance_records (priority, due_at)', 'SELECT 1');
PREPARE maintenance_priority_due_index_stmt FROM @maintenance_priority_due_index_sql; EXECUTE maintenance_priority_due_index_stmt; DEALLOCATE PREPARE maintenance_priority_due_index_stmt;

SET @maintenance_technician_index_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND INDEX_NAME = 'idx_maintenance_technician');
SET @maintenance_technician_index_sql := IF(@maintenance_technician_index_exists = 0, 'CREATE INDEX idx_maintenance_technician ON maintenance_records (technician_user_id)', 'SELECT 1');
PREPARE maintenance_technician_index_stmt FROM @maintenance_technician_index_sql; EXECUTE maintenance_technician_index_stmt; DEALLOCATE PREPARE maintenance_technician_index_stmt;

CREATE TABLE IF NOT EXISTS maintenance_status_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  maintenance_id INT(11) NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NOT NULL,
  note TEXT NULL,
  changed_by INT(11) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_maintenance_status_logs_record (maintenance_id, created_at),
  CONSTRAINT fk_maintenance_status_logs_record FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_status_logs_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS maintenance_parts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  maintenance_id INT(11) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit VARCHAR(50) NULL,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_maintenance_parts_record (maintenance_id),
  CONSTRAINT fk_maintenance_parts_record FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS maintenance_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  maintenance_id INT(11) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NULL,
  uploaded_by INT(11) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_maintenance_attachments_record (maintenance_id),
  CONSTRAINT fk_maintenance_attachments_record FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
