/** Percentile helpers — pure. Cohort gate n >= 8 enforced at query time. */
export const MIN_COHORT_SIZE = 8;

/**
 * Documented cohort gate: never publish percentiles when n < MIN_COHORT_SIZE.
 * Prevents reverse-identification of individual peers.
 */
export const COHORT_GATE_NOTE = `Cohorts publish only when n >= ${MIN_COHORT_SIZE}. Opted-out organisations neither contribute nor appear. Responses never include peer organisation names or ids.`;

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export type CohortStats = {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  /** Privacy-safe best-in-class proxy (= p10). Never the raw cohort minimum. */
  best: number;
  cohortSize: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeCohortStats(values: number[]): CohortStats | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length < MIN_COHORT_SIZE) return null;
  const sum = clean.reduce((acc, v) => acc + v, 0);
  const p10 = round2(percentile(clean, 10));
  return {
    p10,
    p25: round2(percentile(clean, 25)),
    p50: round2(percentile(clean, 50)),
    p75: round2(percentile(clean, 75)),
    p90: round2(percentile(clean, 90)),
    mean: round2(sum / clean.length),
    best: p10,
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

/**
 * Build a synthetic ascending sample from stored percentiles for rank display.
 * Never uses raw peer values — no min/max leak.
 */
export function syntheticCohortSample(stats: {
  p10?: number;
  p25: number;
  p50: number;
  p75: number;
  p90?: number;
}): number[] {
  const p10 = stats.p10 ?? round2(stats.p25 * 0.7);
  const p90 = stats.p90 ?? round2(stats.p75 * 1.3);
  return [
    p10,
    stats.p25,
    round2((stats.p25 + stats.p50) / 2),
    stats.p50,
    round2((stats.p50 + stats.p75) / 2),
    stats.p75,
    round2((stats.p75 + p90) / 2),
    p90,
  ].sort((a, b) => a - b);
}

/**
 * Strip any accidental peer identity fields from an API payload shape.
 * Pure guard used in tests and response builders.
 */
export function assertNoPeerIdentities(payload: Record<string, unknown>): string[] {
  const forbidden = ["name", "orgName", "organisationName", "peerName", "companyName"];
  const leaks: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const next = path ? `${path}.${k}` : k;
      if (forbidden.includes(k) && typeof v === "string" && v.trim().length > 0) {
        // Allow metric labels / status strings that happen to use "name"-like keys only when empty;
        // any non-empty string under forbidden keys is a leak.
        leaks.push(next);
      }
      if (k === "peers" || k === "peerList" || k === "organisations") {
        leaks.push(next);
      }
      walk(v, next);
    }
  };
  walk(payload, "");
  return leaks;
}
