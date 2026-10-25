import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';
import type { Service } from '../db/schema.js';
import { getTemporalClient } from '../temporal/client.js';
import { incidentStateQuery } from '../temporal/shared.js';
import { JarvisLlm } from './llm/jarvis.js';
import { telemetryTools } from './tools/telemetry.js';

/** Answers engineers' questions in the incident's Slack thread, e.g. "why did p99 jump?". */
export function createAskIncidentAgent(service: Service, workflowId: string) {
  const t = telemetryTools(service);
  const incidentState = new FunctionTool({
    name: 'incident_state',
    description:
      'Get the live state of this incident from its workflow: status, anomalies, triage verdict, investigation and verification so far.',
    parameters: z.object({}),
    execute: async () => {
      const client = await getTemporalClient();
      return client.workflow.getHandle(workflowId).query(incidentStateQuery);
    },
  });

  return new LlmAgent({
    name: 'ask_incident',
    model: new JarvisLlm(),
    tools: [incidentState, t.promRange, t.promInstant, t.lokiLogs, t.lokiMetric],
    instruction: `You answer questions from engineers inside the Slack thread of an active incident
on service "${service.name}". Always start by calling incident_state, then use Prometheus and
Loki tools to check the live data before answering. Be brief (Slack-sized), cite the query or
log line behind each claim, and say when the data doesn't support a conclusion.`,
  });
}
