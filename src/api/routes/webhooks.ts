import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { db, schema } from '../../db/client.js';
import { getTemporalClient } from '../../temporal/client.js';
import { deployGuardWorkflowId } from '../../temporal/shared.js';
import type { deployGuardWorkflow } from '../../temporal/workflows/deployGuard.js';
import { requireSharedSecret } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export const webhooksRouter = Router();

async function serviceByName(name: string) {
  const service = await db.query.services.findFirst({ where: eq(schema.services.name, name) });
  if (!service) throw new HttpError(404, 'service_not_found');
  return service;
}

const deployBody = z.object({
  service: z.string(),
  sha: z.string().min(7),
  previousSha: z.string().min(7).optional(),
  deployedAt: z.iso.datetime().optional(),
});

/** Called by CI/CD after each deploy; starts the deploy guard for that release. */
webhooksRouter.post('/deploy', requireSharedSecret(env.DEPLOY_WEBHOOK_SECRET), async (req, res) => {
  const body = deployBody.parse(req.body);
  const service = await serviceByName(body.service);
  const [deploy] = await db
    .insert(schema.deploys)
    .values({
      serviceId: service.id,
      sha: body.sha,
      previousSha: body.previousSha,
      deployedAt: body.deployedAt ? new Date(body.deployedAt) : new Date(),
    })
    .returning();

  const workflowId = deployGuardWorkflowId(deploy!.id);
  const client = await getTemporalClient();
  await client.workflow.start<typeof deployGuardWorkflow>('deployGuardWorkflow', {
    workflowId,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    args: [
      {
        deployId: deploy!.id,
        serviceId: service.id,
        sha: deploy!.sha,
        previousSha: deploy!.previousSha,
        deployedAt: deploy!.deployedAt.toISOString(),
      },
    ],
  });
  await db.update(schema.deploys).set({ guardWorkflowId: workflowId }).where(eq(schema.deploys.id, deploy!.id));
  res.status(202).json({ deployId: deploy!.id, workflowId });
});

const chaosBody = z.object({
  id: z.string().describe('Injection id in the chaos lab'),
  service: z.string(),
  label: z.string(),
  faultType: z.string(),
  expectedRootCause: z.string().optional(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().optional(),
});

/**
 * Ground truth from the chaos lab repo: report each injected fault when it starts, and again
 * with `endedAt` when it is removed. Idempotent on `id`.
 */
webhooksRouter.post('/chaos', requireSharedSecret(env.CHAOS_WEBHOOK_SECRET), async (req, res) => {
  const body = chaosBody.parse(req.body);
  const service = await serviceByName(body.service);
  const values = {
    externalId: body.id,
    serviceId: service.id,
    label: body.label,
    faultType: body.faultType,
    expectedRootCause: body.expectedRootCause,
    startedAt: new Date(body.startedAt),
    endedAt: body.endedAt ? new Date(body.endedAt) : null,
  };
  const [row] = await db
    .insert(schema.chaosInjections)
    .values(values)
    .onConflictDoUpdate({ target: schema.chaosInjections.externalId, set: { endedAt: values.endedAt } })
    .returning();
  res.status(202).json(row);
});
