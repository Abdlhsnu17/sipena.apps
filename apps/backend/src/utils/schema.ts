import bcrypt from 'bcryptjs';
import fs from 'fs';
import mysql, { RowDataPacket } from 'mysql2/promise';
import path from 'path';
import pool from '../config/database';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('schema');

let ensuredNonMedicalSpecificationsColumn = false;
let ensuredNonMedicalConditionColumn = false;
let ensuredReportUploadsTable = false;
let ensuredMaintenanceAssetTypeColumn = false;
let ensuredMaintenanceDetailColumns = false;
let ensuredMaintenanceCancellationReasonColumn = false;
let ensuredMaintenanceOperationsSchema = false;
let ensuredUserProfileColumns = false;
let ensuredUserSessionVersionColumn = false;
let ensuredUserPhoneNumberColumn = false;
let ensuredNonMedicalAssetsTable = false;
let ensuredScheduleAssetFkRemoved = false;
let ensuredUserActivityLogsTable = false;
let ensuredBorrowingWorkflowColumns = false;
let ensuredAssetUsageLogsTable = false;
let ensuredUserAccessControlColumns = false;
let ensuredUserLoginSecurityColumns = false;
let ensuredInitialAdminAccount = false;
let ensuredRoleMenuAccessControlTables = false;
let ensuredDeletionRequestsTable = false;
let ensuredAssetDisposalTable = false;
let ensuredAssetCategoryUmbrellaValues = false;
let attemptedCoreSchemaBootstrap = false;

const tableExists = async (tableName: string): Promise<boolean> => {
  const [rows] = await pool.query<RowDataPacket[]>('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
};

const getUserIdColumnType = async (): Promise<string> => {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
    LIMIT 1
  `);
  // COLUMN_TYPE is database metadata, but keep a strict whitelist before interpolating it in DDL.
  const type = String(rows[0]?.COLUMN_TYPE || 'int(11)').toLowerCase();
  return /^(tinyint|smallint|mediumint|int|bigint)\(\d+\)( unsigned)?$/.test(type) ? type : 'int(11)';
};

const resolveSchemaFilePath = (): string => {
  const candidates = [
    path.resolve(process.cwd(), '../database/seeds/schema.sql'),
    path.resolve(process.cwd(), '../../packages/database/seeds/schema.sql'),
    path.resolve(__dirname, '../../../database/seeds/schema.sql'),
    path.resolve(__dirname, '../../../../packages/database/seeds/schema.sql'),
  ];

  const matchedPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!matchedPath) {
    throw new Error(`Schema file not found. Checked: ${candidates.join(', ')}`);
  }

  return matchedPath;
};

const sanitizeBootstrapSql = (sql: string): string => {
  return sql
    .replace(/\/\*![\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '')
    .replace(/^\s*CREATE DATABASE IF NOT EXISTS .*?;\s*$/gim, '')
    .replace(/^\s*USE\s+`?.*?`?;\s*$/gim, '')
    .replace(/^\s*;\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export async function ensureCoreSchemaInitialized(): Promise<void> {
  if (attemptedCoreSchemaBootstrap) return;

  attemptedCoreSchemaBootstrap = true;

  if (await tableExists('users')) {
    return;
  }

  const shouldBootstrap = (process.env.DB_AUTO_INIT_FROM_SCHEMA || '').trim().toLowerCase() === 'true';
  if (!shouldBootstrap) {
    throw new Error(
      'Core database schema is missing. Set DB_AUTO_INIT_FROM_SCHEMA=true to initialize from packages/database/seeds/schema.sql, or import the schema manually before starting the backend.'
    );
  }

  const schemaPath = resolveSchemaFilePath();
  const rawSql = fs.readFileSync(schemaPath, 'utf8');
  const sql = sanitizeBootstrapSql(rawSql);

  if (!sql) {
    throw new Error(`Schema file is empty after sanitization: ${schemaPath}`);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'sipena_db_local',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || undefined,
    multipleStatements: true,
  });

  try {
    logger.info('Initializing empty database from schema file', { schemaPath });
    await connection.query(sql);
    logger.info('Core database schema initialized');
  } finally {
    await connection.end();
  }
}

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
        \`condition\` VARCHAR(20) DEFAULT 'good',
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

export async function ensureNonMedicalConditionColumn(): Promise<void> {
  if (ensuredNonMedicalConditionColumn) return;

  await ensureNonMedicalAssetsTable();

  const [conditionRows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'non_medical_assets'
        AND COLUMN_NAME = 'condition'
    `
  );

  if (conditionRows.length === 0) {
    const [legacyRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'non_medical_assets'
          AND COLUMN_NAME = 'condition_status'
      `
    );

    if (legacyRows.length > 0) {
      await pool.query(`
        ALTER TABLE non_medical_assets
        CHANGE COLUMN condition_status \`condition\` VARCHAR(20) DEFAULT 'good'
      `);
    } else {
      await pool.query(`
        ALTER TABLE non_medical_assets
        ADD COLUMN \`condition\` VARCHAR(20) DEFAULT 'good'
      `);
    }
  }

  ensuredNonMedicalConditionColumn = true;
}

