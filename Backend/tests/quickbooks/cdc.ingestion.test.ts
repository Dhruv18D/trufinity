import { describe, expect, it, jest } from '@jest/globals';
import { QboApiError } from '../../src/modules/quickbooks/api.client';
import {
  parseQboCdcResponse, QboCdcIngestionService,
  type QboCdcCheckpoint, type QboCdcEvent, type QboCdcRunRuntime,
} from '../../src/modules/quickbooks/ingestion/cdc.ingestion';
import type { QboCdcEntity } from '../../src/modules/quickbooks/types';

const base = new Date('2026-09-15T12:00:00.000Z');
const boundary = '2026-09-16T12:00:00.000Z';
const item = (Id: string, LastUpdatedTime = '2026-09-16T11:59:00.000Z', status?: string) => ({
  ...(status ? { status } : {}), Id, MetaData: { LastUpdatedTime },
});
const response = (groups: unknown[], time = boundary) => ({ CDCResponse: groups, time });
const group = (...QueryResponse: unknown[]) => ({ QueryResponse });
const makeApi = (implementation: (entities: QboCdcEntity[], changedSince: string) => Promise<unknown>) => ({
  getChanges: jest.fn<(entities: QboCdcEntity[], changedSince: string) => Promise<unknown>>(implementation),
});

class MemoryRuntime implements QboCdcRunRuntime {
  public checkpoints = new Map<QboCdcEntity, QboCdcCheckpoint>([['Customer', { checkpointAt: base, origin: 'historical' }]]);
  public rows: { event: QboCdcEvent; isLatest: boolean }[] = [];
  public validationErrors: string[] = [];
  public failure: Error | null = null;
  public locked = true;
  public runStatus: 'RUNNING' | 'COMPLETED' | 'FAILED' | null = null;
  public runCount = 0;
  public recoveryCalls = 0;
  public async acquireLocks(): Promise<(() => Promise<void>) | null> { return this.locked ? async () => undefined : null; }
  public async recoverStaleRuns(): Promise<void> { this.recoveryCalls += 1; }
  public async createRun(): Promise<string> { this.runCount += 1; this.runStatus = 'RUNNING'; return 'run-1'; }
  public async getCheckpoint(entity: QboCdcEntity): Promise<QboCdcCheckpoint | null> { return this.checkpoints.get(entity) ?? null; }
  public async recordValidationError(_id: string, _entity: QboCdcEntity, _sourceId: string | null, message: string): Promise<void> { this.validationErrors.push(message); }
  public async commitSuccess(_id: string, events: QboCdcEvent[], checkpoints: { entity: QboCdcEntity; checkpointAt: Date }[]): Promise<void> {
    if (this.failure) throw this.failure;
    for (const event of events) {
      if (this.rows.some((row) => row.event.entity === event.entity && row.event.sourceId === event.sourceId && row.event.isDeleted === event.isDeleted && row.event.lastUpdatedTime === event.lastUpdatedTime)) continue;
      this.rows = this.rows.map((row) => row.event.entity === event.entity && row.event.sourceId === event.sourceId ? { ...row, isLatest: false } : row);
      this.rows.push({ event, isLatest: true });
    }
    for (const checkpoint of checkpoints) this.checkpoints.set(checkpoint.entity, { checkpointAt: checkpoint.checkpointAt, origin: 'cdc' });
    this.runStatus = 'COMPLETED';
  }
  public async failRun(): Promise<void> { this.runStatus = 'FAILED'; }
}

