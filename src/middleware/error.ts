import { Request, Response, NextFunction } from 'express';

// Wrap async route handlers so thrown errors reach the error handler.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Central error handler.
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err?.message || err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}