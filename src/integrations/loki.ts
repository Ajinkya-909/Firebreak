import { env } from '../config/env.js';

export interface LokiLine {
  timestamp: Date;
  labels: Record<string, string>;
  line: string;
}

interface LokiResponse {
  status: string;
  data: {
    resultType: 'streams' | 'matrix' | 'vector';
    result: Array<{
      stream?: Record<string, string>;
      metric?: Record<string, string>;
      values?: Array<[string, string]>;
      value?: [number, string];
    }>;
  };
}

async function get(path: string, params: Record<string, string>): Promise<LokiResponse> {
  const url = new URL(path, env.LOKI_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Loki ${path} failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as LokiResponse;
}

const toNs = (d: Date) => `${BigInt(d.getTime()) * 1_000_000n}`;

/** Metric LogQL (e.g. `sum(count_over_time(...))`) evaluated at a point in time. */
export async function metricQuery(query: string, time = new Date()): Promise<number | null> {
  const body = await get('/loki/api/v1/query', { query, time: toNs(time) });
  const v = body.data.result[0]?.value?.[1];
  return v === undefined ? null : Number(v);
}

/** Log lines for a LogQL stream query, newest first. */
export async function queryLogs(query: string, start: Date, end: Date, limit = 500): Promise<LokiLine[]> {
  const body = await get('/loki/api/v1/query_range', {
    query,
    start: toNs(start),
    end: toNs(end),
    limit: String(limit),
    direction: 'backward',
  });
  return body.data.result.flatMap((stream) =>
    (stream.values ?? []).map(([ts, line]) => ({
      timestamp: new Date(Number(BigInt(ts) / 1_000_000n)),
      labels: stream.stream ?? {},
      line,
    })),
  );
}
