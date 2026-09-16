import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.string().transform(Number).default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  // QuickBooks Online
  QBO_CLIENT_ID: z.string().default(''),
  QBO_CLIENT_SECRET: z.string().default(''),
  QBO_REDIRECT_URI: z.string().default(''),
  QBO_AUTH_URL: z.string().default(''),
  QBO_TOKEN_URL: z.string().default(''),
  QBO_REVOKE_URL: z.string().default('https://developer.api.intuit.com/v2/oauth2/tokens/revoke'),
  QBO_API_BASE_URL: z.string().default(''),

  // ServiceTitan
  SERVICETITAN_CLIENT_ID: z.string().default(''),
  SERVICETITAN_CLIENT_SECRET: z.string().default(''),
  SERVICETITAN_APP_KEY: z.string().default(''),
  SERVICETITAN_AUTH_URL: z.string().default(''),
  SERVICETITAN_BASE_URL: z.string().default(''),
  SERVICETITAN_TENANT_ID: z.string().default(''),

  // Lace AI (batch export via S3 - no public API, see Section 4.1 of SPEC-BI-001)
  LACE_S3_BUCKET: z.string().default(''),
  LACE_S3_REGION: z.string().default(''),
  LACE_S3_ACCESS_KEY_ID: z.string().default(''),
  LACE_S3_SECRET_ACCESS_KEY: z.string().default(''),
  LACE_S3_CALL_ANALYSIS_PREFIX: z.string().default(''),
  LACE_S3_AGENT_PERFORMANCE_PREFIX: z.string().default(''),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('? Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
