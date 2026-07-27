/** Percentile helpers — pure. Cohort gate n >= 8 enforced at query time. */
export const MIN_COHORT_SIZE = 8;

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function computeCohortStats(values: number[]): {
  p25: number;
  p50: number;
  p75: number;
  cohortSize: number;
} | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length < MIN_COHORT_SIZE) return null;
  return {
    p25: Math.round(percentile(clean, 25) * 100) / 100,
    p50: Math.round(percentile(clean, 50) * 100) / 100,
    p75: Math.round(percentile(clean, 75) * 100) / 100,
    cohortSize: clean.length,
  };
}

/** Approximate percentile rank of value within cohort (0–100). */
export function percentileRank(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) return 0;
  let below = 0;
  for (const v of sortedAsc) {
    if (v < value) below += 1;
    else break;
  }
  return Math.round((below / sortedAsc.length) * 100);
}
