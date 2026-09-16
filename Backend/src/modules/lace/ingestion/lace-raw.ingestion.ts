import type { Knex } from 'knex';
import { db } from '../../../database';
import { logger } from '../../../utils/logger';
import type { LaceObjectStore } from '../s3.client';
import type { LaceS3Object } from '../types';
import { parseLaceCsv } from '../csv.parser';

export interface LaceRawRecord {
  sourceId: string;
  payload: Record<string, unknown>;
}

export interface InvalidLaceRecord {
  sourceId: string | null;
  message: string;
  payload: unknown;
}

export interface LaceIngestionConfig {
  exportType: string;
  rawTable: string;
  s3Prefix: string;
  lockKey: string;
  extractSourceId: (row: Record<string, string>) => string | null;
}

export interface LaceIngestionRepository {
  withExclusiveLock<T>(work: (repository: LaceIngestionRepository) => Promise<T>): Promise<T>;
  recoverInterruptedRuns(): Promise<void>;
  createSyncRun(): Promise<string>;
  isFileIngested(exportType: string, key: string, eTag: string): Promise<boolean>;
  commitFile(
    syncRunId: string,
    file: LaceS3Object,
    exportType: string,
    records: LaceRawRecord[],
    errors: InvalidLaceRecord[],
  ): Promise<void>;
  completeSyncRun(syncRunId: string, recordsProcessed: number): Promise<void>;
  failSyncRun(syncRunId: string, safeMessage: string): Promise<void>;
}

export class LaceSyncInProgressError extends Error {
  public constructor(exportType: string) {
    super(`Lace AI ${exportType} ingestion is already running.`);
    this.name = 'LaceSyncInProgressError';
  }
}

export class PostgresLaceRawRepository implements LaceIngestionRepository {
  public constructor(private readonly config: LaceIngestionConfig, protected readonly database: Knex = db) {}

  public async withExclusiveLock<T>(work: (repository: LaceIngestionRepository) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const connection = await this.database.client.acquireConnection();
    let acquired = false;
    let connectionShouldBeDestroyed = false;
    try {
      const result: unknown = await this.database
        .raw('SELECT pg_try_advisory_lock(hashtext(?)) AS locked', [this.config.lockKey])
        .connection(connection);
      const rows = typeof result === 'object' && result !== null && 'rows' in result ? (result as { rows?: unknown }).rows : null;
      acquired = Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && (rows[0] as { locked?: unknown }).locked === true;
      if (!acquired) throw new LaceSyncInProgressError(this.config.exportType);
      return await work(this);
    } finally {
      try {
        if (acquired) {
          await this.database.raw('SELECT pg_advisory_unlock(hashtext(?))', [this.config.lockKey]).connection(connection);
        }
      } catch {
        connectionShouldBeDestroyed = true;
        logger.error('[LaceAI] Advisory lock release failed; closing lock connection.');
      } finally {
        if (connectionShouldBeDestroyed) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          await this.database.client.destroyRawConnection(connection).catch(() => undefined);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await this.database.client.releaseConnection(connection);
      }
    }
  }

  public async recoverInterruptedRuns(): Promise<void> {
    await this.database('sync_runs')
      .where({ source_system: 'LaceAI', entity_type: this.config.exportType, status: 'RUNNING' })
      .update({
        status: 'FAILED',
        error_message: `Recovered interrupted Lace AI ${this.config.exportType} sync run.`,
        completed_at: this.database.fn.now(),
      });
  }

  public async createSyncRun(): Promise<string> {
    const rows: unknown = await this.database('sync_runs')
      .insert({ source_system: 'LaceAI', entity_type: this.config.exportType, status: 'RUNNING' })
      .returning('id');
    if (!Array.isArray(rows) || rows.length === 0 || typeof rows[0] !== 'object' || rows[0] === null || !('id' in rows[0])) {
      throw new Error('Unable to create Lace AI sync run.');
    }
    const id = (rows[0] as { id?: unknown }).id;
    if (typeof id !== 'string') throw new Error('Unable to create Lace AI sync run.');
    return id;
  }

