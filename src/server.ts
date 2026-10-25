import { requireEnv, env } from './config/env.js';
import { createApp } from './app.js';
import { pool } from './db/client.js';
import { logger } from './lib/logger.js';

// Fail at boot rather than on the first dashboard request.
requireEnv('CLERK_SECRET_KEY');
requireEnv('CLERK_PUBLISHABLE_KEY');

const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'firebreak api listening');
});

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
