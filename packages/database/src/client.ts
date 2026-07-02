import mysql, { Pool } from 'mysql2/promise';
import { createAppConfig } from '@sipena/config';

let pool: Pool | null = null;

export const getDatabaseClient = (): Pool => {
  if (pool) {
    return pool;
  }

  const config = createAppConfig();
  pool = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    waitForConnections: true,
    connectionLimit: config.database.connectionLimit,
    maxIdle: config.database.connectionLimit,
    queueLimit: config.database.queueLimit,
    connectTimeout: config.database.connectTimeoutMs,
    idleTimeout: config.database.idleTimeoutMs,
    enableKeepAlive: true,
    keepAliveInitialDelay: config.database.keepAliveInitialDelayMs,
  });

  return pool;
};

export const closeDatabaseClient = async (): Promise<void> => {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
};
