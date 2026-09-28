import { describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { KnexEmailClassificationRepository } from '../../src/modules/google/classification.repository';

const input = {
  mailboxId: 'mailbox-1', mailboxAddress: 'service@trufinity.ca', providerMessageId: 'message-1',
  classification: { label: 'complaint' as const, confidence: 0.9, reason: 'Synthetic reason.' },
  decisionStatus: 'ESCALATION' as const, modelProvider: 'anthropic', modelName: 'model', promptVersion: 'v1', idempotencyKey: 'event-1',
};

function fakeDatabase(options: { failWorkItem?: boolean; duplicate?: boolean } = {}) {
  const classifications: Array<{ id: string }> = options.duplicate ? [] : [{ id: 'classification-1' }];
  const workItems: Array<{ id: string }> = [];
  const trx = jest.fn((table: string) => {
    const builder: any = {
      insert: jest.fn(() => builder),
      onConflict: jest.fn(() => builder),
      ignore: jest.fn(() => builder),
      returning: jest.fn(async () => {
        if (table === 'email_classification_results') return classifications;
        if (options.failWorkItem) throw new Error('work item failure');
        workItems.push({ id: 'work-1' }); return workItems;
      }),
      select: jest.fn(() => builder),
      where: jest.fn(() => builder),
      first: jest.fn(async () => table === 'email_classification_results' ? { id: 'classification-existing' } : { id: 'work-existing' }),
    };
    return builder;
  }) as any;
  const database = { transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(trx) } as any;
  return { database, trx, workItems };
}

describe('KnexEmailClassificationRepository', () => {
  it('persists a classification and escalation work item atomically', async () => {
    const { database, trx } = fakeDatabase();
    const result = await new KnexEmailClassificationRepository(database).persist(input);
    expect(result).toEqual({ id: 'classification-1', workItemId: 'work-1', duplicate: false });
    expect(trx).toHaveBeenCalledWith('email_classification_results');
    expect(trx).toHaveBeenCalledWith('email_escalation_work_items');
  });

  it('does not create a work item for NONE', async () => {
    const { database, trx } = fakeDatabase();
    const result = await new KnexEmailClassificationRepository(database).persist({ ...input, decisionStatus: 'NONE', idempotencyKey: 'event-none' });
    expect(result.workItemId).toBeNull();
    expect(trx).not.toHaveBeenCalledWith('email_escalation_work_items');
  });

  it('handles duplicate idempotency keys without creating duplicate history/work', async () => {
    const { database, trx } = fakeDatabase({ duplicate: true });
    const result = await new KnexEmailClassificationRepository(database).persist(input);
    expect(result.duplicate).toBe(true);
    expect(result.id).toBe('classification-existing');
    expect(trx).not.toHaveBeenCalledWith('email_escalation_work_items');
  });

  it('propagates work-item failure so the surrounding transaction rolls back', async () => {
    const { database } = fakeDatabase({ failWorkItem: true });
    await expect(new KnexEmailClassificationRepository(database).persist(input)).rejects.toThrow('work item failure');
  });

  it('supports review work items without routing or SLA defaults', async () => {
    const { database } = fakeDatabase();
    const result = await new KnexEmailClassificationRepository(database).persist({ ...input, decisionStatus: 'REVIEW_REQUIRED', idempotencyKey: 'event-review' });
    expect(result.workItemId).toBe('work-1');
  });

  it('does not define prohibited email-content fields in the persistence migration', () => {
    const migration = fs.readFileSync(path.resolve(__dirname, '../../migrations/20260928120000_013_google_gmail_classifier_foundation.ts'), 'utf8');
    for (const prohibited of ["table.string('body'", "table.string('html'", "table.string('snippet'", "table.string('raw_mime'", "table.string('attachment_binary'", "table.string('provider_response'"]) {
      expect(migration.toLowerCase()).not.toContain(prohibited);
    }
  });
});
