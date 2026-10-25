import { and, eq, notInArray, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db, schema } from '../../db/client.js';
import type { Service } from '../../db/schema.js';
import { ewma, score, summarize, type Baseline } from '../../detection/baseline.js';
import { clusterLines } from '../../detection/logPatterns.js';
import { SIGNALS, renderQuery, type SeasonalSignal, type Signal } from '../../detection/signals.js';
import * as loki from '../../integrations/loki.js';
import * as prom from '../../integrations/prometheus.js';
import { incidentFingerprint } from '../../lib/fingerprint.js';
import { logger } from '../../lib/logger.js';
import { getTemporalClient } from '../client.js';
import { anomalySignal, incidentWorkflowId, type AnomalyInput, type DeployGuardInput } from '../shared.js';
import type { incidentWorkflow } from '../workflows/incident.js';

const WEEK_MS = 7 * 24 * 3600 * 1000;
const SEASONAL_WEEKS = 4;
const SEASONAL_HALF_WINDOW_MS = 30 * 60 * 1000;
const NEW_PATTERN_SIGNAL = 'new_log_pattern';

export async function getService(serviceId: string): Promise<Service> {
  const service = await db.query.services.findFirst({ where: eq(schema.services.id, serviceId) });
  if (!service) throw new Error(`Unknown service ${serviceId}`);
  return service;
}

function queryFor(signal: Signal, service: Service): string {
  return renderQuery(signal.query, {
    sel: signal.source === 'loki' ? service.lokiSelector : service.promSelector,
    sloTarget: service.sloTarget,
  });
}

async function currentValue(signal: Signal, query: string, at = new Date()): Promise<number | null> {
  return signal.source === 'loki' ? loki.metricQuery(query, at) : prom.scalar(query, at);
}

/**
 * Seasonal baseline: the same ±30 minute window around this hour-of-week over the previous
 * four weeks. Falls back to an EWMA over the last two hours when history is too short
 * (new service, or Loki retention shorter than a month).
 */
async function seasonalBaseline(signal: SeasonalSignal, query: string, now: Date): Promise<Baseline> {
  if (signal.source === 'prometheus') {
    const windows = await Promise.all(
      Array.from({ length: SEASONAL_WEEKS }, (_, i) => {
        const center = now.getTime() - (i + 1) * WEEK_MS;
        return prom.rangeQuery(
          query,
          new Date(center - SEASONAL_HALF_WINDOW_MS),
          new Date(center + SEASONAL_HALF_WINDOW_MS),
          60,
        );
      }),
    );
    const values = windows.flatMap((series) => series[0]?.values.map(([, v]) => v) ?? []);
    if (values.length >= 30) return summarize(values);

    const recent = await prom.rangeQuery(query, new Date(now.getTime() - 2 * 3600_000), new Date(now.getTime() - 10 * 60_000), 60);
    return ewma(recent[0]?.values.map(([, v]) => v) ?? []);
  }

  // Loki: sample the metric query at 5-minute steps over the same seasonal windows.
  const points: Date[] = [];
  for (let w = 1; w <= SEASONAL_WEEKS; w++) {
    const center = now.getTime() - w * WEEK_MS;
    for (let t = center - SEASONAL_HALF_WINDOW_MS; t <= center + SEASONAL_HALF_WINDOW_MS; t += 5 * 60_000) {
      points.push(new Date(t));
    }
  }
  const sampled = await Promise.all(points.map((p) => loki.metricQuery(query, p).catch(() => null)));
  const values = sampled.filter((v): v is number => v !== null);
  if (values.length >= 10) return summarize(values);

  const recentPoints = Array.from({ length: 22 }, (_, i) => new Date(now.getTime() - (i + 2) * 5 * 60_000));
  const recent = await Promise.all(recentPoints.map((p) => loki.metricQuery(query, p).catch(() => null)));
  return ewma(recent.filter((v): v is number => v !== null).reverse());
}

interface Detected {
  source: AnomalyInput['source'];
  signal: string;
  value: number;
  baseline: Baseline | null;
  zScore: number | null;
  detail?: Record<string, unknown>;
}

async function evaluateSignal(signal: Signal, service: Service, now: Date): Promise<Detected | null> {
  const query = queryFor(signal, service);
  const value = await currentValue(signal, query, now);
  if (value === null) return null;

  if (signal.kind === 'threshold') {
    const fired = signal.op === '>' ? value > signal.threshold : value < signal.threshold;
    return fired
      ? { source: signal.source, signal: signal.name, value, baseline: null, zScore: null, detail: { query, threshold: signal.threshold } }
      : null;
  }

  const baseline = await seasonalBaseline(signal, query, now);
  const s = score(value, baseline, {
    threshold: env.ZSCORE_THRESHOLD,
    direction: signal.direction,
    minAbsDelta: signal.minAbsDelta,
  });
  return s.isAnomaly
    ? { source: signal.source, signal: signal.name, value, baseline, zScore: s.zScore, detail: { query } }
    : null;
}