export async function ensureNonMedicalSpecificationsColumn(): Promise<void> {
  if (ensuredNonMedicalSpecificationsColumn) return;

  await ensureNonMedicalAssetsTable();
  await ensureNonMedicalConditionColumn();


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

export async function ensureAssetCategoryUmbrellaValues(): Promise<void> {
  if (ensuredAssetCategoryUmbrellaValues) return;

  if (await tableExists('medical_assets')) {
    await pool.query(
      `UPDATE medical_assets
       SET category = 'Medis'
       WHERE COALESCE(TRIM(category), '') <> 'Medis'`
    );
  }

  if (await tableExists('non_medical_assets')) {
    await pool.query(
      `UPDATE non_medical_assets
       SET category = 'Non Medis'
       WHERE COALESCE(TRIM(category), '') <> 'Non Medis'`
    );
  }

  ensuredAssetCategoryUmbrellaValues = true;
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
      category VARCHAR(80) NULL,
      related_module VARCHAR(80) NULL,
      retention_until DATE NULL,
        CONSTRAINT fk_report_uploads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  const [columns] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM report_uploads");
  const columnNames = new Set(columns.map((column) => String(column.Field)));
  if (!columnNames.has('category')) await pool.query('ALTER TABLE report_uploads ADD COLUMN category VARCHAR(80) NULL AFTER notes');
  if (!columnNames.has('related_module')) await pool.query('ALTER TABLE report_uploads ADD COLUMN related_module VARCHAR(80) NULL AFTER category');
  if (!columnNames.has('retention_until')) await pool.query('ALTER TABLE report_uploads ADD COLUMN retention_until DATE NULL AFTER related_module');

  ensuredReportUploadsTable = true;
}

export async function ensureUserSessionVersionColumn(): Promise<void> {
  if (ensuredUserSessionVersionColumn) return;

  if (!(await tableExists('users'))) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'session_version'
    `
  );

  if (rows.length === 0) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN session_version INT NOT NULL DEFAULT 0 AFTER last_login
    `);
  }

  ensuredUserSessionVersionColumn = true;
}

