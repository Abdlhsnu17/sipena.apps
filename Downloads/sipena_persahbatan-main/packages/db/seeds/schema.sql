-- =====================================================
-- SIPENA LOCAL DATABASE SCHEMA (Clean for phpMyAdmin)
-- Target: MySQL / MariaDB (phpMyAdmin) - localhost
-- =====================================================

/*!40101 SET NAMES utf8mb4 */;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET FOREIGN_KEY_CHECKS = 0;

START TRANSACTION;

-- -----------------------------------------------------
-- Database
-- -----------------------------------------------------
CREATE DATABASE IF NOT EXISTS `sipena_db_local`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `sipena_db_local`;

-- -----------------------------------------------------
-- OPTIONAL RESET (hapus tabel lama biar import mulus)
-- Urutan drop: child -> parent (biar gak mentok FK)
-- -----------------------------------------------------
DROP TABLE IF EXISTS `report_uploads`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `maintenance_history`;
DROP TABLE IF EXISTS `maintenance_records`;
DROP TABLE IF EXISTS `return_records`;
DROP TABLE IF EXISTS `borrowing_records`;
DROP TABLE IF EXISTS `jadwal_pemeliharaan`;
DROP TABLE IF EXISTS `non_medical_assets`;
DROP TABLE IF EXISTS `medical_assets`;
DROP TABLE IF EXISTS `users`;

-- -----------------------------------------------------
-- Table: users
-- -----------------------------------------------------
CREATE TABLE `users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nip` VARCHAR(20) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'staff',
  `staff_access_type` VARCHAR(20) DEFAULT NULL,
  `gender` VARCHAR(20) DEFAULT NULL,
  `work_unit` VARCHAR(255) DEFAULT NULL,
  `home_address` VARCHAR(500) DEFAULT NULL,
  `photo_path` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `uml_access` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_nip` (`nip`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: medical_assets
-- -----------------------------------------------------
CREATE TABLE `medical_assets` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `asset_code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `category` VARCHAR(100) NOT NULL,
  `type` VARCHAR(20) NOT NULL DEFAULT 'medical',
  `status` VARCHAR(20) NOT NULL DEFAULT 'available',
  `condition` VARCHAR(20) NOT NULL DEFAULT 'good',
  `location` VARCHAR(255) DEFAULT NULL,
  `purchase_date` DATE DEFAULT NULL,
  `purchase_price` DECIMAL(12,2) DEFAULT NULL,
  `warranty_expiry` DATE DEFAULT NULL,
  `specifications` TEXT DEFAULT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_medical_asset_code` (`asset_code`),
  KEY `idx_medical_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: non_medical_assets
-- -----------------------------------------------------
CREATE TABLE `non_medical_assets` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `asset_code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `brand` VARCHAR(100) DEFAULT NULL,
  `model` VARCHAR(100) DEFAULT NULL,
  `serial_number` VARCHAR(100) DEFAULT NULL,
  `purchase_date` DATE DEFAULT NULL,
  `warranty_expiry` DATE DEFAULT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `specifications` TEXT DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'available',
  `condition_status` VARCHAR(20) NOT NULL DEFAULT 'good',
  `usage_purpose` VARCHAR(100) NOT NULL DEFAULT 'Operasional Bersama',
  `created_by` INT(11) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_non_medical_asset_code` (`asset_code`),
  KEY `idx_non_medical_created_by` (`created_by`),
  CONSTRAINT `fk_non_medical_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: jadwal_pemeliharaan
-- -----------------------------------------------------
CREATE TABLE `jadwal_pemeliharaan` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `asset_id` INT(11) NOT NULL,
  `tanggal` DATE NOT NULL,
  `deskripsi` TEXT DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'terjadwal',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_jadwal_asset_id` (`asset_id`),
  CONSTRAINT `fk_jadwal_asset`
    FOREIGN KEY (`asset_id`) REFERENCES `medical_assets` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: borrowing_records
-- -----------------------------------------------------
CREATE TABLE `borrowing_records` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `borrowing_code` VARCHAR(50) NOT NULL,
  `asset_id` INT(11) NOT NULL,
  `asset_type` VARCHAR(20) NOT NULL DEFAULT 'medical',
  `asset_detail_id` VARCHAR(100) DEFAULT NULL,
  `asset_detail_name` VARCHAR(255) DEFAULT NULL,
  `asset_detail_code` VARCHAR(100) DEFAULT NULL,
  `user_id` INT(11) NOT NULL,
  `borrow_date` DATETIME NOT NULL,
  `due_date` DATE NOT NULL,
  `return_date` DATETIME DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `purpose` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `approved_by` INT(11) DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `rejected_by` INT(11) DEFAULT NULL,
  `rejected_at` DATETIME DEFAULT NULL,
  `rejection_reason` TEXT DEFAULT NULL,
  `return_condition` VARCHAR(20) DEFAULT NULL,
  `return_notes` TEXT DEFAULT NULL,
  `return_validated_by` INT(11) DEFAULT NULL,
  `return_validated_at` DATETIME DEFAULT NULL,
  `returned_by` INT(11) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_borrowing_code` (`borrowing_code`),
  KEY `idx_borrowing_user` (`user_id`),
  KEY `idx_borrowing_asset` (`asset_id`),
  KEY `idx_borrowing_asset_type` (`asset_type`),
  KEY `idx_borrowing_approved_by` (`approved_by`),
  KEY `idx_borrowing_rejected_by` (`rejected_by`),
  KEY `idx_borrowing_return_validated_by` (`return_validated_by`),
  KEY `idx_borrowing_returned_by` (`returned_by`),
  CONSTRAINT `fk_borrowing_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_borrowing_approved_by`
    FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_borrowing_rejected_by`
    FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_borrowing_return_validated_by`
    FOREIGN KEY (`return_validated_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_borrowing_returned_by`
    FOREIGN KEY (`returned_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: return_records
