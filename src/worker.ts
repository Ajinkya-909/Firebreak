import { NativeConnection, Worker } from '@temporalio/worker';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import { logger } from './lib/logger.js';
import * as activities from './temporal/activities/index.js';
import { connectionOptions } from './temporal/client.js';
import { syncAllSchedules } from './temporal/schedules.js';

async function main() {
  const connection = await NativeConnection.connect(connectionOptions());
  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    // .ts under tsx in development, .js from the compiled dist/ build.
    workflowsPath: fileURLToPath(new URL(`./temporal/workflows/index${extname(import.meta.url)}`, import.meta.url)),
    activities,
    maxConcurrentActivityTaskExecutions: 50,
  });

  // Make sure every service has its detection schedule (and the digest exists) before polling.
  await syncAllSchedules();

  logger.info({ taskQueue: env.TEMPORAL_TASK_QUEUE }, 'temporal worker started');
  try {
    await worker.run();
  } finally {
    await connection.close();
    await pool.end();
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'worker crashed');
  process.exit(1);
});
