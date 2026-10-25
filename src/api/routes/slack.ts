import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { createAskIncidentAgent } from '../../agents/askIncident.js';
import { runAgent } from '../../agents/run.js';
import { env } from '../../config/env.js';
import { db, schema } from '../../db/client.js';
import { postMessage } from '../../integrations/slack.js';
import { logger } from '../../lib/logger.js';
import { recordFeedback } from '../../services/feedback.js';
import { getTemporalClient } from '../../temporal/client.js';
import { acknowledgeSignal } from '../../temporal/shared.js';

export const slackRouter = Router();

/** https://api.slack.com/authentication/verifying-requests-from-slack */
function verifySlackSignature(req: Request, res: Response, next: NextFunction) {
  const secret = env.SLACK_SIGNING_SECRET;
  const ts = req.header('x-slack-request-timestamp');
  const sig = req.header('x-slack-signature');
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!secret || !ts || !sig || !raw || Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    res.status(401).end();
    return;
  }
  const expected = `v0=${createHmac('sha256', secret).update(`v0:${ts}:${raw.toString('utf8')}`).digest('hex')}`;
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    res.status(401).end();
    return;
  }
  next();
}

slackRouter.use(verifySlackSignature);

async function incidentForThread(channel: string, threadTs: string) {
  return db.query.incidents.findFirst({
    where: and(eq(schema.incidents.slackChannel, channel), eq(schema.incidents.slackThreadTs, threadTs)),
  });
}

/** Ask-the-incident: answer questions posted in an incident's thread. */
async function answerInThread(event: { channel: string; thread_ts: string; text: string }) {
  const incident = await incidentForThread(event.channel, event.thread_ts);
  if (!incident) return;
  const service = await db.query.services.findFirst({ where: eq(schema.services.id, incident.serviceId) });
  if (!service) return;
  const question = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  const run = await runAgent(createAskIncidentAgent(service, incident.workflowId), { prompt: question });
  await postMessage(event.channel, run.finalText || "I couldn't find an answer in the data.", undefined, event.thread_ts);
}

slackRouter.post('/events', (req, res) => {
  const body = req.body as {
    type: string;
    challenge?: string;
    event?: { type: string; channel: string; thread_ts?: string; text?: string; bot_id?: string; subtype?: string };
  };
  if (body.type === 'url_verification') {
    res.json({ challenge: body.challenge });
    return;
  }
  // Slack requires an ack within 3 seconds; answer asynchronously.
  res.status(200).end();

  const e = body.event;
  if (body.type !== 'event_callback' || !e || e.bot_id || e.subtype || !e.thread_ts || !e.text) return;
  if (e.type !== 'app_mention' && e.type !== 'message') return;
  answerInThread({ channel: e.channel, thread_ts: e.thread_ts, text: e.text }).catch((err) =>
    logger.error({ err }, 'ask-the-incident failed'),
  );
});

/** Button clicks: acknowledge and feedback. */
slackRouter.post('/interactions', async (req, res) => {
  const payload = JSON.parse((req.body as { payload: string }).payload) as {
    type: string;
    user: { id: string };
    actions?: Array<{ action_id: string; value: string; block_id: string }>;
  };
  res.status(200).end();

  const action = payload.actions?.[0];
  if (payload.type !== 'block_actions' || !action) return;
  const incidentId = action.block_id.split(':')[1];
  if (!incidentId) return;
  const incident = await db.query.incidents.findFirst({ where: eq(schema.incidents.id, incidentId) });
  if (!incident) return;
  const userId = `slack:${payload.user.id}`;

  try {
    if (action.action_id === 'acknowledge') {
      const client = await getTemporalClient();
      await client.workflow.getHandle(incident.workflowId).signal(acknowledgeSignal, { userId });
      await db
        .update(schema.incidents)
        .set({ acknowledgedBy: userId, acknowledgedAt: new Date() })
        .where(eq(schema.incidents.id, incident.id));
    } else if (action.action_id.startsWith('feedback_')) {
      const verdict = action.value as 'correct' | 'wrong_root_cause' | 'not_incident';
      await recordFeedback({ incident, userId, verdict });
    }
  } catch (err) {
    logger.error({ err, action: action.action_id }, 'slack interaction failed');
  }
});
