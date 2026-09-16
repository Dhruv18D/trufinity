import type { Knex } from 'knex';
import { db } from '../../../database';
import { logger } from '../../../utils/logger';
import type { LaceCallAnalysisRow } from '../types';
import { mapCallAnalysisRowToCanonical } from './call-analysis.mapper';

interface RawCallAnalysisRow {
  source_id: string;
  payload: LaceCallAnalysisRow;
}

// Populates canonical_lace_calls from raw_lace_call_analysis (is_latest rows only).
// Upserts on lace_call_id so re-running after a corrected re-export (which flips
// is_latest on the raw table) keeps the canonical row in sync rather than duplicating it.
export class CallAnalysisCanonicalService {
  public constructor(private readonly database: Knex = db) {}

  public async sync(): Promise<{ rowsUpserted: number }> {
    const rows: RawCallAnalysisRow[] = await this.database('raw_lace_call_analysis')
      .where({ is_latest: true })
      .select('source_id', 'payload');

    let rowsUpserted = 0;
    for (const row of rows) {
      const canonical = mapCallAnalysisRowToCanonical(row.source_id, row.payload);
      await this.database('canonical_lace_calls')
        .insert({
          lace_call_id: canonical.laceCallId,
          crm: canonical.crm,
          csr: canonical.csr,
          company: canonical.company,
          campaign: canonical.campaign,
          call_link: canonical.callLink,
          job_number: canonical.jobNumber,
          crm_call_id: canonical.crmCallId,
          crm_tenant_id: canonical.crmTenantId,
          customer_name: canonical.customerName,
          customer_phone: canonical.customerPhone,
          call_direction: canonical.callDirection,
          booked: canonical.booked,
          qualified: canonical.qualified,
          existing_customer: canonical.existingCustomer,
          duration_sec: canonical.durationSec,
          playbook_score: canonical.playbookScore,
          objections: canonical.objections,
          unbooked_reason: canonical.unbookedReason,
          cancellation_reason: canonical.cancellationReason,
          short_summary: canonical.shortSummary,
          qualification_details: canonical.qualificationDetails,
          received_at: canonical.receivedAt,
          source_specific_data: canonical.sourceSpecificData,
          updated_at: this.database.fn.now(),
        })
        .onConflict('lace_call_id')
        .merge();
      rowsUpserted += 1;
    }

    logger.info('[LaceAI] Canonical call analysis sync completed', { rowsUpserted });
    return { rowsUpserted };
  }
}

export const callAnalysisCanonicalService = new CallAnalysisCanonicalService();