  public async isFileIngested(exportType: string, key: string, eTag: string): Promise<boolean> {
    const row: unknown = await this.database('lace_ingested_files')
      .where({ export_type: exportType, s3_key: key, s3_etag: eTag })
      .first('id');
    return typeof row === 'object' && row !== null;
  }

  public async commitFile(
    syncRunId: string,
    file: LaceS3Object,
    exportType: string,
    records: LaceRawRecord[],
    errors: InvalidLaceRecord[],
  ): Promise<void> {
    await this.database.transaction(async (trx) => {
      for (const record of records) {
        await trx(this.config.rawTable).where({ source_id: record.sourceId, is_latest: true }).update({ is_latest: false });
        await trx(this.config.rawTable).insert({ source_id: record.sourceId, payload: record.payload, is_latest: true, sync_run_id: syncRunId });
      }
      if (errors.length > 0) {
        await trx('sync_errors').insert(
          errors.map((error) => ({ sync_run_id: syncRunId, source_id: error.sourceId, error_message: error.message, payload: error.payload })),
        );
      }
      await trx('lace_ingested_files').insert({
        export_type: exportType,
        s3_key: file.key,
        s3_etag: file.eTag,
        row_count: records.length,
        sync_run_id: syncRunId,
      });
    });
  }

  public async completeSyncRun(syncRunId: string, recordsProcessed: number): Promise<void> {
    await this.database('sync_runs').where({ id: syncRunId }).update({ status: 'COMPLETED', records_processed: recordsProcessed, completed_at: this.database.fn.now() });
  }

  public async failSyncRun(syncRunId: string, safeMessage: string): Promise<void> {
    await this.database('sync_runs').where({ id: syncRunId }).update({ status: 'FAILED', error_message: safeMessage, completed_at: this.database.fn.now() });
  }
}

export class LaceFileIngestionService {
  public constructor(
    private readonly config: LaceIngestionConfig,
    private readonly objectStore: LaceObjectStore,
    private readonly repository: LaceIngestionRepository,
  ) {}

  public async run(): Promise<{ syncRunId: string; recordsProcessed: number; filesProcessed: number }> {
    return this.repository.withExclusiveLock((lockedRepository) => this.runLocked(lockedRepository));
  }

  private async runLocked(repository: LaceIngestionRepository): Promise<{ syncRunId: string; recordsProcessed: number; filesProcessed: number }> {
    await repository.recoverInterruptedRuns();
    let syncRunId: string | null = null;
    let processed = 0;
    let filesProcessed = 0;
    try {
      syncRunId = await repository.createSyncRun();
      const objects = await this.objectStore.listObjects(this.config.s3Prefix);
      for (const file of objects) {
        if (!file.key.toLowerCase().endsWith('.csv')) continue;

        const alreadyIngested = await repository.isFileIngested(this.config.exportType, file.key, file.eTag);
        if (alreadyIngested) continue;

        const text = await this.objectStore.getObjectText(file.key);
        const rows = parseLaceCsv(text);
        const records: LaceRawRecord[] = [];
        const errors: InvalidLaceRecord[] = [];
        for (const row of rows) {
          const sourceId = this.config.extractSourceId(row);
          if (sourceId === null) errors.push({ sourceId, message: `${this.config.exportType} row is missing a valid natural key.`, payload: row });
          else records.push({ sourceId, payload: row });
        }

        await repository.commitFile(syncRunId, file, this.config.exportType, records, errors);
        processed += records.length;
        filesProcessed += 1;
      }
      await repository.completeSyncRun(syncRunId, processed);
      return { syncRunId, recordsProcessed: processed, filesProcessed };
    } catch (error) {
      const message = `Lace AI ${this.config.exportType} export ingestion failed.`;
      if (syncRunId !== null) await repository.failSyncRun(syncRunId, message);
      logger.error(`[LaceAI] ${this.config.exportType} ingestion failed`, {
        syncRunId,
        message,
        error: error instanceof Error ? error.message : String(error),
      });
      // eslint-disable-next-line preserve-caught-error
      throw new Error(message);
    }
  }
}
