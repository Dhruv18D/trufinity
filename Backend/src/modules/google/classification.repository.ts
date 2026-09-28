import type { Knex } from 'knex';
import { db } from '../../database';
import type { EmailClassification, EmailDecisionState } from './email-classifier';

export interface ClassificationPersistenceInput {
  mailboxId?: string | null;
  mailboxAddress: string;
  providerMessageId: string;
  threadId?: string | null;
  sourceReference?: string | null;
  classification: EmailClassification;
  decisionStatus: EmailDecisionState;
  modelProvider: string;
  modelName: string;
  promptVersion: string;
  classifiedAt?: Date;
  idempotencyKey: string;
  supersedesId?: string | null;
}

export interface PersistedClassification { id: string; workItemId: string | null; duplicate: boolean; }
export interface EmailClassificationRepository {
  persist(input: ClassificationPersistenceInput): Promise<PersistedClassification>;
  persistInTransaction(trx: Knex.Transaction, input: ClassificationPersistenceInput): Promise<PersistedClassification>;
}
interface ClassificationRow { id: string; }

export class KnexEmailClassificationRepository implements EmailClassificationRepository {
  public constructor(private readonly database: Knex = db) {}

  public async persist(input: ClassificationPersistenceInput): Promise<PersistedClassification> {
    return this.database.transaction((trx) => this.persistInTransaction(trx, input));
  }

  public async persistInTransaction(trx: Knex.Transaction, input: ClassificationPersistenceInput): Promise<PersistedClassification> {
    const inserted = await trx('email_classification_results').insert({
      mailbox_id: input.mailboxId ?? null,
      mailbox_address: input.mailboxAddress,
      provider_message_id: input.providerMessageId,
      thread_id: input.threadId ?? null,
      source_reference: input.sourceReference ?? null,
      classification_label: input.classification.label,
      confidence: input.classification.confidence,
      reason: input.classification.reason,
      decision_status: input.decisionStatus,
      model_provider: input.modelProvider,
      model_name: input.modelName,
      prompt_version: input.promptVersion,
      classified_at: input.classifiedAt ?? new Date(),
      idempotency_key: input.idempotencyKey,
      supersedes_id: input.supersedesId ?? null,
    }).onConflict('idempotency_key').ignore().returning('id') as unknown as ClassificationRow[];
    const duplicate = inserted.length === 0;
    const existing: unknown = await trx('email_classification_results').select('id').where({ idempotency_key: input.idempotencyKey }).first();
    const row = inserted[0] ?? (existing as ClassificationRow | undefined);
    if (!row?.id) throw new Error('Classification result persistence did not return an id.');
    let workItemId: string | null = null;
    if (!duplicate && input.decisionStatus !== 'NONE') {
      const workRows = await trx('email_escalation_work_items').insert({
        classification_result_id: row.id,
        mailbox_id: input.mailboxId ?? null,
        provider_message_id: input.providerMessageId,
        work_type: input.decisionStatus,
      }).onConflict('classification_result_id').ignore().returning('id') as unknown as ClassificationRow[];
      const existingWork: unknown = await trx('email_escalation_work_items').select('id').where({ classification_result_id: row.id }).first();
      workItemId = workRows[0]?.id ?? (existingWork as ClassificationRow | undefined)?.id ?? null;
    }
    return { id: row.id, workItemId, duplicate };
  }
}