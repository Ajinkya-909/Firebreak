import { Search, SearchX } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { isActive, useIncidents, useServices } from '../api/hooks';
import type { Incident, IncidentStatus, Severity } from '../api/types';
import { Card, EmptyState, ErrorState, inputClass, PageHeader, SeverityBadge, Skeleton, StatusBadge, statusLabel, cx } from '../components/ui';
import { formatDateTime, formatDuration, pct, timeAgo } from '../lib/format';

const STATUSES: IncidentStatus[] = ['triaging', 'open', 'investigating', 'verifying', 'awaiting_recovery', 'resolved', 'noise'];
const SEVERITIES: Severity[] = ['SEV1', 'SEV2', 'SEV3'];

function duration(i: Incident) {
  const end = i.resolvedAt ? Date.parse(i.resolvedAt) : Date.now();
  return i.status === 'noise' ? '—' : formatDuration(end - Date.parse(i.startedAt));
}

const selectClass = cx(inputClass, 'w-auto pr-8');

export function Incidents() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as IncidentStatus | null) ?? undefined;
  const serviceId = params.get('service') ?? undefined;
  const severity = params.get('severity') as Severity | null;
  const activeOnly = params.get('active') === '1';
  const q = params.get('q') ?? '';

  // status and serviceId are API filters; severity, "active" and search are applied client-side.
  const incidents = useIncidents({ status, serviceId, limit: 200 });
  const services = useServices();
  const names = useMemo(() => new Map((services.data ?? []).map((s) => [s.id, s.name])), [services.data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (incidents.data ?? []).filter(
      (i) =>
        (!severity || i.severity === severity) &&
        (!activeOnly || isActive(i.status)) &&
        (!needle || `${i.title ?? ''} ${names.get(i.serviceId) ?? ''} ${i.suspectedComponent ?? ''}`.toLowerCase().includes(needle)),
    );
  }, [incidents.data, severity, activeOnly, q, names]);

  const set = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  const filtered = Boolean(status || serviceId || severity || activeOnly || q);

  return (
    <>
      <PageHeader title="Incidents" description="Every anomaly that reached AI triage, including the ones judged as noise." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => set({ q: e.target.value || null })}
            placeholder="Search title, service, component"
            aria-label="Search incidents"
            className={cx(inputClass, 'pl-9')}
          />
        </div>
        <select
          aria-label="Status"
          className={selectClass}
          value={activeOnly ? 'active' : (status ?? '')}
          onChange={(e) =>
            set(e.target.value === 'active' ? { status: null, active: '1' } : { status: e.target.value || null, active: null })
          }
        >
          <option value="">All statuses</option>
          <option value="active">Active (any stage)</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select aria-label="Severity" className={selectClass} value={severity ?? ''} onChange={(e) => set({ severity: e.target.value || null })}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Service" className={selectClass} value={serviceId ?? ''} onChange={(e) => set({ service: e.target.value || null })}>
          <option value="">All services</option>
          {services.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {filtered && (
          <button type="button" onClick={() => setParams({}, { replace: true })} className="px-2 text-xs font-medium text-accent-ink hover:underline">
            Clear filters
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        {incidents.error ? (
          <ErrorState error={incidents.error} onRetry={() => incidents.refetch()} />
        ) : !incidents.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No incidents match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-surface-2 text-left text-xs text-ink-2">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Severity</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Incident</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Detected</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Duration</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((i) => (
                  <tr key={i.id} className="group relative hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <SeverityBadge severity={i.severity} />
                    </td>
                    <td className="max-w-md px-3 py-3">
                      {/* The title link stretches over the row so the whole row is clickable. */}
                      <Link to={`/incidents/${i.id}`} className="block truncate font-medium text-ink after:absolute after:inset-0">
                        {i.title ?? 'Triage in progress…'}
                      </Link>
                      <span className="text-xs text-muted">
                        {names.get(i.serviceId)}
                        {i.chaosLabel && <> · chaos <span className="font-mono">{i.chaosLabel}</span></>}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-2" title={formatDateTime(i.detectedAt)}>
                      {timeAgo(i.detectedAt)}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-2 tabular">{duration(i)}</td>
                    <td className="px-5 py-3 text-right text-ink-2 tabular">{pct(i.confidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {incidents.data && <p className="mt-3 text-xs text-muted">{rows.length} of {incidents.data.length} incidents</p>}
    </>
  );
}
