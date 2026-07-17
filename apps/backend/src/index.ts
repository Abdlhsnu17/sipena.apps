import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Server } from 'http';
import { connectDatabase, disconnectDatabase } from './config/database';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './config/env';
import { connectRedis, disconnectRedis } from './config/redis';
import { authMiddleware, sseTicketMiddleware } from './middlewares/authMiddleware';
import { errorHandler } from './middlewares/errorHandler';
import { requestContextMiddleware } from './middlewares/requestContext';
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
    ensureNonMedicalSpecificationsColumn,
    ensureReportUploadsTable,
    ensureRoleMenuAccessControlTables,
    ensureScheduleAssetForeignKeyRemoved,
    ensureUserAccessControlColumns,
    ensureUserActivityLogsTable,
    ensureUserLoginSecurityColumns,
    ensureUserProfileColumns,
    withSchemaLock
} from './utils/schema';
import { getMaintenanceUploadsDir, getProfileUploadsDir } from './utils/storage-paths';
import { getServerTimeSnapshot } from './utils/time';

// Routes
import accessControlRoutes from './routes/access_control.routes';
import assetRoutes from './routes/asset.routes';
import assetDisposalRoutes from './routes/asset_disposal.routes';
import assetUsageRoutes from './routes/asset_usage.routes';
import authRoutes from './routes/auth.routes';
import borrowingRoutes from './routes/borrowing.routes';
import deletionRequestRoutes from './routes/deletion_request.routes';
import dssRoutes from './routes/dss.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import maintenanceHistoryRoutes from './routes/maintenance_history.routes';
import maintenanceScheduleRoutes from './routes/maintenance_schedule.routes';
import { MaintenanceService } from './services/maintenance.service';
import notificationRoutes from './routes/notification.routes';
import reportRoutes from './routes/report.routes';
import sanctionsRoutes from './routes/sanctions.routes';
import umlRoutes from './routes/uml.routes';
import userRoutes from './routes/user.routes';
import userActivityRoutes from './routes/user_activity.routes';
// Import notification controller for the standalone SSE stream route mounted
// outside the header-authenticated notification router.
import notificationController from './controllers/notification.controller';

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

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = (process.env.NODE_ENV || 'development') === 'production';
const STARTUP_RETRY_ATTEMPTS = Number.parseInt(process.env.STARTUP_RETRY_ATTEMPTS || '12', 10);
const STARTUP_RETRY_DELAY_MS = Number.parseInt(process.env.STARTUP_RETRY_DELAY_MS || '5000', 10);
const infrastructureStatus = {
  database: 'initializing' as 'initializing' | 'up' | 'down',
  redis: 'initializing' as 'initializing' | 'up' | 'down' | 'optional-down',
  schema: 'initializing' as 'initializing' | 'up' | 'down',
};

