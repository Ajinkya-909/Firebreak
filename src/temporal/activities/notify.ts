import type { KnownBlock } from '@slack/web-api';
import { and, eq, gte } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db, schema } from '../../db/client.js';
import { resolvePage, triggerPage } from '../../integrations/pagerduty.js';
import { postMessage } from '../../integrations/slack.js';
import { logger } from '../../lib/logger.js';
import type { AnomalyInput, TriageVerdict } from '../shared.js';
import { getService } from './detection.js';
import { recordSlackThread, type FinalReport } from './incidents.js';

type SlackRef = { channel: string; threadTs: string } | null;

function feedbackButtons(incidentId: string): KnownBlock {
  return {
    type: 'actions',
    block_id: `feedback:${incidentId}`,
    elements: [
      { type: 'button', text: { type: 'plain_text', text: 'Correct' }, value: 'correct', action_id: 'feedback_correct' },
      { type: 'button', text: { type: 'plain_text', text: 'Wrong root cause' }, value: 'wrong_root_cause', action_id: 'feedback_wrong_root_cause' },
      { type: 'button', text: { type: 'plain_text', text: 'Not an incident' }, value: 'not_incident', action_id: 'feedback_not_incident' },
    ],
  };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * First notification, within ~2 minutes of detection. Routing by severity:
 * SEV1 pages and posts to Slack, SEV2 posts to Slack, SEV3 waits for the daily digest.
 */
export async function sendInitialReport(input: {
  incidentId: string;
  verdict: TriageVerdict;
  anomalies: AnomalyInput[];
}): Promise<SlackRef> {
  const { verdict, incidentId } = input;
  const service = await getService(input.anomalies[0]!.serviceId);

  if (verdict.severity === 'SEV1') {
    await triggerPage({
      dedupKey: incidentId,
      summary: `[${service.name}] ${verdict.title}`,
      source: service.name,
      severity: 'critical',
      details: { summary: verdict.summary, userImpact: verdict.userImpact, confidence: verdict.confidence },
    });
  }
  if (verdict.severity === 'SEV3') return null;

  const channel = service.slackChannel ?? env.SLACK_DEFAULT_CHANNEL;
  if (!channel) {
    logger.warn({ incidentId }, 'no Slack channel configured; skipping initial report');
    return null;
  }

  const signals = input.anomalies
    .map((a) => `• \`${a.signal}\` = ${a.value.toPrecision(4)}${a.zScore !== null ? ` (z=${a.zScore.toFixed(1)})` : ''}`)
    .join('\n');
  const text = `:rotating_light: ${verdict.severity} ${service.name}: ${verdict.title}`;
  const blocks: KnownBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: `${verdict.severity} · ${service.name}: ${verdict.title}`.slice(0, 150) } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Since*\n<!date^${Math.floor(new Date(verdict.startedAt).getTime() / 1000)}^{time}|${verdict.startedAt}>` },
        { type: 'mrkdwn', text: `*Confidence*\n${pct(verdict.confidence)}` },
        { type: 'mrkdwn', text: `*Suspected component*\n${verdict.suspectedComponent}` },
        { type: 'mrkdwn', text: `*User impact*\n${verdict.userImpact}` },
      ],
    },
    { type: 'section', text: { type: 'mrkdwn', text: `${verdict.summary}\n\n*Signals*\n${signals}` } },
    {
      type: 'actions',
      block_id: `ack:${incidentId}`,
      elements: [{ type: 'button', style: 'primary', text: { type: 'plain_text', text: 'Acknowledge' }, value: incidentId, action_id: 'acknowledge' }],
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'Ask questions in this thread, e.g. "why did p99 jump?"' }] },
  ];

  const posted = await postMessage(channel, text, blocks);
  if (!posted) return null;
  await recordSlackThread({ incidentId, channel: posted.channel, threadTs: posted.ts });
  return { channel: posted.channel, threadTs: posted.ts };
}

/** Investigation progress goes into the incident thread rather than new top-level messages. */
export async function postIncidentUpdate(input: { slack: SlackRef; text: string }): Promise<void> {
  if (!input.slack) return;
  await postMessage(input.slack.channel, input.text, undefined, input.slack.threadTs);
}

export async function escalateIncident(input: { incidentId: string; verdict: TriageVerdict; slack: SlackRef }): Promise<void> {
  await triggerPage({
    dedupKey: input.incidentId,
    summary: `[unacknowledged] ${input.verdict.title}`,
    source: 'firebreak',
    severity: input.verdict.severity === 'SEV1' ? 'critical' : 'error',
  });
  await postIncidentUpdate({
    slack: input.slack,
    text: `:warning: No acknowledgement after ${env.ACK_ESCALATION_MINUTES} minutes. Escalated to on-call.`,
  });
}

function renderFinalReport(r: FinalReport): string {
  const evidence = (r.rootCause?.evidence ?? []).map((e) => `• _${e.kind}_ \`${e.value}\`${e.note ? ` — ${e.note}` : ''}`).join('\n');
  const fix = r.fix
    ? r.fix.kind === 'code_diff'
      ? `${r.fix.summary}\n\`\`\`${(r.fix.diff ?? '').slice(0, 2500)}\`\`\``
      : `${r.fix.summary}\n${(r.fix.runbookSteps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '_No fix proposed._';
  const verification = r.verification
    ? `${r.verification.status}: ${r.verification.details}${r.verification.draftPrUrl ? `\nDraft PR: ${r.verification.draftPrUrl}` : ''}`
    : 'not run';
  return [
    `*:white_check_mark: Final report: ${r.title}* (${r.severity}, ${r.service})`,
    r.recovered ? '' : ':warning: Metrics did not return to baseline within the wait window.',
    `*Impact window:* ${r.impactWindow.start} → ${r.impactWindow.end} (${r.impactWindow.minutes} min)`,
    `*Root cause:* ${r.rootCause?.cause ?? 'undetermined'}${r.rootCause ? ` (confidence ${pct(r.rootCause.confidence)})` : ''}`,
    evidence && `*Evidence*\n${evidence}`,
    `*Fix*\n${fix}`,
    `*Verification:* ${verification}`,
    r.prevention.length ? `*Prevention*\n${r.prevention.map((p) => `• ${p}`).join('\n')}` : '',
    `_LLM usage: ${r.usage.tokens.toLocaleString()} tokens, $${r.usage.costUsd.toFixed(4)}_`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Second notification: fix ready and metrics stable at baseline. */
export async function sendFinalReport(input: { incidentId: string; slack: SlackRef; report: FinalReport }): Promise<void> {
  const text = renderFinalReport(input.report);
  if (input.slack) {
    await postMessage(
      input.slack.channel,
      text,
      [{ type: 'section', text: { type: 'mrkdwn', text: text.slice(0, 2900) } }, feedbackButtons(input.incidentId)],
      input.slack.threadTs,
    );
  }
  // Close the page (if one was opened at SEV1 or on escalation) now that the incident is over.
  await resolvePage(input.incidentId);
}

export async function sendSev3Digest(input: { sinceHours: number }): Promise<void> {
  const channel = env.SLACK_DEFAULT_CHANNEL;
  if (!channel) return;
  const since = new Date(Date.now() - input.sinceHours * 3600_000);
  const rows = await db
    .select({ title: schema.incidents.title, status: schema.incidents.status, service: schema.services.name, detectedAt: schema.incidents.detectedAt })
    .from(schema.incidents)
    .innerJoin(schema.services, eq(schema.incidents.serviceId, schema.services.id))
    .where(and(eq(schema.incidents.severity, 'SEV3'), gte(schema.incidents.detectedAt, since)));
  if (rows.length === 0) return;
  const lines = rows.map((r) => `• *${r.service}*: ${r.title} (${r.status})`).join('\n');
  await postMessage(channel, `:clipboard: SEV3 digest, last ${input.sinceHours}h (${rows.length})\n${lines}`);
}
