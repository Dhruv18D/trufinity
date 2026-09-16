import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const callAnalysisRun = jest.fn<() => Promise<unknown>>();
const agentPerformanceRun = jest.fn<() => Promise<unknown>>();
const scheduledTasks: string[] = [];

jest.mock('../../src/modules/lace/ingestion/call-analysis.ingestion', () => ({
  laceCallAnalysisIngestionService: { run: callAnalysisRun },
}));
jest.mock('../../src/modules/lace/ingestion/agent-performance.ingestion', () => ({
  laceAgentPerformanceIngestionService: { run: agentPerformanceRun },
}));
jest.mock('node-cron', () => ({
  schedule: (expression: string, handler: () => void) => {
    scheduledTasks.push(expression);
    return { handler };
  },
}));

describe('Lace scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduledTasks.length = 0;
  });

  it('registers a cron task for both Call Analysis and Agent Performance using the configured expressions', async () => {
    const { startLaceScheduler } = await import('../../src/modules/lace/lace.scheduler');
    const { env } = await import('../../src/config/env');

    startLaceScheduler();

    expect(scheduledTasks).toEqual([env.LACE_CALL_ANALYSIS_CRON, env.LACE_AGENT_PERFORMANCE_CRON]);
  });

  it('running a scheduled tick calls the ingestion service', async () => {
    callAnalysisRun.mockResolvedValue({ syncRunId: 'run-1', recordsProcessed: 5, filesProcessed: 1 });
    const { startLaceScheduler } = await import('../../src/modules/lace/lace.scheduler');

    const tasks = startLaceScheduler() as unknown as { handler: () => void }[];
    tasks[0].handler();
    await new Promise((resolve) => setImmediate(resolve));

    expect(callAnalysisRun).toHaveBeenCalledTimes(1);
  });

  it('swallows a LaceSyncInProgressError from an overlapping run instead of crashing', async () => {
    const { LaceSyncInProgressError } = await import('../../src/modules/lace/ingestion/lace-raw.ingestion');
    callAnalysisRun.mockRejectedValue(new LaceSyncInProgressError('call_analysis'));
    const { startLaceScheduler } = await import('../../src/modules/lace/lace.scheduler');

    const tasks = startLaceScheduler() as unknown as { handler: () => void }[];
    expect(() => tasks[0].handler()).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(callAnalysisRun).toHaveBeenCalledTimes(1);
  });
});
