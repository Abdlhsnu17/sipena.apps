import { NextFunction, Request, Response } from 'express';

interface ErrorResponse {
  success: false;
  message: string;
  error?: any;
  stack?: string;
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

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
