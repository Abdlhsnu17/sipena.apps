import { createClient, RedisClientType } from 'redis';
import { applyDevelopmentEnvDefaults, loadEnvironment } from './env';

loadEnvironment();
applyDevelopmentEnvDefaults();

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
    console.error('⚠️ Redis connection failed:', error);
    console.log('⚠️ Continuing without Redis - some features may be limited');
    // Don't throw error - allow app to continue without Redis
    return false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.disconnect();
    console.log('✅ Redis disconnected');
  } catch (error) {
    console.error('❌ Redis disconnection failed:', error);
  }
};

export default redisClient;
