import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { healthRouter } from './modules/health/health.routes';
import { quickbooksRouter } from './modules/quickbooks/quickbooks.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { serviceTitanRouter } from './modules/servicetitan/servicetitan.routes';
import { laceRouter } from './modules/lace/lace.routes';
import { detectRouter } from './modules/detect/detect.routes';
import { narrateRouter } from './modules/narrate/narrate.routes';
import { deliverRouter } from './modules/deliver/deliver.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging excludes query strings so OAuth authorization codes are not logged.
app.use(morgan((tokens, req, res) => [
  tokens.method(req, res),
  req.path,
  tokens.status(req, res),
  tokens.res(req, res, 'content-length'),
  '-',
  tokens['response-time'](req, res),
  'ms',
].join(' ')));

// API Routes
app.use('/health', healthRouter);
app.use('/api/integrations/servicetitan', serviceTitanRouter);
app.use('/api/integrations/quickbooks', quickbooksRouter);
app.use('/api/integrations/lace', laceRouter);
app.use('/api/detect', detectRouter);
app.use('/api/narrate', narrateRouter);
app.use('/api/brief', deliverRouter);

// Handle 404
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

export default app;
