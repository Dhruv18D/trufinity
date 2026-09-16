import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { laceCallAnalysisIngestionService } from './ingestion/call-analysis.ingestion';
import { laceAgentPerformanceIngestionService } from './ingestion/agent-performance.ingestion';
import { LaceSyncInProgressError } from './ingestion/lace-raw.ingestion';

interface LaceScheduledSync {
  exportType: string;
  cronExpression: string;
  run: () => Promise<{ syncRunId: string; recordsProcessed: number; filesProcessed: number }>;
}

const SCHEDULED_SYNCS: LaceScheduledSync[] = [
  {
    exportType: 'call_analysis',
    cronExpression: env.LACE_CALL_ANALYSIS_CRON,
    run: () => laceCallAnalysisIngestionService.run(),
  },
  {
    exportType: 'agent_performance',
    cronExpression: env.LACE_AGENT_PERFORMANCE_CRON,
    run: () => laceAgentPerformanceIngestionService.run(),
  },
];

async function runScheduledSync(sync: LaceScheduledSync): Promise<void> {
  try {
    const result = await sync.run();
    logger.info(`[LaceAI] Scheduled ${sync.exportType} sync completed`, result);
  } catch (error) {
    // A sync already in progress (e.g. a manual dev trigger overlapping the
    // cron tick) is expected and not an operational failure - log it quietly.
    if (error instanceof LaceSyncInProgressError) {
      logger.info(`[LaceAI] Scheduled ${sync.exportType} sync skipped: already running`);
      return;
    }
    logger.error(`[LaceAI] Scheduled ${sync.exportType} sync failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Registers the Lace AI ingestion cron jobs. Call once at process startup
// (see server.ts) - not from app.ts, so importing the Express app in tests
// doesn't also spin up background cron jobs.
export function startLaceScheduler(): ScheduledTask[] {
  return SCHEDULED_SYNCS.map((sync) => {
    const task = cron.schedule(sync.cronExpression, () => {
      void runScheduledSync(sync);
    });
    logger.info(`[LaceAI] Scheduled ${sync.exportType} sync (cron: ${sync.cronExpression})`);
    return task;
  });
}
