import { db } from '../database';
import { gmailHistoricalSyncService, safeErrorMessage } from '../modules/google/gmail-historical.service';

interface RunnerOptions {
  mailboxAddress: string | null;
  allEligible: boolean;
}

function parseOptions(args: string[]): RunnerOptions {
  if (args.length === 2 && args[0] === '--mailbox' && args[1].trim() !== '') return { mailboxAddress: args[1], allEligible: false };
  if (args.length === 1 && args[0] === '--all') return { mailboxAddress: null, allEligible: true };
  throw new Error('Usage: npm run google:gmail-historical-sync -- --mailbox <mailbox> | --all');
}

async function main(): Promise<void> {
  let exitCode = 0;
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.mailboxAddress) {
      const result = await gmailHistoricalSyncService.runMailbox(options.mailboxAddress);
      console.log(`${result.mailboxAddress} | ${result.contentMode} | COMPLETED | processed=${result.recordsProcessed} | persisted=${result.recordsPersisted}`);
    } else if (options.allEligible) {
      const result = await gmailHistoricalSyncService.runAllEligibleMailboxes();
      for (const completed of result.completed) {
        console.log(`${completed.mailboxAddress} | ${completed.contentMode} | COMPLETED | processed=${completed.recordsProcessed} | persisted=${completed.recordsPersisted}`);
      }
      for (const failed of result.failed) console.log(`${failed.mailboxAddress} | FAILED`);
      if (result.failed.length > 0) exitCode = 1;
    }
  } catch (error) {
    console.error(safeErrorMessage(error));
    exitCode = 1;
  } finally {
    await db.destroy();
  }
  process.exitCode = exitCode;
}

void main();