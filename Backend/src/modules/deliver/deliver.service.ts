import type { Knex } from 'knex';
import { db } from '../../database';

export interface BriefAlert {
  id: string;
  rule_code: string;
  dimension: string;
  period_start: Date;
  period_end: Date;
  baseline_start: Date | null;
  baseline_end: Date | null;
  metric_value: string;
  baseline_value: string | null;
  details: Record<string, unknown>;
  narrative: string | null;
  narrated_at: Date | null;
  detected_at: Date;
}

export interface ListAlertsFilters {
  ruleCode?: string;
  periodStart?: Date;
}

// Dashboard read layer (SPEC-BI-001 Section 2.1: "live web dashboard for
// on-demand drill-down"). Read-only - exposes exactly what Detect/Narrate
// already produced, no computation of its own.
export class DeliverService {
  public constructor(private readonly database: Knex = db) {}

  public async listAlerts(filters: ListAlertsFilters = {}): Promise<BriefAlert[]> {
    const query = this.database('detected_alerts').select('*').orderBy('detected_at', 'desc');
    if (filters.ruleCode) query.where({ rule_code: filters.ruleCode });
    if (filters.periodStart) query.where({ period_start: filters.periodStart });
    return query;
  }

  public async getAlertById(id: string): Promise<BriefAlert | undefined> {
    return this.database('detected_alerts').where({ id }).first();
  }
}

export const deliverService = new DeliverService();
