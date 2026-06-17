/**
 * Centralized Error Handling Utilities
 * Provides consistent error logging and response handling across services
 */

import { createScopedLogger } from './logger';

const baseLogger = createScopedLogger('service-error');

export enum ErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogContext {
  service?: string;
  method?: string;
  userId?: string | number;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Centralized logger for consistent error handling
 */
export class ServiceLogger {
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  private formatLog(level: ErrorLevel, message: string, error?: Error, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : '';
    const errorDetails = error ? `\nError: ${error.message}\nStack: ${error.stack}` : '';

    const logMessage = `[${timestamp}] [${this.source}] [${level.toUpperCase()}] ${message} ${contextStr}${errorDetails}`;

    switch (level) {
      case ErrorLevel.DEBUG:
        baseLogger.debug(logMessage);
        break;
      case ErrorLevel.INFO:
        baseLogger.info(logMessage);
        break;
      case ErrorLevel.WARN:
        baseLogger.warn(logMessage);
        break;
      case ErrorLevel.ERROR:
      case ErrorLevel.CRITICAL:
        baseLogger.error(logMessage);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.formatLog(ErrorLevel.DEBUG, message, undefined, context);
  }

  info(message: string, context?: LogContext): void {
    this.formatLog(ErrorLevel.INFO, message, undefined, context);
  }

  warn(message: string, error?: Error, context?: LogContext): void {
    this.formatLog(ErrorLevel.WARN, message, error, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.formatLog(ErrorLevel.ERROR, message, error, context);
  }

  critical(message: string, error?: Error, context?: LogContext): void {
    this.formatLog(ErrorLevel.CRITICAL, message, error, context);
  }
}

/**
 * Service error handler with consistent response format
 */
export function handleServiceError(
  error: any,
  defaultMessage: string = 'An error occurred',
  logger?: ServiceLogger
): { success: false; message: string; error?: string } {
  const message = error?.message || defaultMessage;

  if (logger) {
    logger.error(`${defaultMessage}: ${message}`, error instanceof Error ? error : undefined);
  }

  return {
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { error: error?.message })
  };
}

/**
 * Validate required environment variables
 */
export function validateEnvironmentVariable(
  varName: string,
  errorMessage?: string
): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(
      errorMessage || `Required environment variable ${varName} is not set`
    );
  }
  return value;
}
