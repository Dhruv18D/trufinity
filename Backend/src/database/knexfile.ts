import type { Knex } from 'knex';
import { env } from '../config/env';

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    },
    migrations: {
      directory: '../../migrations',
      extension: 'ts',
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: { rejectUnauthorized: false }, // Useful for managed DBs
    },
    migrations: {
      directory: './migrations',
      extension: 'js',
    },
  },
};

export default config;
