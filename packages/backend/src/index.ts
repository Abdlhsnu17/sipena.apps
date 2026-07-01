import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { connectDatabase } from './config/database';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './config/env';
import { connectRedis } from './config/redis';
import { authMiddleware } from './middlewares/authMiddleware';
import { errorHandler } from './middlewares/errorHandler';
import { requestContextMiddleware } from './middlewares/requestContext';
import {
    ensureAssetDisposalTable,
    ensureAssetUsageLogsTable,
    ensureBorrowingWorkflowColumns,
    ensureCoreSchemaInitialized,
    ensureDeletionRequestsTable,
    ensureMaintenanceAssetTypeColumn,
    ensureMaintenanceCancellationReasonColumn,
    ensureMaintenanceDetailColumns,
    ensureNonMedicalSpecificationsColumn,
    ensureRoleMenuAccessControlTables,
    ensureReportUploadsTable,
    ensureScheduleAssetForeignKeyRemoved,
    ensureInitialAdminAccount,
    ensureUserAccessControlColumns,
    ensureUserActivityLogsTable,
    ensureUserLoginSecurityColumns,
    ensureUserProfileColumns,
    withSchemaLock
} from './utils/schema';
import { getProfileUploadsDir } from './utils/storage-paths';
import { createScopedLogger } from './utils/logger';
import { getServerTimeSnapshot } from './utils/time';

// Routes
import assetRoutes from './routes/asset.routes';
import assetUsageRoutes from './routes/asset_usage.routes';
import accessControlRoutes from './routes/access_control.routes';
import authRoutes from './routes/auth.routes';
import borrowingRoutes from './routes/borrowing.routes';
import deletionRequestRoutes from './routes/deletion_request.routes';
import dssRoutes from './routes/dss.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import maintenanceHistoryRoutes from './routes/maintenance_history.routes';
import maintenanceScheduleRoutes from './routes/maintenance_schedule.routes';
import assetDisposalRoutes from './routes/asset_disposal.routes';
import reportRoutes from './routes/report.routes';
import sanctionsRoutes from './routes/sanctions.routes';
import umlRoutes from './routes/uml.routes';
import userRoutes from './routes/user.routes';
import userActivityRoutes from './routes/user_activity.routes';
import borrowingService from './services/borrowing.service';

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
const BORROWING_OVERDUE_SYNC_INTERVAL_MS = Number.parseInt(process.env.BORROWING_OVERDUE_SYNC_INTERVAL_MS || '60000', 10);
const infrastructureStatus = {
  database: 'initializing' as 'initializing' | 'up' | 'down',
  redis: 'initializing' as 'initializing' | 'up' | 'down' | 'optional-down',
  schema: 'initializing' as 'initializing' | 'up' | 'down',
};
let borrowingOverdueSyncInterval: NodeJS.Timeout | null = null;

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
app.use(compression());
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
const generalRateLimitMax = parseRateLimitMax(process.env.GENERAL_RATE_LIMIT_MAX, isDev ? 10000 : 1000);
const loginRateLimitMax = parseRateLimitMax(process.env.LOGIN_RATE_LIMIT_MAX, isDev ? 1000 : 20);
const registerRateLimitMax = parseRateLimitMax(process.env.REGISTER_RATE_LIMIT_MAX, isDev ? 1000 : 10);
const passwordResetRateLimitMax = parseRateLimitMax(process.env.PASSWORD_RESET_RATE_LIMIT_MAX, isDev ? 1000 : 10);

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

const startBorrowingOverdueSync = (): void => {
  if (borrowingOverdueSyncInterval || !Number.isFinite(BORROWING_OVERDUE_SYNC_INTERVAL_MS) || BORROWING_OVERDUE_SYNC_INTERVAL_MS <= 0) {
    return;
  }

  const sync = async () => {
    try {
      await borrowingService.refreshOverdueStatuses();
    } catch (error) {
      logger.error('Borrowing overdue synchronization failed', { error });
    }
  };

  void sync();
  borrowingOverdueSyncInterval = setInterval(() => void sync(), BORROWING_OVERDUE_SYNC_INTERVAL_MS);
};

// Start the HTTP server with port-retry logic so a busy port doesn't crash the process.
const startHttpServer = (startPort: number, maxAttempts = 10) => {
  let attempt = 0;

  const tryListen = (port: number) => {
    attempt += 1;
    const server = app.listen(port);

    server.on('listening', () => {
      logger.info('Server started', {
        port,
        environment: process.env.NODE_ENV || 'development',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        apiUrl: `http://localhost:${port}`,
      });
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
        await ensureNonMedicalSpecificationsColumn();
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
      startBorrowingOverdueSync();
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

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (borrowingOverdueSyncInterval) {
    clearInterval(borrowingOverdueSyncInterval);
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (borrowingOverdueSyncInterval) {
    clearInterval(borrowingOverdueSyncInterval);
  }
  process.exit(0);
});

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