/** Cluster recent error lines and report signatures this service has never logged before. */
async function detectNewLogPatterns(service: Service, now: Date): Promise<Detected | null> {
  const since = new Date(now.getTime() - env.DETECTION_INTERVAL_SECONDS * 1000 * 2);
  const lines = await loki.queryLogs(`${service.lokiSelector} |~ "(?i)(error|exception|panic|fatal)"`, since, now, 1000);
  if (lines.length === 0) return null;

  // Until the service has an hour of known signatures, everything looks new: just learn.
  const [oldest] = await db
    .select({ firstSeenAt: sql<Date>`min(${schema.logSignatures.firstSeenAt})` })
    .from(schema.logSignatures)
    .where(eq(schema.logSignatures.serviceId, service.id));
  const warmedUp = oldest?.firstSeenAt != null && new Date(oldest.firstSeenAt).getTime() < now.getTime() - 3600_000;

  const fresh: Array<{ template: string; count: number; sample: string }> = [];
  for (const p of clusterLines(lines.map((l) => l.line))) {
    const inserted = await db
      .insert(schema.logSignatures)
      .values({ serviceId: service.id, signature: p.signature, template: p.template, sample: p.sample, occurrences: p.count })
      .onConflictDoUpdate({
        target: [schema.logSignatures.serviceId, schema.logSignatures.signature],
        set: {
          occurrences: sql`${schema.logSignatures.occurrences} + ${p.count}`,
          lastSeenAt: now,
        },
      })
      // xmax = 0 only for freshly inserted rows, not for rows touched by ON CONFLICT UPDATE.
      .returning({ isNew: sql<boolean>`(xmax = 0)` });
    if (inserted[0]?.isNew) fresh.push(p);
  }

  if (!warmedUp || fresh.length === 0) return null;
  return {
    source: 'loki',
    signal: NEW_PATTERN_SIGNAL,
    value: fresh.reduce((n, p) => n + p.count, 0),
    baseline: null,
    zScore: null,
    detail: { patterns: fresh.slice(0, 10) },
  };
}

async function persistAnomalies(service: Service, found: Detected[], now: Date): Promise<AnomalyInput[]> {
  if (found.length === 0) return [];
  const rows = await db
    .insert(schema.anomalies)
    .values(
      found.map((d) => ({
        serviceId: service.id,
        source: d.source,
        signal: d.signal,
        value: d.value,
        baselineMean: d.baseline?.mean ?? null,
        baselineStd: d.baseline?.std ?? null,
        zScore: d.zScore,
        detail: d.detail ?? null,
        observedAt: now,
      })),
    )
    .returning();
  return rows.map((r) => ({
    anomalyId: r.id,
    serviceId: service.id,
    serviceName: service.name,
    source: r.source,
    signal: r.signal,
    value: r.value,
    baselineMean: r.baselineMean,
    baselineStd: r.baselineStd,
    zScore: r.zScore,
    observedAt: r.observedAt.toISOString(),
    detail: (r.detail as Record<string, unknown> | null) ?? undefined,
  }));
}

export async function detectAnomalies(serviceId: string): Promise<AnomalyInput[]> {
  const service = await getService(serviceId);
  if (!service.enabled) return [];
  const now = new Date();

  const results = await Promise.allSettled([
    ...SIGNALS.map((s) => evaluateSignal(s, service, now)),
    detectNewLogPatterns(service, now),
  ]);

  const found: Detected[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) found.push(r.value);
    // A missing metric or a flaky query shouldn't fail the whole cycle.
    if (r.status === 'rejected') logger.warn({ err: r.reason, service: service.name }, 'signal evaluation failed');
  }
  return persistAnomalies(service, found, now);
}

/**
 * Deliver anomalies to incidents. An already-open incident for the service absorbs new
 * anomalies so metric and log signals get correlated together; otherwise the
 * service+signal fingerprint picks (or starts) the IncidentWorkflow.
 */
