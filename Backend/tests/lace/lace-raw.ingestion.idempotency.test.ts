import { describe, expect, it, beforeEach } from '@jest/globals';
import { db } from '../../src/database';
import { PostgresCallAnalysisRawRepository, LaceCallAnalysisIngestionService } from '../../src/modules/lace/ingestion/call-analysis.ingestion';
import type { LaceObjectStore } from '../../src/modules/lace/s3.client';
import type { LaceS3Object } from '../../src/modules/lace/types';

// Exercises the REAL Postgres repository (not the fake used elsewhere in
// tests/lace) against the real lace_ingested_files table, because the bug
// this covers (unique constraint on lace_ingested_files missing s3_etag,
// breaking "vendor re-sent a corrected export") only exists at the real
// schema level - a fake in-memory repository can't catch a DB constraint bug.
class FakeObjectStore implements LaceObjectStore {
  public constructor(private readonly objects: LaceS3Object[], private readonly contents: Map<string, string>) {}
  public async listObjects(): Promise<LaceS3Object[]> {
    return this.objects;
  }
  public async getObjectText(key: string): Promise<string> {
    const text = this.contents.get(key);
    if (text === undefined) throw new Error(`No fixture content for ${key}`);
    return text;
  }
}

const HEADER =
  'CRM,CSR,Tags,Booked,Company,Campaign,Call link,Qualified,Job number,Objections,CRM call id,CRM tenant id,Customer name,Short summary,Call direction,Customer phone,Duration (sec),Playbook score,Unbooked reason,Existing customer,Cancellation reason,Date received (UTC),Time received (UTC),Date received (Local),Qualification details,Time received (Local)';

function csvRow(callId: string, booked: string): string {
  return `SERVICE_TITAN,Dana,,${booked},Northwind,Organic,https://www.lace.ai/app/call-center-all-calls/${callId},Yes,J1,,,2088992281,Jane,"s",Inbound,+1,300,90,,yes,,2096-08-24,12:00:00,2096-08-24,"q",07:00:00`;
}

function fileObject(key: string, eTag: string): LaceS3Object {
  return { key, eTag, lastModified: new Date('2096-08-24T00:00:00Z'), size: 100 };
}

describe('Lace raw ingestion idempotency (real Postgres repository)', () => {
  beforeEach(async () => {
    await db('lace_ingested_files').where({ export_type: 'call_analysis' }).andWhere('s3_key', 'like', 'idempotency-test/%').delete();
    await db('raw_lace_call_analysis').where('source_id', 'like', 'idem-%').delete();
    await db('sync_runs').where({ source_system: 'LaceAI', entity_type: 'call_analysis' }).delete();
  });

  it('does not reprocess the same file+ETag twice (re-run produces the same final state)', async () => {
    const file = fileObject('idempotency-test/2096-08-24.csv', 'etag-same-1');
    const store = new FakeObjectStore([file], new Map([[file.key, `${HEADER}\n${csvRow('idem-1', 'Booked')}\n`]]));
    const repo = new PostgresCallAnalysisRawRepository();

    const first = await new LaceCallAnalysisIngestionService(store, repo).run();
    const second = await new LaceCallAnalysisIngestionService(store, repo).run();

    expect(first.filesProcessed).toBe(1);
    expect(second.filesProcessed).toBe(0);
    const rows = await db('raw_lace_call_analysis').where({ source_id: 'idem-1' });
    expect(rows).toHaveLength(1);
  });

  it('accepts a corrected re-export under the same S3 key with a new ETag, without violating the DB constraint, and supersedes the prior version', async () => {
    const key = 'idempotency-test/2096-08-25.csv';
    const file1 = fileObject(key, 'etag-v1');
    const store1 = new FakeObjectStore([file1], new Map([[file1.key, `${HEADER}\n${csvRow('idem-2', 'Unbooked')}\n`]]));
    const repo = new PostgresCallAnalysisRawRepository();
    await new LaceCallAnalysisIngestionService(store1, repo).run();

    const file2 = fileObject(key, 'etag-v2');
    const store2 = new FakeObjectStore([file2], new Map([[file2.key, `${HEADER}\n${csvRow('idem-2', 'Booked')}\n`]]));
    // This previously threw a unique-constraint violation on lace_ingested_files.
    const result = await new LaceCallAnalysisIngestionService(store2, repo).run();

    expect(result.filesProcessed).toBe(1);
    const rows = await db('raw_lace_call_analysis').where({ source_id: 'idem-2' }).orderBy('ingested_at');
    expect(rows).toHaveLength(2);
    expect(rows[0].is_latest).toBe(false);
    expect(rows[1].is_latest).toBe(true);
    expect((rows[1].payload as { Booked: string }).Booked).toBe('Booked');
  });
});