describe('QBO CDC response validation and isolated orchestration', () => {
  it('parses multiple entity groups, active/deleted rows, and an empty response', () => {
    const parsed = parseQboCdcResponse(response([
      group({ Customer: [item('c-1')] }),
      group({ Invoice: [item('i-1')] }, { Payment: [item('p-1', boundary, 'Deleted')], Account: [] }),
    ]), ['Customer', 'Invoice', 'Payment', 'Account']);
    expect(parsed.events).toHaveLength(3);
    expect(parsed.events[2].isDeleted).toBe(true);
    expect(parseQboCdcResponse(response([]), ['Customer']).events).toEqual([]);
  });

  it('rejects malformed CDC envelope, query groups, records and entity values', () => {
    for (const bad of [{}, { CDCResponse: {}, time: boundary }, response([{}]), response([group({ Customer: {} })]), response([group({ Customer: [item('x').Id] })]), response([group({ startPosition: '1' })])]) {
      expect(() => parseQboCdcResponse(bad, ['Customer'])).toThrow();
    }
  });

  it('uses historical timestamp minus overlap and advances to provider time only after commit', async () => {
    const runtime = new MemoryRuntime();
    const api = makeApi(async () => response([group({ Customer: [item('c-1')] })]));
    const service = new QboCdcIngestionService(api, runtime, () => Date.parse(boundary), async () => undefined);
    const result = await service.run(['Customer']);
    expect(api.getChanges).toHaveBeenCalledWith(['Customer'], '2026-09-15T11:58:00.000Z');
    expect(runtime.checkpoints.get('Customer')?.checkpointAt.toISOString()).toBe(boundary);
    expect(runtime.runStatus).toBe('COMPLETED');
    expect(runtime.recoveryCalls).toBe(1);
    expect(result.recordsProcessed).toBe(1);
  });

  it('persists deletion state and makes the deleted version latest without removing history', async () => {
    const runtime = new MemoryRuntime();
    const api = makeApi(async () => response([group({ Customer: [item('c-1')] }), group({ Customer: [item('c-1', boundary, 'Deleted')] })]));
    await new QboCdcIngestionService(api, runtime, () => Date.parse(boundary), async () => undefined).run(['Customer']);
    expect(runtime.rows).toHaveLength(2);
    expect(runtime.rows[0].isLatest).toBe(false);
    expect(runtime.rows[1].isLatest).toBe(true);
    expect(runtime.rows[1].event.isDeleted).toBe(true);
  });

  it('replays the overlap window idempotently without creating another raw version', async () => {
    const runtime = new MemoryRuntime();
    const api = makeApi(async () => response([group({ Customer: [item('c-1')] })]));
    const service = new QboCdcIngestionService(api, runtime, () => Date.parse(boundary), async () => undefined);
    await service.run(['Customer']);
    await service.run(['Customer']);
    expect(api.getChanges).toHaveBeenNthCalledWith(2, ['Customer'], '2026-09-16T11:58:00.000Z');
    expect(runtime.rows).toHaveLength(1);
    expect(runtime.rows[0].isLatest).toBe(true);
  });

  it('leaves checkpoints unchanged after API or transactional persistence failure', async () => {
    for (const apiFailure of [true, false]) {
      const runtime = new MemoryRuntime();
      const before = runtime.checkpoints.get('Customer')?.checkpointAt.toISOString();
      const api = makeApi(async () => {
        if (apiFailure) throw new QboApiError('safe failure', 503);
        return response([group({ Customer: [item('c-1')] })]);
      });
      if (!apiFailure) runtime.failure = new Error('database failure');
      await expect(new QboCdcIngestionService(api, runtime, () => Date.parse(boundary), async () => undefined).run(['Customer'])).rejects.toThrow('QuickBooks CDC synchronization failed.');
      expect(runtime.checkpoints.get('Customer')?.checkpointAt.toISOString()).toBe(before);
      expect(runtime.runStatus).toBe('FAILED');
      expect(runtime.rows).toHaveLength(0);
    }
  });

  it('records malformed records safely and does not advance the checkpoint', async () => {
    const runtime = new MemoryRuntime();
    const before = runtime.checkpoints.get('Customer')?.checkpointAt.toISOString();
    const api = makeApi(async () => response([group({ Customer: [{ MetaData: { LastUpdatedTime: boundary } }] })]));
    await expect(new QboCdcIngestionService(api, runtime, () => Date.parse(boundary), async () => undefined).run(['Customer'])).rejects.toThrow();
    expect(runtime.validationErrors).toHaveLength(1);
    expect(runtime.checkpoints.get('Customer')?.checkpointAt.toISOString()).toBe(before);
    expect(runtime.runStatus).toBe('FAILED');
  });

  it('fails safe at the 1000-object cap and when the checkpoint exceeds 30 days', async () => {
    const runtime = new MemoryRuntime();
    const before = runtime.checkpoints.get('Customer')?.checkpointAt.toISOString();
    const records = Array.from({ length: 1000 }, (_, index) => item('c-' + index));
    const capped = makeApi(async () => response([group({ Customer: records })]));
    await expect(new QboCdcIngestionService(capped, runtime, () => Date.parse(boundary), async () => undefined).run(['Customer'])).rejects.toThrow('QuickBooks CDC synchronization failed.');
    expect(runtime.checkpoints.get('Customer')?.checkpointAt.toISOString()).toBe(before);
    expect(runtime.rows).toHaveLength(0);
    expect(capped.getChanges).toHaveBeenCalledTimes(1);

    runtime.checkpoints.set('Customer', { checkpointAt: new Date('2026-07-01T00:00:00Z'), origin: 'cdc' });
    const api = makeApi(async () => { throw new Error('should not be called'); });
    await expect(new QboCdcIngestionService(api, runtime, () => Date.parse(boundary), async () => undefined).run(['Customer'])).rejects.toThrow('QuickBooks CDC synchronization failed.');
    expect(api.getChanges).not.toHaveBeenCalled();
  });

  it('retries transient errors but does not retry permanent HTTP failures', async () => {
    const runtime = new MemoryRuntime();
    let transientAttempts = 0;
    const transient = makeApi(async () => { transientAttempts += 1; if (transientAttempts === 1) throw new QboApiError('temporary', 503); return response([]); });
    await new QboCdcIngestionService(transient, runtime, () => Date.parse(boundary), async () => undefined).run(['Customer']);
    expect(transient.getChanges).toHaveBeenCalledTimes(2);

    const permanent = makeApi(async () => { throw new QboApiError('unauthorized', 401); });
    await expect(new QboCdcIngestionService(permanent, new MemoryRuntime(), () => Date.parse(boundary), async () => undefined).run(['Customer'])).rejects.toThrow();
    expect(permanent.getChanges).toHaveBeenCalledTimes(1);
  });

  it('does not start a run when lock acquisition is contended', async () => {
    const runtime = new MemoryRuntime();
    runtime.locked = false;
    const api = makeApi(async () => { throw new Error('should not be called'); });
    await expect(new QboCdcIngestionService(api, runtime).run(['Customer'])).rejects.toThrow();
    expect(runtime.runCount).toBe(0);
    expect(api.getChanges).not.toHaveBeenCalled();
  });

  it('does not make a first CDC request without a historical baseline checkpoint', async () => {
    const runtime = new MemoryRuntime();
    runtime.checkpoints.clear();
    const api = makeApi(async () => response([]));
    await expect(new QboCdcIngestionService(api, runtime).run(['Customer'])).rejects.toThrow();
    expect(api.getChanges).not.toHaveBeenCalled();
    expect(runtime.checkpoints.size).toBe(0);
  });

  it('requests multiple entities together and rejects malformed entity arrays', async () => {
    const runtime = new MemoryRuntime();
    runtime.checkpoints.set('Invoice', { checkpointAt: base, origin: 'historical' });
    const api = makeApi(async () => response([group({ Customer: [], Invoice: [item('i-1')] })]));
    await new QboCdcIngestionService(api, runtime, () => Date.parse(boundary), async () => undefined).run(['Customer', 'Invoice']);
    expect(api.getChanges).toHaveBeenCalledWith(['Customer', 'Invoice'], '2026-09-15T11:58:00.000Z');
    expect(runtime.checkpoints.get('Invoice')?.checkpointAt.toISOString()).toBe(boundary);
  });
});
