import { NextFunction, Request, Response } from 'express';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('middleware:error');

interface ErrorResponse {
  success: false;
  message: string;
  error?: any;
  stack?: string;
  requestId?: string;
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Unhandled request error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    error: err,
  });

  // Default error
  let error: ErrorResponse = {
    success: false,
    message: 'Internal Server Error',
    error: err.message,
  };

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    res.status(401);
  } else if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    res.status(401);
  }
  // Validation errors
  else if (err.name === 'ValidationError') {
    error.message = 'Validation error';
    res.status(400);
  }
  // Upload errors
  else if (err.name === 'MulterError') {
    error.message = err.message || 'Upload file tidak valid';
    res.status(400);
  } else if (typeof err.message === 'string' && err.message.toLowerCase().includes('jenis file')) {
    error.message = err.message;
    res.status(400);
  }
  // Database errors
  else if (err.code === '23505') { // Unique constraint violation
    error.message = 'Duplicate entry';
    res.status(409);
  } else if (err.code === '23503') { // Foreign key constraint
    error.message = 'Referenced record not found';
    res.status(400);
  }
  // Custom application errors
  else if (err.statusCode) {
    error.message = err.message;
    res.status(err.statusCode);
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    error.stack = err.stack;
  }

  if (req.requestId) {
    error.requestId = req.requestId;
  }

  res.json(error);
};

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
