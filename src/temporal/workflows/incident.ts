import {
  condition,
  log,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from '@temporalio/workflow';
import type * as activities from '../activities/index.js';
import {
  acknowledgeSignal,
  anomalySignal,
  feedbackSignal,
  incidentStateQuery,
  type IncidentState,
  type IncidentWorkflowInput,
  type LlmUsage,
} from '../shared.js';

// Config is passed in from the worker via activity results rather than read from process.env,
// which isn't available inside the workflow sandbox.
const { loadIncidentConfig } = proxyActivities<typeof activities>({ startToCloseTimeout: '10 seconds' });

const db = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 5 },
});

const notify = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 5 },
});

const agents = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '1 minute',
  retry: { maximumAttempts: 3, initialInterval: '5 seconds' },
});

const verify = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  heartbeatTimeout: '2 minutes',
  retry: { maximumAttempts: 2 },
});

// Memory writes improve future triage but must never fail an incident.
const memory = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: { maximumAttempts: 3 },
});

const MAX_TRACKED_ANOMALIES = 50;

/**
 * One incident, from first anomaly to final report. Keyed by `incident-<fingerprint>` so duplicate
 * signals for the same service+signal are delivered here via signal-with-start instead of
 * opening new incidents. The workflow history doubles as the incident timeline.
 */
