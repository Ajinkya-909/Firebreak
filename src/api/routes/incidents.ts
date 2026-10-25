import { and, desc, eq, type SQL } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../../db/client.js';
import { recordFeedback } from '../../services/feedback.js';
import { getTemporalClient } from '../../temporal/client.js';
import { acknowledgeSignal, incidentStateQuery } from '../../temporal/shared.js';
import { currentUserId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export const incidentsRouter = Router();

const listQuery = z.object({
  status: z.enum(schema.incidentStatusEnum.enumValues).optional(),
  serviceId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

incidentsRouter.get('/', async (req, res) => {
  const q = listQuery.parse(req.query);
  const filters: SQL[] = [];
  if (q.status) filters.push(eq(schema.incidents.status, q.status));
  if (q.serviceId) filters.push(eq(schema.incidents.serviceId, q.serviceId));
  const rows = await db
    .select()
    .from(schema.incidents)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(schema.incidents.detectedAt))
    .limit(q.limit);
  res.json(rows);
});

async function loadIncident(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) throw new HttpError(404, 'incident_not_found');
  const incident = await db.query.incidents.findFirst({ where: eq(schema.incidents.id, parsed.data) });
  if (!incident) throw new HttpError(404, 'incident_not_found');
  return incident;
}

incidentsRouter.get('/:id', async (req, res) => {
  const incident = await loadIncident(req.params.id);
  const anomalies = await db.select().from(schema.anomalies).where(eq(schema.anomalies.incidentId, incident.id));
  res.json({ ...incident, anomalies });
});

/** Live workflow state via a Temporal Query; works for running and recently closed incidents. */
incidentsRouter.get('/:id/state', async (req, res) => {
  const incident = await loadIncident(req.params.id);
  const client = await getTemporalClient();
  res.json(await client.workflow.getHandle(incident.workflowId).query(incidentStateQuery));
});

incidentsRouter.post('/:id/ack', async (req, res) => {
  const incident = await loadIncident(req.params.id);
  const userId = currentUserId(req);
  const client = await getTemporalClient();
  await client.workflow.getHandle(incident.workflowId).signal(acknowledgeSignal, { userId });
  await db
    .update(schema.incidents)
    .set({ acknowledgedBy: userId, acknowledgedAt: new Date() })
    .where(eq(schema.incidents.id, incident.id));
  res.status(202).json({ ok: true });
});

const feedbackBody = z.object({
  verdict: z.enum(schema.feedbackVerdictEnum.enumValues),
  comment: z.string().max(2000).optional(),
});

incidentsRouter.post('/:id/feedback', async (req, res) => {
  const incident = await loadIncident(req.params.id);
  const body = feedbackBody.parse(req.body);
  await recordFeedback({ incident, userId: currentUserId(req), ...body });
  res.status(201).json({ ok: true });
});
