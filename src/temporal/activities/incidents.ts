import { tsToDate } from '@temporalio/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db, schema } from '../../db/client.js';
import { getTemporalClient } from '../client.js';
import type { IncidentState, Investigation, LlmUsage, TriageVerdict } from '../shared.js';

export interface IncidentConfig {
  tokenBudget: number;
  ackEscalationMs: number;
  recoveryStableMinutes: number;
  maxRecoveryWaitMinutes: number;
  guardMinutes: number;
  noiseCooldownMs: number;
}

export async function loadIncidentConfig(): Promise<IncidentConfig> {
  return {
    tokenBudget: env.INCIDENT_TOKEN_BUDGET,
    ackEscalationMs: env.ACK_ESCALATION_MINUTES * 60_000,
    recoveryStableMinutes: env.RECOVERY_STABLE_MINUTES,
    maxRecoveryWaitMinutes: 6 * 60,
    guardMinutes: env.DEPLOY_GUARD_MINUTES,
    noiseCooldownMs: env.NOISE_COOLDOWN_MINUTES * 60_000,
  };
}

export async function createIncident(input: {
  fingerprint: string;
  workflowId: string;
  serviceId: string;
  anomalyId: string;
  startedAt: string;
}): Promise<string> {
  // Idempotent on workflowId so an activity retry doesn't create a second row.
  const [row] = await db
    .insert(schema.incidents)
    .values({
      fingerprint: input.fingerprint,
      workflowId: input.workflowId,
      serviceId: input.serviceId,
      startedAt: new Date(input.startedAt),
    })
    .onConflictDoUpdate({ target: schema.incidents.workflowId, set: { fingerprint: input.fingerprint } })
    .returning({ id: schema.incidents.id });
  await db.update(schema.anomalies).set({ incidentId: row!.id }).where(eq(schema.anomalies.id, input.anomalyId));
  return row!.id;
}

export async function updateIncident(
  incidentId: string,
  patch: {
    status?: IncidentState['status'];
    verdict?: TriageVerdict;
    investigation?: Investigation;
    finalReport?: FinalReport;
    usage?: LlmUsage;
    resolved?: boolean;
    // Anomalies merged into this incident via signals.
    anomalyIds?: string[];
  },
): Promise<void> {
  const { verdict, investigation, usage } = patch;
  if (patch.anomalyIds?.length) {
    await db
      .update(schema.anomalies)
      .set({ incidentId })
      .where(and(inArray(schema.anomalies.id, patch.anomalyIds), isNull(schema.anomalies.incidentId)));
  }
  await db
    .update(schema.incidents)
    .set({
      ...(patch.status && { status: patch.status }),
      ...(verdict && {
        severity: verdict.severity,
        confidence: verdict.confidence,
        title: verdict.title,
        summary: verdict.summary,
        suspectedComponent: verdict.suspectedComponent,
        userImpact: verdict.userImpact,
        // LLM-provided; keep the detection time if it isn't a parseable timestamp.
        ...(!Number.isNaN(Date.parse(verdict.startedAt)) && { startedAt: new Date(verdict.startedAt) }),
      }),
      ...(investigation && { rootCause: investigation.rootCauses, fix: investigation.fix }),
      ...(patch.finalReport && { finalReport: patch.finalReport }),
      ...(usage && { tokensUsed: usage.tokens, costUsd: usage.costUsd }),
      ...(patch.resolved && { resolvedAt: new Date() }),
    })
    .where(eq(schema.incidents.id, incidentId));
}

export async function recordSlackThread(input: { incidentId: string; channel: string; threadTs: string }): Promise<void> {
  await db
    .update(schema.incidents)
    .set({ slackChannel: input.channel, slackThreadTs: input.threadTs, initialReportAt: new Date() })
    .where(eq(schema.incidents.id, input.incidentId));
}

export interface TimelineEntry {
  at: string;
  event: string;
}

export interface FinalReport {
  title: string;
  service: string;
  severity: string;
  recovered: boolean;
  impactWindow: { start: string; end: string; minutes: number };
  rootCause: Investigation['rootCauses'][number] | null;
  alternatives: Investigation['rootCauses'];
  fix: Investigation['fix'] | null;
  verification: IncidentState['verification'];
  prevention: string[];
  timeline: TimelineEntry[];
  usage: LlmUsage;
}

/**
 * The workflow history is already a complete, ordered audit log of the incident, so the
 * timeline is derived from it rather than tracked separately.
 */
async function timelineFromHistory(workflowId: string): Promise<TimelineEntry[]> {
  const client = await getTemporalClient();
  const history = await client.workflow.getHandle(workflowId).fetchHistory();
  const entries: TimelineEntry[] = [];
  for (const e of history.events ?? []) {
    if (!e.eventTime) continue;
    const at = tsToDate(e.eventTime).toISOString();
    if (e.workflowExecutionStartedEventAttributes) entries.push({ at, event: 'Incident opened' });
    else if (e.activityTaskScheduledEventAttributes?.activityType?.name)
      entries.push({ at, event: `Started ${e.activityTaskScheduledEventAttributes.activityType.name}` });
    else if (e.activityTaskFailedEventAttributes)
      entries.push({ at, event: `Activity failed: ${e.activityTaskFailedEventAttributes.failure?.message ?? 'unknown'}` });
    else if (e.workflowExecutionSignaledEventAttributes?.signalName)
      entries.push({ at, event: `Signal: ${e.workflowExecutionSignaledEventAttributes.signalName}` });
  }
  return entries;
}

export async function buildFinalReport(input: {
  incidentId: string;
  workflowId: string;
  state: IncidentState;
  recovered: boolean;
}): Promise<FinalReport> {
  const incident = await db.query.incidents.findFirst({ where: eq(schema.incidents.id, input.incidentId) });
  const service = incident && (await db.query.services.findFirst({ where: eq(schema.services.id, incident.serviceId) }));
  const { state } = input;
  const start = incident?.startedAt ?? new Date(state.anomalies[0]?.observedAt ?? Date.now());
  const end = new Date();
  const [top, ...alternatives] = state.investigation?.rootCauses ?? [];

  return {
    title: state.verdict?.title ?? 'Incident',
    service: service?.name ?? 'unknown',
    severity: state.verdict?.severity ?? 'SEV3',
    recovered: input.recovered,
    impactWindow: {
      start: start.toISOString(),
      end: end.toISOString(),
      minutes: Math.round((end.getTime() - start.getTime()) / 60_000),
    },
    rootCause: top ?? null,
    alternatives,
    fix: state.investigation?.fix ?? null,
    verification: state.verification,
    prevention: state.investigation?.fix.prevention ?? [],
    timeline: await timelineFromHistory(input.workflowId),
    usage: state.usage,
  };
}
