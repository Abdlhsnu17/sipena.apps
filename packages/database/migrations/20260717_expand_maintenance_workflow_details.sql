SET @maintenance_estimated_duration_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'estimated_duration_minutes');
SET @maintenance_estimated_duration_sql := IF(@maintenance_estimated_duration_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN estimated_duration_minutes INT(11) NULL AFTER warranty_until', 'SELECT 1');
PREPARE maintenance_estimated_duration_stmt FROM @maintenance_estimated_duration_sql; EXECUTE maintenance_estimated_duration_stmt; DEALLOCATE PREPARE maintenance_estimated_duration_stmt;

SET @maintenance_estimated_cost_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'estimated_cost');
SET @maintenance_estimated_cost_sql := IF(@maintenance_estimated_cost_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN estimated_cost DECIMAL(12,2) NULL AFTER estimated_duration_minutes', 'SELECT 1');
PREPARE maintenance_estimated_cost_stmt FROM @maintenance_estimated_cost_sql; EXECUTE maintenance_estimated_cost_stmt; DEALLOCATE PREPARE maintenance_estimated_cost_stmt;

SET @maintenance_damage_photo_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'damage_photo_url');
SET @maintenance_damage_photo_sql := IF(@maintenance_damage_photo_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN damage_photo_url VARCHAR(500) NULL AFTER estimated_cost', 'SELECT 1');
PREPARE maintenance_damage_photo_stmt FROM @maintenance_damage_photo_sql; EXECUTE maintenance_damage_photo_stmt; DEALLOCATE PREPARE maintenance_damage_photo_stmt;

SET @maintenance_before_photo_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'before_photo_url');
SET @maintenance_before_photo_sql := IF(@maintenance_before_photo_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN before_photo_url VARCHAR(500) NULL AFTER damage_photo_url', 'SELECT 1');
PREPARE maintenance_before_photo_stmt FROM @maintenance_before_photo_sql; EXECUTE maintenance_before_photo_stmt; DEALLOCATE PREPARE maintenance_before_photo_stmt;

SET @maintenance_after_photo_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'after_photo_url');
SET @maintenance_after_photo_sql := IF(@maintenance_after_photo_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN after_photo_url VARCHAR(500) NULL AFTER before_photo_url', 'SELECT 1');
PREPARE maintenance_after_photo_stmt FROM @maintenance_after_photo_sql; EXECUTE maintenance_after_photo_stmt; DEALLOCATE PREPARE maintenance_after_photo_stmt;

SET @maintenance_diagnosis_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'diagnosis');
SET @maintenance_diagnosis_sql := IF(@maintenance_diagnosis_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN diagnosis TEXT NULL AFTER after_photo_url', 'SELECT 1');
PREPARE maintenance_diagnosis_stmt FROM @maintenance_diagnosis_sql; EXECUTE maintenance_diagnosis_stmt; DEALLOCATE PREPARE maintenance_diagnosis_stmt;

SET @maintenance_action_taken_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'action_taken');
SET @maintenance_action_taken_sql := IF(@maintenance_action_taken_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN action_taken TEXT NULL AFTER diagnosis', 'SELECT 1');
PREPARE maintenance_action_taken_stmt FROM @maintenance_action_taken_sql; EXECUTE maintenance_action_taken_stmt; DEALLOCATE PREPARE maintenance_action_taken_stmt;

SET @maintenance_checklist_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'checklist');
SET @maintenance_checklist_sql := IF(@maintenance_checklist_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN checklist TEXT NULL AFTER action_taken', 'SELECT 1');
PREPARE maintenance_checklist_stmt FROM @maintenance_checklist_sql; EXECUTE maintenance_checklist_stmt; DEALLOCATE PREPARE maintenance_checklist_stmt;

SET @maintenance_spare_parts_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'spare_parts');
SET @maintenance_spare_parts_sql := IF(@maintenance_spare_parts_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN spare_parts TEXT NULL AFTER checklist', 'SELECT 1');
PREPARE maintenance_spare_parts_stmt FROM @maintenance_spare_parts_sql; EXECUTE maintenance_spare_parts_stmt; DEALLOCATE PREPARE maintenance_spare_parts_stmt;

SET @maintenance_verification_result_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'verification_result');
SET @maintenance_verification_result_sql := IF(@maintenance_verification_result_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN verification_result TEXT NULL AFTER spare_parts', 'SELECT 1');
PREPARE maintenance_verification_result_stmt FROM @maintenance_verification_result_sql; EXECUTE maintenance_verification_result_stmt; DEALLOCATE PREPARE maintenance_verification_result_stmt;

SET @maintenance_final_condition_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'final_condition');
SET @maintenance_final_condition_sql := IF(@maintenance_final_condition_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN final_condition VARCHAR(100) NULL AFTER verification_result', 'SELECT 1');
PREPARE maintenance_final_condition_stmt FROM @maintenance_final_condition_sql; EXECUTE maintenance_final_condition_stmt; DEALLOCATE PREPARE maintenance_final_condition_stmt;

SET @maintenance_verification_notes_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'verification_notes');
SET @maintenance_verification_notes_sql := IF(@maintenance_verification_notes_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN verification_notes TEXT NULL AFTER final_condition', 'SELECT 1');
PREPARE maintenance_verification_notes_stmt FROM @maintenance_verification_notes_sql; EXECUTE maintenance_verification_notes_stmt; DEALLOCATE PREPARE maintenance_verification_notes_stmt;

SET @maintenance_next_date_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'next_maintenance_date');
SET @maintenance_next_date_sql := IF(@maintenance_next_date_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN next_maintenance_date DATE NULL AFTER verification_notes', 'SELECT 1');
PREPARE maintenance_next_date_stmt FROM @maintenance_next_date_sql; EXECUTE maintenance_next_date_stmt; DEALLOCATE PREPARE maintenance_next_date_stmt;
