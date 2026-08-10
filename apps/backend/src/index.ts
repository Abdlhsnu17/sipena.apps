import fs from 'fs';
import { Server } from 'http';
import path from 'path';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './config/env';
import { infrastructureStatus } from './config/infrastructure-status';
import { connectRedis, disconnectRedis } from './config/redis';
import { MaintenanceService } from './services/maintenance.service';
import { createScopedLogger } from './utils/logger';
import { notificationStreamHub } from './utils/notification-stream';
import {
    ensureAssetCategoryUmbrellaValues,
    ensureAssetDisposalTable,
    ensureAssetUsageLogsTable,
    ensureBorrowingWorkflowColumns,
    ensureCoreSchemaInitialized,
    ensureDeletionRequestsTable,
    ensureInitialAdminAccount,
    ensureMaintenanceAssetTypeColumn,
    ensureMaintenanceCancellationReasonColumn,
    ensureMaintenanceDetailColumns,
    ensureMaintenanceOperationsSchema,
    ensureMaintenanceScheduleTableRemoved,
    ensureNonMedicalSpecificationsColumn,
    ensureReportUploadsTable,
    ensureRoleMenuAccessControlTables,
    ensureUserAccessControlColumns,
    ensureUserActivityLogsTable,
    ensureUserLoginSecurityColumns,
    ensureUserProfileColumns,
    withSchemaLock
} from './utils/schema';

// Load environment variables
loadEnvironment();
applyDevelopmentEnvDefaults();
const logger = createScopedLogger('server');
const bootstrapStartedAt = Date.now();
const DEVELOPMENT_JWT_SECRET = 'sipena-local-dev-jwt-secret-change-in-production';

const readPackageVersion = (): string => {
  const candidates = [
    path.resolve(__dirname, '../../../package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    try {
      const rawPackageJson = fs.readFileSync(candidate, 'utf8');
      const packageJson = JSON.parse(rawPackageJson) as { version?: string };
      if (packageJson.version) {
        return packageJson.version;
      }
    } catch {
      // Fall back to the default version below.
    }
  }

  return process.env.npm_package_version || '2.5.0';
};

const formatLocationLabel = (value: string): string => {
  const normalized = value.trim();
  return normalized || '-';
};

const getStartupSummary = (port: number) => {
  const dbHost = formatLocationLabel(process.env.DB_HOST || 'localhost');
  const dbPort = process.env.DB_PORT || '3306';
  const dbName = formatLocationLabel(process.env.DB_NAME || 'sipena_db_local');
  const dbUser = formatLocationLabel(process.env.DB_USER || 'root');
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  const isUsingDevelopmentJwtSecret = (process.env.JWT_SECRET || '') === DEVELOPMENT_JWT_SECRET;
  const hasEmailConfiguration = Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()
  );
  const isDssDebugEnabled = !isProduction && process.env.ALLOW_DSS_DEBUG === 'true';

  return {
    version: readPackageVersion(),
    environment: process.env.NODE_ENV || 'development',
    serverUrl: `http://localhost:${port}`,
    healthUrl: `http://localhost:${port}/health`,
    databaseLabel: `${dbUser}@${dbHost}:${dbPort}/${dbName}`,
    jwtLabel: isUsingDevelopmentJwtSecret ? 'Menggunakan JWT secret development default' : '',
    emailLabel: hasEmailConfiguration ? 'dikonfigurasi' : 'tidak dikonfigurasi',
    uploadsLabel: 'siap',
    uploadsRootLabel: path.basename(process.env.UPLOADS_ROOT?.trim() || 'uploads') || 'uploads',
    dssDebugLabel: isDssDebugEnabled ? 'on' : 'off',
    redisLabel: infrastructureStatus.redis === 'up'
      ? 'connected successfully'
      : infrastructureStatus.redis === 'optional-down'
        ? 'tidak dikonfigurasi'
        : 'tidak tersedia',
    redisAvailable: infrastructureStatus.redis === 'up',
  };
};

