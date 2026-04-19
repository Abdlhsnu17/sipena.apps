import mysql from 'mysql2/promise';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './env';

loadEnvironment();
applyDevelopmentEnvDefaults();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'sipena_db_local',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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
