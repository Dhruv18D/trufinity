import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const startServer = () => {
  app.listen(env.PORT, () => {
    logger.info(`Server is running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`Health check: http://localhost:${env.PORT}/health`);
  });
};

startServer();