const printStartupBanner = (port: number): void => {
  const summary = getStartupSummary(port);
  const divider = '──────────────────────────────────────────────';
  const pad = (label: string, value: string): string => `${label.padEnd(10)}${value}`;
  const lines = [
    `◆  SIPENA API v${summary.version}  ·  ${summary.environment}`,
    divider,
    `🖥️  ${pad('server', summary.serverUrl)}`,
    `🗄️  ${pad('database', summary.databaseLabel)}`,
    summary.jwtLabel ? `🔐  ${pad('jwt', summary.jwtLabel)}` : null,
    `✉️  ${pad('email', summary.emailLabel)}`,
    `🩺  ${pad('health', summary.healthUrl)}`,
    `📦  ${pad('uploads', `${summary.uploadsLabel} (${summary.uploadsRootLabel})`)}`,
    `🧪  ${pad('dss debug', summary.dssDebugLabel)}`,
  ];

  if (summary.redisAvailable) {
    lines.push(`⚡  ${pad('redis', summary.redisLabel)}`);
  } else {
    lines.push(`⚪  ${pad('redis', summary.redisLabel)}`);
  }

  lines.push('');
  lines.push(`siap dalam ${Date.now() - bootstrapStartedAt} ms  ·  tekan Ctrl+C untuk berhenti`);

  console.log(lines.filter(Boolean).join('\n'));
};

// Validate required environment variables
const validateEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const requiredVars = nodeEnv === 'production'
    ? ['JWT_SECRET', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'FRONTEND_URL', 'REDIS_HOST', 'REDIS_PORT']
    : ['JWT_SECRET'];
  const missing: string[] = [];
  const invalid: string[] = [];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (isProduction) {
    const jwtSecret = process.env.JWT_SECRET || '';
    const weakJwtSecrets = new Set([
      'sipena-local-dev-jwt-secret-change-in-production',
      'sipena-local-dev-jwt-secret-from-env',
      'dev_jwt_secret_change_me_before_production',
      'generate_a_strong_secret_key_here_minimum_32_characters',
    ]);
    const weakDbPasswords = new Set([
      '',
      'changeme',
      'root',
      'root_changeme',
      'password',
      'generate_a_strong_password_here',
      'your_secure_password_here',
      'your_secure_app_password_min_12_chars',
    ]);
    const frontendOrigins = (process.env.FRONTEND_URL || '')
      .split(',')
      .map((origin) => origin.trim().toLowerCase())
      .filter(Boolean);

    if (jwtSecret.length < 32 || weakJwtSecrets.has(jwtSecret)) {
      invalid.push('JWT_SECRET must be at least 32 characters and must not use a development/example value');
    }

    if (weakDbPasswords.has(process.env.DB_PASSWORD || '')) {
      invalid.push('DB_PASSWORD must be set to a strong non-default value');
    }

    if (process.env.ALLOW_IN_MEMORY_PASSWORD_RESET_STORE !== 'false') {
      invalid.push('ALLOW_IN_MEMORY_PASSWORD_RESET_STORE must be false in production');
    }

    if (frontendOrigins.some((origin) => origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      invalid.push('FRONTEND_URL must use the real production origin, not localhost');
    }
  }

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    logger.error('Please ensure all variables are set in your .env file');
    process.exit(1);
  }

  if (invalid.length > 0) {
    logger.error('Invalid production environment configuration', { invalid });
    process.exit(1);
  }
};

validateEnvironment();

const app = createApp();
const PORT = process.env.PORT || 4000;
const isProduction = (process.env.NODE_ENV || 'development') === 'production';
const STARTUP_RETRY_ATTEMPTS = Number.parseInt(process.env.STARTUP_RETRY_ATTEMPTS || '12', 10);
const STARTUP_RETRY_DELAY_MS = Number.parseInt(process.env.STARTUP_RETRY_DELAY_MS || '5000', 10);

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

// Start the HTTP server with port-retry logic so a busy port doesn't crash the process.
let activeHttpServer: Server | null = null;
let maintenanceReminderTimer: NodeJS.Timeout | null = null;

const startMaintenanceReminderScheduler = () => {
  if (maintenanceReminderTimer) return;
  const maintenanceService = new MaintenanceService();
  const run = async () => {
    try {
      const result = await maintenanceService.dispatchDueReminders();
      const sent = result.data?.sent ?? 0;
      if (sent > 0) {
        logger.info('Maintenance reminder scheduler completed', { sent });
      }
    } catch (error) {
      logger.error('Maintenance reminder scheduler failed', { error });
    }
  };
  setTimeout(() => void run(), 30000).unref();
  maintenanceReminderTimer = setInterval(() => void run(), 24 * 60 * 60 * 1000);
  maintenanceReminderTimer.unref();
};

