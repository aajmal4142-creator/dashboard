/**
 * Snapshot + PDF-friendly forecast summary for report export.
 * Pure formatting — calculation lives in lib/analytics/forecast.ts.
 */

import {
  formatProjectionSummary,
  type ForecastConfidence,
  type ForecastPoint,
  type ForecastResultSet,
  type ScenarioForecast,
} from "@/lib/analytics/forecast";

export type ReportForecastScenarioRow = {
  scenario: "conservative" | "baseline" | "aggressive";
  growthRate: number;
  year: number;
  emissions: number;
  lower: number;
  upper: number;
  summary: string;
};

export type ReportForecastSection = {
  confidence: ForecastConfidence;
  slopePerYear: number;
  latestHistoricalYear: number;
  latestHistoricalEmissions: number;
  scenarios: ReportForecastScenarioRow[];
  warnings: string[];
  methodology: string;
};

function rowFromScenario(
  s: ScenarioForecast,
  year?: number,
): ReportForecastScenarioRow | null {
  const point: ForecastPoint | undefined = year
    ? s.points.find((p) => p.year === year)
    : s.points[s.points.length - 1];
  if (!point) return null;
  return {
    scenario: s.scenario,
    growthRate: s.growthRate,
    year: point.year,
    emissions: point.emissions,
    lower: point.confidenceInterval.lower,
    upper: point.confidenceInterval.upper,
    summary: formatProjectionSummary(point),
  };
}

/** Map a full forecast result into a compact report section. */
export function buildReportForecastSection(
  result: ForecastResultSet,
  opts?: { focusYear?: number },
): ReportForecastSection {
  const focusYear = opts?.focusYear;
  const scenarios: ReportForecastScenarioRow[] = [];
  for (const s of [result.conservative, result.baseline, result.aggressive]) {
    const row = rowFromScenario(s, focusYear);
    if (row) scenarios.push(row);
  }

  const last = result.historical[result.historical.length - 1];

  return {
    confidence: result.confidence,
    slopePerYear: result.slopePerYear,
    latestHistoricalYear: last?.year ?? 0,
    latestHistoricalEmissions: last?.emissions ?? 0,
    scenarios,
    warnings: result.warnings,
    methodology: "linear_regression_trend_adjusted",
  };
}
