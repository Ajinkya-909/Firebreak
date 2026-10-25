import { describe, expect, it } from 'vitest';
import { clusterLines, toTemplate } from '../src/detection/logPatterns.js';

describe('log templating', () => {
  it('masks ids, numbers and addresses', () => {
    expect(toTemplate('timeout after 3000ms calling 10.0.3.7:5432 for order 8f14e45f-ceea-467f-a0a1-1d2c3b4a5e6f')).toBe(
      'timeout after <num> calling <ip> for order <uuid>',
    );
  });

  it('uses the message field of JSON logs', () => {
    expect(toTemplate('{"level":"error","msg":"pool exhausted: 50 of 50 in use"}')).toBe('pool exhausted: <num> of <num> in use');
  });

  it('groups lines that differ only in variables', () => {
    const groups = clusterLines([
      'payment failed for user 17',
      'payment failed for user 42',
      'NullPointerException at CartService.java:88',
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ template: 'payment failed for user <num>', count: 2 });
  });
});
