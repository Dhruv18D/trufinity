import { describe, expect, it, jest } from '@jest/globals';
import { runControlledClassifierTest } from '../../src/scripts/google-gmail-classifier-test';

const authorization = (message: Record<string, unknown>) => ({
  subject: 'service@trufinity.ca',
  scope: 'https://www.googleapis.com/auth/gmail.readonly',
  mailbox: { normalizedAddress: 'service@trufinity.ca', contentMode: 'CONTENT' },
  client: { users: { messages: {
    list: jest.fn(async () => ({ data: { messages: [{ id: 'm1' }] } })),
    get: jest.fn(async () => ({ data: message })),
  } } },
} as any);

const inboundMessage = (labels = ['INBOX']) => ({
  id: 'm1', threadId: 't1', labelIds: labels, internalDate: '123456789', historyId: 'h1',
  payload: { headers: [{ name: 'From', value: 'external@example.com' }, { name: 'Subject', value: 'Synthetic subject' }], mimeType: 'text/plain', body: { data: Buffer.from('Synthetic body').toString('base64url') } },
});

describe('controlled Gmail classifier runner', () => {
  it('fetches and classifies at most one message without checkpoint/raw repository access', async () => {
    const auth = authorization(inboundMessage());
    const classifier = { classify: jest.fn(async () => ({ label: 'complaint' as const, confidence: 0.9, reason: 'Synthetic reason.' })) };
    const repository = { persist: jest.fn(async () => ({ id: 'c1', workItemId: 'w1', duplicate: false })) };
    const result = await runControlledClassifierTest('service@trufinity.ca', { getGmailAuthorization: () => auth }, classifier as any, repository);
    expect(result).toMatchObject({ messageId: 'm1', label: 'complaint', decisionStatus: 'ESCALATION', newlyPersisted: true, workItemExists: true });
    expect(auth.client.users.messages.list).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 1, includeSpamTrash: false }));
    expect(auth.client.users.messages.get).toHaveBeenCalledTimes(1);
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(repository.persist).toHaveBeenCalledTimes(1);
  });

  it.each(['careers@trufinity.ca', 'other@trufinity.ca'])('rejects non-approved CONTENT mailbox %s', async (mailbox) => {
    await expect(runControlledClassifierTest(mailbox, { getGmailAuthorization: jest.fn() } as any, {} as any, {} as any)).rejects.toThrow('approved Gmail CONTENT');
  });

  it('rejects metadata access even if the mailbox is otherwise known', async () => {
    await expect(runControlledClassifierTest('service@trufinity.ca', { getGmailAuthorization: () => { throw new Error('should not authorize'); } }, {} as any, {} as any)).rejects.toThrow();
  });

  it.each([['service@trufinity.ca'], ['support@trufinity.ca'], ['billing@trufinity.ca']])('accepts approved mailbox %s', async (mailbox) => {
    const auth = authorization(inboundMessage());
    auth.subject = mailbox;
    auth.mailbox.normalizedAddress = mailbox;
    const repository = { persist: jest.fn(async () => ({ id: 'c1', workItemId: null, duplicate: true })) };
    const result = await runControlledClassifierTest(mailbox, { getGmailAuthorization: () => auth }, { classify: jest.fn(async () => ({ label: 'none' as const, confidence: 0.2, reason: 'Synthetic reason.' })) } as any, repository);
    expect(result.newlyPersisted).toBe(false);
    expect(result.workItemExists).toBe(false);
  });

  it('does not classify outbound, draft, spam, or trash candidates', async () => {
    for (const [labels, from] of [[['INBOX'], 'service@trufinity.ca'], [['DRAFT'], 'external@example.com'], [['SPAM'], 'external@example.com'], [['TRASH'], 'external@example.com']] as const) {
      const auth = authorization({ ...inboundMessage([...labels]), payload: { headers: [{ name: 'From', value: from }], mimeType: 'text/plain', body: { data: Buffer.from('Synthetic body').toString('base64url') } } });
      const classifier = { classify: jest.fn() };
      const repository = { persist: jest.fn() };
      const result = await runControlledClassifierTest('service@trufinity.ca', { getGmailAuthorization: () => auth }, classifier as any, repository as any);
      expect(result.label).toBeNull();
      expect(classifier.classify).not.toHaveBeenCalled();
      expect(repository.persist).not.toHaveBeenCalled();
    }
  });

  it('supports REVIEW_REQUIRED and idempotent reruns', async () => {
    const auth = authorization(inboundMessage());
    const classifier = { classify: jest.fn(async () => ({ label: 'billing_dispute' as const, confidence: 0.2, reason: 'Synthetic reason.' })) };
    const repository = { persist: jest.fn(async () => ({ id: 'c1', workItemId: 'w1', duplicate: true })) };
    const result = await runControlledClassifierTest('service@trufinity.ca', { getGmailAuthorization: () => auth }, classifier as any, repository);
    expect(result.decisionStatus).toBe('REVIEW_REQUIRED');
    expect(result.newlyPersisted).toBe(false);
    expect(result.workItemExists).toBe(true);
  });
});