const resolveTrustProxy = (value: string | undefined): boolean | number => {
  if (!value) {
    return 1;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 1;
};
const trustProxySetting = resolveTrustProxy(process.env.TRUST_PROXY_HOPS);

// Trust proxy - important for rate limiting behind reverse proxy (e.g., Railway)
app.set('trust proxy', trustProxySetting);

// Security middleware
// This backend serves JSON APIs plus static profile photos under /uploads/profiles,
// never an HTML document, so the CSP can be locked down to "nothing is allowed to load".
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      imgSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(compression({
  // Never compress Server-Sent Events: compression buffers the response and
  // would delay (or withhold) real-time notification events.
  filter: (req, res) => {
    if (res.getHeader('Content-Type') === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  },
}));
app.use(requestContextMiddleware);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDev = !isProduction;
const parseRateLimitMax = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number.parseInt(value || '', 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};
const generalRateLimitMax = parseRateLimitMax(process.env.GENERAL_RATE_LIMIT_MAX, isDev ? 10000 : 2000);
const loginRateLimitMax = parseRateLimitMax(process.env.LOGIN_RATE_LIMIT_MAX, isDev ? 1000 : 40);
const registerRateLimitMax = parseRateLimitMax(process.env.REGISTER_RATE_LIMIT_MAX, isDev ? 1000 : 20);
const passwordResetRateLimitMax = parseRateLimitMax(process.env.PASSWORD_RESET_RATE_LIMIT_MAX, isDev ? 1000 : 20);

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isDev) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: generalRateLimitMax,
  skip: (req) => req.path === '/auth/login' || req.path === '/health',
  message: {
    success: false,
    message: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: loginRateLimitMax,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login. Silakan coba lagi beberapa menit.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: registerRateLimitMax,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan pendaftaran. Silakan coba lagi nanti.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: passwordResetRateLimitMax,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan reset password. Silakan coba lagi beberapa menit.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api', generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Only profile photos remain directly reachable; report files must go through protected routes.
// Profile photos are public assets loaded via <img>, so they must not be blocked by Helmet's
// same-origin Cross-Origin-Resource-Policy when the frontend is served from a different origin.
app.use('/uploads/profiles', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads/profiles', express.static(getProfileUploadsDir()));
app.use('/uploads/maintenance', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads/maintenance', express.static(getMaintenanceUploadsDir()));

const healthHandler = (req: express.Request, res: express.Response) => {
  const status = infrastructureStatus.database === 'up' && infrastructureStatus.schema === 'up'
    ? 'OK'
    : 'DEGRADED';

  res.status(200).json({
    status,
    timestamp: getServerTimeSnapshot().now,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: infrastructureStatus,
    requestId: req.requestId,
  });
};

// Health check endpoints
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/time', (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    success: true,
    message: 'Server time synchronized',
    data: getServerTimeSnapshot(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/access-control', authMiddleware, accessControlRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/assets', authMiddleware, assetRoutes);
app.use('/api/asset-usage', authMiddleware, assetUsageRoutes);
app.use('/api/borrowing', authMiddleware, borrowingRoutes);
app.use('/api/deletion-requests', authMiddleware, deletionRequestRoutes);
app.use('/api/dss', authMiddleware, dssRoutes);
// Development-only: expose DSS routes without auth for debugging only when explicitly allowed
// Set ALLOW_DSS_DEBUG=true in your local env to enable this route.
if (!isProduction && process.env.ALLOW_DSS_DEBUG === 'true') {
  app.use('/api/dss-debug', dssRoutes);
  logger.warn('DSS debug routes mounted at /api/dss-debug (dev only)');
} else if (!isProduction && process.env.ALLOW_DSS_DEBUG !== 'true') {
  logger.info('DSS debug routes not mounted (set ALLOW_DSS_DEBUG=true to enable)');
}
app.use('/api/maintenance', authMiddleware, maintenanceRoutes);
app.use('/api/maintenance-history', authMiddleware, maintenanceHistoryRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/uml', authMiddleware, umlRoutes);
app.use('/api/maintenance-schedule', authMiddleware, maintenanceScheduleRoutes);
app.use('/api/user-activities', authMiddleware, userActivityRoutes);
app.use('/api/sanctions', authMiddleware, sanctionsRoutes);
app.use('/api/asset-disposal', authMiddleware, assetDisposalRoutes);
// EventSource cannot set Authorization headers, so this route consumes a
// short-lived, one-use ticket issued by the authenticated notification router.
app.get('/api/notifications/stream', sseTicketMiddleware, notificationController.stream);
app.use('/api/notifications', authMiddleware, notificationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);


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
      logger.info('Server started', {
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
      logger.info('Database connected successfully');

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
        await ensureScheduleAssetForeignKeyRemoved();
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
        logger.info('Redis connected successfully');
      } else {
        if (isProduction) {
          infrastructureStatus.redis = 'down';
          throw new Error('Redis wajib aktif di production');
        }
        infrastructureStatus.redis = 'optional-down';
        logger.warn('Redis not available - continuing without Redis');
      }

      logger.info('Startup initialization complete');
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
