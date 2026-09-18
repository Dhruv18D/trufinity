import { describe, expect, it, beforeEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { db } from '../../src/database';
import { evaluateBookingRateDecline } from '../../src/modules/detect/rules/d01-booking-rate-decline.rule';
import type { DetectionWindow } from '../../src/modules/detect/detect.types';

// Dates are deliberately parked in a year no other test/dev data ever uses
// (Jest runs test files concurrently against the same shared dev database,
// and detect rules aggregate by date range - a real year would pick up rows
// from other test files or from real ingested data running at the same time).
const WINDOW: DetectionWindow = {
  periodStart: new Date('2099-06-08T00:00:00.000Z'),
  periodEnd: new Date('2099-06-15T00:00:00.000Z'),
  baselineStart: new Date('2099-05-11T00:00:00.000Z'),
  baselineEnd: new Date('2099-06-08T00:00:00.000Z'),
};

function callRow(receivedAt: Date, booked: boolean) {
  const id = randomUUID();
  return {
    lace_call_id: id,
    call_link: `https://www.lace.ai/app/call-center-all-calls/${id}`,
    booked,
    received_at: receivedAt,
  };
}

describe('evaluateBookingRateDecline (D-01)', () => {
  beforeEach(async () => {
    await db('canonical_lace_calls').where('received_at', '>=', '2099-05-01').andWhere('received_at', '<', '2099-07-01').delete();
  });

  it('flags a decline that meets the threshold, with the current and baseline rates as metric/baseline values', async () => {
    const baselineDay = new Date('2099-05-20T00:00:00.000Z');
    const currentDay = new Date('2099-06-12T00:00:00.000Z');
    // Baseline: 8/10 booked (80%). Current: 5/10 booked (50%) - a 30-point drop.
    await db('canonical_lace_calls').insert([
      ...Array.from({ length: 8 }, () => callRow(baselineDay, true)),
      ...Array.from({ length: 2 }, () => callRow(baselineDay, false)),
      ...Array.from({ length: 5 }, () => callRow(currentDay, true)),
      ...Array.from({ length: 5 }, () => callRow(currentDay, false)),
    ]);

    const finding = await evaluateBookingRateDecline(WINDOW);

    expect(finding).toMatchObject({
      ruleCode: 'D-01',
      dimension: 'TENANT_TOTAL',
      metricValue: 0.5,
      baselineValue: 0.8,
    });
    expect((finding?.details as { dropPoints: number }).dropPoints).toBeCloseTo(30);
  });

  it('does not flag a decline below the configured threshold', async () => {
    const baselineDay = new Date('2099-05-20T00:00:00.000Z');
    const currentDay = new Date('2099-06-12T00:00:00.000Z');
    // Baseline: 80%. Current: 75% - only a 5-point drop, below the default 10-point threshold.
    await db('canonical_lace_calls').insert([
      ...Array.from({ length: 8 }, () => callRow(baselineDay, true)),
      ...Array.from({ length: 2 }, () => callRow(baselineDay, false)),
      ...Array.from({ length: 3 }, () => callRow(currentDay, true)),
      ...Array.from({ length: 1 }, () => callRow(currentDay, false)),
    ]);

    const finding = await evaluateBookingRateDecline(WINDOW);

    expect(finding).toBeNull();
  });

  it('returns null when there is no data in either window (nothing to compare)', async () => {
    const finding = await evaluateBookingRateDecline(WINDOW);
    expect(finding).toBeNull();
  });

  it('ignores calls with an unknown (null) booked status', async () => {
    const currentDay = new Date('2099-06-12T00:00:00.000Z');
    const baselineDay = new Date('2099-05-20T00:00:00.000Z');
    await db('canonical_lace_calls').insert([
      { lace_call_id: randomUUID(), call_link: 'https://x/unknown-1', booked: null, received_at: currentDay },
      ...Array.from({ length: 5 }, () => callRow(baselineDay, true)),
    ]);

    const finding = await evaluateBookingRateDecline(WINDOW);

    // Current window has zero calls with a known booked status - no rate to compare.
    expect(finding).toBeNull();
  });
});
