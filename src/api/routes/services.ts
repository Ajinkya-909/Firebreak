import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '../../db/client.js';
import { deleteDetectionSchedule, ensureDetectionSchedule } from '../../temporal/schedules.js';
import { HttpError } from '../middleware/errors.js';

const serviceBody = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'lowercase letters, digits and dashes'),
  promSelector: z.string().min(1),
  lokiSelector: z.string().regex(/^\{.*\}$/, 'must be a LogQL stream selector, e.g. {app="checkout"}'),
  githubRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).nullish(),
  slackChannel: z.string().nullish(),
  sloTarget: z.number().gt(0).lt(1).optional(),
  verifyImage: z.string().nullish(),
  verifyCommand: z.string().nullish(),
  enabled: z.boolean().optional(),
});

export const servicesRouter = Router();

servicesRouter.get('/', async (_req, res) => {
  res.json(await db.select().from(schema.services).orderBy(schema.services.name));
});

servicesRouter.post('/', async (req, res) => {
  const body = serviceBody.parse(req.body);
  const [service] = await db
    .insert(schema.services)
    .values(body)
    .returning()
    .catch((err: { code?: string; cause?: { code?: string } }) => {
      // 23505 = unique_violation on services.name (drizzle wraps the pg error in `cause`)
      if ((err.cause?.code ?? err.code) === '23505') throw new HttpError(409, 'service_exists');
      throw err;
    });
  await ensureDetectionSchedule(service!);
  res.status(201).json(service);
});

servicesRouter.patch('/:id', async (req, res) => {
  const body = serviceBody.partial().omit({ name: true }).parse(req.body);
  const [service] = await db
    .update(schema.services)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(schema.services.id, req.params.id))
    .returning();
  if (!service) throw new HttpError(404, 'service_not_found');
  await ensureDetectionSchedule(service);
  res.json(service);
});

servicesRouter.delete('/:id', async (req, res) => {
  // Soft-disable: incidents reference the service, and history should stay intact.
  const [service] = await db
    .update(schema.services)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(schema.services.id, req.params.id))
    .returning();
  if (!service) throw new HttpError(404, 'service_not_found');
  await deleteDetectionSchedule(service.name);
  res.status(204).end();
});
