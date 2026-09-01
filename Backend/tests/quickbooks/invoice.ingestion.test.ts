import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { db } from '../../src/database';
import { QboInvoiceIngestionService } from '../../src/modules/quickbooks/ingestion/invoice.ingestion';

describe('QBO Invoice raw ingestion', () => {
  beforeEach(async () => { await db('raw_qbo_invoices').delete(); await db('raw_sync_metadata').where({ source_system: 'QuickBooks', entity_type: 'Invoices' }).delete(); });
  it('loads paginated invoices and preserves payloads', async () => {
    const api = { getInvoicesPage: jest.fn<(position: number, size: number) => Promise<any>>()
      .mockResolvedValueOnce({ QueryResponse: { Invoice: [{ Id: '1', TotalAmt: 10 }], totalCount: 2, maxResults: 1 }, time: 't' })
      .mockResolvedValueOnce({ QueryResponse: { Invoice: [{ Id: '2', TotalAmt: 20 }], totalCount: 2, maxResults: 1 }, time: 't' }) };
    const result = await new QboInvoiceIngestionService(api).run();
    expect(result.recordsProcessed).toBe(2); expect(api.getInvoicesPage).toHaveBeenNthCalledWith(1, 1, 1000); expect(api.getInvoicesPage).toHaveBeenNthCalledWith(2, 2, 1000);
    const rows = await db('raw_qbo_invoices').orderBy('source_id'); expect(rows).toHaveLength(2); expect(rows[0].payload.Id).toBe(rows[0].source_id);
    const run = await db('sync_runs').where({ id: result.syncRunId }).first(); expect(run.status).toBe('COMPLETED');
  });
});
