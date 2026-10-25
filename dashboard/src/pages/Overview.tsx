import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { isActive, useIncidents, useServices } from '../api/hooks';
import type { Incident, Service } from '../api/types';
import { MttrChart, type MttrDay } from '../components/charts/MttrChart';
import { VerdictsChart, type VerdictDay } from '../components/charts/VerdictsChart';
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, SeverityBadge, Skeleton, StatTile, StatusBadge } from '../components/ui';
import { formatCompact, formatDuration, formatUsd, pct, timeAgo } from '../lib/format';

const DAYS = 14;
const DAY_MS = 86_400_000;
const dayLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const resolveMs = (i: Incident) => (i.resolvedAt ? Date.parse(i.resolvedAt) - Date.parse(i.startedAt) : null);

function useOverview(incidents: Incident[] | undefined) {
  return useMemo(() => {
    if (!incidents) return null;
    const now = Date.now();
    const since = now - DAYS * DAY_MS;
    const recent = incidents.filter((i) => Date.parse(i.detectedAt) >= since);
    const active = incidents.filter((i) => isActive(i.status));
    const resolved = recent.filter((i) => i.status === 'resolved');
    const noise = recent.filter((i) => i.status === 'noise');
    const judged = resolved.length + noise.length;

    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    const verdicts: VerdictDay[] = [];
    const mttr: MttrDay[] = [];
    for (let d = DAYS - 1; d >= 0; d--) {
      const start = startOfToday - d * DAY_MS;
      const inDay = recent.filter((i) => {
        const t = Date.parse(i.detectedAt);
        return t >= start && t < start + DAY_MS;
      });
      const label = dayLabel.format(start);
      verdicts.push({ day: label, incidents: inDay.filter((i) => i.status !== 'noise').length, noise: inDay.filter((i) => i.status === 'noise').length });
      const durations = inDay.map(resolveMs).filter((x): x is number => x != null);
      const m = median(durations);
      mttr.push({ day: label, minutes: m == null ? null : Math.round(m / 60_000), resolved: durations.length });
    }

    return {
      active,
      mttrMs: median(resolved.map(resolveMs).filter((x): x is number => x != null)),
      noiseShare: judged ? noise.length / judged : null,
      noiseCount: noise.length,
      spend: recent.reduce((n, i) => n + i.costUsd, 0),
      tokens: recent.reduce((n, i) => n + i.tokensUsed, 0),
      resolvedCount: resolved.length,
      verdicts,
      mttr,
    };
  }, [incidents]);
}

function ActiveIncidents({ incidents, services }: { incidents: Incident[]; services: Map<string, Service> }) {
  if (incidents.length === 0) {
    return (
      <EmptyState icon={ShieldCheck} title="No active incidents">
        Detection is running every minute for each enabled service.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {incidents.map((i) => (
        <li key={i.id}>
          <Link to={`/incidents/${i.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 hover:bg-surface-2">
            <SeverityBadge severity={i.severity} />
            <div className="min-w-0 flex-1 basis-60">
              <p className="truncate text-sm font-medium text-ink">{i.title ?? 'Triage in progress…'}</p>
              <p className="text-xs text-muted">
                {services.get(i.serviceId)?.name} · started {timeAgo(i.startedAt)}
                {!i.acknowledgedBy && i.status !== 'triaging' && <span className="font-medium text-critical-ink"> · unacknowledged</span>}
              </p>
            </div>
            <StatusBadge status={i.status} />
            <ArrowRight className="size-4 text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ServiceHealth({ services, incidents }: { services: Service[]; incidents: Incident[] }) {
  return (
    <ul className="divide-y divide-line">
      {services.map((s) => {
        const mine = incidents.filter((i) => i.serviceId === s.id && i.status !== 'noise');
        const open = mine.filter((i) => isActive(i.status));
        const worst = open.map((i) => i.severity).sort()[0];
        return (
          <li key={s.id} className="flex items-center gap-3 px-5 py-3">
            <span
              className={`size-2 shrink-0 rounded-full ${!s.enabled ? 'bg-line-strong' : open.length ? (worst === 'SEV1' ? 'bg-critical' : 'bg-serious') : 'bg-good'}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{s.name}</p>
              <p className="text-xs text-muted">
                {!s.enabled ? 'Monitoring paused' : open.length ? `${open.length} active · worst ${worst}` : `Healthy · last incident ${mine[0] ? timeAgo(mine[0].detectedAt) : 'never'}`}
              </p>
            </div>
            <span className="text-xs text-ink-2 tabular">{mine.length} / 14d</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Overview() {
  const incidents = useIncidents({ limit: 200 });
  const services = useServices();
  const o = useOverview(incidents.data);
  const byId = useMemo(() => new Map((services.data ?? []).map((s) => [s.id, s])), [services.data]);

  if (incidents.error || services.error) {
    return <ErrorState error={incidents.error ?? services.error} onRetry={() => (incidents.refetch(), services.refetch())} />;
  }

  const sev1 = o?.active.filter((i) => i.severity === 'SEV1').length ?? 0;

  return (
    <>
      <PageHeader title="Overview" description="Live incidents and how the monitor has performed over the last 14 days." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {o ? (
          <>
            <StatTile
              label="Active incidents"
              value={o.active.length}
              tone={sev1 ? 'critical' : undefined}
              hint={sev1 ? `${sev1} at SEV1` : 'None at SEV1'}
            />
            <StatTile label="Median time to resolve" value={o.mttrMs == null ? '—' : formatDuration(o.mttrMs)} hint={`${o.resolvedCount} resolved in 14 days`} />
            <StatTile label="Filtered as noise" value={pct(o.noiseShare)} hint={`${o.noiseCount} anomalies judged harmless`} />
            <StatTile label="LLM spend" value={formatUsd(o.spend)} hint={`${formatCompact(o.tokens)} tokens in 14 days`} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[98px] rounded-xl" />)
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader
            title="Active incidents"
            subtitle="Sorted by detection time"
            actions={
              <Link to="/incidents?active=1" className="text-xs font-medium text-accent-ink hover:underline">
                View all
              </Link>
            }
          />
          {o ? <ActiveIncidents incidents={o.active} services={byId} /> : <Skeleton className="m-5 h-40" />}
        </Card>
        <Card>
          <CardHeader title="Services" subtitle="Current state per service" />
          {services.data && incidents.data ? <ServiceHealth services={services.data} incidents={incidents.data} /> : <Skeleton className="m-5 h-40" />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Triage verdicts per day" subtitle="Anomalies that crossed the statistical threshold, after AI triage" />
          <div className="p-5">{o ? <VerdictsChart data={o.verdicts} /> : <Skeleton className="h-60" />}</div>
        </Card>
        <Card>
          <CardHeader title="Median time to resolve" subtitle="From the incident’s start to metrics stable at baseline, in minutes" />
          <div className="p-5">{o ? <MttrChart data={o.mttr} /> : <Skeleton className="h-60" />}</div>
        </Card>
      </div>
    </>
  );
}
