import { z } from 'zod';

// Structured outputs for the agents. Kept in sync with the types in temporal/shared.ts.

export const triageVerdictSchema = z.object({
  isIncident: z.boolean().describe('false when the anomalies are expected or harmless'),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3']),
  confidence: z.number().min(0).max(1),
  title: z.string().describe('Short headline, under 80 characters'),
  summary: z.string().describe('Two or three sentences: what is happening and why it matters'),
  suspectedComponent: z.string(),
  userImpact: z.string().describe('Estimated user-facing impact, e.g. "~4% of checkouts failing"'),
  startedAt: z.string().describe('ISO timestamp of the best estimate of when the problem began'),
  reasoning: z.string().describe('How the signals were correlated and which memories were relevant'),
});

const evidenceSchema = z.object({
  kind: z.enum(['promql', 'logql', 'log_line', 'commit']),
  value: z.string().describe('The exact query, log line or commit SHA'),
  note: z.string().optional(),
});

export const investigationSchema = z.object({
  rootCauses: z
    .array(
      z.object({
        rank: z.number().int().min(1),
        cause: z.string(),
        confidence: z.number().min(0).max(1),
        evidence: z.array(evidenceSchema),
      }),
    )
    .min(1)
    .describe('Ranked hypotheses, most likely first'),
  fix: z.object({
    summary: z.string(),
    kind: z.enum(['code_diff', 'runbook']),
    diff: z.string().optional().describe('Unified diff against the repo root, when kind is code_diff'),
    runbookSteps: z.array(z.string()).optional(),
    rollbackSuggestion: z.string().optional(),
    prevention: z.array(z.string()).describe('Follow-ups that stop this class of incident recurring'),
  }),
});
