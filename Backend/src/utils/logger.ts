import winston from 'winston';
import { env } from '../config/env';

const formats = [
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${String(info.timestamp)} ${String(info.level)}: ${String(info.message)}`,
  ),
];

if (env.NODE_ENV === 'development') {
  formats.unshift(winston.format.colorize({ all: true }));
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'warn',
  levels: winston.config.npm.levels,
  format: winston.format.combine(...formats),
  transports: [
    new winston.transports.Console(),
    // We can add File transports here for production
  ],
});
