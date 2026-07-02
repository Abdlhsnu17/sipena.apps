import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  frontendUrl: string;
  jwtSecret: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password?: string;
    connectionLimit: number;
    queueLimit: number;
    connectTimeoutMs: number;
    idleTimeoutMs: number;
    keepAliveInitialDelayMs: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const loadEnvFile = (candidatePaths: string[]): void => {
  const envPath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  dotenv.config(envPath ? { path: envPath, override: true } : undefined);
};

export const createAppConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const nodeEnv = (env.NODE_ENV || 'development') as NodeEnvironment;
  const isProduction = nodeEnv === 'production';
  const connectionLimit = parseNumber(env.DB_CONNECTION_LIMIT, isProduction ? 30 : 10);

  return {
    nodeEnv,
    port: parseNumber(env.PORT, 4000),
    frontendUrl: env.FRONTEND_URL || 'http://localhost:3000',
    jwtSecret: env.JWT_SECRET || '',
    database: {
      host: env.DB_HOST || 'localhost',
      port: parseNumber(env.DB_PORT, 3306),
      name: env.DB_NAME || 'sipena_db_local',
      user: env.DB_USER || 'root',
      password: env.DB_PASSWORD || undefined,
      connectionLimit,
      queueLimit: parseNumber(env.DB_QUEUE_LIMIT, 0),
      connectTimeoutMs: parseNumber(env.DB_CONNECT_TIMEOUT_MS, 10000),
      idleTimeoutMs: parseNumber(env.DB_IDLE_TIMEOUT_MS, 60000),
      keepAliveInitialDelayMs: parseNumber(env.DB_KEEP_ALIVE_INITIAL_DELAY_MS, 0),
    },
    redis: {
      host: env.REDIS_HOST || '127.0.0.1',
      port: parseNumber(env.REDIS_PORT, 6379),
      password: env.REDIS_PASSWORD || undefined,
    },
  };
};

export const getDefaultEnvPaths = (cwd = process.cwd()): string[] => [
  path.resolve(cwd, '.env'),
  path.resolve(cwd, 'apps/backend/.env'),
  path.resolve(cwd, 'apps/frontend/.env'),
];
