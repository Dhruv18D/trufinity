import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { isApprovedContentMailbox, normalizeMailboxAddress, resolveGmailMailboxPolicy } from '../modules/google/gmail-policy';
import { googleWorkspaceAuthService, type GoogleWorkspaceAuthService } from '../modules/google/google-auth.service';
import { normalizeMessage } from '../modules/google/gmail-historical.service';
import { AnthropicEmailClassifier } from '../modules/google/anthropic-email-classifier';
import type { EmailClassifier } from '../modules/google/email-classifier';
import { DefaultGmailClassificationHook } from '../modules/google/gmail-classification.service';
import { KnexEmailClassificationRepository, type ClassificationPersistenceInput, type PersistedClassification } from '../modules/google/classification.repository';

export interface ControlledClassifierTestResult {
  mailbox: string;
  messageId: string | null;
  model: string;
  label: string | null;
  confidence: number | null;
  decisionStatus: string | null;
  newlyPersisted: boolean;
  workItemExists: boolean;
}

export interface ControlledClassifierRepository {
  persist(input: ClassificationPersistenceInput): Promise<PersistedClassification>;
}

type AuthService = Pick<GoogleWorkspaceAuthService, 'getGmailAuthorization'>;

const safeFailure = 'Controlled Gmail classifier verification failed.';

export async function runControlledClassifierTest(
  mailboxAddress: string,
  authService: AuthService = googleWorkspaceAuthService,
  classifier?: EmailClassifier,
  repository: ControlledClassifierRepository = new KnexEmailClassificationRepository(),
): Promise<ControlledClassifierTestResult> {
  const mailbox = normalizeMailboxAddress(mailboxAddress);
  if (!mailbox || !isApprovedContentMailbox(mailbox) || resolveGmailMailboxPolicy(mailbox).contentMode !== 'CONTENT') {
    throw new Error('Only an approved Gmail CONTENT mailbox may be selected.');
  }
  const authorization = authService.getGmailAuthorization(mailbox);
  if (authorization.mailbox.contentMode !== 'CONTENT' || authorization.subject !== mailbox) throw new Error('Selected mailbox is not authorized for CONTENT access.');
  const listed = await authorization.client.users.messages.list({ userId: 'me', maxResults: 1, includeSpamTrash: false, labelIds: ['INBOX'] });
  const listedId = listed.data.messages?.[0]?.id;
  if (typeof listedId !== 'string' || listedId.trim() === '') {
    return { mailbox, messageId: null, model: env.GMAIL_CLASSIFIER_MODEL, label: null, confidence: null, decisionStatus: null, newlyPersisted: false, workItemExists: false };
  }
  const raw = await authorization.client.users.messages.get({ userId: 'me', id: listedId, format: 'full' });
  const message = normalizeMessage(raw.data);
  if (!message || message.labelIds.some((label) => ['DRAFT', 'SPAM', 'TRASH'].includes(label))) {
    return { mailbox, messageId: listedId, model: env.GMAIL_CLASSIFIER_MODEL, label: null, confidence: null, decisionStatus: null, newlyPersisted: false, workItemExists: false };
  }
  const activeClassifier = classifier ?? createExplicitClassifierForControlledTest();
  const hook = new DefaultGmailClassificationHook(activeClassifier, true, env.GMAIL_CLASSIFIER_CONFIDENCE_THRESHOLD);
  const classification = await hook.classifyMessage(authorization, message);
  if (!classification) return { mailbox, messageId: message.id, model: env.GMAIL_CLASSIFIER_MODEL, label: null, confidence: null, decisionStatus: null, newlyPersisted: false, workItemExists: false };
  const persisted = await repository.persist(classification);
  return {
    mailbox,
    messageId: message.id,
    model: env.GMAIL_CLASSIFIER_MODEL,
    label: classification.classification.label,
    confidence: classification.classification.confidence,
    decisionStatus: classification.decisionStatus,
    newlyPersisted: !persisted.duplicate,
    workItemExists: persisted.workItemId !== null,
  };
}

function createExplicitClassifierForControlledTest(): EmailClassifier {
  if (env.GMAIL_CLASSIFIER_PROVIDER !== 'anthropic' || !env.ANTHROPIC_API_KEY || !env.GMAIL_CLASSIFIER_MODEL || env.GMAIL_CLASSIFIER_CONFIDENCE_THRESHOLD === undefined) {
    throw new Error('Classifier provider, model, API key, and confidence threshold must be configured for this controlled test.');
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: env.GMAIL_CLASSIFIER_TIMEOUT_MS });
  return new AnthropicEmailClassifier(client, {
    model: env.GMAIL_CLASSIFIER_MODEL,
    timeoutMs: env.GMAIL_CLASSIFIER_TIMEOUT_MS,
    maxRetries: env.GMAIL_CLASSIFIER_MAX_RETRIES,
    promptVersion: env.GMAIL_CLASSIFIER_PROMPT_VERSION,
  });
}

function printResult(result: ControlledClassifierTestResult): void {
  console.log(`MAILBOX: ${result.mailbox}`);
  console.log(`MESSAGE ID: ${result.messageId ?? 'none'}`);
  console.log(`MODEL: ${result.model}`);
  console.log(`LABEL: ${result.label ?? 'none'}`);
  console.log(`CONFIDENCE: ${result.confidence ?? 'none'}`);
  console.log(`DECISION: ${result.decisionStatus ?? 'none'}`);
  console.log(`PERSISTENCE: ${result.newlyPersisted ? 'newly persisted' : 'already existed or no eligible message'}`);
  console.log(`WORK ITEM: ${result.workItemExists ? 'exists' : 'none'}`);
}

function selectedMailbox(args: string[]): string {
  const index = args.indexOf('--mailbox');
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || args.some((arg, position) => arg === '--mailbox' && position !== index)) throw new Error('Usage: --mailbox <approved-content-mailbox>');
  return value;
}

async function main(): Promise<void> {
  try { printResult(await runControlledClassifierTest(selectedMailbox(process.argv.slice(2)))); }
  catch { console.error(safeFailure); process.exitCode = 1; }
}

if (require.main === module) void main();
