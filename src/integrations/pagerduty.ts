import { env } from '../config/env.js';

/** PagerDuty Events API v2. `dedupKey` keeps re-triggers for the same incident on one PD incident. */
export async function triggerPage(input: {
  dedupKey: string;
  summary: string;
  source: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  details?: Record<string, unknown>;
}): Promise<boolean> {
  if (!env.PAGERDUTY_ROUTING_KEY) return false;
  const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      routing_key: env.PAGERDUTY_ROUTING_KEY,
      event_action: 'trigger',
      dedup_key: input.dedupKey,
      payload: {
        summary: input.summary,
        source: input.source,
        severity: input.severity,
        custom_details: input.details,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`PagerDuty enqueue failed (${res.status}): ${await res.text()}`);
  return true;
}

export async function resolvePage(dedupKey: string): Promise<void> {
  if (!env.PAGERDUTY_ROUTING_KEY) return;
  const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ routing_key: env.PAGERDUTY_ROUTING_KEY, event_action: 'resolve', dedup_key: dedupKey }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`PagerDuty resolve failed (${res.status}): ${await res.text()}`);
}
