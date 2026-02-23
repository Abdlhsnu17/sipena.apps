import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { authMiddleware } from './middlewares/authMiddleware';
import { errorHandler } from './middlewares/errorHandler';
import {
    ensureMaintenanceAssetTypeColumn,
    ensureMaintenanceDetailColumns,
    ensureNonMedicalSpecificationsColumn,
    ensureReportUploadsTable,
    ensureUserProfileColumns
} from './utils/schema';

// Routes
import assetRoutes from './routes/asset.routes';
import authRoutes from './routes/auth.routes';
import borrowingRoutes from './routes/borrowing.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import maintenanceHistoryRoutes from './routes/maintenance_history.routes';
import maintenanceScheduleRoutes from './routes/maintenance_schedule.routes';
import reportRoutes from './routes/report.routes';
import umlRoutes from './routes/uml.routes';
import userRoutes from './routes/user.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(compression());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 100, // allow higher throughput in development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const healthHandler = (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
};

// Health check endpoints
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/assets', authMiddleware, assetRoutes);
app.use('/api/borrowing', authMiddleware, borrowingRoutes);
app.use('/api/maintenance', authMiddleware, maintenanceRoutes);
app.use('/api/maintenance-history', authMiddleware, maintenanceHistoryRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/uml', authMiddleware, umlRoutes);
app.use('/api/maintenance-schedule', authMiddleware, maintenanceScheduleRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

// Initialize database connections
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');
    await ensureMaintenanceAssetTypeColumn();
    await ensureMaintenanceDetailColumns();
    await ensureNonMedicalSpecificationsColumn();
    await ensureReportUploadsTable();
    await ensureUserProfileColumns();
    
    // Connect to Redis (optional)
    const redisConnected = await connectRedis();
    if (redisConnected) {
      console.log('✅ Redis connected successfully');
    } else {
      console.log('⚠️ Redis not available - continuing without Redis');
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
startServer();

export default app;