export async function ensureUserPhoneNumberColumn(): Promise<void> {
  if (ensuredUserPhoneNumberColumn) return;

  if (!(await tableExists('users'))) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'phone_number'
    `
  );

  if (rows.length === 0) {
    const [homeAddressRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'home_address'
      `
    );
    const afterClause = homeAddressRows.length > 0 ? ' AFTER home_address' : '';

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN phone_number VARCHAR(25) DEFAULT NULL${afterClause}
    `);
  }

  ensuredUserPhoneNumberColumn = true;
}

export async function ensureUserProfileColumns(): Promise<void> {
  if (ensuredUserProfileColumns) return;

  if (!(await tableExists('users'))) return;

  await ensureUserSessionVersionColumn();
  await ensureUserPhoneNumberColumn();

  const columnCheckQuery = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME IN ('gender', 'work_unit', 'sub_work_unit', 'home_address', 'phone_number', 'photo_path', 'session_version')
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

  if (!existingColumns.has('sub_work_unit')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN sub_work_unit VARCHAR(255) DEFAULT NULL AFTER work_unit
    `);
  }

  if (!existingColumns.has('phone_number')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN phone_number VARCHAR(25) DEFAULT NULL AFTER home_address
    `);
  }

  if (!existingColumns.has('photo_path')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN photo_path VARCHAR(255) DEFAULT NULL AFTER phone_number
    `);
  }

  ensuredUserProfileColumns = true;
}

export async function ensureUserAccessControlColumns(): Promise<void> {
  if (ensuredUserAccessControlColumns) return;

  if (!(await tableExists('users'))) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN ('account_status', 'must_change_password')
    `
  );
  const existingColumns = new Set(rows.map((row) => row.COLUMN_NAME));

  if (!existingColumns.has('account_status')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER is_active
    `);
  }

  if (!existingColumns.has('must_change_password')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER account_status
    `);
  }

  await pool.query(`
    UPDATE users
    SET account_status = CASE
      WHEN COALESCE(is_active, 1) = 1 THEN 'active'
      ELSE 'inactive'
    END
    WHERE account_status IS NULL OR account_status = ''
  `);

  ensuredUserAccessControlColumns = true;
}

export async function ensureUserLoginSecurityColumns(): Promise<void> {
  if (ensuredUserLoginSecurityColumns) return;

  if (!(await tableExists('users'))) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN ('failed_login_attempts', 'locked_until')
    `
  );
  const existingColumns = new Set(rows.map((row) => row.COLUMN_NAME));

  if (!existingColumns.has('failed_login_attempts')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0 AFTER must_change_password
    `);
  }

  if (!existingColumns.has('locked_until')) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN locked_until DATETIME DEFAULT NULL AFTER failed_login_attempts
    `);
  }

  ensuredUserLoginSecurityColumns = true;
}

