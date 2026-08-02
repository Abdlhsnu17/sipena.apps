SET @maintenance_actual_start_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'actual_start_at');
SET @maintenance_actual_start_sql := IF(@maintenance_actual_start_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN actual_start_at DATETIME NULL AFTER completed_date', 'SELECT 1');
PREPARE maintenance_actual_start_stmt FROM @maintenance_actual_start_sql; EXECUTE maintenance_actual_start_stmt; DEALLOCATE PREPARE maintenance_actual_start_stmt;

SET @maintenance_actual_end_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'actual_end_at');
SET @maintenance_actual_end_sql := IF(@maintenance_actual_end_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN actual_end_at DATETIME NULL AFTER actual_start_at', 'SELECT 1');
PREPARE maintenance_actual_end_stmt FROM @maintenance_actual_end_sql; EXECUTE maintenance_actual_end_stmt; DEALLOCATE PREPARE maintenance_actual_end_stmt;

SET @maintenance_recurrence_interval_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'recurrence_interval');
SET @maintenance_recurrence_interval_sql := IF(@maintenance_recurrence_interval_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN recurrence_interval VARCHAR(20) NOT NULL DEFAULT ''none'' AFTER actual_end_at', 'SELECT 1');
PREPARE maintenance_recurrence_interval_stmt FROM @maintenance_recurrence_interval_sql; EXECUTE maintenance_recurrence_interval_stmt; DEALLOCATE PREPARE maintenance_recurrence_interval_stmt;

SET @maintenance_recurrence_enabled_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'recurrence_enabled');
SET @maintenance_recurrence_enabled_sql := IF(@maintenance_recurrence_enabled_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN recurrence_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER recurrence_interval', 'SELECT 1');
PREPARE maintenance_recurrence_enabled_stmt FROM @maintenance_recurrence_enabled_sql; EXECUTE maintenance_recurrence_enabled_stmt; DEALLOCATE PREPARE maintenance_recurrence_enabled_stmt;

SET @maintenance_approval_status_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'approval_status');
SET @maintenance_approval_status_sql := IF(@maintenance_approval_status_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT ''not_required'' AFTER recurrence_enabled', 'SELECT 1');
PREPARE maintenance_approval_status_stmt FROM @maintenance_approval_status_sql; EXECUTE maintenance_approval_status_stmt; DEALLOCATE PREPARE maintenance_approval_status_stmt;

SET @maintenance_approval_notes_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'approval_notes');
SET @maintenance_approval_notes_sql := IF(@maintenance_approval_notes_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN approval_notes TEXT NULL AFTER approval_status', 'SELECT 1');
PREPARE maintenance_approval_notes_stmt FROM @maintenance_approval_notes_sql; EXECUTE maintenance_approval_notes_stmt; DEALLOCATE PREPARE maintenance_approval_notes_stmt;

SET @maintenance_approved_by_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'approved_by');
SET @maintenance_approved_by_sql := IF(@maintenance_approved_by_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN approved_by INT(11) NULL AFTER approval_notes', 'SELECT 1');
PREPARE maintenance_approved_by_stmt FROM @maintenance_approved_by_sql; EXECUTE maintenance_approved_by_stmt; DEALLOCATE PREPARE maintenance_approved_by_stmt;

SET @maintenance_approved_at_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'approved_at');
SET @maintenance_approved_at_sql := IF(@maintenance_approved_at_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN approved_at DATETIME NULL AFTER approved_by', 'SELECT 1');
PREPARE maintenance_approved_at_stmt FROM @maintenance_approved_at_sql; EXECUTE maintenance_approved_at_stmt; DEALLOCATE PREPARE maintenance_approved_at_stmt;

SET @maintenance_reminder_h7_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'reminder_h7_sent_at');
SET @maintenance_reminder_h7_sql := IF(@maintenance_reminder_h7_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN reminder_h7_sent_at DATETIME NULL AFTER approved_at', 'SELECT 1');
PREPARE maintenance_reminder_h7_stmt FROM @maintenance_reminder_h7_sql; EXECUTE maintenance_reminder_h7_stmt; DEALLOCATE PREPARE maintenance_reminder_h7_stmt;

SET @maintenance_reminder_h3_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'reminder_h3_sent_at');
SET @maintenance_reminder_h3_sql := IF(@maintenance_reminder_h3_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN reminder_h3_sent_at DATETIME NULL AFTER reminder_h7_sent_at', 'SELECT 1');
PREPARE maintenance_reminder_h3_stmt FROM @maintenance_reminder_h3_sql; EXECUTE maintenance_reminder_h3_stmt; DEALLOCATE PREPARE maintenance_reminder_h3_stmt;

SET @maintenance_reminder_h1_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'reminder_h1_sent_at');
SET @maintenance_reminder_h1_sql := IF(@maintenance_reminder_h1_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN reminder_h1_sent_at DATETIME NULL AFTER reminder_h3_sent_at', 'SELECT 1');
PREPARE maintenance_reminder_h1_stmt FROM @maintenance_reminder_h1_sql; EXECUTE maintenance_reminder_h1_stmt; DEALLOCATE PREPARE maintenance_reminder_h1_stmt;

SET @maintenance_validated_by_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'validated_by');
SET @maintenance_validated_by_sql := IF(@maintenance_validated_by_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN validated_by INT(11) NULL AFTER completed_by', 'SELECT 1');
PREPARE maintenance_validated_by_stmt FROM @maintenance_validated_by_sql; EXECUTE maintenance_validated_by_stmt; DEALLOCATE PREPARE maintenance_validated_by_stmt;

SET @maintenance_validated_at_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records' AND COLUMN_NAME = 'validated_at');
SET @maintenance_validated_at_sql := IF(@maintenance_validated_at_exists = 0, 'ALTER TABLE maintenance_records ADD COLUMN validated_at DATETIME NULL AFTER validated_by', 'SELECT 1');
PREPARE maintenance_validated_at_stmt FROM @maintenance_validated_at_sql; EXECUTE maintenance_validated_at_stmt; DEALLOCATE PREPARE maintenance_validated_at_stmt;
