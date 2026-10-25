import { heartbeat, cancellationSignal } from '@temporalio/activity';
import { createInvestigationAgent } from '../../agents/investigation.js';
import { createMonitorAgent } from '../../agents/monitor.js';
import { runAgent } from '../../agents/run.js';
import { investigationSchema, triageVerdictSchema } from '../../agents/schemas.js';
import { recall, remember } from '../../integrations/supermemory.js';
import { logger } from '../../lib/logger.js';
import type { AnomalyInput, Investigation, LlmUsage, TriageVerdict } from '../shared.js';
import { getService } from './detection.js';
import type { FinalReport } from './incidents.js';

function describeAnomalies(anomalies: AnomalyInput[]): string {
  return anomalies
    .map((a) =>
      JSON.stringify({
        source: a.source,
        signal: a.signal,
        value: a.value,
        baselineMean: a.baselineMean,
        zScore: a.zScore,
        observedAt: a.observedAt,
        detail: a.detail,
      }),
    )
    .join('\n');
}

async function safeRecall(...args: Parameters<typeof recall>): Promise<string> {
  try {
    const hits = await recall(...args);
    return hits.length ? hits.map((h) => `- (${h.similarity.toFixed(2)}) ${h.text}`).join('\n') : 'none';
  } catch (err) {
    // Memory is an enhancement; triage must still work if Supermemory is down.
    logger.warn({ err }, 'supermemory recall failed');
    return 'unavailable';
  }
}

export async function triageAnomalies(input: {
  incidentId: string;
  anomalies: AnomalyInput[];
}): Promise<{ verdict: TriageVerdict; usage: LlmUsage }> {
  const service = await getService(input.anomalies[0]!.serviceId);
  const signals = [...new Set(input.anomalies.map((a) => a.signal))].join(', ');

  const memories = await safeRecall({
    serviceName: service.name,
    query: `${signals} anomaly on ${service.name}`,
    kinds: ['noise_pattern', 'incident_report', 'feedback'],
    limit: 8,
  });

  const run = await runAgent(createMonitorAgent(), {
    prompt: `Service: ${service.name}
Current time: ${new Date().toISOString()}

Anomalies:
${describeAnomalies(input.anomalies)}

Relevant memories (similarity in parentheses):
${memories}`,
    abortSignal: cancellationSignal(),
  });

  return { verdict: triageVerdictSchema.parse(run.state.verdict), usage: run.usage };
}

export async function investigateIncident(input: {
  incidentId: string;
  verdict: TriageVerdict;
  anomalies: AnomalyInput[];
}): Promise<{ investigation: Investigation; usage: LlmUsage }> {
  const service = await getService(input.anomalies[0]!.serviceId);
  const query = `${input.verdict.title}. ${input.verdict.summary}`;
  const [pastIncidents, rejectedFixes] = await Promise.all([
    safeRecall({ serviceName: service.name, query, kinds: ['incident_report'], limit: 5 }),
    safeRecall({ serviceName: service.name, query, kinds: ['rejected_fix'], limit: 5 }),
  ]);

  const run = await runAgent(createInvestigationAgent(service), {
    prompt: 'Investigate this incident and recommend a fix.',
    state: {
      triage: JSON.stringify({ ...input.verdict, anomalies: describeAnomalies(input.anomalies) }),
      past_incidents: pastIncidents,
      rejected_fixes: rejectedFixes,
    },
    // Each agent event is progress; keeps the activity alive under its heartbeat timeout.
    onEvent: (e) => heartbeat({ author: e.author }),
    abortSignal: cancellationSignal(),
  });

  return { investigation: investigationSchema.parse(run.state.investigation), usage: run.usage };
}

export async function rememberNoise(input: {
  incidentId: string;
  anomalies: AnomalyInput[];
  verdict: TriageVerdict;
}): Promise<void> {
  const service = await getService(input.anomalies[0]!.serviceId);
  const at = new Date(input.anomalies[0]!.observedAt);
  await remember({
    serviceName: service.name,
    kind: 'noise_pattern',
    id: `noise-${input.incidentId}`,
    content:
      `Not an incident on ${service.name}: ${input.verdict.title}. Signals: ${input.anomalies.map((a) => a.signal).join(', ')}. ` +
      `Observed ${at.toUTCString()} (weekday ${at.getUTCDay()}, hour ${at.getUTCHours()} UTC). Reasoning: ${input.verdict.reasoning}`,
    metadata: { incidentId: input.incidentId, signals: input.anomalies.map((a) => a.signal) },
  });
}

/** Closes the learning loop: the final report becomes context for future triage and fixes. */
export async function rememberIncident(input: { incidentId: string; report: FinalReport }): Promise<void> {
  const r = input.report;
  await remember({
    serviceName: r.service,
    kind: 'incident_report',
    id: `incident-${input.incidentId}`,
    content: [
      `${r.severity} incident on ${r.service}: ${r.title}`,
      `Impact: ${r.impactWindow.minutes} minutes from ${r.impactWindow.start}.`,
      `Root cause: ${r.rootCause?.cause ?? 'undetermined'}`,
      `Evidence: ${(r.rootCause?.evidence ?? []).map((e) => e.value).join(' | ')}`,
      `Fix: ${r.fix?.summary ?? 'none'} (verification ${r.verification?.status ?? 'not run'})`,
      `Prevention: ${r.prevention.join('; ')}`,
    ].join('\n'),
    metadata: { incidentId: input.incidentId, severity: r.severity, recovered: r.recovered },
  });
}
