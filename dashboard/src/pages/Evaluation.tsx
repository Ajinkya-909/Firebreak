import { CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useEvaluation } from '../api/hooks';
import { RecallChart, type RecallRow } from '../components/charts/RecallChart';
import { Card, CardHeader, cx, EmptyState, ErrorState, PageHeader, Skeleton, StatTile } from '../components/ui';
import { formatSeconds, humanize, pct } from '../lib/format';

const WINDOWS = [7, 14, 30];

export function Evaluation() {
  const [params, setParams] = useSearchParams();
  const days = WINDOWS.includes(Number(params.get('days'))) ? Number(params.get('days')) : 14;
  const evaluation = useEvaluation(days);
  const e = evaluation.data;

  const byFault = useMemo<RecallRow[]>(() => {
    if (!e) return [];
    const m = new Map<string, { detected: number; total: number }>();
    for (const p of e.perInjection) {
      const row = m.get(p.faultType) ?? { detected: 0, total: 0 };
      row.total++;
      if (p.detected) row.detected++;
      m.set(p.faultType, row);
    }
    return [...m.entries()]
      .map(([faultType, r]) => ({ faultType, ...r, recall: r.detected / r.total }))
      .sort((a, b) => b.recall - a.recall || b.total - a.total);
  }, [e]);

  return (
    <>
      <PageHeader
        title="Evaluation"
        description="Detection quality measured against chaos-lab ground truth. Each injected fault carries a label, so these numbers are measured, not claimed."
        actions={
          <div role="radiogroup" aria-label="Time window" className="flex rounded-lg border border-line-strong bg-surface p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={w === days}
                onClick={() => setParams({ days: String(w) }, { replace: true })}
                className={cx('rounded-md px-3 py-1 text-xs font-medium', w === days ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink')}
              >
                {w}d
              </button>
            ))}
          </div>
        }
      />

      {evaluation.error ? (
        <Card>
          <ErrorState error={evaluation.error} onRetry={() => evaluation.refetch()} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {e ? (
              <>
                <StatTile label="Recall" value={pct(e.recall)} hint={`Faults detected out of ${e.injections} injected`} />
                <StatTile label="Precision" value={pct(e.precision)} hint={`Of ${e.incidents} incidents on services under test`} />
                <StatTile label="Median time to initial report" value={formatSeconds(e.medianTimeToInitialReportSec)} hint="From fault start to first notification" />
                <StatTile label="Root-cause accuracy" value={pct(e.rootCauseAccuracy)} hint="From engineer feedback on matched incidents" />
              </>
            ) : (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[98px] rounded-xl" />)
            )}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,26rem)_1fr]">
            <Card>
              <CardHeader title="Recall by fault type" subtitle="Share of injected faults that opened an incident" />
              <div className="p-5">{e ? byFault.length ? <RecallChart data={byFault} /> : <EmptyState title="No injections in this window" /> : <Skeleton className="h-48" />}</div>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Injections" subtitle="An injection counts as detected if an incident opened on the same service before the fault ended plus 15 minutes" />
              {!e ? (
                <Skeleton className="m-5 h-48" />
              ) : e.perInjection.length === 0 ? (
                <EmptyState icon={FlaskConical} title="No chaos injections reported">
                  The chaos lab posts each fault to <span className="font-mono text-xs">/api/webhooks/chaos</span>.
                </EmptyState>
              ) : (
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="sticky top-0 border-b border-line bg-surface-2 text-left text-xs text-ink-2">
                      <tr>
                        <th scope="col" className="px-5 py-2.5 font-medium">Label</th>
                        <th scope="col" className="px-3 py-2.5 font-medium">Fault type</th>
                        <th scope="col" className="px-3 py-2.5 font-medium">Result</th>
                        <th scope="col" className="px-5 py-2.5 text-right font-medium">Incident</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {e.perInjection.map((p) => (
                        <tr key={p.label}>
                          <td className="px-5 py-2.5 font-mono text-xs text-ink">{p.label}</td>
                          <td className="px-3 py-2.5 text-ink-2">{humanize(p.faultType)}</td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
                              {p.detected ? <CheckCircle2 className="size-3.5 text-good" aria-hidden /> : <XCircle className="size-3.5 text-critical" aria-hidden />}
                              {p.detected ? 'Detected' : 'Missed'}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right text-xs">
                            {p.incidentId ? (
                              <Link to={`/incidents/${p.incidentId}`} className="font-medium text-accent-ink hover:underline">
                                Open
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
