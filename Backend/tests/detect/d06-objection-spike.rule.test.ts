import { describe, expect, it, beforeEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { db } from '../../src/database';
import { evaluateObjectionCategorySpikes } from '../../src/modules/detect/rules/d06-objection-spike.rule';
import type { DetectionWindow } from '../../src/modules/detect/detect.types';

// A year isolated from other test files and real dev data - see d01-booking-rate-decline.rule.test.ts.
const WINDOW: DetectionWindow = {
  periodStart: new Date('2098-06-08T00:00:00.000Z'),
  periodEnd: new Date('2098-06-15T00:00:00.000Z'),
  baselineStart: new Date('2098-05-11T00:00:00.000Z'),
  baselineEnd: new Date('2098-06-08T00:00:00.000Z'),
};

function callRow(receivedAt: Date, objections: string[] | null) {
  const id = randomUUID();
  return {
    lace_call_id: id,
    call_link: `https://www.lace.ai/app/call-center-all-calls/${id}`,
    received_at: receivedAt,
    objections,
  };
}

describe('evaluateObjectionCategorySpikes (D-06)', () => {
  beforeEach(async () => {
    await db('canonical_lace_calls').where('received_at', '>=', '2098-05-01').andWhere('received_at', '<', '2098-07-01').delete();
  });

  it('flags a category whose current count is at least the threshold multiple of its baseline weekly average', async () => {
    const baselineDay = new Date('2098-05-20T00:00:00.000Z');
    const currentDay = new Date('2098-06-12T00:00:00.000Z');
    // Baseline: 4 occurrences over 4 weeks -> weekly avg 1. Current: 4 occurrences -> 4x, above the 2x default.
    await db('canonical_lace_calls').insert([
      ...Array.from({ length: 4 }, () => callRow(baselineDay, ['Value Concerns'])),
      ...Array.from({ length: 4 }, () => callRow(currentDay, ['Value Concerns'])),
    ]);

    const findings = await evaluateObjectionCategorySpikes(WINDOW);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleCode: 'D-06', dimension: 'Value Concerns', metricValue: 4, baselineValue: 1 });
  });

  it('does not flag a category below the minimum sample size, even at a high multiplier', async () => {
    const baselineDay = new Date('2098-05-20T00:00:00.000Z');
    const currentDay = new Date('2098-06-12T00:00:00.000Z');
    // Baseline weekly avg 0.25 (1 over 4 weeks); current count 2 -> 8x multiplier but below the min sample of 3.
    await db('canonical_lace_calls').insert([
      callRow(baselineDay, ['Rare Category']),
      ...Array.from({ length: 2 }, () => callRow(currentDay, ['Rare Category'])),
    ]);

    const findings = await evaluateObjectionCategorySpikes(WINDOW);

    expect(findings).toHaveLength(0);
  });

  it('does not flag a brand-new category with zero baseline occurrences (nothing to compare a rate against)', async () => {
    const currentDay = new Date('2098-06-12T00:00:00.000Z');
    await db('canonical_lace_calls').insert(Array.from({ length: 5 }, () => callRow(currentDay, ['New Category'])));

    const findings = await evaluateObjectionCategorySpikes(WINDOW);

    expect(findings).toHaveLength(0);
  });

  it('does not flag a category whose current count is below the threshold multiple', async () => {
    const baselineDay = new Date('2098-05-20T00:00:00.000Z');
    const currentDay = new Date('2098-06-12T00:00:00.000Z');
    // Baseline: 8 over 4 weeks -> weekly avg 2. Current: 3 -> 1.5x, below the 2x default.
    await db('canonical_lace_calls').insert([
      ...Array.from({ length: 8 }, () => callRow(baselineDay, ['Steady Category'])),
      ...Array.from({ length: 3 }, () => callRow(currentDay, ['Steady Category'])),
    ]);

    const findings = await evaluateObjectionCategorySpikes(WINDOW);

    expect(findings).toHaveLength(0);
  });

  it('evaluates multiple objection categories on the same call independently', async () => {
    const baselineDay = new Date('2098-05-20T00:00:00.000Z');
    const currentDay = new Date('2098-06-12T00:00:00.000Z');
    await db('canonical_lace_calls').insert([
      ...Array.from({ length: 4 }, () => callRow(baselineDay, ['Category A', 'Category B'])),
      ...Array.from({ length: 4 }, () => callRow(currentDay, ['Category A'])),
    ]);

    const findings = await evaluateObjectionCategorySpikes(WINDOW);

    const dimensions = findings.map((f) => f.dimension).sort();
    // Category A spikes (4x baseline avg 1); Category B has 0 current occurrences, so it can't spike.
    expect(dimensions).toEqual(['Category A']);
  });
});
