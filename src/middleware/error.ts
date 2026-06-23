import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Wrap async route handlers so thrown errors reach the error handler.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Map known library error shapes to an HTTP status + safe-to-show message. */
function classify(err: any): { status: number; message: string } | null {
  if (err instanceof multer.MulterError) {
    return { status: 400, message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : err.message };
  }
  if (err?.message === 'Only image files are allowed') {
    return { status: 400, message: err.message };
  }
  if (err?.name === 'CastError') {
    return { status: 400, message: 'Invalid id format' };
  }
  if (err?.name === 'ValidationError') {
    return { status: 400, message: 'Invalid data: ' + Object.values(err.errors || {}).map((e: any) => e.message).join(', ') };
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return { status: 409, message: `${field} already in use` };
  }
  return null;
}

// Central error handler. Operational errors (anything with `.status` explicitly set, or a
// recognized library error) return their real message. Anything else is an unexpected/programmer
// error — log it fully server-side, but never echo its message/stack to the client.
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err?.stack || err?.message || err);

  if (typeof err?.status === 'number') {
    return res.status(err.status).json({ error: err.message || 'Request failed' });
  }

  const known = classify(err);
  if (known) return res.status(known.status).json({ error: known.message });

  res.status(500).json({ error: 'Internal server error' });
}
