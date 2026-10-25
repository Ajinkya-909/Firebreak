import { describe, expect, it } from 'vitest';
import { ewma, score, summarize } from '../src/detection/baseline.js';

const steady = Array.from({ length: 120 }, (_, i) => 100 + (i % 5) - 2); // 98..102

describe('seasonal z-score', () => {
  it('flags a spike well outside the baseline', () => {
    const r = score(150, summarize(steady), { threshold: 3, direction: 'up', minAbsDelta: 1 });
    expect(r.isAnomaly).toBe(true);
    expect(r.zScore).toBeGreaterThan(3);
  });

  it('ignores values inside normal variation', () => {
    expect(score(102, summarize(steady), { threshold: 3, direction: 'up', minAbsDelta: 1 }).isAnomaly).toBe(false);
  });

  it('respects direction', () => {
    const b = summarize(steady);
    expect(score(40, b, { threshold: 3, direction: 'up', minAbsDelta: 1 }).isAnomaly).toBe(false);
    expect(score(40, b, { threshold: 3, direction: 'down', minAbsDelta: 1 }).isAnomaly).toBe(true);
    expect(score(40, b, { threshold: 3, direction: 'both', minAbsDelta: 1 }).isAnomaly).toBe(true);
  });

  it('does not turn tiny moves on a flat baseline into anomalies', () => {
    const flat = summarize(Array(60).fill(0));
    expect(score(0.001, flat, { threshold: 3, direction: 'up', minAbsDelta: 0.01 }).isAnomaly).toBe(false);
    expect(score(0.2, flat, { threshold: 3, direction: 'up', minAbsDelta: 0.01 }).isAnomaly).toBe(true);
  });

  it('needs enough history before judging', () => {
    expect(score(1000, summarize([1, 2, 3]), { threshold: 3, direction: 'up', minAbsDelta: 1 }).isAnomaly).toBe(false);
  });
});

describe('ewma', () => {
  it('tracks the level of a series', () => {
    const b = ewma(steady);
    expect(b.mean).toBeGreaterThan(97);
    expect(b.mean).toBeLessThan(103);
    expect(b.samples).toBe(steady.length);
  });
});
