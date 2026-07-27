/**
 * Deterministic anomaly / sanity flags — rules only, zero model calls. §15.1.3
 */

export const ANOMALY_THRESHOLDS = {
  /** Flag if |value/median| > this or < 1/this (when cohort n≥8). */
  medianMultiple: 3,
  /** Flag period-over-period change beyond this fraction without evidence. */
  periodChange: 0.4,
  /** Magnitude heuristic: value looks like wrong unit scale if > this vs typical. */
  scaleJump: 1000,
} as const;

export type AnomalyFlag = {
  metricKey: string;
  reason: string;
  severity: "warn" | "high";
};

export type DatapointLike = {
  metricKey: string;
  value?: number | null;
  unit?: string | null;
  evidenceCount: number;
  priorValue?: number | null;
  cohortMedian?: number | null;
  cohortSize?: number | null;
};

export function detectAnomalies(points: DatapointLike[]): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  const { medianMultiple, periodChange, scaleJump } = ANOMALY_THRESHOLDS;

  for (const p of points) {
    if (p.value == null || Number.isNaN(p.value)) continue;

    if (
      p.cohortMedian != null &&
      p.cohortSize != null &&
      p.cohortSize >= 8 &&
      p.cohortMedian !== 0
    ) {
      const ratio = Math.abs(p.value / p.cohortMedian);
      if (ratio > medianMultiple || ratio < 1 / medianMultiple) {
        flags.push({
          metricKey: p.metricKey,
          severity: "high",
          reason: `Value is ${ratio.toFixed(1)}× the sector median (n=${p.cohortSize}).`,
        });
      }
    }

    if (p.priorValue != null && p.priorValue !== 0) {
      const delta = Math.abs(p.value - p.priorValue) / Math.abs(p.priorValue);
      if (delta > periodChange && p.evidenceCount === 0) {
        flags.push({
          metricKey: p.metricKey,
          severity: "warn",
          reason: `Changed ${(delta * 100).toFixed(0)}% vs prior period with no evidence attached.`,
        });
      }
    }

    if (p.priorValue != null && Math.abs(p.priorValue) > 0) {
      const jump = Math.abs(p.value / p.priorValue);
      if (jump >= scaleJump || jump <= 1 / scaleJump) {
        flags.push({
          metricKey: p.metricKey,
          severity: "warn",
          reason: `Magnitude jump suggests a unit/scale mismatch (×${jump.toFixed(0)}).`,
        });
      }
    }
  }

  return flags;
}
