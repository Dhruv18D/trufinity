import type { Knex } from 'knex';
import { db } from '../../../database';
import { env } from '../../../config/env';
import type { DetectedAlertFinding, DetectionWindow } from '../detect.types';

const BASELINE_WEEKS = 4;

interface CategoryCount {
  category: string;
  count: number;
}

async function objectionCountsForWindow(database: Knex, start: Date, end: Date): Promise<Map<string, number>> {
  const rows: CategoryCount[] = await database('canonical_lace_calls')
    .crossJoin(database.raw('unnest(canonical_lace_calls.objections) as category'))
    .whereNotNull('objections')
    .andWhere('received_at', '>=', start)
    .andWhere('received_at', '<', end)
    .groupBy('category')
    .select('category')
    .count('* as count')
    .then((result) => result as unknown as { category: string; count: string }[])
    .then((result) => result.map((r) => ({ category: r.category, count: Number(r.count) })));
  return new Map(rows.map((r) => [r.category, r.count]));
}

// D-06: flags an objection category whose current-week count spikes against
// its trailing 4-week weekly average (SPEC-BI-001 Section 2.2/4.1 category;
// exact threshold TBD from the spec - see DETECT_D06_OBJECTION_SPIKE_MULTIPLIER).
// A minimum sample size avoids flagging noise on rarely-occurring categories
// (e.g. going from 1 occurrence to 2 is a 100% "spike" but not meaningful).
export async function evaluateObjectionCategorySpikes(
  window: DetectionWindow,
  database: Knex = db,
): Promise<DetectedAlertFinding[]> {
  const [current, baseline] = await Promise.all([
    objectionCountsForWindow(database, window.periodStart, window.periodEnd),
    objectionCountsForWindow(database, window.baselineStart, window.baselineEnd),
  ]);

  const findings: DetectedAlertFinding[] = [];
  for (const [category, currentCount] of current) {
    if (currentCount < env.DETECT_D06_OBJECTION_MIN_SAMPLE) continue;

    const baselineTotal = baseline.get(category) ?? 0;
    const baselineWeeklyAverage = baselineTotal / BASELINE_WEEKS;
    // No baseline occurrences at all is a new category appearing, not a
    // measurable "spike" against a rate - skip rather than divide by zero.
    if (baselineWeeklyAverage === 0) continue;

    const multiplier = currentCount / baselineWeeklyAverage;
    if (multiplier < env.DETECT_D06_OBJECTION_SPIKE_MULTIPLIER) continue;

    findings.push({
      ruleCode: 'D-06',
      dimension: category,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      baselineStart: window.baselineStart,
      baselineEnd: window.baselineEnd,
      metricValue: currentCount,
      baselineValue: baselineWeeklyAverage,
      details: {
        currentCount,
        baselineTotalOverWindow: baselineTotal,
        baselineWeeks: BASELINE_WEEKS,
        multiplier,
        thresholdMultiplier: env.DETECT_D06_OBJECTION_SPIKE_MULTIPLIER,
      },
    });
  }
  return findings;
}
