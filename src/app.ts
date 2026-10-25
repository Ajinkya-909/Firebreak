import { clerkMiddleware } from '@clerk/express';
import cors from 'cors';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { requireUser } from './api/middleware/auth.js';
import { errorHandler, notFound } from './api/middleware/errors.js';
import { evaluationRouter } from './api/routes/evaluation.js';
import { incidentsRouter } from './api/routes/incidents.js';
import { servicesRouter } from './api/routes/services.js';
import { slackRouter } from './api/routes/slack.js';
import { webhooksRouter } from './api/routes/webhooks.js';
import { pool } from './db/client.js';
import { logger } from './lib/logger.js';

// Slack signs the raw request body, so keep a copy before parsing.
const keepRawBody = (req: Request, _res: unknown, buf: Buffer) => {
  (req as Request & { rawBody?: Buffer }).rawBody = buf;
};

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/healthz' } }));
  app.use(express.json({ limit: '1mb', verify: keepRawBody }));
  app.use(express.urlencoded({ extended: false, verify: keepRawBody }));

  app.get('/healthz', async (_req, res) => {
    await pool.query('select 1');
    res.json({ ok: true });
  });

  // Machine-to-machine: authenticated by shared secret / Slack signature, not Clerk.
  app.use('/api/webhooks', webhooksRouter);
  app.use('/api/slack', slackRouter);

  // Dashboard API: Clerk session required.
  app.use('/api', clerkMiddleware(), requireUser);
  app.use('/api/services', servicesRouter);
  app.use('/api/incidents', incidentsRouter);
  app.use('/api/evaluation', evaluationRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
