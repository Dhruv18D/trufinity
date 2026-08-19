import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { healthRouter } from './modules/health/health.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (use 'dev' format in development)
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// API Routes
app.use('/health', healthRouter);

// Handle 404
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

export default app;