// On a brand new install the `users` table is empty, so there is no way to log in through the
// public register/login flow (which can never create an admin). This bootstraps exactly one
// admin account from INITIAL_ADMIN_* env vars instead of shipping a real, hardcoded account in
// schema.sql. It is a no-op once any admin already exists.
export async function ensureInitialAdminAccount(): Promise<void> {
  if (ensuredInitialAdminAccount) return;

  if (!(await tableExists('users'))) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
  );
  const adminCount = Number(rows[0]?.count) || 0;

  if (adminCount > 0) {
    ensuredInitialAdminAccount = true;
    return;
  }

  const nip = process.env.INITIAL_ADMIN_NIP;
  const name = process.env.INITIAL_ADMIN_NAME;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const phoneNumber = process.env.INITIAL_ADMIN_PHONE;

  if (!nip || !name || !email || !password || !phoneNumber) {
    logger.warn(
      'No admin account exists yet and INITIAL_ADMIN_NIP/NAME/EMAIL/PASSWORD/PHONE are not fully set. ' +
      'Set all of them in your .env to bootstrap the first admin account.'
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users (nip, name, email, password, role, phone_number, account_status, must_change_password)
     VALUES (?, ?, ?, ?, 'admin', ?, 'active', 1)`,
    [nip, name, email, hashedPassword, phoneNumber]
  );

  logger.info('Bootstrapped initial admin account from INITIAL_ADMIN_* environment variables', { nip, email });

  ensuredInitialAdminAccount = true;
}

export async function ensureRoleMenuAccessControlTables(): Promise<void> {
  if (ensuredRoleMenuAccessControlTables) return;

  if (!(await tableExists('users'))) return;

  if (!(await tableExists('roles'))) {
    await pool.query(`
      CREATE TABLE roles (
        id INT(11) NOT NULL AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_roles_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  if (!(await tableExists('menus'))) {
    await pool.query(`
      CREATE TABLE menus (
        id INT(11) NOT NULL AUTO_INCREMENT,
        code VARCHAR(80) NOT NULL,
        label VARCHAR(120) NOT NULL,
        path VARCHAR(160) NOT NULL,
        sort_order INT(11) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_menus_code (code),
        UNIQUE KEY uq_menus_path (path)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  if (!(await tableExists('role_menu_permissions'))) {
    await pool.query(`
      CREATE TABLE role_menu_permissions (
        role_id INT(11) NOT NULL,
        menu_id INT(11) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        PRIMARY KEY (role_id, menu_id),
        KEY idx_role_menu_permissions_menu (menu_id),
        CONSTRAINT fk_role_menu_permissions_role
          FOREIGN KEY (role_id) REFERENCES roles(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_role_menu_permissions_menu
          FOREIGN KEY (menu_id) REFERENCES menus(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  ensuredRoleMenuAccessControlTables = true;
}

export async function withSchemaLock<T>(task: () => Promise<T>): Promise<T> {
  const lockName = 'sipena_schema_ensure_lock';
  const [rows] = await pool.query<RowDataPacket[]>('SELECT GET_LOCK(?, 30) AS lock_status', [lockName]);
  const lockStatus = Number(rows[0]?.lock_status || 0);

  if (lockStatus !== 1) {
    throw new Error('Gagal memperoleh schema lock untuk startup');
  }

  try {
    return await task();
  } finally {
    await pool.query('DO RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
  }
}

export async function ensureMaintenanceAssetTypeColumn(): Promise<void> {
  if (ensuredMaintenanceAssetTypeColumn) return;

  if (!(await tableExists('maintenance_records'))) return;

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

  if (!(await tableExists('maintenance_records'))) return;

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

export async function ensureMaintenanceCancellationReasonColumn(): Promise<void> {
  if (ensuredMaintenanceCancellationReasonColumn) return;

  if (!(await tableExists('maintenance_records'))) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'maintenance_records'
        AND COLUMN_NAME = 'cancellation_reason'
    `
  );

  if (rows.length === 0) {
    await pool.query(`
      ALTER TABLE maintenance_records
      ADD COLUMN cancellation_reason TEXT DEFAULT NULL AFTER notes
    `);
  }

  ensuredMaintenanceCancellationReasonColumn = true;
}

export async function ensureMaintenanceOperationsSchema(): Promise<void> {
  if (ensuredMaintenanceOperationsSchema || !(await tableExists('maintenance_records'))) return;

  const [columns] = await pool.query<RowDataPacket[]>(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_records'
      AND COLUMN_NAME IN ('priority', 'due_at', 'started_at', 'technician_user_id', 'vendor_name', 'vendor_reference', 'warranty_until')
  `);
  const existing = new Set(columns.map((row) => row.COLUMN_NAME));
  const additions: Array<[string, string]> = [
    ['priority', "VARCHAR(20) NOT NULL DEFAULT 'normal' AFTER type"],
    ['due_at', 'DATETIME NULL AFTER scheduled_date'],
    ['started_at', 'DATETIME NULL AFTER due_at'],
    ['technician_user_id', 'INT(11) NULL AFTER technician'],
    ['vendor_name', 'VARCHAR(255) NULL AFTER technician_user_id'],
    ['vendor_reference', 'VARCHAR(100) NULL AFTER vendor_name'],
    ['warranty_until', 'DATE NULL AFTER vendor_reference'],
  ];
  for (const [name, definition] of additions) {
    if (!existing.has(name)) await pool.query(`ALTER TABLE maintenance_records ADD COLUMN ${name} ${definition}`);
  }

  const userIdType = await getUserIdColumnType();
  await pool.query(`CREATE TABLE IF NOT EXISTS maintenance_status_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, maintenance_id INT(11) NOT NULL,
    from_status VARCHAR(20) NULL, to_status VARCHAR(20) NOT NULL, note TEXT NULL,
    changed_by ${userIdType} NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_maintenance_status_logs_record (maintenance_id, created_at),
    CONSTRAINT fk_maintenance_status_logs_record FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_status_logs_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS maintenance_parts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, maintenance_id INT(11) NOT NULL, name VARCHAR(255) NOT NULL,
    quantity DECIMAL(12,2) NOT NULL DEFAULT 1, unit VARCHAR(50) NULL, unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_maintenance_parts_record (maintenance_id),
    CONSTRAINT fk_maintenance_parts_record FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS maintenance_attachments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, maintenance_id INT(11) NOT NULL, file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL, mime_type VARCHAR(100) NULL, uploaded_by ${userIdType} NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_maintenance_attachments_record (maintenance_id),
    CONSTRAINT fk_maintenance_attachments_record FOREIGN KEY (maintenance_id) REFERENCES maintenance_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_maintenance_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  ensuredMaintenanceOperationsSchema = true;
}

export async function ensureScheduleAssetForeignKeyRemoved(): Promise<void> {
  if (ensuredScheduleAssetFkRemoved) return;

  if (!(await tableExists('jadwal_pemeliharaan'))) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'jadwal_pemeliharaan'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND CONSTRAINT_NAME = 'fk_jadwal_asset'
    `
  );

  if (rows.length > 0) {
    await pool.query('ALTER TABLE jadwal_pemeliharaan DROP FOREIGN KEY fk_jadwal_asset');
  }

  ensuredScheduleAssetFkRemoved = true;
}

export async function ensureUserActivityLogsTable(): Promise<void> {
  if (ensuredUserActivityLogsTable) return;

  const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'user_activity_logs'");
  if (tables.length === 0) {
    const userIdType = await getUserIdColumnType();
    await pool.query(`
      CREATE TABLE user_activity_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id ${userIdType} NOT NULL,
        feature VARCHAR(80) NOT NULL,
        action VARCHAR(80) NOT NULL,
        description VARCHAR(255) NOT NULL,
        metadata_json TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_user_activity_user_created (user_id, created_at),
        CONSTRAINT fk_user_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  ensuredUserActivityLogsTable = true;
}

export async function ensureAssetUsageLogsTable(): Promise<void> {
  if (ensuredAssetUsageLogsTable) return;

  const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'asset_usage_logs'");
  if (tables.length === 0) {
    const userIdType = await getUserIdColumnType();
    await pool.query(`
      CREATE TABLE asset_usage_logs (
        \`no\` VARCHAR(50) DEFAULT NULL,
        borrowing_id INT(11) DEFAULT NULL,
        id INT(11) NOT NULL AUTO_INCREMENT,
        asset_id INT(11) NOT NULL,
        asset_type VARCHAR(20) NOT NULL DEFAULT 'medical',
        asset_detail_id VARCHAR(100) DEFAULT NULL,
        asset_detail_name VARCHAR(255) DEFAULT NULL,
        asset_detail_code VARCHAR(100) DEFAULT NULL,
        asset_location VARCHAR(255) DEFAULT NULL,
        room_name VARCHAR(255) NOT NULL,
        operator_user_id ${userIdType} DEFAULT NULL,
        usage_context VARCHAR(30) NOT NULL DEFAULT 'own_room',
        started_at DATETIME NOT NULL,
        ended_at DATETIME DEFAULT NULL,
        usage_count INT(11) NOT NULL DEFAULT 1,
        condition_before VARCHAR(50) DEFAULT NULL,
        condition_after VARCHAR(50) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_by ${userIdType} NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
        PRIMARY KEY (id),
        UNIQUE KEY \`uniq_asset_usage_no\` (\`no\`),
        KEY idx_asset_usage_borrowing (borrowing_id),
        KEY idx_asset_usage_asset (asset_type, asset_id, asset_detail_id),
        KEY idx_asset_usage_room_started (room_name, started_at),
        KEY idx_asset_usage_operator (operator_user_id),
        KEY idx_asset_usage_created_by (created_by),
        CONSTRAINT fk_asset_usage_operator FOREIGN KEY (operator_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_asset_usage_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  const existingColumns = await getExistingColumns('asset_usage_logs', ['id', 'no', 'borrowing_id']);
  if (!existingColumns.has('no')) {
    const afterClause = existingColumns.has('id') ? ' AFTER `id`' : '';
    await pool.query(`ALTER TABLE asset_usage_logs ADD COLUMN \`no\` VARCHAR(50) DEFAULT NULL${afterClause}`);
    existingColumns.add('no');
  }

  if (
    !(await hasIndex('asset_usage_logs', 'uniq_asset_usage_no')) &&
    !(await hasIndex('asset_usage_logs', 'uniq_asset_usage_logs_no'))
  ) {
    await pool.query('CREATE UNIQUE INDEX uniq_asset_usage_no ON asset_usage_logs (`no`)');
  }

  if (!existingColumns.has('borrowing_id')) {
    const previousColumn = existingColumns.has('no') ? 'no' : 'id';
    const afterClause = existingColumns.has(previousColumn) ? ` AFTER \`${previousColumn}\`` : '';
    await pool.query(`ALTER TABLE asset_usage_logs ADD COLUMN borrowing_id INT(11) DEFAULT NULL${afterClause}`);
  }

  if (!(await hasIndex('asset_usage_logs', 'idx_asset_usage_borrowing'))) {
    await pool.query('CREATE INDEX idx_asset_usage_borrowing ON asset_usage_logs (borrowing_id)');
  }

  const auditColumns = await getExistingColumns('asset_usage_logs', [
    'updated_at',
    'deleted_at',
    'deleted_by',
    'delete_reason',
    'source_type'
  ]);

  if (!auditColumns.has('deleted_at')) {
    const afterClause = auditColumns.has('updated_at') ? ' AFTER `updated_at`' : '';
    await pool.query(`ALTER TABLE asset_usage_logs ADD COLUMN \`deleted_at\` DATETIME DEFAULT NULL${afterClause}`);
    auditColumns.add('deleted_at');
  }

  if (!auditColumns.has('deleted_by')) {
    await pool.query('ALTER TABLE asset_usage_logs ADD COLUMN `deleted_by` INT(11) DEFAULT NULL AFTER `deleted_at`');
    auditColumns.add('deleted_by');
  }

  if (!auditColumns.has('delete_reason')) {
    await pool.query('ALTER TABLE asset_usage_logs ADD COLUMN `delete_reason` TEXT DEFAULT NULL AFTER `deleted_by`');
    auditColumns.add('delete_reason');
  }

  if (!auditColumns.has('source_type')) {
    await pool.query(
      "ALTER TABLE asset_usage_logs ADD COLUMN `source_type` VARCHAR(20) NOT NULL DEFAULT 'manual' AFTER `delete_reason`"
    );
    auditColumns.add('source_type');
  }

  if (!(await hasIndex('asset_usage_logs', 'idx_asset_usage_deleted_at'))) {
    await pool.query('CREATE INDEX idx_asset_usage_deleted_at ON asset_usage_logs (deleted_at)');
  }

  ensuredAssetUsageLogsTable = true;
}

const hasIndex = async (tableName: string, indexName: string): Promise<boolean> => {
  const [rows] = await pool.query<RowDataPacket[]>('SHOW INDEX FROM ?? WHERE Key_name = ?', [tableName, indexName]);
  return rows.length > 0;
};

const getExistingColumns = async (tableName: string, columnNames: string[]): Promise<Set<string>> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME IN (?)
    `,
    [tableName, columnNames]
  );

  return new Set(rows.map((row) => String(row.COLUMN_NAME)));
};

export async function ensureBorrowingWorkflowColumns(): Promise<void> {
  if (ensuredBorrowingWorkflowColumns) return;

  if (!(await tableExists('borrowing_records'))) return;

  const columnDefinitions = [
    {
      name: 'asset_type',
      sql: "ALTER TABLE borrowing_records ADD COLUMN asset_type VARCHAR(20) NOT NULL DEFAULT 'medical' AFTER asset_id",
    },
    {
      name: 'asset_detail_id',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN asset_detail_id VARCHAR(100) DEFAULT NULL AFTER asset_type',
    },
    {
      name: 'asset_detail_name',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN asset_detail_name VARCHAR(255) DEFAULT NULL AFTER asset_detail_id',
    },
    {
      name: 'asset_detail_code',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN asset_detail_code VARCHAR(100) DEFAULT NULL AFTER asset_detail_name',
    },
    {
      name: 'borrower_position',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN borrower_position VARCHAR(100) DEFAULT NULL AFTER user_id',
    },
    {
      name: 'borrower_work_unit',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN borrower_work_unit VARCHAR(150) DEFAULT NULL AFTER borrower_position',
    },
    {
      name: 'owner_name',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN owner_name VARCHAR(150) DEFAULT NULL AFTER borrower_work_unit',
    },
    {
      name: 'owner_position',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN owner_position VARCHAR(100) DEFAULT NULL AFTER owner_name',
    },
    {
      name: 'owner_work_unit',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN owner_work_unit VARCHAR(150) DEFAULT NULL AFTER owner_position',
    },
    {
      name: 'purpose_type',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN purpose_type VARCHAR(30) DEFAULT NULL AFTER purpose',
    },
    {
      name: 'destination_room',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN destination_room VARCHAR(255) DEFAULT NULL AFTER purpose_type',
    },
    {
      name: 'loan_duration_value',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN loan_duration_value INT(11) DEFAULT NULL AFTER destination_room',
    },
    {
      name: 'loan_duration_unit',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN loan_duration_unit VARCHAR(20) DEFAULT NULL AFTER loan_duration_value',
    },
    {
      name: 'quantity',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN quantity INT(11) NOT NULL DEFAULT 1 AFTER loan_duration_unit',
    },
    {
      name: 'return_validated_by',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN return_validated_by INT(11) DEFAULT NULL AFTER return_notes',
    },
    {
      name: 'return_validated_at',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN return_validated_at DATETIME DEFAULT NULL AFTER return_validated_by',
    },
    {
      name: 'returned_by',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN returned_by INT(11) DEFAULT NULL AFTER return_validated_at',
    },
    {
      name: 'overdue_days',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN overdue_days INT(11) NOT NULL DEFAULT 0 AFTER returned_by',
    },
    {
      name: 'sanction_status',
      sql: "ALTER TABLE borrowing_records ADD COLUMN sanction_status VARCHAR(20) NOT NULL DEFAULT 'none' AFTER overdue_days",
    },
    {
      name: 'sanction_notes',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN sanction_notes TEXT DEFAULT NULL AFTER sanction_status',
    },
    {
      name: 'sanction_applied_at',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN sanction_applied_at DATETIME DEFAULT NULL AFTER sanction_notes',
    },
    {
      name: 'extension_count',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN extension_count INT(11) NOT NULL DEFAULT 0 AFTER sanction_applied_at',
    },
    {
      name: 'last_extended_date',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN last_extended_date DATETIME DEFAULT NULL AFTER extension_count',
    },
    {
      name: 'extension_notes',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN extension_notes TEXT DEFAULT NULL AFTER last_extended_date',
    },
    {
      name: 'is_extension_blocked',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN is_extension_blocked BOOLEAN NOT NULL DEFAULT FALSE AFTER extension_notes',
    },
    {
      name: 'resolved_at',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN resolved_at DATETIME DEFAULT NULL AFTER is_extension_blocked',
    },
    {
      name: 'resolved_by_user_id',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN resolved_by_user_id INT(11) DEFAULT NULL AFTER resolved_at',
    },
    {
      name: 'resolved_notes',
      sql: 'ALTER TABLE borrowing_records ADD COLUMN resolved_notes TEXT DEFAULT NULL AFTER resolved_by_user_id',
    },
  ] as const;

  const existingColumns = await getExistingColumns(
    'borrowing_records',
    columnDefinitions.map((definition) => definition.name)
  );

  for (const definition of columnDefinitions) {
    if (!existingColumns.has(definition.name)) {
      await pool.query(definition.sql);
    }
  }

  if (!(await hasIndex('borrowing_records', 'idx_user_overdue_status'))) {
    await pool.query('CREATE INDEX idx_user_overdue_status ON borrowing_records (user_id, status, sanction_status)');
  }

  if (!(await hasIndex('borrowing_records', 'idx_user_extension_status'))) {
    await pool.query('CREATE INDEX idx_user_extension_status ON borrowing_records (user_id, sanction_status, is_extension_blocked)');
  }

  ensuredBorrowingWorkflowColumns = true;
}

export async function ensureAssetDisposalTable(): Promise<void> {
  if (ensuredAssetDisposalTable) return;

  const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'asset_disposal_requests'");
  if (tables.length === 0) {
    await pool.query(`
      CREATE TABLE asset_disposal_requests (
        id INT(11) NOT NULL AUTO_INCREMENT,
        request_code VARCHAR(50) DEFAULT NULL,
        asset_id INT(11) NOT NULL,
        asset_type VARCHAR(20) NOT NULL DEFAULT 'medical',
        asset_detail_id VARCHAR(100) DEFAULT NULL,
        asset_detail_name VARCHAR(255) DEFAULT NULL,
        asset_detail_code VARCHAR(100) DEFAULT NULL,
        reason TEXT NOT NULL,
        condition_notes TEXT DEFAULT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        requested_by INT(11) NOT NULL,
        reviewed_by INT(11) DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        review_notes TEXT DEFAULT NULL,
        approved_at DATETIME DEFAULT NULL,
        rejected_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
        PRIMARY KEY (id),
        UNIQUE KEY uniq_disposal_code (request_code),
        KEY idx_disposal_asset (asset_type, asset_id),
        KEY idx_disposal_status (status),
        KEY idx_disposal_requested_by (requested_by),
        CONSTRAINT fk_disposal_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_disposal_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  ensuredAssetDisposalTable = true;
}

export async function ensureDeletionRequestsTable(): Promise<void> {
  if (ensuredDeletionRequestsTable) return;

  const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'deletion_requests'");
  if (tables.length === 0) {
    await pool.query(`
      CREATE TABLE deletion_requests (
        id INT(11) NOT NULL AUTO_INCREMENT,
        request_code VARCHAR(50) DEFAULT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id INT(11) NOT NULL,
        target_label VARCHAR(255) DEFAULT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        requested_by INT(11) NOT NULL,
        reviewed_by INT(11) DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        review_notes TEXT DEFAULT NULL,
        approved_at DATETIME DEFAULT NULL,
        rejected_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
        PRIMARY KEY (id),
        KEY idx_deletion_requests_status (status),
        KEY idx_deletion_requests_target (target_type, target_id),
        KEY idx_deletion_requests_requested_by (requested_by),
        KEY idx_deletion_requests_reviewed_by (reviewed_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  ensuredDeletionRequestsTable = true;
}
