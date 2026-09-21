import { describe, expect, it, beforeEach } from '@jest/globals';
import { db } from '../../src/database';
import { DeliverService } from '../../src/modules/deliver/deliver.service';

const PERIOD_START = new Date('2095-06-08T00:00:00.000Z');

function insertAlert(overrides: Partial<Record<string, unknown>> = {}) {
  return db('detected_alerts').insert({
    rule_code: 'D-01',
    dimension: 'TENANT_TOTAL',
    period_start: PERIOD_START,
    period_end: new Date('2095-06-15T00:00:00.000Z'),
    metric_value: 0.5,
    baseline_value: 0.8,
    details: {},
    ...overrides,
  }).returning('id');
}

describe('DeliverService', () => {
  beforeEach(async () => {
    await db('detected_alerts').where('period_start', '>=', '2095-01-01').delete();
  });

  it('lists alerts newest-first', async () => {
    await insertAlert({ dimension: 'A', detected_at: new Date('2095-06-16T00:00:00Z') });
    await insertAlert({ dimension: 'B', detected_at: new Date('2095-06-17T00:00:00Z') });

    const alerts = await new DeliverService().listAlerts();
    const relevant = alerts.filter((a) => a.period_start >= PERIOD_START);

    expect(relevant.map((a) => a.dimension)).toEqual(['B', 'A']);
  });

  it('filters by ruleCode', async () => {
    await insertAlert({ rule_code: 'D-01', dimension: 'A' });
    await insertAlert({ rule_code: 'D-06', dimension: 'B' });

    const alerts = await new DeliverService().listAlerts({ ruleCode: 'D-06' });
    const relevant = alerts.filter((a) => a.period_start >= PERIOD_START);

    expect(relevant).toHaveLength(1);
    expect(relevant[0].dimension).toBe('B');
  });

  it('gets a single alert by id, and returns undefined for a missing one', async () => {
    const [row] = await insertAlert({ dimension: 'Solo' });
    const id = typeof row === 'object' ? row.id : row;

    const found = await new DeliverService().getAlertById(id);
    expect(found?.dimension).toBe('Solo');

    const missing = await new DeliverService().getAlertById('00000000-0000-0000-0000-000000000000');
    expect(missing).toBeUndefined();
  });
});
