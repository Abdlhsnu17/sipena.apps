import { RowDataPacket } from 'mysql2';
import pool from '../config/database';

let ensuredNonMedicalSpecificationsColumn = false;
let ensuredReportUploadsTable = false;
let ensuredMaintenanceAssetTypeColumn = false;
let ensuredMaintenanceDetailColumns = false;
let ensuredUserProfileColumns = false;
let ensuredNonMedicalAssetsTable = false;

export async function ensureNonMedicalAssetsTable(): Promise<void> {
  if (ensuredNonMedicalAssetsTable) return;

  const [tables] = await pool.query<RowDataPacket[]>(
    "SHOW TABLES LIKE 'non_medical_assets'"
  );

  if (tables.length === 0) {
    await pool.query(`
      CREATE TABLE non_medical_assets (
        id INT(11) NOT NULL AUTO_INCREMENT,
        asset_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        brand VARCHAR(100) DEFAULT NULL,
        model VARCHAR(100) DEFAULT NULL,
        serial_number VARCHAR(100) DEFAULT NULL,
        purchase_date DATE DEFAULT NULL,
        warranty_expiry DATE DEFAULT NULL,
        location VARCHAR(255) DEFAULT NULL,
        specifications TEXT DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'available',
        condition_status VARCHAR(20) DEFAULT 'good',
        usage_purpose VARCHAR(100) DEFAULT 'Operasional Bersama',
        created_by INT(11) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_non_medical_asset_code (asset_code),
        KEY idx_non_medical_created_by (created_by),
        CONSTRAINT fk_non_medical_created_by
          FOREIGN KEY (created_by) REFERENCES users(id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  ensuredNonMedicalAssetsTable = true;
}

export async function ensureNonMedicalSpecificationsColumn(): Promise<void> {
  if (ensuredNonMedicalSpecificationsColumn) return;

  await ensureNonMedicalAssetsTable();


  const columnCheckQuery = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'non_medical_assets'
      AND COLUMN_NAME = 'specifications'
  `;

  const [rows] = await pool.query<RowDataPacket[]>(columnCheckQuery);
  if (rows.length === 0) {
    await pool.query(`
      ALTER TABLE non_medical_assets
      ADD COLUMN specifications TEXT DEFAULT NULL
    `);
  }

  ensuredNonMedicalSpecificationsColumn = true;
}

export async function ensureReportUploadsTable(): Promise<void> {
  if (ensuredReportUploadsTable) return;

  // Create the uploads table if it doesn't exist yet
  const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'report_uploads'");
  if (tables.length === 0) {
    await pool.query(`
      CREATE TABLE report_uploads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
        size_bytes BIGINT NOT NULL DEFAULT 0,
        stored_path VARCHAR(255) NULL,
        uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes TEXT NULL,
        CONSTRAINT fk_report_uploads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  ensuredReportUploadsTable = true;
}

export async function ensureUserProfileColumns(): Promise<void> {
  if (ensuredUserProfileColumns) return;

  const columnCheckQuery = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME IN ('gender', 'work_unit', 'home_address', 'photo_path')
  `;

  const [rows] = await pool.query<RowDataPacket[]>(columnCheckQuery);
  const existingColumns = new Set(rows.map((row) => row.COLUMN_NAME));

  if (!existingColumns.has('gender')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN gender VARCHAR(20) DEFAULT NULL AFTER staff_access_type
    `);
  }

  if (!existingColumns.has('work_unit')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN work_unit VARCHAR(255) DEFAULT NULL AFTER gender
    `);
  }

  if (!existingColumns.has('home_address')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN home_address VARCHAR(500) DEFAULT NULL AFTER work_unit
    `);
  }

  if (!existingColumns.has('photo_path')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN photo_path VARCHAR(255) DEFAULT NULL AFTER home_address
    `);
  }

  ensuredUserProfileColumns = true;
}

export async function ensureMaintenanceAssetTypeColumn(): Promise<void> {
  if (ensuredMaintenanceAssetTypeColumn) return;

  const columnCheckQuery = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'maintenance_records'
      AND COLUMN_NAME = 'asset_type'
  `;

  const [columnRows] = await pool.query<RowDataPacket[]>(columnCheckQuery);
  if (columnRows.length === 0) {
    await pool.query(`
      ALTER TABLE maintenance_records
      ADD COLUMN asset_type VARCHAR(20) NOT NULL DEFAULT 'medical' AFTER asset_id
    `);
  }

  const [indexRows] = await pool.query<RowDataPacket[]>(
    "SHOW INDEX FROM maintenance_records WHERE Key_name = 'idx_maintenance_asset_type'"
  );
  if (indexRows.length === 0) {
    await pool.query('CREATE INDEX idx_maintenance_asset_type ON maintenance_records (asset_type)');
  }

  ensuredMaintenanceAssetTypeColumn = true;
}

export async function ensureMaintenanceDetailColumns(): Promise<void> {
  if (ensuredMaintenanceDetailColumns) return;

  const columnCheckQuery = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'maintenance_records'
      AND COLUMN_NAME IN ('asset_detail_id', 'asset_detail_name', 'asset_detail_code', 'schedule_id')
  `;

  const [rows] = await pool.query<RowDataPacket[]>(columnCheckQuery);
  const existing = new Set(rows.map((row) => row.COLUMN_NAME));

  if (!existing.has('asset_detail_id')) {
    await pool.query(`
      ALTER TABLE maintenance_records
      ADD COLUMN asset_detail_id VARCHAR(100) DEFAULT NULL AFTER asset_type
    `);
  }

  if (!existing.has('asset_detail_name')) {
    await pool.query(`
      ALTER TABLE maintenance_records
      ADD COLUMN asset_detail_name VARCHAR(255) DEFAULT NULL AFTER asset_detail_id
    `);
  }

  if (!existing.has('asset_detail_code')) {
    await pool.query(`
      ALTER TABLE maintenance_records
      ADD COLUMN asset_detail_code VARCHAR(100) DEFAULT NULL AFTER asset_detail_name
    `);
  }

  if (!existing.has('schedule_id')) {
    await pool.query(`
      ALTER TABLE maintenance_records
      ADD COLUMN schedule_id INT(11) DEFAULT NULL AFTER asset_detail_code
    `);
  }

  ensuredMaintenanceDetailColumns = true;
}
