import { WorkflowNotFoundError } from '@temporalio/client';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import type { Incident } from '../db/schema.js';
import { remember } from '../integrations/supermemory.js';
import { logger } from '../lib/logger.js';
import { getTemporalClient } from '../temporal/client.js';
import { feedbackSignal } from '../temporal/shared.js';

type Verdict = (typeof schema.feedbackVerdictEnum.enumValues)[number];

/**
 * Store feedback from the dashboard or Slack buttons. It is the measured-precision signal,
 * and it feeds memory: "not an incident" becomes a noise pattern, "wrong root cause" marks
 * the proposed fix as rejected so the recommender won't repeat it.
 */
export async function recordFeedback(input: { incident: Incident; userId: string; verdict: Verdict; comment?: string }) {
  const { incident, verdict } = input;
  await db.insert(schema.feedback).values({
    incidentId: incident.id,
    verdict,
    userId: input.userId,
    comment: input.comment,
  });

  try {
    const client = await getTemporalClient();
    await client.workflow.getHandle(incident.workflowId).signal(feedbackSignal, { verdict, userId: input.userId });
  } catch (err) {
    // Most feedback arrives after the incident workflow has completed.
    if (!(err instanceof WorkflowNotFoundError)) logger.warn({ err }, 'feedback signal failed');
  }

  const service = await db.query.services.findFirst({ where: eq(schema.services.id, incident.serviceId) });
  if (!service) return;
  const comment = input.comment ? ` Engineer comment: ${input.comment}` : '';
  const fix = incident.fix as { summary?: string } | null;
  if (verdict === 'not_incident') {
    await remember({
      serviceName: service.name,
      kind: 'noise_pattern',
      id: `feedback-noise-${incident.id}`,
      content: `Engineers marked "${incident.title}" on ${service.name} as not an incident.${comment}`,
      metadata: { incidentId: incident.id },
    });
  } else if (verdict === 'wrong_root_cause') {
    await remember({
      serviceName: service.name,
      kind: 'rejected_fix',
      id: `rejected-${incident.id}`,
      content: `Rejected diagnosis for "${incident.title}": ${JSON.stringify(incident.rootCause)}. Rejected fix: ${fix?.summary ?? 'n/a'}.${comment}`,
      metadata: { incidentId: incident.id },
    });
  } else {
    await remember({
      serviceName: service.name,
      kind: 'feedback',
      id: `confirmed-${incident.id}`,
      content: `Engineers confirmed the diagnosis for "${incident.title}" on ${service.name}.${comment}`,
      metadata: { incidentId: incident.id },
    });
  }
}
