import { createHash } from 'node:crypto';

/**
 * Drain-lite log templating: mask the variable parts of a line so lines that differ only in
 * ids, numbers or addresses collapse into one signature. A signature never seen before for
 * a service is often the earliest sign that something new is broken.
 */
const MASKS: Array<[RegExp, string]> = [
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<ip>'],
  [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g, '<ts>'],
  [/\b0x[0-9a-f]+\b/gi, '<hex>'],
  [/\b[0-9a-f]{12,}\b/gi, '<hex>'],
  [/"[^"]{32,}"/g, '"<str>"'],
  [/\b\d+(?:\.\d+)?(?:ms|s|m|h|b|kb|mb|gb)?\b/gi, '<num>'],
];

export function toTemplate(line: string): string {
  let out = line.trim();
  // Structured logs: prefer the message field when the line is JSON.
  if (out.startsWith('{')) {
    try {
      const parsed = JSON.parse(out) as Record<string, unknown>;
      const msg = parsed.msg ?? parsed.message ?? parsed.error;
      if (typeof msg === 'string') out = msg;
    } catch {
      // not JSON, template the raw line
    }
  }
  for (const [re, token] of MASKS) out = out.replace(re, token);
  return out.replace(/\s+/g, ' ').slice(0, 300);
}

export function signatureOf(template: string): string {
  return createHash('sha1').update(template).digest('hex').slice(0, 16);
}

export interface PatternCount {
  signature: string;
  template: string;
  count: number;
  sample: string;
}

export function clusterLines(lines: string[]): PatternCount[] {
  const groups = new Map<string, PatternCount>();
  for (const line of lines) {
    const template = toTemplate(line);
    const signature = signatureOf(template);
    const existing = groups.get(signature);
    if (existing) existing.count++;
    else groups.set(signature, { signature, template, count: 1, sample: line.slice(0, 500) });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}
