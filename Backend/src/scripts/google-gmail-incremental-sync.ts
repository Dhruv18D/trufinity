import { db } from '../database';
import { gmailIncrementalSyncService } from '../modules/google/gmail-incremental.service';
import { safeErrorMessage } from '../modules/google/gmail-historical.service';

function parseOptions(args: string[]): string {
  if (args.length === 1 && args[0].trim() !== '') {
    return args[0].trim();
  }
  throw new Error('Usage: npm run google:gmail-incremental-sync -- <mailbox>');
}

async function main(): Promise<void> {
  let exitCode = 0;
  try {
    const mailboxAddress = parseOptions(process.argv.slice(2));
    const result = await gmailIncrementalSyncService.runMailbox(mailboxAddress);
    console.log(`${result.mailboxAddress} | ${result.contentMode} | COMPLETED | processed=${result.recordsProcessed} | persisted=${result.recordsPersisted}`);
  } catch (error) {
    console.error(safeErrorMessage(error));
    exitCode = 1;
  } finally {
    await db.destroy();
  }
  process.exitCode = exitCode;
}

void main();