export async function routeAnomalies(anomalies: AnomalyInput[]): Promise<void> {
  const client = await getTemporalClient();
  // Anomalies routed in this batch, per service. The incident row is written by the workflow a
  // moment after it starts, so same-batch anomalies can't rely on the DB lookup below.
  const routed = new Map<string, { fingerprint: string; workflowId: string }>();

  for (const anomaly of anomalies) {
    let target = routed.get(anomaly.serviceId);
    if (!target) {
      const open = await db.query.incidents.findFirst({
        where: and(
          eq(schema.incidents.serviceId, anomaly.serviceId),
          notInArray(schema.incidents.status, ['resolved', 'noise']),
        ),
        orderBy: (i, { desc }) => [desc(i.detectedAt)],
      });
      const fingerprint = open?.fingerprint ?? incidentFingerprint(anomaly.serviceName, anomaly.signal);
      target = { fingerprint, workflowId: open?.workflowId ?? incidentWorkflowId(fingerprint) };
      routed.set(anomaly.serviceId, target);
    }

    await client.workflow.signalWithStart<typeof incidentWorkflow, [AnomalyInput]>('incidentWorkflow', {
      workflowId: target.workflowId,
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      args: [{ fingerprint: target.fingerprint, anomaly }],
      signal: anomalySignal,
      signalArgs: [anomaly],
    });
  }
}

/** True when none of the given signals is currently anomalous for the service. */
export async function isServiceAtBaseline(input: { serviceId: string; signals: string[] }): Promise<boolean> {
  const service = await getService(input.serviceId);
  const now = new Date();
  // A new log signature has no "level" to recover to; judge it by the error-log rate instead.
  const names = new Set(input.signals.map((s) => (s === NEW_PATTERN_SIGNAL ? 'error_log_rate' : s)));
  const relevant = SIGNALS.filter((s) => names.has(s.name));
  const results = await Promise.all(relevant.map((s) => evaluateSignal(s, service, now).catch(() => null)));
  return results.every((r) => r === null);
}

// ── Deploy guard ──────────────────────────────────────────────────────────────

const GUARDED = SIGNALS.filter((s): s is SeasonalSignal => s.kind === 'seasonal' && s.source === 'prometheus');

export async function capturePreDeployBaseline(input: {
  serviceId: string;
  deployedAt: string;
}): Promise<Record<string, Baseline>> {
  const service = await getService(input.serviceId);
  const end = new Date(input.deployedAt);
  const start = new Date(end.getTime() - 60 * 60_000);
  const entries = await Promise.all(
    GUARDED.map(async (s) => {
      const series = await prom.rangeQuery(queryFor(s, service), start, end, 60).catch(() => []);
      return [s.name, summarize(series[0]?.values.map(([, v]) => v) ?? [])] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export interface Regression {
  signal: string;
  value: number;
  baseline: Baseline;
  zScore: number;
}

export async function checkDeployRegression(input: {
  serviceId: string;
  baseline: Record<string, Baseline>;
}): Promise<Regression[]> {
  const service = await getService(input.serviceId);
  const regressions: Regression[] = [];
  for (const s of GUARDED) {
    const baseline = input.baseline[s.name];
    if (!baseline) continue;
    const value = await prom.scalar(queryFor(s, service)).catch(() => null);
    if (value === null) continue;
    const result = score(value, baseline, {
      threshold: env.ZSCORE_THRESHOLD,
      // A deploy that drops traffic is a regression too; otherwise only "worse" counts.
      direction: s.direction === 'both' ? 'both' : 'up',
      minAbsDelta: s.minAbsDelta,
    });
    if (result.isAnomaly) regressions.push({ signal: s.name, value, baseline, zScore: result.zScore });
  }
  return regressions;
}

export async function openDeployRegressionIncident(input: {
  deploy: DeployGuardInput;
  regressions: Regression[];
}): Promise<void> {
  const service = await getService(input.deploy.serviceId);
  const { deploy } = input;
  const compareUrl =
    service.githubRepo && deploy.previousSha
      ? `https://github.com/${service.githubRepo}/compare/${deploy.previousSha}...${deploy.sha}`
      : null;
  const now = new Date();
  const anomalies = await persistAnomalies(
    service,
    input.regressions.map((r) => ({
      source: 'deploy_guard' as const,
      signal: r.signal,
      value: r.value,
      baseline: r.baseline,
      zScore: r.zScore,
      detail: {
        deployId: deploy.deployId,
        sha: deploy.sha,
        previousSha: deploy.previousSha,
        compareUrl,
        rollbackSuggestion: deploy.previousSha ? `Roll back ${service.name} to ${deploy.previousSha}` : null,
      },
    })),
    now,
  );
  await routeAnomalies(anomalies);
}

export async function markDeploy(input: { deployId: string; regressed: boolean }): Promise<void> {
  await db.update(schema.deploys).set({ regressed: input.regressed }).where(eq(schema.deploys.id, input.deployId));
}