const startHttpServer = (startPort: number, maxAttempts = 10): Promise<number> => new Promise((resolve, reject) => {
  let attempt = 0;
  let resolved = false;

  const tryListen = (port: number) => {
    attempt += 1;
    const server = app.listen(port);

    server.on('listening', () => {
      activeHttpServer = server;
      if (!resolved) {
        resolved = true;
        resolve(port);
      }
      startMaintenanceReminderScheduler();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err && err.code === 'EADDRINUSE') {
        logger.warn('Port is already in use', { port });
        server.close?.();
        if (attempt < maxAttempts) {
          const nextPort = port + 1;
          logger.info('Trying next port', { nextPort, attempt: attempt + 1, maxAttempts });
          // small delay before retrying
          setTimeout(() => tryListen(nextPort), 200);
          return;
        }
        const error = new Error('All port attempts failed. Please free the port or set PORT to another value.');
        reject(error);
        process.exit(1);
      }

      // For other errors, rethrow to surface the problem
      logger.error('HTTP server error', { error: err });
      if (!resolved) {
        reject(err);
      }
      process.exit(1);
    });
  };

  tryListen(Number(startPort));
});

// Initialize database connections in the background.
const initializeInfrastructure = async (): Promise<void> => {
  for (let attempt = 1; attempt <= STARTUP_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await connectDatabase();
      infrastructureStatus.database = 'up';

      await withSchemaLock(async () => {
        await ensureCoreSchemaInitialized();
        await ensureBorrowingWorkflowColumns();
        await ensureAssetUsageLogsTable();
        await ensureMaintenanceAssetTypeColumn();
        await ensureMaintenanceDetailColumns();
        await ensureMaintenanceCancellationReasonColumn();
        await ensureMaintenanceOperationsSchema();
        await ensureNonMedicalSpecificationsColumn();
        await ensureAssetCategoryUmbrellaValues();
        await ensureReportUploadsTable();
        await ensureMaintenanceScheduleTableRemoved();
        await ensureUserProfileColumns();
        await ensureUserAccessControlColumns();
        await ensureUserLoginSecurityColumns();
        await ensureInitialAdminAccount();
        await ensureRoleMenuAccessControlTables();
        await ensureUserActivityLogsTable();
        await ensureDeletionRequestsTable();
        await ensureAssetDisposalTable();
      });
      infrastructureStatus.schema = 'up';

      const redisConnected = await connectRedis();
      if (redisConnected) {
        infrastructureStatus.redis = 'up';
      } else {
        if (isProduction) {
          infrastructureStatus.redis = 'down';
          throw new Error('Redis wajib aktif di production');
        }
        infrastructureStatus.redis = 'optional-down';
      }

      return;
    } catch (error) {
      logger.error('Startup initialization attempt failed', {
        attempt,
        maxAttempts: STARTUP_RETRY_ATTEMPTS,
        error,
      });
      infrastructureStatus.database = 'down';
      infrastructureStatus.schema = 'down';

      if (attempt < STARTUP_RETRY_ATTEMPTS) {
        await sleep(STARTUP_RETRY_DELAY_MS);
        continue;
      }

      if (isProduction) {
        logger.error('Startup initialization failed in production. Exiting.');
        process.exit(1);
      }

      logger.warn('Continuing to serve while startup initialization remains unavailable.');
      return;
    }
  }
};

const httpServerReady = startHttpServer(Number(PORT));
const infrastructureReady = initializeInfrastructure();

void Promise.all([httpServerReady, infrastructureReady])
  .then(([port]) => {
    printStartupBanner(port);
  })
  .catch((error) => {
    logger.error('Startup banner could not be printed', { error });
  });

let shutdownStarted = false;
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  logger.info('Shutdown signal received', { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    notificationStreamHub.closeAll();
    if (maintenanceReminderTimer) {
      clearInterval(maintenanceReminderTimer);
      maintenanceReminderTimer = null;
    }
    if (activeHttpServer) {
      const server = activeHttpServer;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      activeHttpServer = null;
    }
    await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    logger.error('Graceful shutdown failed', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
  logger.error('Unhandled promise rejection', {
    promise,
    reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error, stack: error.stack });
  process.exit(1);
});

export default app;
