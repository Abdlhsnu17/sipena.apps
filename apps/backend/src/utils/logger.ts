import { createLogger, format, transports } from 'winston';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const developmentFormat = format.printf(({ message, ...metadata }) => {
  const metadataText = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  return `${message}${metadataText}`;
});

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  silent: process.env.LOG_SILENT === 'true' || (isTest && process.env.LOG_TEST_OUTPUT !== 'true'),
  defaultMeta: {
    service: 'sipena-backend',
  },
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    isProduction ? format.json() : developmentFormat,
  ),
  transports: [new transports.Console()],
});

export const createScopedLogger = (scope: string) => logger.child({ scope });
