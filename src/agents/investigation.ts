import { LlmAgent, ParallelAgent, SequentialAgent } from '@google/adk';
import type { Service } from '../db/schema.js';
import { JarvisLlm } from './llm/jarvis.js';
import { investigationSchema } from './schemas.js';
import { changeTools } from './tools/changes.js';
import { telemetryTools } from './tools/telemetry.js';

const FINDINGS_FORMAT = `Finish with a concise findings section: what you found, the exact queries or log lines
that show it, and timestamps. Say plainly when you found nothing.`;

/**
 * Three investigators run concurrently (metrics, logs, changes), each writing findings to
 * session state. The fix recommender then reads all three plus recalled past incidents and
 * rejected fixes, and produces ranked root causes and a fix.
 */
export function createInvestigationAgent(service: Service) {
  const t = telemetryTools(service);
  const c = changeTools(service);

  const metrics = new LlmAgent({
    name: 'metrics_investigator',
    model: new JarvisLlm(),
    tools: [t.promRange, t.promInstant],
    outputKey: 'metrics_findings',
    instruction: `Investigate the incident on service "${service.name}" using Prometheus.
Incident triage: {triage}

Drill into RED metrics and saturation around the start time: break down by route, status code,
pod/instance and dependency to localize the problem. Compare to an hour before.
${FINDINGS_FORMAT}`,
  });

  const logs = new LlmAgent({
    name: 'logs_investigator',
    model: new JarvisLlm(),
    tools: [t.lokiLogs, t.lokiMetric],
    outputKey: 'logs_findings',
    instruction: `Investigate the incident on service "${service.name}" using Loki logs.
Incident triage: {triage}

Find the first occurrence of new or elevated errors, the dominant exception/stack signatures,
and any upstream/downstream service named in them.
${FINDINGS_FORMAT}`,
  });

  const changes = new LlmAgent({
    name: 'changes_investigator',
    model: new JarvisLlm(),
    tools: [c.recentDeploys, c.recentCommits, c.commitDiff],
    outputKey: 'changes_findings',
    instruction: `Investigate recent changes to service "${service.name}".
Incident triage: {triage}

List deploys and commits shortly before the incident start, read the diffs of the most
suspicious ones, and explain which change (if any) plausibly causes the observed symptoms.
${FINDINGS_FORMAT}`,
  });

  const recommender = new LlmAgent({
    name: 'fix_recommender',
    model: new JarvisLlm(),
    generateContentConfig: { temperature: 0.2 },
    outputSchema: investigationSchema,
    outputKey: 'investigation',
    instruction: `You are the fix recommender for service "${service.name}".

Triage: {triage}

Metrics findings:
{metrics_findings}

Logs findings:
{logs_findings}

Change findings:
{changes_findings}

Similar past incidents and their resolutions:
{past_incidents}

Fixes previously rejected for this service (do not propose these again):
{rejected_fixes}

Produce ranked root-cause hypotheses, each backed by concrete evidence copied from the
findings (queries, log lines, commit SHAs). Then propose one fix: a minimal unified diff
when a code change is clearly implicated, otherwise runbook steps. If a recent deploy is
the cause, include a rollback suggestion. Add prevention items. Reply with JSON only.`,
  });

  return new SequentialAgent({
    name: 'investigation',
    subAgents: [
      new ParallelAgent({ name: 'investigators', subAgents: [metrics, logs, changes] }),
      recommender,
    ],
  });
}