-- -----------------------------------------------------
CREATE TABLE `return_records` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `borrowing_id` INT(11) NOT NULL,
  `return_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `returned_by` INT(11) NOT NULL,
  `received_by` INT(11) DEFAULT NULL,
  `asset_condition` VARCHAR(20) NOT NULL DEFAULT 'good',
  `damage_description` TEXT DEFAULT NULL,
  `penalties` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_return_borrowing` (`borrowing_id`),
  KEY `idx_return_returned_by` (`returned_by`),
  KEY `idx_return_received_by` (`received_by`),
  CONSTRAINT `fk_return_borrowing`
    FOREIGN KEY (`borrowing_id`) REFERENCES `borrowing_records` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_return_returned_by`
    FOREIGN KEY (`returned_by`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_return_received_by`
    FOREIGN KEY (`received_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: maintenance_records
-- -----------------------------------------------------
CREATE TABLE `maintenance_records` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `maintenance_code` VARCHAR(50) NOT NULL,
  `asset_id` INT(11) NOT NULL,
  `asset_type` VARCHAR(20) NOT NULL DEFAULT 'medical',
  `asset_detail_id` VARCHAR(100) DEFAULT NULL,
  `asset_detail_name` VARCHAR(255) DEFAULT NULL,
  `asset_detail_code` VARCHAR(100) DEFAULT NULL,
  `schedule_id` INT(11) DEFAULT NULL,
  `type` VARCHAR(50) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  `scheduled_date` DATE NOT NULL,
  `completed_date` DATETIME DEFAULT NULL,
  `description` TEXT NOT NULL,
  `technician` VARCHAR(255) DEFAULT NULL,
  `cost` DECIMAL(10,2) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_by` INT(11) DEFAULT NULL,
  `completed_by` INT(11) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_maintenance_code` (`maintenance_code`),
  KEY `idx_maintenance_asset` (`asset_id`),
  KEY `idx_maintenance_asset_type` (`asset_type`),
  KEY `idx_maintenance_created_by` (`created_by`),
  KEY `idx_maintenance_completed_by` (`completed_by`),
  KEY `idx_maintenance_schedule_id` (`schedule_id`),
  CONSTRAINT `fk_maintenance_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_maintenance_completed_by`
    FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_maintenance_schedule_id`
    FOREIGN KEY (`schedule_id`) REFERENCES `jadwal_pemeliharaan` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: maintenance_history
-- -----------------------------------------------------
CREATE TABLE `maintenance_history` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `maintenance_id` INT(11) NOT NULL,
  `asset_id` INT(11) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'requested',
  `scheduled_date` DATE NOT NULL,
  `started_date` DATETIME DEFAULT NULL,
  `completed_date` DATETIME DEFAULT NULL,
  `description` TEXT NOT NULL,
  `technician` VARCHAR(255) DEFAULT NULL,
  `cost` DECIMAL(12,2) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_by` INT(11) DEFAULT NULL,
  `validated_by` INT(11) DEFAULT NULL,
  `validated_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_history_maintenance` (`maintenance_id`),
  KEY `idx_history_created_by` (`created_by`),
  KEY `idx_history_validated_by` (`validated_by`),
  CONSTRAINT `fk_history_maintenance`
    FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance_records` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_history_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_history_validated_by`
    FOREIGN KEY (`validated_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: activity_logs
-- -----------------------------------------------------
CREATE TABLE `activity_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `resource_type` VARCHAR(50) DEFAULT NULL,
  `resource_id` INT(11) DEFAULT NULL,
  `old_values` TEXT DEFAULT NULL,
  `new_values` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_user` (`user_id`),
  CONSTRAINT `fk_activity_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: report_uploads
-- -----------------------------------------------------
CREATE TABLE `report_uploads` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) DEFAULT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `content_type` VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
  `size_bytes` BIGINT NOT NULL DEFAULT 0,
  `stored_path` VARCHAR(255) DEFAULT NULL,
  `uploaded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_report_user` (`user_id`),
  CONSTRAINT `fk_report_uploads_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
