/**
 * Signal catalog evaluated for every service each detection cycle.
 *
 * `{sel}` is replaced with the service's Prometheus label matcher (or Loki stream selector).
 * Metric names follow common Prometheus/cAdvisor conventions; adjust them to match how the
 * services under test (and the chaos lab) are instrumented.
 */

export type Direction = 'up' | 'down' | 'both';

export interface SeasonalSignal {
  kind: 'seasonal';
  name: string;
  source: 'prometheus' | 'loki';
  query: string;
  direction: Direction;
  // Ignore deviations smaller than this in absolute terms, so a near-zero baseline std
  // (a quiet service) doesn't turn noise into a 10-sigma event.
  minAbsDelta: number;
}

export interface ThresholdSignal {
  kind: 'threshold';
  name: string;
  source: 'prometheus' | 'predictive';
  query: string;
  // Fires when the value is above (or below) the threshold.
  op: '>' | '<';
  threshold: number;
}

export type Signal = SeasonalSignal | ThresholdSignal;

export const SIGNALS: Signal[] = [
  // RED
  {
    kind: 'seasonal',
    name: 'request_rate',
    source: 'prometheus',
    query: 'sum(rate(http_requests_total{{sel}}[5m]))',
    direction: 'both',
    minAbsDelta: 1,
  },
  {
    kind: 'seasonal',
    name: 'error_ratio',
    source: 'prometheus',
    query:
      'sum(rate(http_requests_total{{sel},status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total{{sel}}[5m])), 1e-9)',
    direction: 'up',
    minAbsDelta: 0.01,
  },
  {
    kind: 'seasonal',
    name: 'latency_p99',
    source: 'prometheus',
    query: 'histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{{sel}}[5m])))',
    direction: 'up',
    minAbsDelta: 0.05,
  },
  // Saturation
  {
    kind: 'seasonal',
    name: 'cpu_cores',
    source: 'prometheus',
    query: 'sum(rate(container_cpu_usage_seconds_total{{sel}}[5m]))',
    direction: 'up',
    minAbsDelta: 0.1,
  },
  {
    kind: 'seasonal',
    name: 'memory_bytes',
    source: 'prometheus',
    query: 'sum(container_memory_working_set_bytes{{sel}})',
    direction: 'up',
    minAbsDelta: 50 * 1024 * 1024,
  },
  {
    kind: 'seasonal',
    name: 'db_pool_utilization',
    source: 'prometheus',
    query: 'max(db_pool_connections_in_use{{sel}} / clamp_min(db_pool_connections_max{{sel}}, 1))',
    direction: 'up',
    minAbsDelta: 0.1,
  },
  // SLO: fast-burn alert from the Google SRE workbook (2% of a 30d budget in 1h).
  // `{slo_error_budget}` is replaced with (1 - sloTarget).
  {
    kind: 'threshold',
    name: 'slo_burn_rate_1h',
    source: 'prometheus',
    query:
      '(sum(rate(http_requests_total{{sel},status=~"5.."}[1h])) / clamp_min(sum(rate(http_requests_total{{sel}}[1h])), 1e-9)) / {slo_error_budget}',
    op: '>',
    threshold: 14.4,
  },
  // Predictive: raise before the resource runs out.
  {
    kind: 'threshold',
    name: 'memory_exhaustion_1h',
    source: 'predictive',
    query:
      'max(predict_linear(container_memory_working_set_bytes{{sel}}[30m], 3600) / clamp_min(container_spec_memory_limit_bytes{{sel}}, 1))',
    op: '>',
    threshold: 1,
  },
  {
    kind: 'threshold',
    name: 'disk_fill_4h',
    source: 'predictive',
    query: 'min(predict_linear(node_filesystem_avail_bytes{{sel}}[1h], 4 * 3600))',
    op: '<',
    threshold: 0,
  },
  {
    kind: 'threshold',
    name: 'db_pool_exhaustion_30m',
    source: 'predictive',
    query:
      'max(predict_linear(db_pool_connections_in_use{{sel}}[15m], 1800) / clamp_min(db_pool_connections_max{{sel}}, 1))',
    op: '>',
    threshold: 1,
  },
  // Logs
  {
    kind: 'seasonal',
    name: 'error_log_rate',
    source: 'loki',
    query: 'sum(count_over_time({sel} |~ "(?i)(error|exception|panic|fatal)" [5m]))',
    direction: 'up',
    minAbsDelta: 5,
  },
];

export function renderQuery(template: string, vars: { sel: string; sloTarget?: number }): string {
  return template
    .replaceAll('{sel}', vars.sel)
    .replaceAll('{slo_error_budget}', String(1 - (vars.sloTarget ?? 0.999)));
}
