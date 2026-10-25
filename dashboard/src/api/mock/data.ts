import type {
  Anomaly,
  FeedbackVerdict,
  FinalReport,
  FixProposal,
  Incident,
  IncidentStatus,
  RootCauseHypothesis,
  Service,
  Severity,
  SignalSource,
  TimelineEntry,
} from '../types';

// Deterministic demo dataset, anchored to "now" so the dashboard always looks live.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261025);
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
const iso = (t: number) => new Date(t).toISOString();

export interface ChaosInjection {
  id: string;
  externalId: string;
  serviceId: string;
  label: string;
  faultType: string;
  expectedRootCause: string | null;
  startedAt: string;
  endedAt: string | null;
  matchedIncidentId: string | null;
  createdAt: string;
}

export interface FeedbackRow {
  id: string;
  incidentId: string;
  verdict: FeedbackVerdict;
  userId: string;
  comment: string | null;
  createdAt: string;
}

export interface MockDb {
  services: Service[];
  incidents: Incident[];
  anomalies: Anomaly[];
  chaosInjections: ChaosInjection[];
  feedback: FeedbackRow[];
}

// ── Services ──────────────────────────────────────────────────────────────────

const SERVICE_DEFS = [
  { name: 'checkout', repo: 'acme/checkout', channel: '#inc-checkout', slo: 0.999, verify: true },
  { name: 'payments', repo: 'acme/payments', channel: '#inc-payments', slo: 0.9995, verify: true },
  { name: 'catalog-search', repo: 'acme/catalog', channel: '#inc-catalog', slo: 0.995, verify: false },
  { name: 'auth', repo: 'acme/auth', channel: '#inc-auth', slo: 0.9995, verify: true },
  { name: 'notifications', repo: 'acme/notifications', channel: '#inc-platform', slo: 0.99, verify: false },
  { name: 'inventory', repo: 'acme/inventory', channel: null, slo: 0.999, verify: false },
] as const;

// ── Scenario library ──────────────────────────────────────────────────────────

interface Scenario {
  title: string;
  signal: string;
  source: SignalSource;
  severity: Severity;
  component: string;
  impact: string;
  summary: string;
  faultType: string;
  value: [number, number];
  baseline: number;
  causes: Array<Omit<RootCauseHypothesis, 'rank'>>;
  fix: FixProposal;
}

const sel = (svc: string) => `job="${svc}"`;

