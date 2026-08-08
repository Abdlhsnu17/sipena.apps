import { Server } from 'http';
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
      logger.info('Maintenance reminder scheduler completed', { sent: result.data?.sent ?? 0 });
    } catch (error) {
      logger.error('Maintenance reminder scheduler failed', { error });
    }
  };
  setTimeout(() => void run(), 30000).unref();
  maintenanceReminderTimer = setInterval(() => void run(), 24 * 60 * 60 * 1000);
  maintenanceReminderTimer.unref();
};

const startHttpServer = (startPort: number, maxAttempts = 10) => {
  let attempt = 0;

  const tryListen = (port: number) => {
    attempt += 1;
    const server = app.listen(port);

    server.on('listening', () => {
      activeHttpServer = server;
      logger.info('🚀 Backend is LIVE - Server started', {
        port,
        environment: process.env.NODE_ENV || 'development',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        apiUrl: `http://localhost:${port}`,
      });
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
        logger.error('All port attempts failed. Please free the port or set PORT to another value.');
        process.exit(1);
      }

      // For other errors, rethrow to surface the problem
      logger.error('HTTP server error', { error: err });
      process.exit(1);
    });
  };

  tryListen(Number(startPort));
};

startHttpServer(Number(PORT));

// Initialize database connections in the background.
const initializeInfrastructure = async (): Promise<void> => {
  for (let attempt = 1; attempt <= STARTUP_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await connectDatabase();
      infrastructureStatus.database = 'up';
      logger.info('✅ Database connected successfully');

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
        logger.info('✅ Redis connected successfully');
      } else {
        if (isProduction) {
          infrastructureStatus.redis = 'down';
          throw new Error('Redis wajib aktif di production');
        }
        infrastructureStatus.redis = 'optional-down';
        logger.warn('⚠️ Redis not available - continuing without Redis');
      }

      logger.info('✅ Startup initialization complete');
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

void initializeInfrastructure();

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
