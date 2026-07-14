-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Waktu pembuatan: 03 Apr 2026 pada 05.07
-- Versi server: 10.4.28-MariaDB
-- Versi PHP: 8.0.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `sipena_db_local` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sipena_db_local`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `role_menu_permissions`, `menus`, `roles`, `asset_disposal_requests`, `deletion_requests`, `return_records`, `report_uploads`, `maintenance_history`, `asset_usage_logs`, `maintenance_records`, `jadwal_pemeliharaan`, `borrowing_records`, `non_medical_assets`, `medical_assets`, `notifications`, `user_activity_logs`, `activity_logs`, `users`;
SET FOREIGN_KEY_CHECKS = 1;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sipena_db_local`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `resource_type` varchar(50) DEFAULT NULL,
  `resource_id` int(11) DEFAULT NULL,
  `old_values` text DEFAULT NULL,
  `new_values` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `user_activity_logs`
--

CREATE TABLE `user_activity_logs` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `feature` varchar(100) NOT NULL,
  `action` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `metadata_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `category` varchar(30) NOT NULL DEFAULT 'system',
  `title` varchar(255) NOT NULL,
  `message` text DEFAULT NULL,
  `link` varchar(255) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read_created` (`user_id`, `is_read`, `created_at`),
  KEY `idx_notifications_reference` (`reference_type`, `reference_id`),
  KEY `idx_notifications_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `borrowing_records`
-- Sinkron dengan pembaruan formulir peminjaman
-- Berlaku untuk inventaris medis dan non-medis
--

CREATE TABLE `borrowing_records` (
  `id` int(11) NOT NULL,
  `borrowing_code` varchar(50) NOT NULL,
  `asset_id` int(11) NOT NULL,
  `asset_type` varchar(20) NOT NULL DEFAULT 'medical',
  `asset_detail_id` varchar(100) DEFAULT NULL,
  `asset_detail_name` varchar(255) DEFAULT NULL,
  `asset_detail_code` varchar(100) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `borrower_position` varchar(100) DEFAULT NULL,
  `borrower_work_unit` varchar(150) DEFAULT NULL,
  `owner_user_id` int(11) DEFAULT NULL,
  `owner_name` varchar(150) DEFAULT NULL,
  `owner_nip` varchar(30) DEFAULT NULL,
  `owner_position` varchar(100) DEFAULT NULL,
  `owner_work_unit` varchar(150) DEFAULT NULL,
  `borrow_date` datetime NOT NULL,
  `due_date` datetime DEFAULT NULL,
  `return_date` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `purpose` text DEFAULT NULL,
  `purpose_type` varchar(30) DEFAULT NULL,
  `destination_room` varchar(255) DEFAULT NULL,
  `loan_duration_value` int(11) DEFAULT NULL,
  `loan_duration_unit` varchar(20) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_by` int(11) DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `return_condition` varchar(20) DEFAULT NULL,
  `return_notes` text DEFAULT NULL,
  `return_validated_by` int(11) DEFAULT NULL,
  `return_validated_at` datetime DEFAULT NULL,
  `returned_by` int(11) DEFAULT NULL,
  `overdue_days` int(11) NOT NULL DEFAULT 0,
  `sanction_status` varchar(20) NOT NULL DEFAULT 'none',
  `sanction_notes` text DEFAULT NULL,
  `sanction_applied_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by_user_id` int(11) DEFAULT NULL,
  `resolved_notes` text DEFAULT NULL,
  `extension_count` int(11) NOT NULL DEFAULT 0,
  `last_extended_date` datetime DEFAULT NULL,
  `extension_notes` text DEFAULT NULL,
  `is_extension_blocked` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `delete_reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `jadwal_pemeliharaan`
--

CREATE TABLE `jadwal_pemeliharaan` (
  `id` int(11) NOT NULL,
  `asset_id` int(11) NOT NULL,
  `asset_type` varchar(20) NOT NULL DEFAULT 'medical',
  `tanggal` datetime NOT NULL,
  `deskripsi` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'terjadwal',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  CONSTRAINT `ck_jadwal_asset_type` CHECK (`asset_type` in ('medical','non_medical'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `asset_usage_logs`
--

CREATE TABLE `asset_usage_logs` (
  `id` int(11) NOT NULL,
  `no` varchar(50) DEFAULT NULL,
  `borrowing_id` int(11) DEFAULT NULL,
  `asset_id` int(11) NOT NULL,
  `asset_type` varchar(20) NOT NULL DEFAULT 'medical',
  `asset_detail_id` varchar(100) DEFAULT NULL,
  `asset_detail_name` varchar(255) DEFAULT NULL,
  `asset_detail_code` varchar(100) DEFAULT NULL,
  `asset_location` varchar(255) DEFAULT NULL,
  `room_name` varchar(255) NOT NULL,
  `operator_user_id` int(11) DEFAULT NULL,
  `usage_context` varchar(30) NOT NULL DEFAULT 'own_room',
  `started_at` datetime NOT NULL,
  `ended_at` datetime DEFAULT NULL,
  `usage_count` int(11) NOT NULL DEFAULT 1,
  `condition_before` varchar(50) DEFAULT NULL,
  `condition_after` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `delete_reason` text DEFAULT NULL,
  `source_type` varchar(20) NOT NULL DEFAULT 'manual'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `maintenance_history`
--

CREATE TABLE `maintenance_history` (
  `id` int(11) NOT NULL,
  `maintenance_id` int(11) NOT NULL,
  `asset_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'requested',
  `scheduled_date` datetime NOT NULL,
  `started_date` datetime DEFAULT NULL,
  `completed_date` datetime DEFAULT NULL,
  `description` text NOT NULL,
  `technician` varchar(255) DEFAULT NULL,
  `cost` decimal(12,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `validated_by` int(11) DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `delete_reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `maintenance_records`
--

CREATE TABLE `maintenance_records` (
  `id` int(11) NOT NULL,
  `maintenance_code` varchar(50) NOT NULL,
  `asset_id` int(11) NOT NULL,
  `asset_type` varchar(20) NOT NULL DEFAULT 'medical',
  `asset_detail_id` varchar(100) DEFAULT NULL,
  `asset_detail_name` varchar(255) DEFAULT NULL,
  `asset_detail_code` varchar(100) DEFAULT NULL,
  `schedule_id` int(11) DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'scheduled',
  `scheduled_date` datetime NOT NULL,
  `completed_date` datetime DEFAULT NULL,
  `description` text NOT NULL,
  `technician` varchar(255) DEFAULT NULL,
  `cost` decimal(10,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `cancellation_reason` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `completed_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `delete_reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `medical_assets`
--

CREATE TABLE `medical_assets` (
  `id` int(11) NOT NULL,
  `asset_code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(100) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'medical',
  `status` varchar(20) NOT NULL DEFAULT 'available',
  `condition` varchar(20) NOT NULL DEFAULT 'good',
  `location` varchar(255) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `purchase_price` decimal(12,2) DEFAULT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `specifications` text DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Struktur dari tabel `non_medical_assets`
--

CREATE TABLE `non_medical_assets` (
  `id` int(11) NOT NULL,
  `asset_code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `specifications` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'available',
  `condition` varchar(20) NOT NULL DEFAULT 'good',
  `usage_purpose` varchar(100) NOT NULL DEFAULT 'Operasional Bersama',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------

--
-- Struktur dari tabel `report_uploads`
--

CREATE TABLE `report_uploads` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `filename` varchar(255) NOT NULL,
  `content_type` varchar(150) NOT NULL DEFAULT 'application/octet-stream',
  `size_bytes` bigint(20) NOT NULL DEFAULT 0,
  `stored_path` varchar(255) DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `return_records`
--

CREATE TABLE `return_records` (
  `id` int(11) NOT NULL,
  `borrowing_id` int(11) NOT NULL,
  `return_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `returned_by` int(11) NOT NULL,
  `received_by` int(11) DEFAULT NULL,
  `asset_condition` varchar(20) NOT NULL DEFAULT 'good',
  `damage_description` text DEFAULT NULL,
  `penalties` decimal(10,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `delete_reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `deletion_requests`
--

CREATE TABLE `deletion_requests` (
  `id` int(11) NOT NULL,
  `request_code` varchar(50) DEFAULT NULL,
  `target_type` varchar(50) NOT NULL,
  `target_id` int(11) NOT NULL,
  `target_label` varchar(255) DEFAULT NULL,
  `reason` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `requested_by` int(11) NOT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_notes` text DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `asset_disposal_requests`
--

CREATE TABLE `asset_disposal_requests` (
  `id` int(11) NOT NULL,
  `request_code` varchar(50) DEFAULT NULL,
  `asset_id` int(11) NOT NULL,
  `asset_type` varchar(20) NOT NULL,
  `asset_detail_id` varchar(100) DEFAULT NULL,
  `asset_detail_name` varchar(255) DEFAULT NULL,
  `asset_detail_code` varchar(100) DEFAULT NULL,
  `reason` text NOT NULL,
  `condition_notes` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `requested_by` int(11) NOT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_notes` text DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `menus`
--

CREATE TABLE `menus` (
  `id` int(11) NOT NULL,
  `code` varchar(80) NOT NULL,
  `label` varchar(120) NOT NULL,
  `path` varchar(160) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `role_menu_permissions`
--

CREATE TABLE `role_menu_permissions` (
  `role_id` int(11) NOT NULL,
  `menu_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `nip` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'staff',
  `staff_access_type` varchar(20) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `work_unit` varchar(255) DEFAULT NULL,
  `sub_work_unit` varchar(255) DEFAULT NULL,
  `home_address` varchar(500) DEFAULT NULL,
  `phone_number` varchar(25) DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL,
  `session_version` int(11) NOT NULL DEFAULT 0,
  `uml_access` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `account_status` varchar(20) NOT NULL DEFAULT 'active',
  `must_change_password` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `delete_reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


--
-- --------------------------------------------------------







-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activity_user` (`user_id`);

--
-- Indeks untuk tabel `user_activity_logs`
--
ALTER TABLE `user_activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_activity_user_created` (`user_id`,`created_at`);

--
-- Indeks untuk tabel `borrowing_records`
--
ALTER TABLE `borrowing_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_borrowing_code` (`borrowing_code`),
  ADD KEY `idx_borrowing_user` (`user_id`),
  ADD KEY `idx_borrowing_owner_user` (`owner_user_id`),
  ADD KEY `idx_borrowing_asset` (`asset_id`),
  ADD KEY `idx_borrowing_asset_type` (`asset_type`),
  ADD KEY `idx_borrowing_approved_by` (`approved_by`),
  ADD KEY `idx_borrowing_rejected_by` (`rejected_by`),
  ADD KEY `idx_borrowing_return_validated_by` (`return_validated_by`),
  ADD KEY `idx_borrowing_returned_by` (`returned_by`),
  ADD KEY `idx_borrowing_sanction_status` (`sanction_status`),
  ADD KEY `idx_user_overdue_status` (`user_id`,`status`,`sanction_status`),
  ADD KEY `idx_user_extension_status` (`user_id`,`sanction_status`,`is_extension_blocked`),
  ADD KEY `idx_borrowing_resolved_by_user_id` (`resolved_by_user_id`);

--
-- Indeks untuk tabel `asset_usage_logs`
--
ALTER TABLE `asset_usage_logs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_asset_usage_no` (`no`),
  ADD KEY `idx_asset_usage_borrowing` (`borrowing_id`),
  ADD KEY `idx_asset_usage_asset` (`asset_type`,`asset_id`,`asset_detail_id`),
  ADD KEY `idx_asset_usage_room_started` (`room_name`,`started_at`),
  ADD KEY `idx_asset_usage_operator` (`operator_user_id`),
  ADD KEY `idx_asset_usage_created_by` (`created_by`),
  ADD KEY `idx_asset_usage_deleted_at` (`deleted_at`);

--
-- Indeks untuk tabel `jadwal_pemeliharaan`
--
ALTER TABLE `jadwal_pemeliharaan`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_jadwal_asset_id_type` (`asset_id`, `asset_type`);

--
-- Indeks untuk tabel `maintenance_history`
--
ALTER TABLE `maintenance_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_history_maintenance` (`maintenance_id`),
  ADD KEY `idx_history_created_by` (`created_by`),
  ADD KEY `idx_history_validated_by` (`validated_by`);

--
-- Indeks untuk tabel `maintenance_records`
--
ALTER TABLE `maintenance_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_maintenance_code` (`maintenance_code`),
  ADD KEY `idx_maintenance_asset` (`asset_id`),
  ADD KEY `idx_maintenance_asset_type` (`asset_type`),
  ADD KEY `idx_maintenance_created_by` (`created_by`),
  ADD KEY `idx_maintenance_completed_by` (`completed_by`),
  ADD KEY `idx_maintenance_schedule_id` (`schedule_id`);

--
-- Indeks untuk tabel `medical_assets`
--
ALTER TABLE `medical_assets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_medical_asset_code` (`asset_code`),
  ADD KEY `idx_medical_type` (`type`);

--
-- Indeks untuk tabel `non_medical_assets`
--
ALTER TABLE `non_medical_assets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_non_medical_asset_code` (`asset_code`),
  ADD KEY `idx_non_medical_created_by` (`created_by`),
  ADD KEY `idx_non_medical_condition` (`condition`);

--
-- Indeks untuk tabel `report_uploads`
--
ALTER TABLE `report_uploads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_report_user` (`user_id`);

--
-- Indeks untuk tabel `return_records`
--
ALTER TABLE `return_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_return_borrowing` (`borrowing_id`),
  ADD KEY `idx_return_returned_by` (`returned_by`),
  ADD KEY `idx_return_received_by` (`received_by`);

--
-- Indeks untuk tabel `deletion_requests`
--
ALTER TABLE `deletion_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_deletion_requests_status` (`status`),
  ADD KEY `idx_deletion_requests_target` (`target_type`,`target_id`),
  ADD KEY `idx_deletion_requests_requested_by` (`requested_by`),
  ADD KEY `idx_deletion_requests_reviewed_by` (`reviewed_by`);

--
-- Indeks untuk tabel `asset_disposal_requests`
--
ALTER TABLE `asset_disposal_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_asset_disposal_requests_status` (`status`),
  ADD KEY `idx_asset_disposal_requests_asset` (`asset_type`,`asset_id`),
  ADD KEY `idx_asset_disposal_requests_requested_by` (`requested_by`),
  ADD KEY `idx_asset_disposal_requests_reviewed_by` (`reviewed_by`);

--
-- Indeks untuk tabel `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_roles_code` (`code`);

--
-- Indeks untuk tabel `menus`
--
ALTER TABLE `menus`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_menus_code` (`code`),
  ADD UNIQUE KEY `uq_menus_path` (`path`);

--
-- Indeks untuk tabel `role_menu_permissions`
--
ALTER TABLE `role_menu_permissions`
  ADD PRIMARY KEY (`role_id`,`menu_id`),
  ADD KEY `idx_role_menu_permissions_menu` (`menu_id`);

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_nip` (`nip`),
  ADD UNIQUE KEY `uq_users_email` (`email`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `user_activity_logs`
--
ALTER TABLE `user_activity_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `borrowing_records`
--
ALTER TABLE `borrowing_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `asset_usage_logs`
--
ALTER TABLE `asset_usage_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `jadwal_pemeliharaan`
--
ALTER TABLE `jadwal_pemeliharaan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `maintenance_history`
--
ALTER TABLE `maintenance_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `maintenance_records`
--
ALTER TABLE `maintenance_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `medical_assets`
--
ALTER TABLE `medical_assets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT untuk tabel `non_medical_assets`
--
ALTER TABLE `non_medical_assets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT untuk tabel `report_uploads`
--
ALTER TABLE `report_uploads`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `return_records`
--
ALTER TABLE `return_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `deletion_requests`
--
ALTER TABLE `deletion_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `asset_disposal_requests`
--
ALTER TABLE `asset_disposal_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `menus`
--
ALTER TABLE `menus`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `user_activity_logs`
--
ALTER TABLE `user_activity_logs`
  ADD CONSTRAINT `fk_user_activity_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `borrowing_records`
--
ALTER TABLE `borrowing_records`
  ADD CONSTRAINT `fk_borrowing_owner_user` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_borrowing_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_borrowing_rejected_by` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_borrowing_return_validated_by` FOREIGN KEY (`return_validated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_borrowing_returned_by` FOREIGN KEY (`returned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_borrowing_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `asset_usage_logs`
--
ALTER TABLE `asset_usage_logs`
  ADD CONSTRAINT `fk_asset_usage_operator` FOREIGN KEY (`operator_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_asset_usage_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `maintenance_history`
--
ALTER TABLE `maintenance_history`
  ADD CONSTRAINT `fk_history_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_history_maintenance` FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_history_validated_by` FOREIGN KEY (`validated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `maintenance_records`
--
ALTER TABLE `maintenance_records`
  ADD CONSTRAINT `fk_maintenance_completed_by` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_maintenance_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_maintenance_schedule_id` FOREIGN KEY (`schedule_id`) REFERENCES `jadwal_pemeliharaan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `non_medical_assets`
--
ALTER TABLE `non_medical_assets`
  ADD CONSTRAINT `fk_non_medical_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `report_uploads`
--
ALTER TABLE `report_uploads`
  ADD CONSTRAINT `fk_report_uploads_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `return_records`
--
ALTER TABLE `return_records`
  ADD CONSTRAINT `fk_return_borrowing` FOREIGN KEY (`borrowing_id`) REFERENCES `borrowing_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_return_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_return_returned_by` FOREIGN KEY (`returned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `deletion_requests`
--
ALTER TABLE `deletion_requests`
  ADD CONSTRAINT `fk_deletion_requests_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_deletion_requests_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ketidakleluasaan untuk tabel `role_menu_permissions`
--
ALTER TABLE `role_menu_permissions`
  ADD CONSTRAINT `fk_role_menu_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_role_menu_permissions_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