function scenarios(svc: string): Scenario[] {
  return [
    {
      title: `${svc} 5xx spike after deploy`,
      signal: 'error_ratio',
      source: 'deploy_guard',
      severity: 'SEV1',
      component: `${svc}-api`,
      impact: '~9% of requests returning 500',
      summary: `Error ratio on ${svc} rose from 0.2% to 9% within four minutes of a deploy. A new NullPointerException signature appeared at the same time.`,
      faultType: 'bad_deploy',
      value: [0.06, 0.12],
      baseline: 0.002,
      causes: [
        {
          cause: 'Deploy introduced a null dereference when the optional `promoCode` field is absent',
          confidence: 0.86,
          evidence: [
            { kind: 'promql', value: `sum(rate(http_requests_total{${sel(svc)},status=~"5.."}[5m])) by (route)`, note: 'Errors isolated to POST /cart/apply' },
            { kind: 'log_line', value: 'java.lang.NullPointerException: Cannot invoke "String.trim()" because "promoCode" is null', note: 'First seen 40s after rollout' },
            { kind: 'commit', value: '4f2c9e1', note: 'refactor(cart): inline promo validation' },
          ],
        },
        {
          cause: 'Upstream pricing service returning partial payloads',
          confidence: 0.18,
          evidence: [{ kind: 'logql', value: `{app="${svc}"} |= "pricing" |= "timeout"`, note: 'No increase versus baseline' }],
        },
      ],
      fix: {
        summary: 'Guard optional promoCode before trimming',
        kind: 'code_diff',
        diff: `--- a/src/cart/PromoValidator.java\n+++ b/src/cart/PromoValidator.java\n@@ -41,7 +41,9 @@ public final class PromoValidator {\n   public Result validate(CartRequest req) {\n-    String code = req.promoCode().trim();\n+    if (req.promoCode() == null || req.promoCode().isBlank()) {\n+      return Result.noPromo();\n+    }\n+    String code = req.promoCode().trim();\n     return lookup(code);\n   }`,
        rollbackSuggestion: `Roll back ${svc} to 9b1d33a`,
        prevention: ['Add a contract test for carts without promo codes', 'Enable deploy guard auto-rollback for SEV1 regressions'],
      },
    },
    {
      title: `Connection pool exhaustion forecast on ${svc}`,
      signal: 'db_pool_exhaustion_30m',
      source: 'predictive',
      severity: 'SEV2',
      component: `${svc}-postgres`,
      impact: 'None yet; requests will queue in ~35 minutes at the current trend',
      summary: `predict_linear on db_pool_connections_in_use projects the pool reaching 100% within 30 minutes. In-use connections have climbed steadily for 50 minutes without a matching traffic increase.`,
      faultType: 'connection_leak',
      value: [1.1, 1.4],
      baseline: 0.45,
      causes: [
        {
          cause: 'Connections leak on the retry path when the ledger call times out',
          confidence: 0.74,
          evidence: [
            { kind: 'promql', value: `predict_linear(db_pool_connections_in_use{${sel(svc)}}[15m], 1800)`, note: 'Projected 64 of 50 connections' },
            { kind: 'logql', value: `{app="${svc}"} |= "ledger" |= "retrying"`, note: 'Retries up 6x' },
          ],
        },
      ],
      fix: {
        summary: 'Release the connection in a finally block on the ledger retry path',
        kind: 'code_diff',
        diff: `--- a/internal/ledger/client.go\n+++ b/internal/ledger/client.go\n@@ -88,6 +88,7 @@ func (c *Client) Post(ctx context.Context, e Entry) error {\n \tconn, err := c.pool.Acquire(ctx)\n \tif err != nil {\n \t\treturn err\n \t}\n+\tdefer conn.Release()\n \tfor attempt := 0; attempt < 3; attempt++ {`,
        prevention: ['Alert when pool utilization stays above 80% for 10 minutes', 'Add a leak detector to integration tests'],
      },
    },
    {
      title: `p99 latency regression on ${svc}`,
      signal: 'latency_p99',
      source: 'prometheus',
      severity: 'SEV2',
      component: `${svc}-read-path`,
      impact: 'Slow responses for ~15% of users; no errors',
      summary: `p99 latency rose from 180ms to 1.4s (z=7.8 against the same hour last month). CPU is flat, and the slow requests share a cache-miss log pattern.`,
      faultType: 'cache_eviction',
      value: [1.1, 1.8],
      baseline: 0.18,
      causes: [
        {
          cause: 'Redis evicting hot keys after maxmemory was lowered',
          confidence: 0.69,
          evidence: [
            { kind: 'promql', value: 'rate(redis_evicted_keys_total[5m])', note: 'Evictions up from 0 to 1.2k/s' },
            { kind: 'log_line', value: 'cache miss for key product:<num>, falling back to primary', note: 'New log signature' },
          ],
        },
        {
          cause: 'Slow query on the primary after an index rebuild',
          confidence: 0.22,
          evidence: [{ kind: 'promql', value: 'pg_stat_activity_max_tx_duration', note: 'Elevated but trailing the latency rise' }],
        },
      ],
      fix: {
        summary: 'Restore Redis maxmemory and pre-warm hot keys',
        kind: 'runbook',
        runbookSteps: [
          'kubectl -n data exec redis-0 -- redis-cli CONFIG SET maxmemory 4gb',
          'Run the cache warmer: kubectl create job --from=cronjob/cache-warmer warm-now',
          'Watch p99 return under 250ms in the latency panel',
        ],
        prevention: ['Manage Redis maxmemory in Terraform instead of by hand', 'Alert on eviction rate above 100/s'],
      },
    },
    {
      title: `Memory leak trending toward OOM on ${svc}`,
      signal: 'memory_exhaustion_1h',
      source: 'predictive',
      severity: 'SEV2',
      component: `${svc}-worker`,
      impact: 'Pods projected to OOM-kill in ~40 minutes',
      summary: `Working-set memory has grown linearly for 2 hours on every pod. predict_linear reaches the container limit in about 40 minutes.`,
      faultType: 'memory_leak',
      value: [1.05, 1.3],
      baseline: 0.55,
      causes: [
        {
          cause: 'Unbounded in-process cache of rendered templates',
          confidence: 0.71,
          evidence: [
            { kind: 'promql', value: `predict_linear(container_memory_working_set_bytes{${sel(svc)}}[30m], 3600)`, note: '1.18x the memory limit' },
            { kind: 'commit', value: 'a7e01cd', note: 'feat(templates): cache rendered output' },
          ],
        },
      ],
      fix: {
        summary: 'Bound the template cache with an LRU of 5k entries',
        kind: 'code_diff',
        diff: `--- a/src/render/cache.ts\n+++ b/src/render/cache.ts\n@@ -1,4 +1,5 @@\n-const cache = new Map<string, string>();\n+import { LRUCache } from 'lru-cache';\n+const cache = new LRUCache<string, string>({ max: 5_000 });`,
        prevention: ['Require size bounds on in-process caches in code review', 'Add a 2-hour soak test to CI'],
      },
    },
    {
      title: `New error signature: upstream TLS handshake failures from ${svc}`,
      signal: 'new_log_pattern',
      source: 'loki',
      severity: 'SEV3',
      component: `${svc} → email-provider`,
      impact: 'Retries succeed; delivery delayed by ~2 minutes',
      summary: `A log signature never seen before for ${svc} appeared 340 times in 5 minutes: TLS handshake failures to the email provider.`,
      faultType: 'dependency_tls',
      value: [200, 400],
      baseline: 0,
      causes: [
        {
          cause: "The provider rotated its intermediate certificate, and the service's CA bundle is outdated",
          confidence: 0.64,
          evidence: [{ kind: 'log_line', value: 'x509: certificate signed by unknown authority (host smtp.mailer.example)', note: 'New signature' }],
        },
      ],
      fix: {
        summary: 'Refresh the CA bundle in the base image',
        kind: 'runbook',
        runbookSteps: ['Bump the base image to pick up ca-certificates 2026.09', 'Redeploy and confirm the signature stops'],
        prevention: ['Track the base-image CA bundle age in the weekly report'],
      },
    },
  ];
}

