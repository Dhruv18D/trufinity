import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { db } from '../../src/database';
import { QboCustomerIngestionService } from '../../src/modules/quickbooks/ingestion/customer.ingestion';

describe('QBO Customer raw ingestion', () => {
  beforeEach(async () => { await db('raw_qbo_customers').delete(); await db('raw_sync_metadata').where({ source_system: 'QuickBooks', entity_type: 'Customers' }).delete(); });
  it('loads all pages and preserves payloads/versioning', async () => {
    const api = { getCustomersPage: jest.fn<(position: number, size: number) => Promise<any>>()
      .mockResolvedValueOnce({ QueryResponse: { Customer: [{ Id: '1', DisplayName: 'A' }], totalCount: 2, maxResults: 1 }, time: 't' })
      .mockResolvedValueOnce({ QueryResponse: { Customer: [{ Id: '2', DisplayName: 'B' }], totalCount: 2, maxResults: 1 }, time: 't' }) };
    const result = await new QboCustomerIngestionService(api).run();
    expect(result.recordsProcessed).toBe(2); expect(api.getCustomersPage).toHaveBeenCalledTimes(2); expect(api.getCustomersPage).toHaveBeenNthCalledWith(1, 1, 1000); expect(api.getCustomersPage).toHaveBeenNthCalledWith(2, 2, 1000);
    const rows = await db('raw_qbo_customers').orderBy('source_id'); expect(rows).toHaveLength(2); expect(rows[0].payload.Id).toBe(rows[0].source_id);
    const run = await db('sync_runs').where({ id: result.syncRunId }).first(); expect(run.status).toBe('COMPLETED');
  });
});
