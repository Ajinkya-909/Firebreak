import { ScheduleAlreadyRunning, ScheduleNotFoundError, ScheduleOverlapPolicy, type ScheduleOptions } from '@temporalio/client';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db, schema } from '../db/client.js';
import type { Service } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import { getTemporalClient } from './client.js';
import { detectionScheduleId } from './shared.js';

const DIGEST_SCHEDULE_ID = 'sev3-digest';

async function upsertSchedule(options: ScheduleOptions): Promise<void> {
  const client = await getTemporalClient();
  try {
    await client.schedule.create(options);
  } catch (err) {
    if (!(err instanceof ScheduleAlreadyRunning)) throw err;
    await client.schedule.getHandle(options.scheduleId).update((prev) => ({
      ...prev,
      spec: options.spec,
      action: options.action,
      policies: { ...prev.policies, ...options.policies },
      state: { ...prev.state, paused: options.state?.paused ?? false },
    }));
  }
}

/** One detection schedule per service. SKIP overlap so a slow cycle never stacks up behind itself. */
export async function ensureDetectionSchedule(service: Service): Promise<void> {
  await upsertSchedule({
    scheduleId: detectionScheduleId(service.name),
    spec: { intervals: [{ every: `${env.DETECTION_INTERVAL_SECONDS}s` }] },
    action: {
      type: 'startWorkflow',
      workflowType: 'detectionWorkflow',
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      args: [{ serviceId: service.id }],
      workflowRunTimeout: '2 minutes',
    },
    policies: { overlap: ScheduleOverlapPolicy.SKIP, catchupWindow: '1 minute' },
    state: { paused: !service.enabled, note: `Firebreak detection for ${service.name}` },
  });
}

export async function deleteDetectionSchedule(serviceName: string): Promise<void> {
  const client = await getTemporalClient();
  try {
    await client.schedule.getHandle(detectionScheduleId(serviceName)).delete();
  } catch (err) {
    if (!(err instanceof ScheduleNotFoundError)) throw err;
  }
}

export async function ensureDigestSchedule(): Promise<void> {
  await upsertSchedule({
    scheduleId: DIGEST_SCHEDULE_ID,
    spec: { calendars: [{ hour: 9, minute: 0 }] },
    action: { type: 'startWorkflow', workflowType: 'digestWorkflow', taskQueue: env.TEMPORAL_TASK_QUEUE, args: [] },
    policies: { overlap: ScheduleOverlapPolicy.SKIP },
  });
}

/** Reconcile Temporal schedules with the services table. Run on worker start and after service edits. */
export async function syncAllSchedules(): Promise<void> {
  const services = await db.select().from(schema.services);
  for (const service of services) await ensureDetectionSchedule(service);
  await ensureDigestSchedule();
  logger.info({ services: services.length }, 'schedules synced');
}

export async function syncScheduleForService(serviceId: string): Promise<void> {
  const service = await db.query.services.findFirst({ where: eq(schema.services.id, serviceId) });
  if (service) await ensureDetectionSchedule(service);
}
