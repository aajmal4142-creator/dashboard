/**
 * Assurance freshness — Phase 4.
 * Never invent a green pass. Unset coverage → amber “coverage unknown”.
 */

export type FreshnessState = "ok" | "mismatch" | "unknown";

export type FreshnessResult = {
  state: FreshnessState;
  /** Short copy for UI. */
  label: string;
};

export function evidenceFreshness(input: {
  coverageStart?: string | null;
  coverageEnd?: string | null;
  periodStart: string;
  periodEnd: string;
}): FreshnessResult {
  const { coverageStart, coverageEnd, periodStart, periodEnd } = input;
  if (!coverageStart || !coverageEnd) {
    return { state: "unknown", label: "Coverage unknown" };
  }
  const cStart = Date.parse(coverageStart);
  const cEnd = Date.parse(coverageEnd);
  const pStart = Date.parse(periodStart);
  const pEnd = Date.parse(periodEnd);
  if ([cStart, cEnd, pStart, pEnd].some((n) => Number.isNaN(n))) {
    return { state: "unknown", label: "Coverage unknown" };
  }
  // Overlap: coverage intersects reporting period
  const overlaps = cStart <= pEnd && cEnd >= pStart;
  if (!overlaps) {
    return { state: "mismatch", label: "Coverage does not overlap period" };
  }
  return { state: "ok", label: "Coverage overlaps period" };
}
