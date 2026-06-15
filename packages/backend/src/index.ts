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
    ensureUserAccessControlColumns,
    ensureUserActivityLogsTable,
    ensureUserProfileColumns,
    withSchemaLock
} from './utils/schema';
import { getProfileUploadsDir } from './utils/storage-paths';

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

// Load environment variables
loadEnvironment();
applyDevelopmentEnvDefaults();

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
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please ensure all variables are set in your .env file');
    process.exit(1);
  }

  if (invalid.length > 0) {
    console.error('❌ Invalid production environment configuration:');
    invalid.forEach((message) => console.error(`- ${message}`));
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
app.use(helmet());
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

app.use('/api/auth/login', loginLimiter);
app.use('/api', generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Only profile photos remain directly reachable; report files must go through protected routes.
app.use('/uploads/profiles', express.static(getProfileUploadsDir()));

const healthHandler = (req: express.Request, res: express.Response) => {
  const status = infrastructureStatus.database === 'up' && infrastructureStatus.schema === 'up'
    ? 'OK'
    : 'DEGRADED';

  res.status(200).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: infrastructureStatus,
    requestId: req.requestId,
  });
};

// Health check endpoints
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

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
  console.log('⚠️ DSS debug routes mounted at /api/dss-debug (dev only)');
} else if (!isProduction && process.env.ALLOW_DSS_DEBUG !== 'true') {
  console.log('ℹ️ DSS debug routes not mounted (set ALLOW_DSS_DEBUG=true to enable)');
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

// Start the HTTP server with port-retry logic so a busy port doesn't crash the process.
const startHttpServer = (startPort: number, maxAttempts = 10) => {
  let attempt = 0;

  const tryListen = (port: number) => {
    attempt += 1;
    const server = app.listen(port);

    server.on('listening', () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🌐 API URL: http://localhost:${port}`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`⚠️ Port ${port} is already in use.`);
        server.close?.();
        if (attempt < maxAttempts) {
          const nextPort = port + 1;
          console.log(`ℹ️ Trying next port ${nextPort} (attempt ${attempt + 1}/${maxAttempts})`);
          // small delay before retrying
          setTimeout(() => tryListen(nextPort), 200);
          return;
        }
        console.error('❌ All port attempts failed. Please free the port or set PORT to another value.');
        process.exit(1);
      }

      // For other errors, rethrow to surface the problem
      console.error('❌ HTTP server error:', err);
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
      console.log('✅ Database connected successfully');

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
        await ensureRoleMenuAccessControlTables();
        await ensureUserActivityLogsTable();
        await ensureDeletionRequestsTable();
        await ensureAssetDisposalTable();
      });
      infrastructureStatus.schema = 'up';

      const redisConnected = await connectRedis();
      if (redisConnected) {
        infrastructureStatus.redis = 'up';
        console.log('✅ Redis connected successfully');
      } else {
        if (isProduction) {
          infrastructureStatus.redis = 'down';
          throw new Error('Redis wajib aktif di production');
        }
        infrastructureStatus.redis = 'optional-down';
        console.log('⚠️ Redis not available - continuing without Redis');
      }

      console.log('✅ Startup initialization complete');
      return;
    } catch (error) {
      console.error(
        `❌ Startup initialization attempt ${attempt}/${STARTUP_RETRY_ATTEMPTS} failed:`,
        error
      );
      infrastructureStatus.database = 'down';
      infrastructureStatus.schema = 'down';

      if (attempt < STARTUP_RETRY_ATTEMPTS) {
        await sleep(STARTUP_RETRY_DELAY_MS);
        continue;
      }

      if (isProduction) {
        console.error('❌ Startup initialization failed in production. Exiting.');
        process.exit(1);
      }

      console.error('⚠️ Continuing to serve while startup initialization remains unavailable.');
      return;
    }
  }
};

void initializeInfrastructure();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

export default app;
