import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './config/env';
import { infrastructureStatus } from './config/infrastructure-status';
import { authMiddleware, sseTicketMiddleware } from './middlewares/auth.middleware';
import { borrowingPreflightMiddleware } from './middlewares/borrowing-preflight.middleware';
import { errorHandler } from './middlewares/error-handler.middleware';
import { requestContextMiddleware } from './middlewares/request-context.middleware';
import { getAnnouncementUploadsDir, getMaintenanceUploadsDir, getProfileUploadsDir } from './utils/storage-paths';
import { getServerTimeSnapshot } from './utils/time';

// Routes
import { API_MOUNTS, dssRoutes } from './routes/api-mounts';
import docsRoutes from './routes/docs.routes';
// Import notification controller for the standalone SSE stream route mounted
// outside the header-authenticated notification router.
import notificationController from './controllers/notification.controller';

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

const parseRateLimitMax = (value: string | undefined, fallback: number): number => {
  const parsedValue = Number.parseInt(value || '', 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

/**
 * Membangun aplikasi Express lengkap dengan seluruh middleware dan route.
 *
 * Fungsi ini sengaja bebas efek samping: tidak membuka port, tidak menyentuh
 * database/Redis, dan tidak pernah memanggil `process.exit`. Bootstrap produksi
 * ada di `index.ts`, sementara test integrasi memanggil `createApp()` langsung
 * lalu memakainya dengan supertest.
 *
 * Rate limiter dibuat ulang pada setiap pemanggilan sehingga hitungannya tidak
 * bocor antar test.
 */
export const createApp = (): express.Application => {
  loadEnvironment();
  applyDevelopmentEnvDefaults();

  const app = express();
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  const isTest = (process.env.NODE_ENV || '') === 'test';
  const isDev = !isProduction;

  // Trust proxy - important for rate limiting behind reverse proxy (e.g., Railway)
  app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY_HOPS));

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

  // Selenium/regression suites emit a lot of legitimate API traffic in dev mode,
  // so keep the general limiter comfortably above the default production-like cap
  // when running locally.
  const generalRateLimitMax = isDev
    ? Math.max(parseRateLimitMax(process.env.GENERAL_RATE_LIMIT_MAX, 10000), 10000)
    : parseRateLimitMax(process.env.GENERAL_RATE_LIMIT_MAX, 2000);
  const loginRateLimitMax = parseRateLimitMax(process.env.LOGIN_RATE_LIMIT_MAX, isDev ? 1000 : 40);
  const registerRateLimitMax = parseRateLimitMax(process.env.REGISTER_RATE_LIMIT_MAX, isDev ? 1000 : 20);
  const passwordResetRateLimitMax = parseRateLimitMax(process.env.PASSWORD_RESET_RATE_LIMIT_MAX, isDev ? 1000 : 20);

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

  if (!isTest) {
    app.use('/api/auth/login', loginLimiter);
    app.use('/api/auth/register', registerLimiter);
    app.use('/api/auth/reset-password', passwordResetLimiter);
    app.use('/api', generalLimiter);
  }

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
  // Gambar siaran mengikuti pola foto profil: dimuat lewat <img> sehingga harus
  // lolos Cross-Origin-Resource-Policy, dan dapat diakses tanpa autentikasi oleh
  // siapa pun yang mengetahui nama filenya yang teracak.
  app.use('/uploads/announcements', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.use('/uploads/announcements', express.static(getAnnouncementUploadsDir()));

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

  // Interactive API documentation. Mounted before the authenticated routers so
  // the contract stays readable without a token.
  app.use('/api/docs', docsRoutes);

  // Development-only: expose DSS routes without auth for debugging only when explicitly allowed
  // Set ALLOW_DSS_DEBUG=true in your local env to enable this route.
  if (!isProduction && process.env.ALLOW_DSS_DEBUG === 'true') {
    app.use('/api/dss-debug', dssRoutes);
  }

  // EventSource cannot set Authorization headers, so this route consumes a
  // short-lived, one-use ticket issued by the authenticated notification router.
  // Must be registered before the /api/notifications router so it is not
  // intercepted by the header-based authMiddleware.
  app.get('/api/notifications/stream', sseTicketMiddleware, notificationController.stream);

  // Borrowing preflight keeps validation/role checks deterministic even when
  // route-level middleware order changes during refactors.
  app.use('/api/borrowing', authMiddleware, borrowingPreflightMiddleware);

  // API Routes
  for (const mount of API_MOUNTS) {
    if (mount.requiresAuth) {
      app.use(mount.prefix, authMiddleware, mount.router);
    } else {
      app.use(mount.prefix, mount.router);
    }
  }

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};

export default createApp;
