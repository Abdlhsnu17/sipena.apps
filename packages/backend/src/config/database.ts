import mysql from 'mysql2/promise';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './env';

loadEnvironment();
applyDevelopmentEnvDefaults();

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
  waitForConnections: true,
  connectionLimit,
  maxIdle: connectionLimit,
  queueLimit,
  connectTimeout,
  idleTimeout,
  enableKeepAlive: true,
  keepAliveInitialDelay,
});

export const connectDatabase = async (): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('✅ Database disconnected');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
};

export default pool;
