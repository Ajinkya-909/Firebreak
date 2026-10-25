// Types, signals and queries shared by workflows, activities and the API.
// This file is imported by workflow code, so it must stay deterministic: no Node APIs, no I/O.
import { defineQuery, defineSignal } from '@temporalio/workflow';

export type Severity = 'SEV1' | 'SEV2' | 'SEV3';
export type SignalSource = 'prometheus' | 'loki' | 'predictive' | 'deploy_guard';

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
  observedAt: string; // ISO
  detail?: Record<string, unknown>;
}

export interface TriageVerdict {
  isIncident: boolean;
  severity: Severity;
  confidence: number; // 0..1
  title: string;
  summary: string;
  suspectedComponent: string;
  userImpact: string;
  startedAt: string; // ISO, best estimate of when the problem began
  reasoning: string;
}

export interface RootCauseHypothesis {
  rank: number;
  cause: string;
  confidence: number;
  evidence: Array<{ kind: 'promql' | 'logql' | 'log_line' | 'commit'; value: string; note?: string }>;
}

export interface FixProposal {
  summary: string;
  kind: 'code_diff' | 'runbook';
  diff?: string; // unified diff, applies to the service repo root
  runbookSteps?: string[];
  rollbackSuggestion?: string;
  prevention: string[];
}

export interface Investigation {
  rootCauses: RootCauseHypothesis[];
  fix: FixProposal;
}

export interface VerificationResult {
  status: 'passed' | 'failed' | 'skipped';
  details: string;
  draftPrUrl?: string;
}

export interface LlmUsage {
  tokens: number;
  costUsd: number;
}

export type IncidentStatus =
  | 'triaging'
  | 'noise'
  | 'open'
  | 'investigating'
  | 'verifying'
  | 'awaiting_recovery'
  | 'resolved';

export interface IncidentState {
  incidentId: string | null;
  fingerprint: string;
  status: IncidentStatus;
  anomalies: AnomalyInput[];
  verdict: TriageVerdict | null;
  investigation: Investigation | null;
  verification: VerificationResult | null;
  acknowledgedBy: string | null;
  escalated: boolean;
  slack: { channel: string; threadTs: string } | null;
  usage: LlmUsage;
  budgetExhausted: boolean;
}

export interface IncidentWorkflowInput {
  fingerprint: string;
  anomaly: AnomalyInput;
}

export interface DeployGuardInput {
  deployId: string;
  serviceId: string;
  sha: string;
  previousSha: string | null;
  deployedAt: string; // ISO
}

/** New anomaly with the same fingerprint as a running incident. */
export const anomalySignal = defineSignal<[AnomalyInput]>('anomaly');
export const acknowledgeSignal = defineSignal<[{ userId: string }]>('acknowledge');
export const feedbackSignal = defineSignal<[{ verdict: 'correct' | 'wrong_root_cause' | 'not_incident'; userId: string }]>(
  'feedback',
);

export const incidentStateQuery = defineQuery<IncidentState>('incidentState');

export const incidentWorkflowId = (fingerprint: string) => `incident-${fingerprint}`;
export const detectionScheduleId = (serviceName: string) => `detect-${serviceName}`;
export const deployGuardWorkflowId = (deployId: string) => `deploy-guard-${deployId}`;
