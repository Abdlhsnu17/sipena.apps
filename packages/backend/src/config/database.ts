import mysql from 'mysql2/promise';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './env';
import { createScopedLogger } from '../utils/logger';

loadEnvironment();
applyDevelopmentEnvDefaults();
const logger = createScopedLogger('config:database');

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number.parseInt(value || '', 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
};

const isProduction = (process.env.NODE_ENV || 'development') === 'production';
const connectionLimit = parseNumber(process.env.DB_CONNECTION_LIMIT, isProduction ? 30 : 10);
const queueLimit = parseNumber(process.env.DB_QUEUE_LIMIT, 0);
const connectTimeout = parseNumber(process.env.DB_CONNECT_TIMEOUT_MS, 10000);
const idleTimeout = parseNumber(process.env.DB_IDLE_TIMEOUT_MS, 60000);
const keepAliveInitialDelay = parseNumber(process.env.DB_KEEP_ALIVE_INITIAL_DELAY_MS, 0);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'sipena_db_local',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || undefined,
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit,
  maxIdle: connectionLimit,
  queueLimit,
  connectTimeout,
  idleTimeout,
  enableKeepAlive: true,
  keepAliveInitialDelay,
});

pool.on('connection', (connection) => {
  void connection.query("SET time_zone = '+00:00'").catch((error) => {
    logger.error('Failed to set database session time zone to UTC', { error });
  });
});

export const connectDatabase = async (): Promise<void> => {
  let connection: mysql.PoolConnection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.query("SET time_zone = '+00:00'");
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  } finally {
    connection?.release();
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Database disconnection failed', { error });
  }
};

export default pool;
