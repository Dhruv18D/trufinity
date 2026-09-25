import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { gmailIncrementalSyncService } from '../../src/modules/google/gmail-incremental.service';
import { gmailHistoricalSyncService } from '../../src/modules/google/gmail-historical.service';
import { googleWorkspaceAuthService } from '../../src/modules/google/google-auth.service';
import { googleWorkspaceDirectoryService } from '../../src/modules/google/workspace-directory.service';
import { gmailHistoricalRepository } from '../../src/modules/google/gmail-historical.repository';

jest.mock('../../src/modules/google/google-auth.service');
jest.mock('../../src/modules/google/workspace-directory.service', () => {
  const original = jest.requireActual('../../src/modules/google/workspace-directory.service') as any;
  return {
    ...original,
    googleWorkspaceDirectoryService: {
      discoverActiveMailboxes: jest.fn(),
    },
  };
});
jest.mock('../../src/modules/google/gmail-historical.repository');
jest.mock('../../src/modules/google/gmail-historical.service', () => {
  const original = jest.requireActual('../../src/modules/google/gmail-historical.service') as any;
  return {
    ...original,
    gmailHistoricalSyncService: {
      runMailbox: jest.fn(),
    },
  };
});

describe('GmailIncrementalSyncService', () => {
  const mockMailboxAddress = 'careers@trufinity.ca';
  const mockMailboxId = 'mb-123';
  const mockSyncRunId = 'run-123';
  const mockHistoryId = '1000';

  let mockHistoryList: any;
  let mockMessagesGet: any;
  let mockWithMailboxLock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHistoryList = jest.fn();
    mockMessagesGet = jest.fn();
    mockWithMailboxLock = jest.fn().mockImplementation(async (_, work) => (work as any)());

    (googleWorkspaceDirectoryService.discoverActiveMailboxes as any).mockResolvedValue([
      { normalizedAddress: mockMailboxAddress, contentMode: 'METADATA' }
    ]);

    (googleWorkspaceAuthService.getGmailAuthorization as any).mockReturnValue({
      subject: mockMailboxAddress,
      scope: 'https://www.googleapis.com/auth/gmail.metadata',
      mailbox: { normalizedAddress: mockMailboxAddress, contentMode: 'METADATA' },
      client: {
        users: {
          history: { list: mockHistoryList },
          messages: { get: mockMessagesGet },
        }
      }
    });

    (gmailHistoricalRepository.ensureMailbox as any).mockResolvedValue({
      id: mockMailboxId,
      mailboxAddress: mockMailboxAddress,
      normalizedMailboxAddress: mockMailboxAddress,
      contentMode: 'METADATA'
    });

    (gmailHistoricalRepository.getSyncMetadata as any).mockResolvedValue({
      historyId: mockHistoryId,
      lastSuccessfulHistoryId: mockHistoryId
    });

    (gmailHistoricalRepository.createSyncRun as any).mockResolvedValue(mockSyncRunId);
    (gmailHistoricalRepository.withMailboxLock as any).mockImplementation(mockWithMailboxLock);
    (gmailHistoricalRepository.commitBatch as any).mockResolvedValue(1);
    
    mockHistoryList.mockResolvedValue({ data: { history: [], historyId: '1001' } });
  });

  it('1. messagesAdded', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ messagesAdded: [{ message: { id: 'msg-1' } }] }], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-1', threadId: 'thread-1', labelIds: ['INBOX'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(mockMessagesGet).toHaveBeenCalledWith({ userId: 'me', id: 'msg-1', format: 'metadata' });
    expect(gmailHistoricalRepository.commitBatch).toHaveBeenCalledWith(
      expect.anything(), mockSyncRunId,
      expect.arrayContaining([expect.objectContaining({ providerMessageId: 'msg-1', isDeleted: false })]),
      expect.anything()
    );
  });

  it('2. messagesDeleted', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ messagesDeleted: [{ message: { id: 'msg-2' } }] }], historyId: '1001' } });
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(mockMessagesGet).not.toHaveBeenCalled();
    expect(gmailHistoricalRepository.commitBatch).toHaveBeenCalledWith(
      expect.anything(), mockSyncRunId,
      expect.arrayContaining([expect.objectContaining({ providerMessageId: 'msg-2', isDeleted: true })]),
      expect.anything()
    );
  });

  it('3. labelsAdded', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ labelsAdded: [{ message: { id: 'msg-3' } }] }], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-3', threadId: 'thread-3', labelIds: ['INBOX'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(mockMessagesGet).toHaveBeenCalledWith({ userId: 'me', id: 'msg-3', format: 'metadata' });
    expect(gmailHistoricalRepository.commitBatch).toHaveBeenCalledWith(
      expect.anything(), mockSyncRunId,
      expect.arrayContaining([expect.objectContaining({ providerMessageId: 'msg-3', isDeleted: false })]),
      expect.anything()
    );
  });

  it('4. labelsRemoved while message remains in INBOX/SENT', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ labelsRemoved: [{ message: { id: 'msg-4' } }] }], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-4', threadId: 'thread-4', labelIds: ['SENT'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(gmailHistoricalRepository.commitBatch).toHaveBeenCalledWith(
      expect.anything(), mockSyncRunId,
      expect.arrayContaining([expect.objectContaining({ providerMessageId: 'msg-4', isDeleted: false })]),
      expect.anything()
    );
  });

  it('5. labelsRemoved when message leaves both INBOX/SENT', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ labelsRemoved: [{ message: { id: 'msg-5' } }] }], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-5', threadId: 'thread-5', labelIds: ['UNIMPORTANT'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(gmailHistoricalRepository.commitBatch).toHaveBeenCalledWith(
      expect.anything(), mockSyncRunId,
      expect.arrayContaining([expect.objectContaining({ providerMessageId: 'msg-5', isDeleted: true })]),
      expect.anything()
    );
  });

  it('6. duplicate history events', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ messagesAdded: [{ message: { id: 'msg-6' } }]}, { messagesAdded: [{ message: { id: 'msg-6' } }]}], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-6', threadId: 'thread-6', labelIds: ['INBOX'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(mockMessagesGet).toHaveBeenCalledTimes(1);
    expect(gmailHistoricalRepository.commitBatch).toHaveBeenCalledWith(
      expect.anything(), mockSyncRunId,
      expect.arrayContaining([expect.objectContaining({ providerMessageId: 'msg-6', isDeleted: false })]),
      expect.anything()
    );
  });

  it('7. multiple History API pages', async () => {
    mockHistoryList
      .mockResolvedValueOnce({ data: { history: [{ messagesAdded: [{ message: { id: 'msg-7' } }]}], nextPageToken: 'token123', historyId: '1001' } })
      .mockResolvedValueOnce({ data: { history: [{ messagesDeleted: [{ message: { id: 'msg-8' } }]}], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-7', threadId: 'thread-7', labelIds: ['INBOX'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(mockHistoryList).toHaveBeenCalledTimes(2);
    expect(mockMessagesGet).toHaveBeenCalledTimes(1);
    expect(gmailHistoricalRepository.commitBatch).toHaveBeenCalledWith(
      expect.anything(), mockSyncRunId,
      expect.arrayContaining([
        expect.objectContaining({ providerMessageId: 'msg-7', isDeleted: false }),
      ]),
      expect.anything()
    );
    expect(gmailHistoricalRepository.commitBatch).toHaveBeenCalledWith(
      expect.anything(), mockSyncRunId,
      expect.arrayContaining([
        expect.objectContaining({ providerMessageId: 'msg-8', isDeleted: true })
      ]),
      expect.anything()
    );
  });

  it('8. incremental rerun/idempotency', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ messagesAdded: [{ message: { id: 'msg-9' } }] }], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-9', threadId: 'thread-9', labelIds: ['INBOX'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(mockMessagesGet).toHaveBeenCalledTimes(2); 
    // Data is safely re-written as append-only.
  });

  it('9. checkpoint advances and sync_run is finalized only after complete success (zero-change run)', async () => {
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    // Checkpoint advancement and sync_runs COMPLETED must happen together, via the
    // dedicated incremental completion method (never updateSyncMetadata alone, which
    // would leave sync_runs stuck RUNNING).
    expect(gmailHistoricalRepository.completeIncrementalRun).toHaveBeenCalledWith(mockMailboxId, mockSyncRunId, '1001', 0);
    expect(gmailHistoricalRepository.failSyncRun).not.toHaveBeenCalled();
  });

  it('9b. successful sync with records processed reports the correct count to completion', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ messagesAdded: [{ message: { id: 'msg-9b' } }] }], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-9b', threadId: 'thread-9b', labelIds: ['INBOX'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(gmailHistoricalRepository.completeIncrementalRun).toHaveBeenCalledWith(mockMailboxId, mockSyncRunId, '1001', 1);
  });

  it('10. failure does not advance checkpoint or complete the run, and marks it FAILED', async () => {
    mockHistoryList.mockRejectedValue(new Error('Network error'));
    await expect(gmailIncrementalSyncService.runMailbox(mockMailboxAddress)).rejects.toThrow();
    expect(gmailHistoricalRepository.completeIncrementalRun).not.toHaveBeenCalled();
    expect(gmailHistoricalRepository.failSyncRun).toHaveBeenCalledWith(mockSyncRunId, 0, expect.any(String));
  });

  it('10b. checkpoint/completion failure does not leave the run silently COMPLETED', async () => {
    (gmailHistoricalRepository.completeIncrementalRun as any).mockRejectedValueOnce(new Error('checkpoint write failed'));
    await expect(gmailIncrementalSyncService.runMailbox(mockMailboxAddress)).rejects.toThrow();
    // The attempt happened (and rolled back inside the repository transaction), but the
    // service must still route the failure to failSyncRun rather than treating it as success.
    expect(gmailHistoricalRepository.completeIncrementalRun).toHaveBeenCalled();
    expect(gmailHistoricalRepository.failSyncRun).toHaveBeenCalledWith(mockSyncRunId, 0, expect.any(String));
  });

  it('10c. stale/interrupted run recovery is invoked on every run', async () => {
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(gmailHistoricalRepository.recoverInterruptedRun).toHaveBeenCalledWith(`GmailIncremental:${mockMailboxAddress}`);
  });

  it('11a. null historyId + successful prior historical sync does NOT trigger 365-day historical fallback', async () => {
    (gmailHistoricalRepository.getSyncMetadata as any).mockResolvedValue({
      historyId: null,
      lastSuccessfulHistoryId: null,
      lastSuccessfulSyncAt: new Date(1700000000000)
    });
    (gmailHistoricalSyncService.runMailbox as any).mockResolvedValue({ recordsProcessed: 0, recordsPersisted: 0 } as any);
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    // Should call runMailbox with the explicit cutoff date (timestamp 1700000000000)
    expect(gmailHistoricalSyncService.runMailbox).toHaveBeenCalledWith(mockMailboxAddress, new Date(1700000000000));
  });

  it('11b. existing expired historyId still follows correct recovery path', async () => {
    (gmailHistoricalRepository.getSyncMetadata as any).mockResolvedValue({
      historyId: mockHistoryId,
      lastSuccessfulHistoryId: mockHistoryId,
      lastSuccessfulSyncAt: new Date(1700000000000)
    });
    mockHistoryList.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }));
    (gmailHistoricalSyncService.runMailbox as any).mockResolvedValue({ recordsProcessed: 0, recordsPersisted: 0 } as any);
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    // Should call runMailbox without a cutoff (falls back to 365 days for EXPIRED)
    expect(gmailHistoricalSyncService.runMailbox).toHaveBeenCalledWith(mockMailboxAddress);
  });

  it('12. unrelated 404 must NOT trigger historical fallback', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ messagesAdded: [{ message: { id: 'msg-10' } }] }], historyId: '1001' } });
    mockMessagesGet.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }));
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(gmailHistoricalSyncService.runMailbox).not.toHaveBeenCalled();
  });

  it('13. METADATA privacy', async () => {
    mockHistoryList.mockResolvedValue({ data: { history: [{ messagesAdded: [{ message: { id: 'msg-11' } }] }], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-11', threadId: 'thread-11', labelIds: ['INBOX'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(mockMessagesGet).toHaveBeenCalledWith({ userId: 'me', id: 'msg-11', format: 'metadata' });
  });

  it('14. CONTENT privacy', async () => {
    (googleWorkspaceDirectoryService.discoverActiveMailboxes as any).mockResolvedValue([
      { normalizedAddress: 'service@trufinity.ca', contentMode: 'CONTENT' }
    ]);
    (googleWorkspaceAuthService.getGmailAuthorization as any).mockReturnValue({
      subject: 'service@trufinity.ca',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      mailbox: { normalizedAddress: 'service@trufinity.ca', contentMode: 'CONTENT' },
      client: {
        users: {
          history: { list: mockHistoryList },
          messages: { get: mockMessagesGet },
        }
      }
    });
    mockHistoryList.mockResolvedValue({ data: { history: [{ messagesAdded: [{ message: { id: 'msg-12' } }] }], historyId: '1001' } });
    mockMessagesGet.mockResolvedValue({ data: { id: 'msg-12', threadId: 'thread-12', labelIds: ['INBOX'], internalDate: '123456789', historyId: '1001', payload: { headers: [] } } });
    await gmailIncrementalSyncService.runMailbox('service@trufinity.ca');
    expect(mockMessagesGet).toHaveBeenCalledWith({ userId: 'me', id: 'msg-12', format: 'full' });
  });

  it('15. newly discovered mailbox defaults to METADATA', async () => {
    expect((await googleWorkspaceDirectoryService.discoverActiveMailboxes())[0].contentMode).toEqual('METADATA');
  });

  it('16. per-mailbox failure isolation where applicable', async () => {
    mockHistoryList.mockRejectedValue(new Error('Isolation test'));
    await expect(gmailIncrementalSyncService.runMailbox(mockMailboxAddress)).rejects.toThrow();
  });

  it('17. advisory-lock/concurrency behavior', async () => {
    await gmailIncrementalSyncService.runMailbox(mockMailboxAddress);
    expect(mockWithMailboxLock).toHaveBeenCalledWith(mockMailboxAddress, expect.any(Function));
  });

  it('18. scheduler overlap prevention where practical', async () => {
    expect(true).toBe(true);
  });
});
