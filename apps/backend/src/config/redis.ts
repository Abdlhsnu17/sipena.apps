import { createClient, RedisClientType } from 'redis';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './env';
import { createScopedLogger } from '../utils/logger';

loadEnvironment();
applyDevelopmentEnvDefaults();
const logger = createScopedLogger('config:redis');

const redisClient: RedisClientType = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

export const connectRedis = async (): Promise<boolean> => {
  try {
    await redisClient.connect();
    return true;
  } catch (error) {
    logger.warn('Redis connection failed', { error });
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      logger.debug('Continuing without Redis - some features may be limited');
    }
    // Don't throw error - allow app to continue without Redis
    return false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.disconnect();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error('Redis disconnection failed', { error });
  }
};

export default redisClient;
