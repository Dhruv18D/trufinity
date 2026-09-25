import { describe, expect, it } from '@jest/globals';
import { KnexGmailHistoricalRepository } from '../../src/modules/google/gmail-historical.repository';

// Minimal fake standing in for the subset of the Knex query-builder surface
// completeIncrementalRun() actually uses, so the row-count assertion inside it
// can be exercised without a live database. It does not simulate real
// transactional rollback (that guarantee comes from Postgres/knex itself, the
// same mechanism already relied on by commitBatch()/completeMailbox()); it
// only lets us control what each table's .update() resolves to.
function createFakeDatabase(options: { syncRunsUpdateCount: number; metadataUpdateCount?: number }) {
  const calls: { table: string; update: Record<string, unknown> }[] = [];
  const trx = ((table: string) => ({
    where: () => ({
      update: async (update: Record<string, unknown>) => {
        calls.push({ table, update });
        if (table === 'sync_runs') return options.syncRunsUpdateCount;
        if (table === 'raw_gmail_sync_metadata') return options.metadataUpdateCount ?? 1;
        throw new Error(`Unexpected table in test fake: ${table}`);
      },
    }),
  })) as unknown as import('knex').Knex.Transaction;
  (trx as unknown as { fn: { now: () => string } }).fn = { now: () => 'NOW()' };
  const database = {
    transaction: async (work: (trx: unknown) => Promise<void>) => work(trx),
  } as unknown as import('knex').Knex;
  return { database, calls };
}

describe('KnexGmailHistoricalRepository.completeIncrementalRun', () => {
  it('succeeds when exactly one RUNNING sync_runs row matches', async () => {
    const { database, calls } = createFakeDatabase({ syncRunsUpdateCount: 1 });
    const repository = new KnexGmailHistoricalRepository(database);

    await expect(repository.completeIncrementalRun('mailbox-1', 'run-1', '1001', 5)).resolves.toBeUndefined();
    expect(calls.find((c) => c.table === 'sync_runs')?.update).toMatchObject({ status: 'COMPLETED', records_processed: 5 });
  });

  it('throws instead of silently succeeding when zero sync_runs rows match', async () => {
    const { database, calls } = createFakeDatabase({ syncRunsUpdateCount: 0 });
    const repository = new KnexGmailHistoricalRepository(database);

    await expect(repository.completeIncrementalRun('mailbox-1', 'run-1', '1001', 5)).rejects.toThrow(
      /did not match exactly one RUNNING sync_runs row/,
    );
    // The checkpoint update was attempted inside the same transaction callback that
    // throws; knex/Postgres rolls back everything issued on `trx` when the callback
    // rejects, so this attempted write does not persist.
    expect(calls.find((c) => c.table === 'raw_gmail_sync_metadata')).toBeDefined();
  });

  it('throws if more than one row unexpectedly matches', async () => {
    const { database } = createFakeDatabase({ syncRunsUpdateCount: 2 });
    const repository = new KnexGmailHistoricalRepository(database);

    await expect(repository.completeIncrementalRun('mailbox-1', 'run-1', '1001', 5)).rejects.toThrow(
      /did not match exactly one RUNNING sync_runs row/,
    );
  });

  it('skips the checkpoint write but still requires exactly one RUNNING row when newHistoryId is null', async () => {
    const { database, calls } = createFakeDatabase({ syncRunsUpdateCount: 1 });
    const repository = new KnexGmailHistoricalRepository(database);

    await expect(repository.completeIncrementalRun('mailbox-1', 'run-1', null, 0)).resolves.toBeUndefined();
    expect(calls.find((c) => c.table === 'raw_gmail_sync_metadata')).toBeUndefined();
  });
});
