const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h}h ${min % 60}m` : `${h}h`;
}

export function formatSeconds(sec: number | null | undefined): string {
  if (sec == null) return '—';
  if (sec < 90) return `${Math.round(sec)}s`;
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
}

const dateTime = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatTime = (iso: string) => time.format(new Date(iso));

export const pct = (n: number | null | undefined, digits = 0) => (n == null ? '—' : `${(n * 100).toFixed(digits)}%`);

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCompact = (n: number) => compact.format(n);

export const formatUsd = (n: number) => (n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);

/** Signal values span ratios, seconds, bytes and counts; pick a readable form per signal. */
export function formatSignalValue(signal: string, value: number): string {
  if (signal.includes('ratio') || signal.includes('utilization') || signal.includes('exhaustion')) return pct(value, 1);
  if (signal.includes('latency')) return value < 1 ? `${Math.round(value * 1000)}ms` : `${value.toFixed(2)}s`;
  if (signal.includes('bytes')) return `${formatCompact(value / 1024 / 1024)} MiB`;
  return Number.isInteger(value) ? formatCompact(value) : value.toPrecision(3);
}

export const humanize = (s: string) => s.replaceAll('_', ' ');
