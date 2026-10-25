import { env } from '../config/env.js';

export interface PromSample {
  metric: Record<string, string>;
  value: number;
}

export interface PromSeries {
  metric: Record<string, string>;
  values: Array<[timestampSec: number, value: number]>;
}

interface PromResponse<T> {
  status: 'success' | 'error';
  data: { resultType: string; result: T };
  error?: string;
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, env.PROMETHEUS_URL);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json()) as PromResponse<T>;
  if (!res.ok || body.status !== 'success') {
    throw new Error(`Prometheus ${path} failed (${res.status}): ${body.error ?? 'unknown error'}`);
  }
  return body.data.result;
}

/** Instant query. NaN/Inf samples (e.g. 0/0 error ratios) are dropped. */
export async function instantQuery(query: string, time?: Date): Promise<PromSample[]> {
  const result = await call<Array<{ metric: Record<string, string>; value: [number, string] }>>(
    '/api/v1/query',
    { query, ...(time && { time: String(time.getTime() / 1000) }) },
  );
  return result
    .map((r) => ({ metric: r.metric, value: Number(r.value[1]) }))
    .filter((s) => Number.isFinite(s.value));
}

export async function rangeQuery(query: string, start: Date, end: Date, stepSec: number): Promise<PromSeries[]> {
  const result = await call<Array<{ metric: Record<string, string>; values: Array<[number, string]> }>>(
    '/api/v1/query_range',
    {
      query,
      start: String(start.getTime() / 1000),
      end: String(end.getTime() / 1000),
      step: String(stepSec),
    },
  );
  return result.map((r) => ({
    metric: r.metric,
    values: r.values
      .map(([t, v]) => [t, Number(v)] as [number, number])
      .filter(([, v]) => Number.isFinite(v)),
  }));
}

/** Convenience for queries that aggregate to a single scalar series. */
export async function scalar(query: string, time?: Date): Promise<number | null> {
  const samples = await instantQuery(query, time);
  return samples[0]?.value ?? null;
}
