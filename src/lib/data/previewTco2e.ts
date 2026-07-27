import type { FactorRecord } from "@/lib/calc";
import { resolveFactor } from "@/lib/calc/resolveFactor";

import { DATA_METRIC_BY_KEY } from "./metrics";

/**
 * Live tCO2e preview for a single activity figure (deterministic).
 * Returns null when the metric has no emission mapping or factor is missing.
 */
export function previewTco2e(opts: {
  metricKey: string;
  value: number | null;
  factors: FactorRecord[];
  region: string;
  year: number;
}): number | null {
  if (opts.value === null || !Number.isFinite(opts.value)) return null;
  const def = DATA_METRIC_BY_KEY[opts.metricKey];
  if (!def?.emissionFactorKey) return null;
  try {
    const factor = resolveFactor(
      opts.factors,
      def.emissionFactorKey,
      opts.region,
      opts.year,
    );
    return (opts.value * factor.value) / 1000;
  } catch {
    return null;
  }
}
