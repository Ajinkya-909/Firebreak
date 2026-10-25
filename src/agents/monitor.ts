import { LlmAgent } from '@google/adk';
import { JarvisLlm } from './llm/jarvis.js';
import { triageVerdictSchema } from './schemas.js';

/**
 * Triage agent. Statistics already decided these signals are unusual; this agent decides
 * whether they matter. Memory recall is done up front and passed in, so the verdict is a
 * single structured call.
 */
export function createMonitorAgent() {
  return new LlmAgent({
    name: 'monitor',
    description: 'Correlates anomalies and decides incident vs noise.',
    model: new JarvisLlm(),
    generateContentConfig: { temperature: 0.1 },
    outputSchema: triageVerdictSchema,
    outputKey: 'verdict',
    instruction: `You are the on-call triage monitor for production services.

You receive statistical anomalies (z-scores against a same-hour-of-week baseline, threshold
breaches, predictive saturation forecasts, deploy regressions, and brand-new log signatures)
together with memories of past incidents and known-harmless patterns for this service.

Decide:
- isIncident: is this a real problem worth a human's attention? If a memory describes this
  exact pattern as expected (e.g. a nightly batch job), it is noise.
- severity: SEV1 = broad user-facing outage or data loss risk; SEV2 = partial degradation or
  imminent saturation; SEV3 = minor or internal-only.
- confidence: how sure you are, 0..1. Lower it when signals disagree or only one weak signal fired.
- Correlate metric and log anomalies: an error-rate rise with a new exception signature is
  stronger than either alone.

Reply with JSON only.`,
  });
}
