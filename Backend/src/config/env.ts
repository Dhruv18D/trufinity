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

  // Lace AI (batch export via S3 - no public API, see Section 4.1 of SPEC-BI-001)
  LACE_S3_BUCKET: z.string().default(''),
  LACE_S3_REGION: z.string().default(''),
  LACE_S3_ACCESS_KEY_ID: z.string().default(''),
  LACE_S3_SECRET_ACCESS_KEY: z.string().default(''),
  LACE_S3_CALL_ANALYSIS_PREFIX: z.string().default(''),
  LACE_S3_AGENT_PERFORMANCE_PREFIX: z.string().default(''),
  // Cron expressions for the automated sync schedule. Defaults: Call Analysis
  // daily at 02:00, Agent Performance monthly on the 1st at 03:00 (server time).
  LACE_CALL_ANALYSIS_CRON: z.string().default('0 2 * * *'),
  LACE_AGENT_PERFORMANCE_CRON: z.string().default('0 3 1 * *'),
  // Stuck-run reaper: catches a sync_run left RUNNING by a crashed process
  // well before the next scheduled ingestion would notice on its own.
  LACE_STUCK_RUN_REAPER_CRON: z.string().default('*/30 * * * *'),
  LACE_STUCK_RUN_THRESHOLD_MINUTES: z.coerce.number().default(60),

  // Detect layer thresholds (SPEC-BI-001 exact values not confirmed yet -
  // these are reasonable defaults, deliberately env-tunable so they can be
  // corrected without a code change once the spec's exact numbers are known).
  // D-01: alert when the current 7-day booking rate drops at least this many
  // percentage points below the trailing 4-week average booking rate.
  DETECT_D01_BOOKING_RATE_DROP_THRESHOLD_POINTS: z.coerce.number().default(10),
  // D-06: alert when an objection category's current 7-day count is at least
  // this many times its trailing 4-week weekly average (min sample size below).
  DETECT_D06_OBJECTION_SPIKE_MULTIPLIER: z.coerce.number().default(2),
  DETECT_D06_OBJECTION_MIN_SAMPLE: z.coerce.number().default(3),

  // Narrate layer: LLM writes prose describing detected_alerts findings only -
  // it never recomputes numbers (SPEC-BI-001 Section 4.1).
  ANTHROPIC_API_KEY: z.string().default(''),
  NARRATE_MODEL: z.string().default('claude-opus-5'),
});

// A missing S3 secret must fail fast at startup in production, not surface
// later as a cryptic AWS SDK auth error the first time ingestion runs.
const productionEnvSchema = envSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV !== 'production') return;
  if (data.LACE_S3_SECRET_ACCESS_KEY.length < 20) {
    ctx.addIssue({
      code: 'custom',
      path: ['LACE_S3_SECRET_ACCESS_KEY'],
      message: 'LACE_S3_SECRET_ACCESS_KEY is required (min 20 chars) when NODE_ENV=production.',
    });
  }
  if (data.LACE_S3_ACCESS_KEY_ID.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['LACE_S3_ACCESS_KEY_ID'],
      message: 'LACE_S3_ACCESS_KEY_ID is required when NODE_ENV=production.',
    });
  }
  if (data.LACE_S3_BUCKET.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['LACE_S3_BUCKET'], message: 'LACE_S3_BUCKET is required when NODE_ENV=production.' });
  }
});

const _env = productionEnvSchema.safeParse(process.env);

if (!_env.success) {
  console.error('? Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
