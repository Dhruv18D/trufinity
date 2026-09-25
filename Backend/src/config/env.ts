import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { sanitizeApprovedMailboxAllowlist } from '../modules/google/gmail-policy';

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
  // Number of reverse-proxy hops to trust for client IPs (0 disables proxy trust).
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  // Authentication
  APP_BASE_URL: z.url().default('http://localhost:3001').transform((value) => value.replace(/\/+$/, '')),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  AUTH_PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().min(3).max(50).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),

  // Outbound email (SMTP) used for password reset messages
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().default('TruFinity <no-reply@trufinity.ca>'),

  // QuickBooks Online
  QBO_CLIENT_ID: z.string().default(''),
  QBO_CLIENT_SECRET: z.string().default(''),
  QBO_REDIRECT_URI: z.string().default(''),
  QBO_AUTH_URL: z.string().default(''),
  QBO_TOKEN_URL: z.string().default(''),
  QBO_REVOKE_URL: z.string().default('https://developer.api.intuit.com/v2/oauth2/tokens/revoke'),
  QBO_DISCONNECT_AUTH_TOKEN: z.string().default(''),
  QBO_API_BASE_URL: z.string().default(''),
  QBO_CDC_POLL_INTERVAL_MS: z.coerce.number().int().min(300_000).max(86_400_000).default(900_000),

  // Google Workspace / Gmail foundation. Credentials are optional until Phase B.
  GOOGLE_CLOUD_PROJECT_ID: z.string().default('trufinity-email-integration'),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().default(''),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().default('').transform((value) => value.replace(/\\n/g, '\n')),
  GOOGLE_ADMIN_DELEGATED_USER: z.string().default(''),
  GOOGLE_GMAIL_DELEGATED_USER: z.string().default(''),
  GOOGLE_GMAIL_HISTORICAL_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
  GOOGLE_GMAIL_SYNC_INTERVAL_MS: z.coerce.number().int().min(300_000).max(86_400_000).default(900_000),
  GOOGLE_GMAIL_APPROVED_CONTENT_MAILBOXES: z.string()
    .default('service@trufinity.ca,support@trufinity.ca,billing@trufinity.ca')
    .superRefine((value, context) => {
      try { sanitizeApprovedMailboxAllowlist(value); }
      catch { context.addIssue({ code: 'custom', message: 'Google Gmail approved content mailbox configuration is invalid.' }); }
    })
    .transform(sanitizeApprovedMailboxAllowlist),

  // ServiceTitan
  SERVICETITAN_CLIENT_ID: z.string().default(''),
  SERVICETITAN_CLIENT_SECRET: z.string().default(''),
  SERVICETITAN_APP_KEY: z.string().default(''),
  SERVICETITAN_AUTH_URL: z.string().default(''),
  SERVICETITAN_BASE_URL: z.string().default(''),
  SERVICETITAN_TENANT_ID: z.string().default(''),
  // Where tenant admins grant this app access (Settings > Integrations > API Application Access).
  SERVICETITAN_CONNECT_URL: z.url().default('https://go.servicetitan.com'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('? Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