const NOISE = [
  { title: 'Nightly batch job CPU spike', signal: 'cpu_cores', reasoning: 'Matches memory: "nightly reindex job spikes CPU at 02:00 UTC"' },
  { title: 'Traffic dip during a regional holiday', signal: 'request_rate', reasoning: 'Request rate down 30%, but the error ratio and latency are normal' },
  { title: 'Synthetic load test from staging', signal: 'request_rate', reasoning: 'All extra traffic carries the user-agent k6/loadtest' },
  { title: 'Scheduled cache flush', signal: 'latency_p99', reasoning: 'Matches memory: weekly cache flush on Sundays, recovers in under 5 minutes' },
  { title: 'Single noisy pod restart', signal: 'error_log_rate', reasoning: 'Errors from one pod during its graceful shutdown; no user impact' },
];

// ── Builders ──────────────────────────────────────────────────────────────────

function buildTimeline(detected: number, initial: number, resolved: number | null, acked: number | null): TimelineEntry[] {
  const t: TimelineEntry[] = [
    { at: iso(detected), event: 'Incident opened' },
    { at: iso(detected), event: 'Anomaly received' },
    { at: iso(detected + 20_000), event: 'Triage started' },
    { at: iso(initial), event: 'Initial report sent' },
  ];
  if (acked) t.push({ at: iso(acked), event: 'Acknowledged' });
  t.push({ at: iso(initial + 15_000), event: 'Investigation started' });
  t.push({ at: iso(initial + between(2, 5) * MIN), event: 'Fix verification started' });
  if (resolved) {
    t.push({ at: iso(resolved - 11 * MIN), event: 'Waiting for metrics to return to baseline' });
    t.push({ at: iso(resolved), event: 'Recovered; final report prepared' });
  }
  return t.sort((a, b) => a.at.localeCompare(b.at));
}

function makeAnomaly(service: Service, s: Pick<Scenario, 'signal' | 'source' | 'value' | 'baseline'>, at: number, incidentId: string | null): Anomaly {
  const value = between(...s.value);
  const std = Math.max(s.baseline * 0.15, 0.001);
  const threshold = s.source === 'predictive' || s.signal === 'new_log_pattern';
  return {
    id: uuid(),
    serviceId: service.id,
    incidentId,
    source: s.source,
    signal: s.signal,
    value,
    baselineMean: threshold ? null : s.baseline,
    baselineStd: threshold ? null : std,
    zScore: threshold ? null : (value - s.baseline) / std,
    detail: s.source === 'deploy_guard' ? { sha: '4f2c9e1', previousSha: '9b1d33a', compareUrl: `https://github.com/${service.githubRepo}/compare/9b1d33a...4f2c9e1` } : null,
    observedAt: iso(at),
  };
}

