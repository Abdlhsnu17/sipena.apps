import fs from 'fs';
import mysql, { RowDataPacket } from 'mysql2/promise';
import path from 'path';
import pool from '../config/database';

let ensuredNonMedicalSpecificationsColumn = false;
let ensuredNonMedicalConditionColumn = false;
let ensuredReportUploadsTable = false;
let ensuredMaintenanceAssetTypeColumn = false;
let ensuredMaintenanceDetailColumns = false;
let ensuredMaintenanceCancellationReasonColumn = false;
let ensuredUserProfileColumns = false;
let ensuredUserSessionVersionColumn = false;
let ensuredUserPhoneNumberColumn = false;
let ensuredNonMedicalAssetsTable = false;
let ensuredScheduleAssetFkRemoved = false;
let ensuredUserActivityLogsTable = false;
let ensuredBorrowingWorkflowColumns = false;
let ensuredAssetUsageLogsTable = false;
let attemptedCoreSchemaBootstrap = false;

const tableExists = async (tableName: string): Promise<boolean> => {
  const [rows] = await pool.query<RowDataPacket[]>('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
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
    console.log(`🛠️ Initializing empty database from schema file: ${schemaPath}`);
    await connection.query(sql);
    console.log('✅ Core database schema initialized');
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
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN phone_number VARCHAR(25) DEFAULT NULL AFTER home_address
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
    await pool.query(`
      CREATE TABLE user_activity_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
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
        operator_user_id INT(11) DEFAULT NULL,
        usage_context VARCHAR(30) NOT NULL DEFAULT 'own_room',
        started_at DATETIME NOT NULL,
        ended_at DATETIME DEFAULT NULL,
        usage_count INT(11) NOT NULL DEFAULT 1,
        condition_before VARCHAR(50) DEFAULT NULL,
        condition_after VARCHAR(50) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_by INT(11) NOT NULL,
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
  if (!existingColumns.has('borrowing_id')) {
    const previousColumn = existingColumns.has('no') ? 'no' : 'id';
    const afterClause = existingColumns.has(previousColumn) ? ` AFTER \`${previousColumn}\`` : '';
    await pool.query(`ALTER TABLE asset_usage_logs ADD COLUMN borrowing_id INT(11) DEFAULT NULL${afterClause}`);
  }

  if (!(await hasIndex('asset_usage_logs', 'idx_asset_usage_borrowing'))) {
    await pool.query('CREATE INDEX idx_asset_usage_borrowing ON asset_usage_logs (borrowing_id)');
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
