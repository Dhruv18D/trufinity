import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { db } from '../../src/database';
import {
  NarrateService,
  buildNarrationPayload,
  findUnverifiedNumbers,
  type DetectedAlertRow,
  type NarrationClient,
} from '../../src/modules/narrate/narrate.service';

// A year isolated from other test files and real dev data - matches the
// convention in tests/detect (Jest runs test files concurrently against the
// same shared dev database).
const PERIOD_START = new Date('2096-06-08T00:00:00.000Z');
const PERIOD_END = new Date('2096-06-15T00:00:00.000Z');

function insertAlert(overrides: Partial<Record<string, unknown>> = {}) {
  return db('detected_alerts').insert({
    rule_code: 'D-01',
    dimension: 'TENANT_TOTAL',
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    baseline_start: new Date('2096-05-11T00:00:00.000Z'),
    baseline_end: PERIOD_START,
    metric_value: 0.5,
    baseline_value: 0.8,
    details: { dropPoints: 30 },
    ...overrides,
  });
}

describe('NarrateService', () => {
  beforeEach(async () => {
    await db('detected_alerts').where('period_start', '>=', '2096-01-01').delete();
  });

  it('narrates every alert missing a narrative and persists the result', async () => {
    await insertAlert();
    const fakeClient: NarrationClient = { narrate: jest.fn<(alert: DetectedAlertRow) => Promise<string>>().mockResolvedValue('Booking rate dropped from 80% to 50%.') };

    const result = await new NarrateService(fakeClient).run();

    expect(result).toEqual({ narrated: 1, failed: 0 });
    const row = await db('detected_alerts').where('period_start', '>=', '2096-01-01').first();
    expect(row.narrative).toBe('Booking rate dropped from 80% to 50%.');
    expect(row.narrated_at).not.toBeNull();
  });

  it('skips alerts that already have a narrative', async () => {
    await insertAlert({ narrative: 'Already narrated.', narrated_at: new Date() });
    const fakeClient: NarrationClient = { narrate: jest.fn<(alert: DetectedAlertRow) => Promise<string>>() };

    const result = await new NarrateService(fakeClient).run();

    expect(result).toEqual({ narrated: 0, failed: 0 });
    expect(fakeClient.narrate).not.toHaveBeenCalled();
  });

  it('counts a failure without blocking other alerts, and leaves the failed row unnarrated', async () => {
    const [failingId] = await insertAlert({ dimension: 'A' }).returning('id');
    await insertAlert({ dimension: 'B', rule_code: 'D-06' });
    const narrateMock = jest.fn<(alert: DetectedAlertRow) => Promise<string>>()
      .mockImplementation(async (alert) => {
        if (alert.dimension === 'A') throw new Error('model error');
        return 'Objection category spiked.';
      });

    const result = await new NarrateService({ narrate: narrateMock }).run();

    expect(result).toEqual({ narrated: 1, failed: 1 });
    const failedRow = await db('detected_alerts').where({ id: typeof failingId === 'object' ? failingId.id : failingId }).first();
    expect(failedRow.narrative).toBeNull();
  });

  it('passes only the stored numbers to the narration client (no recomputation surface)', async () => {
    await insertAlert({ metric_value: 0.42, baseline_value: 0.77, details: { dropPoints: 35 } });
    let captured: DetectedAlertRow | undefined;
    const fakeClient: NarrationClient = {
      narrate: jest.fn<(alert: DetectedAlertRow) => Promise<string>>().mockImplementation(async (alert) => {
        captured = alert;
        return 'narrated';
      }),
    };

    await new NarrateService(fakeClient).run();

    expect(captured?.details).toEqual({ dropPoints: 35 });
    expect(Number(captured?.metric_value)).toBeCloseTo(0.42);
    expect(Number(captured?.baseline_value)).toBeCloseTo(0.77);
  });

  it('blocks delivery (SPEC-BI-001 Section 9) when the model writes a number absent from the source payload', async () => {
    await insertAlert();
    // 99 does not appear anywhere in the payload (metric 50%, baseline 80%, dropPoints 30) - an invented figure.
    const fakeClient: NarrationClient = {
      narrate: jest.fn<(alert: DetectedAlertRow) => Promise<string>>().mockResolvedValue('Booking rate dropped 99% this week.'),
    };

    const result = await new NarrateService(fakeClient).run();

    expect(result).toEqual({ narrated: 0, failed: 1 });
    const row = await db('detected_alerts').where('period_start', '>=', '2096-01-01').first();
    expect(row.narrative).toBeNull();
  });
});

describe('buildNarrationPayload', () => {
  it('pre-converts a percentage rule\'s fraction values to rounded percentages, so the model never does the conversion itself', () => {
    const alert = {
      id: 'a1',
      rule_code: 'D-01',
      dimension: 'TENANT_TOTAL',
      period_start: new Date('2096-06-15T00:00:00.000Z'),
      period_end: new Date('2096-06-22T00:00:00.000Z'),
      baseline_start: null,
      baseline_end: null,
      metric_value: '0.503',
      baseline_value: '0.8',
      details: {},
    } as unknown as DetectedAlertRow;

    const payload = buildNarrationPayload(alert);

    expect(payload).toMatchObject({ metricValuePercent: 50.3, baselineValuePercent: 80 });
    expect(payload).not.toHaveProperty('metricValue');
  });

  it('leaves a non-percentage rule\'s values as plain numbers', () => {
    const alert = {
      id: 'a2',
      rule_code: 'X-99',
      dimension: 'Value Concerns',
      period_start: new Date('2096-06-15T00:00:00.000Z'),
      period_end: new Date('2096-06-22T00:00:00.000Z'),
      baseline_start: null,
      baseline_end: null,
      metric_value: '4',
      baseline_value: '1',
      details: {},
    } as unknown as DetectedAlertRow;

    const payload = buildNarrationPayload(alert);

    expect(payload).toMatchObject({ metricValue: 4, baselineValue: 1 });
    expect(payload).not.toHaveProperty('metricValuePercent');
  });
});

describe('findUnverifiedNumbers', () => {
  it('returns an empty list when every number in the narrative appears in the payload', () => {
    const payload = { metricValuePercent: 50, baselineValuePercent: 80, details: { dropPoints: 30 } };
    const narrative = 'Booking rate dropped from 80% to 50%, a 30-point decline.';

    expect(findUnverifiedNumbers(narrative, payload)).toEqual([]);
  });

  it('flags a number that does not appear anywhere in the payload', () => {
    const payload = { metricValuePercent: 50, baselineValuePercent: 80, details: { dropPoints: 30 } };
    const narrative = 'Booking rate dropped from 80% to 50%, a 42-point decline.';

    expect(findUnverifiedNumbers(narrative, payload)).toEqual([42]);
  });

  it('does not flag date components (day/month/year) mentioned in prose', () => {
    const payload = {
      periodStart: new Date('2096-06-15T00:00:00.000Z'),
      periodEnd: new Date('2096-06-22T00:00:00.000Z'),
      metricValuePercent: 50,
    };
    const narrative = 'For the week of June 15 to June 22, 2096, the rate was 50%.';

    expect(findUnverifiedNumbers(narrative, payload)).toEqual([]);
  });

  it('tolerates minor floating-point/rounding noise without flagging it', () => {
    const payload = { metricValuePercent: 50.3 };
    const narrative = 'The rate was 50.32%.';

    expect(findUnverifiedNumbers(narrative, payload)).toEqual([]);
  });
});
