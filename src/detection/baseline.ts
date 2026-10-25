import type { Direction } from './signals.js';

export interface Baseline {
  mean: number;
  std: number;
  samples: number;
}

export interface Score {
  zScore: number;
  isAnomaly: boolean;
}

export function summarize(values: number[]): Baseline {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0, samples: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1) : 0;
  return { mean, std: Math.sqrt(variance), samples: n };
}

/**
 * Score a value against a seasonal baseline (same hour-of-week over previous weeks).
 * A std floor keeps flat baselines from producing infinite z-scores, and `minAbsDelta`
 * suppresses statistically large but operationally meaningless moves.
 */
export function score(
  value: number,
  baseline: Baseline,
  opts: { threshold: number; direction: Direction; minAbsDelta: number; minSamples?: number },
): Score {
  const minSamples = opts.minSamples ?? 10;
  const delta = value - baseline.mean;
  const std = Math.max(baseline.std, Math.abs(baseline.mean) * 0.05, 1e-9);
  const zScore = delta / std;

  if (baseline.samples < minSamples || Math.abs(delta) < opts.minAbsDelta) {
    return { zScore, isAnomaly: false };
  }

  const crosses =
    opts.direction === 'up'
      ? zScore >= opts.threshold
      : opts.direction === 'down'
        ? zScore <= -opts.threshold
        : Math.abs(zScore) >= opts.threshold;

  return { zScore, isAnomaly: crosses };
}

/** Exponentially weighted moving average and variance, for signals without weekly seasonality. */
export function ewma(values: number[], alpha = 0.3): Baseline {
  if (values.length === 0) return { mean: 0, std: 0, samples: 0 };
  let mean = values[0]!;
  let variance = 0;
  for (const v of values.slice(1)) {
    const diff = v - mean;
    const incr = alpha * diff;
    mean += incr;
    variance = (1 - alpha) * (variance + diff * incr);
  }
  return { mean, std: Math.sqrt(variance), samples: values.length };
}
