import { logger } from './shared/logger';
import { schedule } from 'node-cron';
import { syncMetrics } from './services/metrics.service';
import { initServer } from "./server";

const cron = process.env.CRON || '* * * * *';
logger.info(`Scheduling next execution with expression: ${cron}`);

async function schedulerMetrics() {
  try {
    await syncMetrics();
  } catch (err) {
    logger.error(err, `Error running process.`);
  }
}

schedulerMetrics()
  .then(() => schedule(cron, schedulerMetrics))
  .catch(err => logger.error(err, `Error in scheduling execution.`));

initServer();