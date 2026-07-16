import fs from 'fs/promises';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import path from 'path';
import { statSync } from 'fs';
import { applyDevelopmentEnvDefaults, loadEnvironment } from '../config/env';

loadEnvironment();
applyDevelopmentEnvDefaults();

const resolveMigrationsDir = (): string => {
  const candidates = [
    path.resolve(process.cwd(), '../database/migrations'),
    path.resolve(process.cwd(), '../../packages/database/migrations'),
    path.resolve(__dirname, '../../../database/migrations'),
    path.resolve(__dirname, '../../../../packages/database/migrations'),
  ];

  const matchedPath = candidates.find((candidate) => {
    try {
      return statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  });

  if (!matchedPath) {
    throw new Error(`Migrations directory not found. Checked: ${candidates.join(', ')}`);
  }

  return matchedPath;
};

const getConnection = () =>
  mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'sipena_db_local',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || undefined,
    multipleStatements: true,
  });

const run = async (): Promise<void> => {
  const connection = await getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT NOT NULL AUTO_INCREMENT,
        filename VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_schema_migrations_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const migrationsDir = resolveMigrationsDir();
    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const filename of files) {
      const filePath = path.join(migrationsDir, filename);
      const sql = await fs.readFile(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const [existingRows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT checksum FROM schema_migrations WHERE filename = ? LIMIT 1',
        [filename],
      );

      if (existingRows.length > 0) {
        if (existingRows[0].checksum !== checksum) {
          throw new Error(`Migration checksum mismatch: ${filename}`);
        }
        console.log(`skip ${filename}`);
        continue;
      }

      console.log(`apply ${filename}`);
      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)',
          [filename, checksum],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    console.log('database migrations complete');
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error('database migration failed:', error);
  process.exit(1);
});
