import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

// Logs one structured entry per HTTP request (method, path, status, duration).
// Health-check requests are skipped to keep the logs focused on real activity.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/api/health') {
    next();
    return;
  }

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
