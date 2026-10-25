import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import type { Service } from '../../db/schema.js';
import * as loki from '../../integrations/loki.js';
import * as prom from '../../integrations/prometheus.js';

// Tool output goes straight into the model context, so keep it small and summarized.
const MAX_POINTS = 60;
const MAX_LOG_LINES = 80;

function downsample<T>(values: T[], max: number): T[] {
  if (values.length <= max) return values;
  const step = values.length / max;
  return Array.from({ length: max }, (_, i) => values[Math.floor(i * step)]!);
}

/** Prometheus and Loki tools scoped to one service. The service selectors are offered as hints. */
export function telemetryTools(service: Service) {
  const promRange = new FunctionTool({
    name: 'prometheus_query_range',
    description:
      `Run a PromQL range query and get downsampled series. This service's label matcher is ${service.promSelector}; ` +
      'include it in every selector. Returns at most 60 points per series.',
    parameters: z.object({
      query: z.string().describe('PromQL expression'),
      minutesAgo: z.number().int().min(5).max(24 * 60).default(60).describe('Window start, in minutes before now'),
      stepSeconds: z.number().int().min(15).max(3600).default(60),
    }),
    execute: async ({ query, minutesAgo, stepSeconds }) => {
      const end = new Date();
      const series = await prom.rangeQuery(query, new Date(end.getTime() - minutesAgo * 60_000), end, stepSeconds);
      return series.slice(0, 10).map((s) => ({
        metric: s.metric,
        points: downsample(s.values, MAX_POINTS).map(([t, v]) => [new Date(t * 1000).toISOString(), Number(v.toPrecision(5))]),
      }));
    },
  });

  const promInstant = new FunctionTool({
    name: 'prometheus_query',
    description: `Run an instant PromQL query. This service's label matcher is ${service.promSelector}.`,
    parameters: z.object({ query: z.string().describe('PromQL expression') }),
    execute: async ({ query }) => (await prom.instantQuery(query)).slice(0, 25),
  });

  const lokiLogs = new FunctionTool({
    name: 'loki_query_logs',
    description:
      `Fetch log lines with LogQL, newest first. This service's stream selector is ${service.lokiSelector}. ` +
      'Add line filters (|= "timeout", |~ "(?i)error") to stay focused. Returns at most 80 lines.',
    parameters: z.object({
      query: z.string().describe('LogQL log query'),
      minutesAgo: z.number().int().min(1).max(24 * 60).default(30),
    }),
    execute: async ({ query, minutesAgo }) => {
      const end = new Date();
      const lines = await loki.queryLogs(query, new Date(end.getTime() - minutesAgo * 60_000), end, MAX_LOG_LINES);
      return lines.map((l) => ({ ts: l.timestamp.toISOString(), line: l.line.slice(0, 400) }));
    },
  });

  const lokiMetric = new FunctionTool({
    name: 'loki_metric_query',
    description: 'Evaluate a LogQL metric query (count_over_time, rate, sum by ...) at the current time.',
    parameters: z.object({ query: z.string().describe('LogQL metric query') }),
    execute: async ({ query }) => ({ value: await loki.metricQuery(query) }),
  });

  return { promRange, promInstant, lokiLogs, lokiMetric };
}