export async function incidentWorkflow(input: IncidentWorkflowInput): Promise<IncidentState> {
  const config = await loadIncidentConfig();

  const state: IncidentState = {
    incidentId: null,
    fingerprint: input.fingerprint,
    status: 'triaging',
    anomalies: [input.anomaly],
    verdict: null,
    investigation: null,
    verification: null,
    acknowledgedBy: null,
    escalated: false,
    slack: null,
    usage: { tokens: 0, costUsd: 0 },
    budgetExhausted: false,
  };

  setHandler(incidentStateQuery, () => state);
  setHandler(anomalySignal, (anomaly) => {
    // Signal-with-start also delivers the starting anomaly as a signal; skip duplicates.
    if (state.anomalies.some((a) => a.anomalyId === anomaly.anomalyId)) return;
    if (state.anomalies.length < MAX_TRACKED_ANOMALIES) state.anomalies.push(anomaly);
  });
  setHandler(acknowledgeSignal, ({ userId }) => {
    state.acknowledgedBy ??= userId;
  });
  setHandler(feedbackSignal, (fb) => {
    log.info('Feedback received', { ...fb });
  });

  const anomalyIds = () => state.anomalies.map((a) => a.anomalyId);
  const addUsage = (u: LlmUsage) => {
    state.usage.tokens += u.tokens;
    state.usage.costUsd += u.costUsd;
    state.budgetExhausted = state.usage.tokens >= config.tokenBudget;
  };

  const { anomaly } = input;
  state.incidentId = await db.createIncident({
    fingerprint: input.fingerprint,
    workflowId: workflowInfo().workflowId,
    serviceId: anomaly.serviceId,
    anomalyId: anomaly.anomalyId,
    startedAt: anomaly.observedAt,
  });
  const incidentId = state.incidentId;

  // ── 2. Triage ────────────────────────────────────────────────────────────────
  // Give correlated signals a moment to arrive so the agent sees metrics and logs together.
  await sleep('20 seconds');
  const triage = await agents.triageAnomalies({ incidentId, anomalies: state.anomalies });
  addUsage(triage.usage);
  state.verdict = triage.verdict;

  if (!triage.verdict.isIncident) {
    state.status = 'noise';
    await db.updateIncident(incidentId, { status: 'noise', verdict: triage.verdict, usage: state.usage, anomalyIds: anomalyIds() });
    await memory
      .rememberNoise({ incidentId, anomalies: state.anomalies, verdict: triage.verdict })
      .catch((err) => log.warn('Failed to remember noise verdict', { error: String(err) }));
    // Stay open as a sink for the same fingerprint, so a persisting harmless pattern isn't
    // re-triaged (and re-billed) every detection cycle.
    await sleep(config.noiseCooldownMs);
    return state;
  }

  // ── 3. Initial report ────────────────────────────────────────────────────────
  state.status = 'open';
  await db.updateIncident(incidentId, { status: 'open', verdict: triage.verdict, usage: state.usage, anomalyIds: anomalyIds() });
  state.slack = await notify.sendInitialReport({ incidentId, verdict: triage.verdict, anomalies: state.anomalies });

  // Escalate if nobody acknowledges in time. Runs alongside the investigation; if the incident
  // resolves first, the pending timer is simply dropped when the workflow completes.
  void (async () => {
    const acked = await condition(() => state.acknowledgedBy !== null, config.ackEscalationMs);
    if (!acked && triage.verdict.severity !== 'SEV3') {
      state.escalated = true;
      await notify.escalateIncident({ incidentId, verdict: triage.verdict, slack: state.slack });
    }
  })().catch((err) => log.warn('Escalation failed', { error: String(err) }));

  // ── 4. Investigate ───────────────────────────────────────────────────────────
  if (!state.budgetExhausted) {
    state.status = 'investigating';
    await db.updateIncident(incidentId, { status: 'investigating' });
    await notify.postIncidentUpdate({ slack: state.slack, text: ':mag: Investigating: metrics, logs and recent changes in parallel.' });

    const result = await agents.investigateIncident({
      incidentId,
      verdict: triage.verdict,
      anomalies: state.anomalies,
    });
    addUsage(result.usage);
    state.investigation = result.investigation;
    await db.updateIncident(incidentId, { investigation: result.investigation, usage: state.usage });
    await notify.postIncidentUpdate({
      slack: state.slack,
      text: `:dart: Likely root cause: ${result.investigation.rootCauses[0]?.cause ?? 'unknown'}`,
    });

    // ── 5. Verify ──────────────────────────────────────────────────────────────
    state.status = 'verifying';
    await db.updateIncident(incidentId, { status: 'verifying' });
    state.verification = await verify.verifyFix({ incidentId, serviceId: anomaly.serviceId, fix: result.investigation.fix });
    await notify.postIncidentUpdate({
      slack: state.slack,
      text: `:test_tube: Fix verification ${state.verification.status}: ${state.verification.details}`,
    });
  } else {
    await notify.postIncidentUpdate({ slack: state.slack, text: ':money_with_wings: Token budget exhausted; skipping automated investigation.' });
  }

  // ── 6. Wait for recovery: metrics back at baseline for N consecutive minutes ──
  state.status = 'awaiting_recovery';
  await db.updateIncident(incidentId, { status: 'awaiting_recovery' });
  const signals = [...new Set(state.anomalies.map((a) => a.signal))];
  let stableMinutes = 0;
  let waitedMinutes = 0;
  while (stableMinutes < config.recoveryStableMinutes && waitedMinutes < config.maxRecoveryWaitMinutes) {
    const healthy = await db.isServiceAtBaseline({ serviceId: anomaly.serviceId, signals });
    stableMinutes = healthy ? stableMinutes + 1 : 0;
    waitedMinutes++;
    await sleep('1 minute');
  }
  const recovered = stableMinutes >= config.recoveryStableMinutes;

  // ── Final report ─────────────────────────────────────────────────────────────
  state.status = 'resolved';
  const report = await db.buildFinalReport({ incidentId, workflowId: workflowInfo().workflowId, state, recovered });
  await db.updateIncident(incidentId, {
    status: 'resolved',
    finalReport: report,
    usage: state.usage,
    resolved: true,
    anomalyIds: anomalyIds(),
  });
  await notify.sendFinalReport({ incidentId, slack: state.slack, report });
  await memory
    .rememberIncident({ incidentId, report })
    .catch((err) => log.warn('Failed to write incident to memory', { error: String(err) }));
  return state;
}
