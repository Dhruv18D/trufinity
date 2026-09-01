/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import type { Knex } from 'knex';
import { db } from '../../../database';
import { logger } from '../../../utils/logger';
import { qboCustomerService } from '../services/customer.service';
import type { QboCustomer, QboQueryResponse } from '../types';

const PAGE_SIZE = 1000;
const MAX_ATTEMPTS = 3;
interface CustomerApi { getCustomersPage(position: number, maxResults: number): Promise<QboQueryResponse<QboCustomer>>; }

export class QboCustomerIngestionService {
  public constructor(private readonly api: CustomerApi = qboCustomerService, private readonly database: Knex = db) {}
  public async run(): Promise<{ syncRunId: string; recordsProcessed: number }> {
    const connection = await this.database.client.acquireConnection(); let locked = false; let runId: string | null = null; let processed = 0;
    try {
      const lockResult = await this.database.raw('SELECT pg_try_advisory_lock(hashtext(?)) AS locked', ['QuickBooks:Customers']).connection(connection);
      locked = Array.isArray(lockResult.rows) && lockResult.rows[0]?.locked === true;
      if (!locked) throw new Error('QuickBooks Customers ingestion is already running.');
      await this.database('sync_runs').where({ source_system: 'QuickBooks', entity_type: 'Customers', status: 'RUNNING' }).update({ status: 'FAILED', error_message: 'Recovered interrupted QuickBooks Customers sync run.', completed_at: this.database.fn.now() });
      const inserted = await this.database('sync_runs').insert({ source_system: 'QuickBooks', entity_type: 'Customers', status: 'RUNNING' }).returning('id'); runId = inserted[0].id as string;
      const metadata = await this.database('raw_sync_metadata').where({ source_system: 'QuickBooks', entity_type: 'Customers' }).first('continuation_token');
      const storedPosition = metadata?.continuation_token ? Number(metadata.continuation_token) : 1;
      let position = Number.isInteger(storedPosition) && storedPosition > 0 ? storedPosition : 1; let hasMore = true;
      while (hasMore) {
        const response = await this.fetchPage(position);
        const page = response.QueryResponse;
        if (!page || !Array.isArray(page.Customer)) throw new Error('Malformed QuickBooks Customer response.');
        const valid: { id: string; payload: QboCustomer }[] = []; const invalid: unknown[] = [];
        for (const payload of page.Customer) { const id = payload && typeof payload.Id === 'string' && payload.Id.trim() ? payload.Id : null; if (id) valid.push({ id, payload }); else invalid.push(payload); }
        await this.database.transaction(async (trx) => {
          for (const record of valid) { await trx('raw_qbo_customers').where({ source_id: record.id, is_latest: true }).update({ is_latest: false }); await trx('raw_qbo_customers').insert({ source_id: record.id, payload: record.payload, is_latest: true, sync_run_id: runId }); }
          if (invalid.length) await trx('sync_errors').insert(invalid.map((payload) => ({ sync_run_id: runId, source_id: null, error_message: 'Customer payload is missing a valid Id.', payload })));
        });
        processed += valid.length; const max = page.maxResults ?? PAGE_SIZE; hasMore = page.totalCount !== undefined ? position + page.Customer.length <= page.totalCount : page.Customer.length === max; position += page.Customer.length;
        await this.database('raw_sync_metadata').insert({ source_system: 'QuickBooks', entity_type: 'Customers', continuation_token: hasMore ? String(position) : null, last_synced_at: this.database.fn.now() }).onConflict(['source_system', 'entity_type']).merge({ continuation_token: hasMore ? String(position) : null, last_synced_at: this.database.fn.now() });
      }
      await this.database('sync_runs').where({ id: runId }).update({ status: 'COMPLETED', records_processed: processed, completed_at: this.database.fn.now() }); return { syncRunId: runId, recordsProcessed: processed };
    } catch { if (runId) await this.database('sync_runs').where({ id: runId }).update({ status: 'FAILED', error_message: 'QuickBooks Customers ingestion failed.', completed_at: this.database.fn.now() }); logger.error('[QuickBooks] Customers ingestion failed', { syncRunId: runId }); throw new Error('QuickBooks Customers ingestion failed.'); }
    finally { try { if (locked) await this.database.raw('SELECT pg_advisory_unlock(hashtext(?))', ['QuickBooks:Customers']).connection(connection); } catch { logger.error('[QuickBooks] Customers advisory lock release failed'); } finally { await this.database.client.releaseConnection(connection); } }
  }
  private async fetchPage(position: number): Promise<QboQueryResponse<QboCustomer>> { let last: unknown; for (let i = 1; i <= MAX_ATTEMPTS; i += 1) { try { return await this.api.getCustomersPage(position, PAGE_SIZE); } catch (error) { last = error; if (i < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 50 * i)); } } throw last instanceof Error ? last : new Error('QuickBooks Customer request failed.'); }
}
export const qboCustomerIngestionService = new QboCustomerIngestionService();
