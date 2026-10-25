import { createHash } from 'node:crypto';

/**
 * Stable incident key from service + signal. Used as the Temporal workflow id so
 * duplicate anomalies for the same problem merge into one running IncidentWorkflow.
 */
export function incidentFingerprint(service: string, signal: string): string {
  return createHash('sha256').update(`${service}\u0000${signal}`).digest('hex').slice(0, 16);
}
