import { env } from '../config/env';
import { db } from '../database';
import { qboCdcIngestionService } from '../modules/quickbooks/ingestion/cdc.ingestion';
import { QboCdcScheduler, validateQboCdcPollInterval, type QboCdcSchedulerLogger } from '../modules/quickbooks/worker/cdc.scheduler';
import type { QboCdcEntity } from '../modules/quickbooks/types';
import { logger } from '../utils/logger';

export interface QboCdcWorkerDatabase { raw(query: string): Promise<unknown>; destroy(): Promise<unknown>; }
export interface QboCdcWorkerConfig { clientId: string; clientSecret: string; tokenUrl: string; apiBaseUrl: string; pollIntervalMs: number; }
export interface QboCdcWorkerScheduler { start(): void; stop(): Promise<void>; }
export interface QboCdcWorkerDependencies {
  database: QboCdcWorkerDatabase;
  config: QboCdcWorkerConfig;
  runEntity(entity: QboCdcEntity): Promise<unknown>;
  logger: QboCdcSchedulerLogger;
  createScheduler(runEntity: (entity: QboCdcEntity) => Promise<unknown>, intervalMs: number): QboCdcWorkerScheduler;
  registerShutdown(handler: (signal: 'SIGTERM' | 'SIGINT') => void): () => void;
}

export const validateQboCdcWorkerConfig = (config: QboCdcWorkerConfig): void => {
  if (!config.clientId.trim() || !config.clientSecret.trim()) throw new Error('QuickBooks OAuth client configuration is required for the CDC worker.');
  for (const endpoint of [config.tokenUrl, config.apiBaseUrl]) {
    let parsed: URL;
    try { parsed = new URL(endpoint); } catch { throw new Error('QuickBooks API endpoint configuration is invalid.'); }
    if (parsed.protocol !== 'https:') throw new Error('QuickBooks worker endpoints must use HTTPS.');
  }
  validateQboCdcPollInterval(config.pollIntervalMs);
};

export const startQboCdcWorker = async (dependencies: QboCdcWorkerDependencies): Promise<{ shutdown(): Promise<void> }> => {
  validateQboCdcWorkerConfig(dependencies.config);
  await dependencies.database.raw('SELECT 1');
  dependencies.logger.info('QuickBooks CDC worker database connectivity verified.');
  const scheduler = dependencies.createScheduler((entity) => dependencies.runEntity(entity), dependencies.config.pollIntervalMs);
  let shutdownPromise: Promise<void> | undefined;
  let unregisterShutdown = (): void => undefined;
  const shutdown = (): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    unregisterShutdown();
    shutdownPromise = (async () => {
      dependencies.logger.info('QuickBooks CDC worker stopping; waiting for the active cycle to finish.');
      await scheduler.stop();
      await dependencies.database.destroy();
      dependencies.logger.info('QuickBooks CDC worker stopped cleanly.');
    })();
    return shutdownPromise;
  };
  unregisterShutdown = dependencies.registerShutdown((signal) => {
    dependencies.logger.info(`QuickBooks CDC worker received ${signal}; graceful shutdown requested.`);
    void shutdown().catch(() => {
      dependencies.logger.error('QuickBooks CDC worker shutdown encountered an error.');
      process.exitCode = 1;
    });
  });
  scheduler.start();
  dependencies.logger.info('QuickBooks CDC worker started; first cycle begins immediately.');
  return { shutdown };
};

const registerProcessShutdown = (handler: (signal: 'SIGTERM' | 'SIGINT') => void): (() => void) => {
  const onSigterm = (): void => handler('SIGTERM');
  const onSigint = (): void => handler('SIGINT');
  process.once('SIGTERM', onSigterm);
  process.once('SIGINT', onSigint);
  return () => { process.removeListener('SIGTERM', onSigterm); process.removeListener('SIGINT', onSigint); };
};

const main = async (): Promise<void> => {
  try {
    await startQboCdcWorker({
      database: db,
      config: { clientId: env.QBO_CLIENT_ID, clientSecret: env.QBO_CLIENT_SECRET, tokenUrl: env.QBO_TOKEN_URL, apiBaseUrl: env.QBO_API_BASE_URL, pollIntervalMs: env.QBO_CDC_POLL_INTERVAL_MS },
      runEntity: (entity) => qboCdcIngestionService.run([entity]),
      logger,
      createScheduler: (runEntity, intervalMs) => new QboCdcScheduler({ runEntity, intervalMs, logger }),
      registerShutdown: registerProcessShutdown,
    });
  } catch {
    logger.error('QuickBooks CDC worker startup failed; verify configuration and database connectivity.');
    await db.destroy().catch(() => undefined);
    process.exitCode = 1;
  }
};

if (require.main === module) void main();
