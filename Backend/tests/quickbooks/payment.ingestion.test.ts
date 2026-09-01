import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { db } from '../../src/database';
import { QboPaymentIngestionService } from '../../src/modules/quickbooks/ingestion/payment.ingestion';

describe('QBO Payment raw ingestion', () => {
  beforeEach(async () => { await db('raw_qbo_payments').delete(); await db('raw_sync_metadata').where({ source_system: 'QuickBooks', entity_type: 'Payments' }).delete(); });
  it('loads paginated payments and preserves payloads', async () => {
    const api = { getPaymentsPage: jest.fn<(position: number, size: number) => Promise<any>>()
      .mockResolvedValueOnce({ QueryResponse: { Payment: [{ Id: '1', TotalAmt: 10 }], totalCount: 2, maxResults: 1 }, time: 't' })
      .mockResolvedValueOnce({ QueryResponse: { Payment: [{ Id: '2', TotalAmt: 20 }], totalCount: 2, maxResults: 1 }, time: 't' }) };
    const result = await new QboPaymentIngestionService(api).run();
    expect(result.recordsProcessed).toBe(2); expect(api.getPaymentsPage).toHaveBeenNthCalledWith(1, 1, 1000); expect(api.getPaymentsPage).toHaveBeenNthCalledWith(2, 2, 1000);
    const rows = await db('raw_qbo_payments').orderBy('source_id'); expect(rows).toHaveLength(2); expect(rows[0].payload.Id).toBe(rows[0].source_id);
    const run = await db('sync_runs').where({ id: result.syncRunId }).first(); expect(run.status).toBe('COMPLETED');
  });
});
