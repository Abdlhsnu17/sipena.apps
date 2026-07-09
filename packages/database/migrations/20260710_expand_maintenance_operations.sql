ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal' AFTER type,
  ADD COLUMN IF NOT EXISTS due_at DATETIME NULL AFTER scheduled_date,
  ADD COLUMN IF NOT EXISTS started_at DATETIME NULL AFTER due_at,
  ADD COLUMN IF NOT EXISTS technician_user_id INT(11) NULL AFTER technician,
  ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255) NULL AFTER technician_user_id,
  ADD COLUMN IF NOT EXISTS vendor_reference VARCHAR(100) NULL AFTER vendor_name,
  ADD COLUMN IF NOT EXISTS warranty_until DATE NULL AFTER vendor_reference;

CREATE INDEX IF NOT EXISTS idx_maintenance_priority_due ON maintenance_records (priority, due_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_technician ON maintenance_records (technician_user_id);

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
