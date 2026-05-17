import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const shouldSkipRequestLog = (path: string): boolean => {
  return path === '/health' || path === '/api/health';
};

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'];
  req.requestId = typeof requestId === 'string' && requestId.trim() ? requestId.trim() : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  if (shouldSkipRequestLog(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const actorId = req.user?.id ? String(req.user.id) : '-';
    console.info(
      `[HTTP] requestId=${req.requestId} method=${req.method} path=${req.originalUrl} status=${res.statusCode} userId=${actorId} durationMs=${durationMs.toFixed(2)}`,
    );
  });

  next();
};
