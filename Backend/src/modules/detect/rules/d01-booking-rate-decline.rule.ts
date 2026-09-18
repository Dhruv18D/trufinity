import type { Knex } from 'knex';
import { db } from '../../../database';
import { env } from '../../../config/env';
import type { DetectedAlertFinding, DetectionWindow } from '../detect.types';

const TENANT_DIMENSION = 'TENANT_TOTAL';

interface BookingCounts {
  total: number;
  booked: number;
}

async function bookingRateForWindow(database: Knex, start: Date, end: Date): Promise<BookingCounts> {
  const row: { total: string; booked: string } = await database('canonical_lace_calls')
    .whereNotNull('booked')
    .andWhere('received_at', '>=', start)
    .andWhere('received_at', '<', end)
    .select(
      database.raw('count(*) as total'),
      database.raw("count(*) filter (where booked = true) as booked"),
    )
    .first();
  return { total: Number(row.total), booked: Number(row.booked) };
}

function rate(counts: BookingCounts): number | null {
  return counts.total > 0 ? counts.booked / counts.total : null;
}

// D-01: flags a tenant-wide booking rate decline vs. the trailing 4-week
// average (SPEC-BI-001 Section 2.2/4.1 category; exact threshold TBD from the
// spec - see DETECT_D01_BOOKING_RATE_DROP_THRESHOLD_POINTS).
export async function evaluateBookingRateDecline(
  window: DetectionWindow,
  database: Knex = db,
): Promise<DetectedAlertFinding | null> {
  const [current, baseline] = await Promise.all([
    bookingRateForWindow(database, window.periodStart, window.periodEnd),
    bookingRateForWindow(database, window.baselineStart, window.baselineEnd),
  ]);

  const currentRate = rate(current);
  const baselineRate = rate(baseline);
  if (currentRate === null || baselineRate === null) return null;

  const dropPoints = (baselineRate - currentRate) * 100;
  if (dropPoints < env.DETECT_D01_BOOKING_RATE_DROP_THRESHOLD_POINTS) return null;

  return {
    ruleCode: 'D-01',
    dimension: TENANT_DIMENSION,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    baselineStart: window.baselineStart,
    baselineEnd: window.baselineEnd,
    metricValue: currentRate,
    baselineValue: baselineRate,
    details: {
      currentBookedCalls: current.booked,
      currentTotalCalls: current.total,
      baselineBookedCalls: baseline.booked,
      baselineTotalCalls: baseline.total,
      dropPoints,
      thresholdPoints: env.DETECT_D01_BOOKING_RATE_DROP_THRESHOLD_POINTS,
    },
  };
}
