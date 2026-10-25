import {
  ArrowLeft,
  BellRing,
  Check,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  VolumeX,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { isActive, useAcknowledge, useFeedback, useIncident, useIncidentState, useServices } from '../api/hooks';
import type { Anomaly, Evidence, FeedbackVerdict, FixProposal, IncidentDetail as Detail, IncidentState, TimelineEntry, VerificationResult } from '../api/types';
import { Button, Card, CardHeader, Code, cx, EmptyState, ErrorState, SeverityBadge, Skeleton, StatusBadge } from '../components/ui';
import { formatDateTime, formatDuration, formatSignalValue, formatTime, formatUsd, humanize, pct, timeAgo } from '../lib/format';

const STAGES = ['triaging', 'open', 'investigating', 'verifying', 'awaiting_recovery', 'resolved'] as const;
const STAGE_LABEL: Record<(typeof STAGES)[number], string> = {
  triaging: 'Triage',
  open: 'Initial report',
  investigating: 'Investigate',
  verifying: 'Verify',
  awaiting_recovery: 'Recovery',
  resolved: 'Final report',
};

function Progress({ status }: { status: Detail['status'] }) {
  if (status === 'noise') return null;
  const current = STAGES.indexOf(status);
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Incident progress">
      {STAGES.map((stage, i) => {
        const done = i < current || status === 'resolved';
        const now = i === current && status !== 'resolved';
        return (
          <li key={stage} aria-current={now ? 'step' : undefined}>
            <div className={cx('h-1 rounded-full', done ? 'bg-good' : now ? 'bg-accent' : 'bg-surface-3')} />
            <p className={cx('mt-1.5 text-[11px] font-medium', done || now ? 'text-ink' : 'text-muted')}>
              {done && <Check className="mr-0.5 inline size-3 text-good" aria-label="done" />}
              {STAGE_LABEL[stage]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-accent-wash" role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-xs font-medium text-ink tabular">{pct(value)}</span>
    </div>
  );
}

const EVIDENCE_LABEL: Record<Evidence['kind'], string> = { promql: 'PromQL', logql: 'LogQL', log_line: 'Log line', commit: 'Commit' };

function RootCause({ incident }: { incident: Detail }) {
  if (!incident.rootCause?.length) {
    return (
      <EmptyState title={incident.status === 'noise' ? 'Not investigated' : 'Investigation in progress'}>
        {incident.status === 'noise'
          ? 'Triage judged this harmless, so no investigation ran.'
          : 'Three investigators (metrics, logs, recent changes) are running in parallel. Ranked root causes appear here.'}
      </EmptyState>
    );
  }
  return (
    <ol className="divide-y divide-line">
      {incident.rootCause.map((h) => (
        <li key={h.rank} className="px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className={cx('min-w-0 flex-1 text-sm', h.rank === 1 ? 'font-semibold text-ink' : 'text-ink-2')}>
              <span className="mr-2 text-muted tabular">#{h.rank}</span>
              {h.cause}
            </p>
            <Meter value={h.confidence} label={`Confidence for hypothesis ${h.rank}`} />
          </div>
          <ul className="mt-3 space-y-2">
            {h.evidence.map((e, i) => (
              <li key={i} className="text-xs">
                <span className="mr-2 inline-block w-16 font-medium text-muted">{EVIDENCE_LABEL[e.kind]}</span>
                <Code>{e.value}</Code>
                {e.note && <span className="ml-2 text-ink-2">{e.note}</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-code py-2 font-mono text-xs leading-5">
      {diff.split('\n').map((line, i) => (
        <span
          key={i}
          className={cx(
            'block px-3',
            line.startsWith('+') && !line.startsWith('+++') && 'bg-[color-mix(in_oklab,var(--good)_14%,transparent)]',
            line.startsWith('-') && !line.startsWith('---') && 'bg-[color-mix(in_oklab,var(--critical)_14%,transparent)]',
            line.startsWith('@@') && 'text-muted',
          )}
        >
          {line || ' '}
        </span>
      ))}
    </pre>
  );
}

const VERIFY: Record<VerificationResult['status'], { icon: LucideIcon; tone: string; label: string }> = {
  passed: { icon: CheckCircle2, tone: 'text-good', label: 'Verification passed' },
  failed: { icon: XCircle, tone: 'text-critical', label: 'Verification failed' },
  skipped: { icon: Undo2, tone: 'text-muted', label: 'Verification skipped' },
};

function Fix({ fix, verification }: { fix: FixProposal; verification: VerificationResult | null }) {
  const v = verification && VERIFY[verification.status];
  return (
    <div className="space-y-4 p-5">
      <p className="text-sm font-medium text-ink">{fix.summary}</p>
      {fix.kind === 'code_diff' && fix.diff ? (
        <DiffView diff={fix.diff} />
      ) : (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2 marker:text-muted">
          {fix.runbookSteps?.map((s, i) => (
            <li key={i}>
              <Code>{s}</Code>
            </li>
          ))}
        </ol>
      )}
      {fix.rollbackSuggestion && (
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">Rollback option: </span>
          {fix.rollbackSuggestion}
        </p>
      )}
      {v && verification && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
          <v.icon className={cx('mt-0.5 size-4 shrink-0', v.tone)} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{v.label}</p>
            <p className="text-ink-2">{verification.details.replaceAll('`', '')}</p>
          </div>
          {verification.draftPrUrl && (
            <a href={verification.draftPrUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline">
              <GitPullRequest className="size-3.5" aria-hidden />
              Draft PR
            </a>
          )}
        </div>
      )}
      {fix.prevention.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink-2">Prevention</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-2 marker:text-muted">
            {fix.prevention.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Anomalies({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <ul className="divide-y divide-line">
      {anomalies.map((a) => (
        <li key={a.id} className="px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs font-medium text-ink">{a.signal}</p>
            <span className="text-[11px] text-muted">{humanize(a.source)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-2">
            <span className="font-medium text-ink tabular">{formatSignalValue(a.signal, a.value)}</span>
            {a.baselineMean != null && <> vs baseline {formatSignalValue(a.signal, a.baselineMean)}</>}
            {a.zScore != null && <> · z = <span className="tabular">{a.zScore.toFixed(1)}</span></>}
            {a.baselineMean == null && <> · threshold signal</>}
          </p>
          {typeof a.detail?.compareUrl === 'string' && (
            <a href={a.detail.compareUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
              Commit range <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Final reports carry the full timeline from workflow history; running incidents show what is known so far. */
function timelineFor(incident: Detail): TimelineEntry[] {
  if (incident.finalReport) return incident.finalReport.timeline;
  const t: TimelineEntry[] = [{ at: incident.detectedAt, event: 'Incident opened' }];
  if (incident.initialReportAt) t.push({ at: incident.initialReportAt, event: 'Initial report sent' });
  if (incident.acknowledgedAt) t.push({ at: incident.acknowledgedAt, event: `Acknowledged by ${incident.acknowledgedBy}` });
  return t.sort((a, b) => a.at.localeCompare(b.at));
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-3 px-5 py-4 before:absolute before:bottom-6 before:left-[25px] before:top-6 before:w-px before:bg-line">
      {entries.map((e, i) => (
        <li key={i} className="relative flex gap-3 text-xs">
          <span className="relative z-10 mt-1 size-2 shrink-0 rounded-full bg-line-strong ring-2 ring-surface" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-ink">{e.event}</p>
            <p className="text-muted tabular">{formatTime(e.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function LiveState({ state, loading }: { state: IncidentState | undefined; loading: boolean }) {
  if (loading || !state) return <Skeleton className="m-5 h-24" />;
  const rows: Array<[string, ReactNode]> = [
    ['Workflow status', <StatusBadge key="s" status={state.status} />],
    ['Acknowledged', state.acknowledgedBy ?? <span className="text-critical-ink">Not yet</span>],
    ['Escalated', state.escalated ? 'Yes, paged on-call' : 'No'],
    ['Anomalies merged', state.anomalies.length],
    ['LLM usage', `${state.usage.tokens.toLocaleString()} tokens · ${formatUsd(state.usage.costUsd)}`],
  ];
  if (state.budgetExhausted) rows.push(['Token budget', <span key="b" className="text-critical-ink">Exhausted</span>]);
  return (
    <dl className="divide-y divide-line text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3 px-5 py-2.5">
          <dt className="text-ink-2">{k}</dt>
          <dd className="text-right font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const FEEDBACK: Array<{ verdict: FeedbackVerdict; label: string; icon: LucideIcon }> = [
  { verdict: 'correct', label: 'Correct', icon: ThumbsUp },
  { verdict: 'wrong_root_cause', label: 'Wrong root cause', icon: ThumbsDown },
  { verdict: 'not_incident', label: 'Not an incident', icon: VolumeX },
];

function FeedbackCard({ incidentId }: { incidentId: string }) {
  const feedback = useFeedback(incidentId);
  const [sent, setSent] = useState<FeedbackVerdict | null>(null);
  const [comment, setComment] = useState('');

  if (sent) {
    return (
      <p className="flex items-center gap-2 px-5 py-4 text-sm text-ink-2" role="status">
        <CheckCircle2 className="size-4 text-good" aria-hidden />
        Thanks. Recorded as “{FEEDBACK.find((f) => f.verdict === sent)?.label}” and saved to the service’s memory.
      </p>
    );
  }
  return (
    <div className="space-y-3 p-5">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment for the next responder"
        rows={2}
        className="block w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
        aria-label="Feedback comment"
      />
      <div className="flex flex-wrap gap-2">
        {FEEDBACK.map((f) => (
          <Button
            key={f.verdict}
            size="sm"
            icon={f.icon}
            loading={feedback.isPending && feedback.variables?.verdict === f.verdict}
            disabled={feedback.isPending}
            onClick={() => feedback.mutate({ verdict: f.verdict, comment: comment.trim() || undefined }, { onSuccess: () => setSent(f.verdict) })}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {feedback.error && <p className="text-xs text-critical-ink">{(feedback.error as Error).message}</p>}
    </div>
  );
}

export function IncidentDetail() {
  const { id = '' } = useParams();
  const incident = useIncident(id);
  const running = incident.data ? isActive(incident.data.status) : false;
  const state = useIncidentState(id, running);
  const services = useServices();
  const ack = useAcknowledge(id);

  if (incident.error) {
    const missing = incident.error instanceof ApiError && incident.error.status === 404;
    return (
      <Card>
        {missing ? (
          <EmptyState title="Incident not found">
            <Link to="/incidents" className="text-accent-ink hover:underline">
              Back to incidents
            </Link>
          </EmptyState>
        ) : (
          <ErrorState error={incident.error} onRetry={() => incident.refetch()} />
        )}
      </Card>
    );
  }

  const i = incident.data;
  if (!i) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const service = services.data?.find((s) => s.id === i.serviceId);
  const end = i.resolvedAt ? Date.parse(i.resolvedAt) : Date.now();
  const slackUrl = i.slackChannel && i.slackThreadTs ? `https://slack.com/app_redirect?channel=${encodeURIComponent(i.slackChannel.replace('#', ''))}` : null;

  return (
    <>
      <Link to="/incidents" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden />
        Incidents
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={i.severity} />
          <StatusBadge status={i.status} />
          {i.chaosLabel && <span className="rounded-md border border-dashed border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-ink-2">chaos: {i.chaosLabel}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{i.title ?? 'Triage in progress…'}</h1>
            <p className="mt-1 text-sm text-ink-2">
              {service?.name ?? '…'} · started {timeAgo(i.startedAt)} ({formatDateTime(i.startedAt)}) ·{' '}
              {i.status === 'noise' ? 'closed as noise' : `${i.resolvedAt ? 'lasted' : 'ongoing for'} ${formatDuration(end - Date.parse(i.startedAt))}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {slackUrl && (
              <a href={slackUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-2">
                <MessageSquare className="size-4" aria-hidden />
                Slack thread
              </a>
            )}
            {running && !i.acknowledgedBy && (
              <Button variant="primary" icon={BellRing} loading={ack.isPending} onClick={() => ack.mutate()}>
                Acknowledge
              </Button>
            )}
          </div>
        </div>
        {i.status !== 'noise' && (
          <div className="mt-5">
            <Progress status={i.status} />
          </div>
        )}
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {i.title && (
            <Card>
              <CardHeader title={i.status === 'noise' ? 'Triage verdict: noise' : 'Initial report'} subtitle={i.initialReportAt ? `Sent ${timeAgo(i.initialReportAt)}` : undefined} />
              <div className="space-y-4 p-5">
                <p className="text-sm leading-relaxed text-ink">{i.summary}</p>
                {i.status !== 'noise' && (
                  <dl className="grid gap-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted">User impact</dt>
                      <dd className="mt-0.5 text-ink">{i.userImpact}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Suspected component</dt>
                      <dd className="mt-0.5 font-mono text-xs text-ink">{i.suspectedComponent}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Triage confidence</dt>
                      <dd className="mt-1">{i.confidence != null && <Meter value={i.confidence} label="Triage confidence" />}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </Card>
          )}

          {i.status !== 'noise' && (
            <Card>
              <CardHeader title="Root cause" subtitle="Ranked hypotheses with the queries and log lines behind them" />
              <RootCause incident={i} />
            </Card>
          )}

          {i.fix && (
            <Card>
              <CardHeader title="Proposed fix" subtitle={i.fix.kind === 'code_diff' ? 'Code change' : 'Runbook'} />
              <Fix fix={i.fix} verification={i.finalReport?.verification ?? state.data?.verification ?? null} />
            </Card>
          )}

          {(i.status === 'resolved' || i.status === 'noise') && (
            <Card>
              <CardHeader title="Was this right?" subtitle="Feedback measures precision and teaches the monitor via Supermemory" />
              <FeedbackCard incidentId={i.id} />
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Live workflow state" subtitle={running ? 'Temporal query · refreshes every 5s' : 'Temporal query · workflow closed'} />
            <LiveState state={state.data} loading={state.isLoading} />
          </Card>
          <Card>
            <CardHeader title="Signals" subtitle={`${i.anomalies.length} anomal${i.anomalies.length === 1 ? 'y' : 'ies'} merged into this incident`} />
            <Anomalies anomalies={i.anomalies} />
          </Card>
          <Card>
            <CardHeader title="Timeline" subtitle={i.finalReport ? 'From the workflow history' : 'So far'} />
            <Timeline entries={timelineFor(i)} />
          </Card>
        </aside>
      </div>
    </>
  );
}
