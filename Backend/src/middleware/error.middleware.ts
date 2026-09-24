import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });

  // err.message can carry internal detail (S3 object keys, DB identifiers,
  // ...) that shouldn't reach a client outside development - it's already
  // logged above for operators.
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({
    status: 'error',
    message: isDevelopment ? err.message || 'Internal Server Error' : 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }),
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Not Found - ${req.originalUrl}`,
  });
};
