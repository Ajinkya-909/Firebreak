// JSON shapes returned by the Firebreak API (see ../../../src/api/routes and ../../../src/db/schema.ts).
// Timestamps arrive as ISO strings. Keep these in sync with the backend.

export type Severity = 'SEV1' | 'SEV2' | 'SEV3';

export type IncidentStatus =
  | 'triaging'
  | 'noise'
  | 'open'
  | 'investigating'
  | 'verifying'
  | 'awaiting_recovery'
  | 'resolved';

export const ACTIVE_STATUSES: IncidentStatus[] = ['triaging', 'open', 'investigating', 'verifying', 'awaiting_recovery'];

export type SignalSource = 'prometheus' | 'loki' | 'predictive' | 'deploy_guard';
export type FeedbackVerdict = 'correct' | 'wrong_root_cause' | 'not_incident';

export interface Service {
  id: string;
  name: string;
  promSelector: string;
  lokiSelector: string;
  githubRepo: string | null;
  slackChannel: string | null;
  sloTarget: number;
  verifyImage: string | null;
  verifyCommand: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewService = Pick<Service, 'name' | 'promSelector' | 'lokiSelector'> &
  Partial<Pick<Service, 'githubRepo' | 'slackChannel' | 'sloTarget' | 'verifyImage' | 'verifyCommand' | 'enabled'>>;

export interface Evidence {
  kind: 'promql' | 'logql' | 'log_line' | 'commit';
  value: string;
  note?: string;
}

export interface RootCauseHypothesis {
  rank: number;
  cause: string;
  confidence: number;
  evidence: Evidence[];
}

export interface FixProposal {
  summary: string;
  kind: 'code_diff' | 'runbook';
  diff?: string;
  runbookSteps?: string[];
  rollbackSuggestion?: string;
  prevention: string[];
}

export interface VerificationResult {
  status: 'passed' | 'failed' | 'skipped';
  details: string;
  draftPrUrl?: string;
}

export interface TimelineEntry {
  at: string;
  event: string;
}

export interface LlmUsage {
  tokens: number;
  costUsd: number;
}

export interface FinalReport {
  title: string;
  service: string;
  severity: string;
  recovered: boolean;
  impactWindow: { start: string; end: string; minutes: number };
  rootCause: RootCauseHypothesis | null;
  alternatives: RootCauseHypothesis[];
  fix: FixProposal | null;
  verification: VerificationResult | null;
  prevention: string[];
  timeline: TimelineEntry[];
  usage: LlmUsage;
}

export interface Incident {
  id: string;
  fingerprint: string;
  workflowId: string;
  serviceId: string;
  status: IncidentStatus;
  severity: Severity | null;
  confidence: number | null;
  title: string | null;
  summary: string | null;
  suspectedComponent: string | null;
  userImpact: string | null;
  rootCause: RootCauseHypothesis[] | null;
  fix: FixProposal | null;
  finalReport: FinalReport | null;
  slackChannel: string | null;
  slackThreadTs: string | null;
  acknowledgedBy: string | null;
  chaosLabel: string | null;
  tokensUsed: number;
  costUsd: number;
  startedAt: string;
  detectedAt: string;
  initialReportAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface Anomaly {
  id: string;
  serviceId: string;
  incidentId: string | null;
  source: SignalSource;
  signal: string;
  value: number;
  baselineMean: number | null;
  baselineStd: number | null;
  zScore: number | null;
  detail: Record<string, unknown> | null;
  observedAt: string;
}

export type IncidentDetail = Incident & { anomalies: Anomaly[] };

export interface TriageVerdict {
  isIncident: boolean;
  severity: Severity;
  confidence: number;
  title: string;
  summary: string;
  suspectedComponent: string;
  userImpact: string;
  startedAt: string;
  reasoning: string;
}

export interface AnomalyInput {
  anomalyId: string;
  serviceId: string;
  serviceName: string;
  source: SignalSource;
  signal: string;
  value: number;
  baselineMean: number | null;
  baselineStd: number | null;
  zScore: number | null;
  observedAt: string;
  detail?: Record<string, unknown>;
}

/** Live workflow state from GET /api/incidents/:id/state (a Temporal Query). */
export interface IncidentState {
  incidentId: string | null;
  fingerprint: string;
  status: IncidentStatus;
  anomalies: AnomalyInput[];
  verdict: TriageVerdict | null;
  investigation: { rootCauses: RootCauseHypothesis[]; fix: FixProposal } | null;
  verification: VerificationResult | null;
  acknowledgedBy: string | null;
  escalated: boolean;
  slack: { channel: string; threadTs: string } | null;
  usage: LlmUsage;
  budgetExhausted: boolean;
}

export interface Evaluation {
  windowDays: number;
  injections: number;
  incidents: number;
  recall: number | null;
  precision: number | null;
  medianTimeToInitialReportSec: number | null;
  rootCauseAccuracy: number | null;
  perInjection: Array<{ label: string; faultType: string; detected: boolean; incidentId: string | null }>;
}

export interface IncidentFilters {
  status?: IncidentStatus;
  serviceId?: string;
  limit?: number;
}
