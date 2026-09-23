import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const callAnalysisRun = jest.fn<() => Promise<unknown>>();
const agentPerformanceRun = jest.fn<() => Promise<unknown>>();
const canonicalSync = jest.fn<() => Promise<unknown>>();
const loggerInfo = jest.fn();
const loggerError = jest.fn();
const scheduledTasks: string[] = [];

jest.mock('../../src/modules/lace/ingestion/call-analysis.ingestion', () => ({
  laceCallAnalysisIngestionService: { run: callAnalysisRun },
}));
jest.mock('../../src/modules/lace/ingestion/agent-performance.ingestion', () => ({
  laceAgentPerformanceIngestionService: { run: agentPerformanceRun },
}));
jest.mock('../../src/modules/lace/canonical/call-analysis.canonical.service', () => ({
  callAnalysisCanonicalService: { sync: canonicalSync },
}));
jest.mock('../../src/utils/logger', () => ({
  logger: { info: loggerInfo, error: loggerError, warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('node-cron', () => ({
  schedule: (expression: string, handler: () => void) => {
    scheduledTasks.push(expression);
    return { handler };
  },
}));

// Each test dynamically imports the scheduler fresh (resetModules), so the
// module-level SCHEDULED_SYNCS array and its captured mock references can't
// leak state between tests - the previous version relied on jest.clearAllMocks()
// alone, which resets call history but not module state.
describe('Lace scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    scheduledTasks.length = 0;
  });

  it('registers a cron task for both Call Analysis and Agent Performance using the configured expressions', async () => {
    const { startLaceScheduler } = await import('../../src/modules/lace/lace.scheduler');
    const { env } = await import('../../src/config/env');

    startLaceScheduler();

    expect(scheduledTasks).toEqual([env.LACE_CALL_ANALYSIS_CRON, env.LACE_AGENT_PERFORMANCE_CRON, env.LACE_STUCK_RUN_REAPER_CRON]);
  });

  it('running a scheduled tick calls the ingestion service', async () => {
    callAnalysisRun.mockResolvedValue({ syncRunId: 'run-1', recordsProcessed: 5, filesProcessed: 1, filesFailed: 0 });
    canonicalSync.mockResolvedValue({ rowsUpserted: 5 });
    const { startLaceScheduler } = await import('../../src/modules/lace/lace.scheduler');

    const tasks = startLaceScheduler() as unknown as { handler: () => Promise<void> }[];
    await tasks[0].handler();

    expect(callAnalysisRun).toHaveBeenCalledTimes(1);
  });

  it('chains canonical sync after a successful call-analysis raw sync (afterSuccess)', async () => {
    callAnalysisRun.mockResolvedValue({ syncRunId: 'run-1', recordsProcessed: 5, filesProcessed: 1, filesFailed: 0 });
    canonicalSync.mockResolvedValue({ rowsUpserted: 5 });
    const { startLaceScheduler } = await import('../../src/modules/lace/lace.scheduler');

    const tasks = startLaceScheduler() as unknown as { handler: () => Promise<void> }[];
    await tasks[0].handler();

    expect(canonicalSync).toHaveBeenCalledTimes(1);
  });

  it('does not let a canonical-sync failure be mistaken for an ingestion failure', async () => {
    callAnalysisRun.mockResolvedValue({ syncRunId: 'run-1', recordsProcessed: 5, filesProcessed: 1, filesFailed: 0 });
    canonicalSync.mockRejectedValue(new Error('canonical sync boom'));
    const { startLaceScheduler } = await import('../../src/modules/lace/lace.scheduler');

    const tasks = startLaceScheduler() as unknown as { handler: () => Promise<void> }[];
    await expect(tasks[0].handler()).resolves.toBeUndefined();

    expect(canonicalSync).toHaveBeenCalledTimes(1);
    // The failure must be logged loudly (as a post-sync error), not swallowed silently.
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Post-sync step failed'),
      expect.objectContaining({ error: 'canonical sync boom' }),
    );
  });

  it('swallows a LaceSyncInProgressError from an overlapping run instead of crashing, and logs it at info level', async () => {
    const { LaceSyncInProgressError } = await import('../../src/modules/lace/ingestion/lace-raw.ingestion');
    callAnalysisRun.mockRejectedValue(new LaceSyncInProgressError('call_analysis'));
    const { startLaceScheduler } = await import('../../src/modules/lace/lace.scheduler');

    const tasks = startLaceScheduler() as unknown as { handler: () => Promise<void> }[];
    await expect(tasks[0].handler()).resolves.toBeUndefined();

    expect(callAnalysisRun).toHaveBeenCalledTimes(1);
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining('skipped: already running'));
    expect(loggerError).not.toHaveBeenCalled();
    // The overlap is expected, not a failure - canonical sync must not run off stale/no data.
    expect(canonicalSync).not.toHaveBeenCalled();
  });
});
