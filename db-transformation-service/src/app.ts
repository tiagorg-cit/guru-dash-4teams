import { logger } from './shared/logger';
import { schedule } from 'node-cron';
import { consolidateMetrics } from './services/consolidate.service';

const cron = process.env.CRON || '* * * * *';
logger.info(`Scheduling next execution with expression: ${cron}`);

async function main() {
  try {
    await consolidateMetrics();
  } catch (err) {
    logger.error(err, `Error running consolidate process.`);
  }
}

main();
/*main()
  .then(() => schedule(cron, main))
  .catch(err => logger.error(err, `Error in scheduling execution.`));*/