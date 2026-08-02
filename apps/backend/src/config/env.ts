import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createScopedLogger } from '../utils/logger';

let hasLoadedEnv = false;
let hasWarnedAboutDevJwtSecret = false;
const logger = createScopedLogger('config:env');
const DB_PASSWORD_PLACEHOLDERS = new Set([
  'your_secure_password_here',
  'changeme',
  'your_secure_app_password_min_12_chars',
  'root_dev_password',
]);
const DEVELOPMENT_JWT_SECRET = 'sipena-local-dev-jwt-secret-change-in-production';

const getCandidateEnvPaths = (): string[] => {
  const backendRoot = path.resolve(__dirname, '../../');
  const candidates = [
    path.resolve(backendRoot, '.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];

  return [...new Set(candidates)];
};

export const loadEnvironment = (): void => {
  if (hasLoadedEnv) {
    return;
  }

  const envPath = getCandidateEnvPaths().find((candidate) => fs.existsSync(candidate));

  if (envPath) {
    dotenv.config({ path: envPath, override: true });
  } else {
    dotenv.config();
  }

  hasLoadedEnv = true;
};

export const applyDevelopmentEnvDefaults = (): void => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv !== 'production';

  if (!isDevelopment) {
    return;
  }

  process.env.DB_HOST ||= '127.0.0.1';
  process.env.DB_PORT ||= '3306';
  process.env.DB_NAME ||= 'sipena_db_local';
  process.env.DB_USER ||= 'root';
  const currentPassword = process.env.DB_PASSWORD?.trim() || '';
  const dbHost = (process.env.DB_HOST || '').trim().toLowerCase();
  const isLocalDatabaseHost = !dbHost || dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '::1';
  if (isLocalDatabaseHost && DB_PASSWORD_PLACEHOLDERS.has(currentPassword)) {
    process.env.DB_PASSWORD = '';
  }
  process.env.DB_PASSWORD ||= process.env.MYSQL_ROOT_PASSWORD || '';
  process.env.FRONTEND_URL ||= 'http://localhost:3000';
  process.env.JWT_SECRET ||= DEVELOPMENT_JWT_SECRET;

  if (process.env.JWT_SECRET === DEVELOPMENT_JWT_SECRET && !hasWarnedAboutDevJwtSecret) {
    logger.warn('⚠️ Menggunakan JWT secret development default. Jangan gunakan nilai ini di production.');
    hasWarnedAboutDevJwtSecret = true;
  }
};
