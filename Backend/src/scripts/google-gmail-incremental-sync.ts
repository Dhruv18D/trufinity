import { db } from '../database';
import { gmailIncrementalSyncService } from '../modules/google/gmail-incremental.service';

function parseOptions(args: string[]): string {
  if (args.length === 1 && args[0].trim() !== '') {
    return args[0].trim();
  }
  throw new Error('Usage: npm run google:gmail-incremental-sync -- <mailbox>');
}

async function main(): Promise<void> {
  let exitCode = 0;
  try {
    (global as any).__GMAIL_SYNC_STAGE = 'CLI argument validation';
    const mailboxAddress = parseOptions(process.argv.slice(2));
    const result = await gmailIncrementalSyncService.runMailbox(mailboxAddress);
    console.log(`${result.mailboxAddress} | ${result.contentMode} | COMPLETED | processed=${result.recordsProcessed} | persisted=${result.recordsPersisted}`);
  } catch (error) {
    const stage = (global as any).__GMAIL_SYNC_STAGE || 'unknown stage';
    let statusCode = 'unknown';
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (error as any).response;
      if (response && typeof response.status === 'number') {
        statusCode = response.status.toString();
      }
    }
    
    console.error('--- GMAIL INCREMENTAL SYNC DIAGNOSTIC ERROR ---');
    console.error(`Stage: ${stage}`);
    console.error(`Error Name: ${error instanceof Error ? error.name : 'Unknown Error'}`);
    console.error(`HTTP Status: ${statusCode}`);
    
    let safeMsg = error instanceof Error ? error.message : 'Unknown error';
    safeMsg = safeMsg.replace(/(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g, '[REDACTED_JWT]');
    safeMsg = safeMsg.replace(/([a-zA-Z0-9-_]{40,})/g, '[REDACTED_TOKEN]');
    safeMsg = safeMsg.replace(/(https?:\/\/[^\s]+)/g, '[REDACTED_URL]');
    console.error(`Message: ${safeMsg}`);
    
    exitCode = 1;
  } finally {
    await db.destroy();
  }
  process.exitCode = exitCode;
}

void main();
