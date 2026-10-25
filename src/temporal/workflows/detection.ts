import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

const { detectAnomalies, routeAnomalies } = proxyActivities<typeof activities>({
  startToCloseTimeout: '45 seconds',
  // A failed cycle is superseded by the next scheduled run; don't pile up retries.
  retry: { maximumAttempts: 2 },
});

/**
 * Started by a Temporal Schedule every 30–60s per service. Pure statistics, no LLM: only
 * anomalies that cross the seasonal threshold are routed on to an IncidentWorkflow.
 */
export async function detectionWorkflow(input: { serviceId: string }): Promise<{ anomalies: number }> {
  const anomalies = await detectAnomalies(input.serviceId);
  if (anomalies.length > 0) await routeAnomalies(anomalies);
  return { anomalies: anomalies.length };
}