export function createMockDb(now = Date.now()): MockDb {
  const services: Service[] = SERVICE_DEFS.map((d, i) => ({
    id: uuid(),
    name: d.name,
    promSelector: sel(d.name),
    lokiSelector: `{app="${d.name}"}`,
    githubRepo: d.repo,
    slackChannel: d.channel,
    sloTarget: d.slo,
    verifyImage: d.verify ? 'ghcr.io/acme/ci-runner:2026.10' : null,
    verifyCommand: d.verify ? 'make test' : null,
    enabled: d.name !== 'inventory',
    createdAt: iso(now - (40 - i) * DAY),
    updatedAt: iso(now - (10 - i) * DAY),
  }));
  const enabled = services.filter((s) => s.enabled);
  const incidents: Incident[] = [];
  const anomalies: Anomaly[] = [];
  const chaosInjections: ChaosInjection[] = [];
  const feedback: FeedbackRow[] = [];
  const users = ['user_ana', 'user_dev', 'user_kai', 'slack:U04RAJ'];

  const base = (service: Service, startedAt: number, status: IncidentStatus): Incident => ({
    id: uuid(),
    fingerprint: hex(16),
    workflowId: '',
    serviceId: service.id,
    status,
    severity: null,
    confidence: null,
    title: null,
    summary: null,
    suspectedComponent: null,
    userImpact: null,
    rootCause: null,
    fix: null,
    finalReport: null,
    slackChannel: null,
    slackThreadTs: null,
    acknowledgedBy: null,
    chaosLabel: null,
    tokensUsed: 0,
    costUsd: 0,
    startedAt: iso(startedAt),
    detectedAt: iso(startedAt + between(40, 110) * 1000),
    initialReportAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
  });

  const realIncident = (service: Service, s: Scenario, startedAt: number, opts: { status: IncidentStatus; chaosLabel?: string }) => {
    const inc = base(service, startedAt, opts.status);
    inc.workflowId = `incident-${inc.fingerprint}`;
    const detected = Date.parse(inc.detectedAt);
    const initial = detected + between(55, 130) * 1000;
    const tokens = int(18_000, 95_000);
    Object.assign(inc, {
      severity: s.severity,
      confidence: Number(between(0.62, 0.95).toFixed(2)),
      title: s.title,
      summary: s.summary,
      suspectedComponent: s.component,
      userImpact: s.impact,
      chaosLabel: opts.chaosLabel ?? null,
      tokensUsed: tokens,
      costUsd: (tokens / 1e6) * 0.6,
      initialReportAt: iso(initial),
      slackChannel: s.severity === 'SEV3' ? null : service.slackChannel,
      slackThreadTs: s.severity === 'SEV3' ? null : `${Math.floor(initial / 1000)}.${int(100000, 999999)}`,
    });
    const investigated = !['triaging', 'open'].includes(opts.status);
    if (investigated) {
      inc.rootCause = s.causes.map((c, i) => ({ ...c, rank: i + 1 }));
      inc.fix = s.fix;
    }
    if (opts.status === 'resolved') {
      const acked = initial + between(1, 6) * MIN;
      const resolved = initial + between(14, 95) * MIN;
      inc.acknowledgedBy = pick(users);
      inc.acknowledgedAt = iso(acked);
      inc.resolvedAt = iso(resolved);
      const verification =
        s.fix.kind === 'code_diff' && service.verifyCommand
          ? { status: 'passed' as const, details: '`make test` passed with the patch applied.', draftPrUrl: `https://github.com/${service.githubRepo}/pull/${int(400, 1900)}` }
          : { status: 'skipped' as const, details: s.fix.kind === 'runbook' ? 'Runbook fix; nothing to build.' : 'Docker verification not configured for this service.' };
      const report: FinalReport = {
        title: s.title,
        service: service.name,
        severity: s.severity,
        recovered: true,
        impactWindow: { start: inc.startedAt, end: iso(resolved), minutes: Math.round((resolved - startedAt) / MIN) },
        rootCause: inc.rootCause![0]!,
        alternatives: inc.rootCause!.slice(1),
        fix: s.fix,
        verification,
        prevention: s.fix.prevention,
        timeline: buildTimeline(detected, initial, resolved, acked),
        usage: { tokens, costUsd: inc.costUsd },
      };
      inc.finalReport = report;
    }
    incidents.push(inc);
    anomalies.push(makeAnomaly(service, s, detected - 30_000, inc.id));
    if (rand() < 0.6) {
      anomalies.push(makeAnomaly(service, { signal: 'error_log_rate', source: 'loki', value: [80, 300], baseline: 12 }, detected - 10_000, inc.id));
    }
    return inc;
  };

  // History: 14 days. Noise verdicts taper off as Supermemory learns the harmless patterns.
  for (let d = 13; d >= 1; d--) {
    const dayStart = now - d * DAY;
    const realCount = int(0, 3);
    for (let i = 0; i < realCount; i++) {
      const service = pick(enabled);
      const s = pick(scenarios(service.name));
      const startedAt = dayStart + between(0, DAY - 3 * HOUR);
      const fromChaos = rand() < 0.65;
      const label = fromChaos ? `${s.faultType}-${hex(4)}` : undefined;
      const inc = realIncident(service, s, startedAt, { status: 'resolved', chaosLabel: label });
      if (fromChaos) {
        chaosInjections.push({
          id: uuid(),
          externalId: `inj-${hex(6)}`,
          serviceId: service.id,
          label: label!,
          faultType: s.faultType,
          expectedRootCause: s.causes[0]!.cause,
          startedAt: iso(startedAt),
          endedAt: iso(startedAt + between(15, 40) * MIN),
          matchedIncidentId: inc.id,
          createdAt: iso(startedAt),
        });
        const verdict: FeedbackVerdict = rand() < 0.8 ? 'correct' : 'wrong_root_cause';
        feedback.push({ id: uuid(), incidentId: inc.id, verdict, userId: pick(users), comment: null, createdAt: inc.resolvedAt! });
      }
    }
    const noiseCount = Math.max(0, Math.round(between(3, 6) * (d / 13)) + int(-1, 1));
    for (let i = 0; i < noiseCount; i++) {
      const service = pick(enabled);
      const n = pick(NOISE);
      const inc = base(service, dayStart + between(0, DAY), 'noise');
      inc.workflowId = `incident-${inc.fingerprint}`;
      Object.assign(inc, { severity: 'SEV3', confidence: Number(between(0.7, 0.96).toFixed(2)), title: n.title, summary: n.reasoning, tokensUsed: int(2_000, 5_000) });
      inc.costUsd = (inc.tokensUsed / 1e6) * 0.6;
      incidents.push(inc);
      anomalies.push(makeAnomaly(service, { signal: n.signal, source: 'prometheus', value: [2, 4], baseline: 1 }, Date.parse(inc.detectedAt), inc.id));
    }
  }

  // Missed injections: faults Firebreak did not catch (keeps recall honest).
  for (let i = 0; i < 2; i++) {
    const service = pick(enabled);
    const at = now - between(2, 12) * DAY;
    chaosInjections.push({
      id: uuid(),
      externalId: `inj-${hex(6)}`,
      serviceId: service.id,
      label: `slow_disk-${hex(4)}`,
      faultType: 'slow_disk',
      expectedRootCause: 'Disk I/O latency on the data volume',
      startedAt: iso(at),
      endedAt: iso(at + 20 * MIN),
      matchedIncidentId: null,
      createdAt: iso(at),
    });
  }

  // Live incidents, one per active stage.
  const [checkout, payments, catalog, auth] = services;
  const live: Array<[Service, number, number, IncidentStatus, boolean]> = [
    [checkout!, 0, 14, 'investigating', false],
    [payments!, 1, 26, 'open', true],
    [catalog!, 2, 48, 'verifying', true],
    [auth!, 3, 71, 'awaiting_recovery', true],
  ];
  for (const [service, scenarioIdx, minutesAgo, status, acked] of live) {
    const s = scenarios(service.name)[scenarioIdx]!;
    const inc = realIncident(service, s, now - minutesAgo * MIN, { status });
    if (acked) {
      inc.acknowledgedBy = pick(users);
      inc.acknowledgedAt = iso(Date.parse(inc.initialReportAt!) + 3 * MIN);
    }
    if (status === 'investigating') inc.tokensUsed = 31_200;
  }
  // One still in triage, seconds old.
  const triaging = base(services[4]!, now - 50_000, 'triaging');
  triaging.workflowId = `incident-${triaging.fingerprint}`;
  triaging.detectedAt = iso(now - 20_000);
  incidents.push(triaging);
  anomalies.push(makeAnomaly(services[4]!, { signal: 'error_log_rate', source: 'loki', value: [140, 220], baseline: 15 }, now - 25_000, triaging.id));

  incidents.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  return { services, incidents, anomalies, chaosInjections, feedback };
}
