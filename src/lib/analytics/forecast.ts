/**
 * Predictive emissions forecasting — pure functions, zero I/O.
 * Linear regression with growth, efficiency, and intervention adjustments.
 */

export type ForecastConfidence = "high" | "medium" | "low";

export type ForecastScenarioType = "conservative" | "baseline" | "aggressive";

export type EmissionsPeriod = {
  year: number;
  emissions: number;
};

export type ForecastIntervention = {
  /** Calendar year when the intervention takes effect */
  year: number;
  /** Absolute tCO2e reduction from that year onward (cumulative) */
  reductionTco2e: number;
  label?: string;
};

export type ForecastAssumptions = {
  /** Annual revenue / activity growth rate as a fraction (0.03 = 3%). */
  growthRate: number;
  /** Annual efficiency improvement as a fraction (0.02 = 2% less emissions per year). */
  efficiencyImprovement: number;
  interventions?: ForecastIntervention[];
};

export type ScenarioGrowthDefaults = {
  conservative: number;
  baseline: number;
  aggressive: number;
};

export type ForecastPoint = {
  year: number;
  emissions: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  reasoning: string;
};

export type ScenarioForecast = {
  scenario: ForecastScenarioType;
  growthRate: number;
  points: ForecastPoint[];
  confidence: ForecastConfidence;
  slopePerYear: number;
  latestHistoricalEmissions: number;
  latestHistoricalYear: number;
};

export type ForecastResultSet = {
  baseline: ScenarioForecast;
  conservative: ScenarioForecast;
  aggressive: ScenarioForecast;
  historical: EmissionsPeriod[];
  warnings: string[];
  confidence: ForecastConfidence;
  slopePerYear: number;
  assumptionsUsed: {
    growthRates: ScenarioGrowthDefaults;
    efficiencyImprovement: number;
    interventions: ForecastIntervention[];
    horizonYears: number;
  };
};

export type ForecastInput = {
  emissionsByPeriod: EmissionsPeriod[];
  /** Applied to baseline scenario when baselineGrowthRate not overridden. */
  orgGrowthRate?: number | null;
  efficiencyImprovement?: number;
  interventions?: ForecastIntervention[];
  /** Years ahead to project (1–5 recommended; >5 emits a warning). */
  horizonYears?: number;
  /** Override scenario growth rates (fractions). Defaults: 0 / 0.03 / 0.10. */
  scenarioGrowthRates?: Partial<ScenarioGrowthDefaults>;
};

export const DEFAULT_SCENARIO_GROWTH: ScenarioGrowthDefaults = {
  conservative: 0,
  baseline: 0.03,
  aggressive: 0.1,
};

export const ASSUMPTION_BOUNDS = {
  growthRate: { min: -0.5, max: 1 },
  efficiencyImprovement: { min: 0, max: 0.5 },
  horizonYears: { min: 1, max: 10 },
  warnHorizonYears: 5,
} as const;

const CI_WIDTH_BY_CONFIDENCE: Record<ForecastConfidence, number> = {
  high: 0.08,
  medium: 0.15,
  low: 0.28,
};

/**
 * Ordinary least-squares slope (emissions per year) and intercept.
 */
export function linearRegression(periods: EmissionsPeriod[]): {
  slope: number;
  intercept: number;
  meanX: number;
  meanY: number;
} {
  const n = periods.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, meanX: 0, meanY: 0 };
  }
  if (n === 1) {
    const p = periods[0]!;
    return { slope: 0, intercept: p.emissions, meanX: p.year, meanY: p.emissions };
  }

  const meanX = periods.reduce((s, p) => s + p.year, 0) / n;
  const meanY = periods.reduce((s, p) => s + p.emissions, 0) / n;

  let num = 0;
  let den = 0;
  for (const p of periods) {
    const dx = p.year - meanX;
    num += dx * (p.emissions - meanY);
    den += dx * dx;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept, meanX, meanY };
}

export function resolveForecastConfidence(yearCount: number): ForecastConfidence {
  if (yearCount >= 3) return "high";
  if (yearCount >= 2) return "medium";
  return "low";
}

export function validateAssumptions(input: {
  growthRate?: number;
  efficiencyImprovement?: number;
  horizonYears?: number;
}): string[] {
  const errors: string[] = [];
  if (input.growthRate !== undefined) {
    const { min, max } = ASSUMPTION_BOUNDS.growthRate;
    if (
      !Number.isFinite(input.growthRate) ||
      input.growthRate < min ||
      input.growthRate > max
    ) {
      errors.push(
        `growthRate must be between ${min * 100}% and ${max * 100}% (got ${input.growthRate}).`,
      );
    }
  }
  if (input.efficiencyImprovement !== undefined) {
    const { min, max } = ASSUMPTION_BOUNDS.efficiencyImprovement;
    if (
      !Number.isFinite(input.efficiencyImprovement) ||
      input.efficiencyImprovement < min ||
      input.efficiencyImprovement > max
    ) {
      errors.push(
        `efficiencyImprovement must be between ${min * 100}% and ${max * 100}% (got ${input.efficiencyImprovement}).`,
      );
    }
  }
  if (input.horizonYears !== undefined) {
    const { min, max } = ASSUMPTION_BOUNDS.horizonYears;
    if (
      !Number.isFinite(input.horizonYears) ||
      !Number.isInteger(input.horizonYears) ||
      input.horizonYears < min ||
      input.horizonYears > max
    ) {
      errors.push(`horizonYears must be an integer between ${min} and ${max}.`);
    }
  }
  return errors;
}

function clampNonNegative(n: number): number {
  return Math.max(0, n);
}

function roundEmissions(n: number): number {
  return Math.round(n * 100) / 100;
}

function cumulativeIntervention(
  interventions: ForecastIntervention[],
  year: number,
): { total: number; labels: string[] } {
  let total = 0;
  const labels: string[] = [];
  for (const iv of interventions) {
    if (iv.year <= year) {
      total += iv.reductionTco2e;
      if (iv.label) labels.push(iv.label);
    }
  }
  return { total, labels };
}

/**
 * Project one year under linear trend + growth + efficiency + interventions.
 *
 * emissions(h) = max(0,
 *   (last + slope·h) · (1+g)^h · (1−e)^h − Σ interventions ≤ year
 * )
 */
export function projectYear(params: {
  lastEmissions: number;
  lastYear: number;
  targetYear: number;
  slopePerYear: number;
  growthRate: number;
  efficiencyImprovement: number;
  interventions: ForecastIntervention[];
  confidence: ForecastConfidence;
}): ForecastPoint {
  const h = params.targetYear - params.lastYear;
  const trendBase = params.lastEmissions + params.slopePerYear * h;
  const growthAdj = Math.pow(1 + params.growthRate, h);
  const efficiencyAdj = Math.pow(1 - params.efficiencyImprovement, h);
  const { total: interventionSum, labels } = cumulativeIntervention(
    params.interventions,
    params.targetYear,
  );

  const raw = trendBase * growthAdj * efficiencyAdj - interventionSum;
  const emissions = roundEmissions(clampNonNegative(raw));

  const baseWidth = CI_WIDTH_BY_CONFIDENCE[params.confidence];
  const horizonWiden = 1 + 0.12 * Math.max(0, h - 1);
  const half = emissions * baseWidth * horizonWiden;
  const lower = roundEmissions(clampNonNegative(emissions - half));
  const upper = roundEmissions(emissions + half);

  const growthPct = (params.growthRate * 100).toFixed(1);
  const effPct = (params.efficiencyImprovement * 100).toFixed(1);
  const parts = [
    `Trend slope ${roundEmissions(params.slopePerYear)} tCO2e/yr`,
    `growth ${growthPct}%`,
    `efficiency −${effPct}%/yr`,
  ];
  if (interventionSum > 0) {
    parts.push(
      `interventions −${roundEmissions(interventionSum)} tCO2e` +
        (labels.length ? ` (${labels.join(", ")})` : ""),
    );
  }

  return {
    year: params.targetYear,
    emissions,
    confidenceInterval: { lower, upper },
    reasoning: `Based on ${params.confidence} confidence data: ${parts.join("; ")}.`,
  };
}

function buildScenario(
  scenario: ForecastScenarioType,
  growthRate: number,
  historical: EmissionsPeriod[],
  slope: number,
  last: EmissionsPeriod,
  horizonYears: number,
  efficiencyImprovement: number,
  interventions: ForecastIntervention[],
  confidence: ForecastConfidence,
): ScenarioForecast {
  const points: ForecastPoint[] = [];
  for (let h = 1; h <= horizonYears; h++) {
    points.push(
      projectYear({
        lastEmissions: last.emissions,
        lastYear: last.year,
        targetYear: last.year + h,
        slopePerYear: slope,
        growthRate,
        efficiencyImprovement,
        interventions,
        confidence,
      }),
    );
  }

  return {
    scenario,
    growthRate,
    points,
    confidence,
    slopePerYear: slope,
    latestHistoricalEmissions: last.emissions,
    latestHistoricalYear: last.year,
  };
}

/**
 * Forecast future emissions for conservative / baseline / aggressive scenarios.
 * Throws on invalid assumptions or empty history.
 */
export function calculateEmissionsForecast(input: ForecastInput): ForecastResultSet {
  const historical = [...input.emissionsByPeriod]
    .filter(
      (p) => Number.isFinite(p.year) && Number.isFinite(p.emissions) && p.emissions >= 0,
    )
    .sort((a, b) => a.year - b.year);

  if (historical.length === 0) {
    throw new Error("emissionsByPeriod requires at least one historical year.");
  }

  const horizonYears = input.horizonYears ?? 3;
  const efficiencyImprovement = input.efficiencyImprovement ?? 0;
  const interventions = input.interventions ?? [];

  const orgBaselineGrowth =
    typeof input.orgGrowthRate === "number" && Number.isFinite(input.orgGrowthRate)
      ? input.orgGrowthRate
      : DEFAULT_SCENARIO_GROWTH.baseline;

  const growthRates: ScenarioGrowthDefaults = {
    conservative:
      input.scenarioGrowthRates?.conservative ?? DEFAULT_SCENARIO_GROWTH.conservative,
    baseline: input.scenarioGrowthRates?.baseline ?? orgBaselineGrowth,
    aggressive:
      input.scenarioGrowthRates?.aggressive ?? DEFAULT_SCENARIO_GROWTH.aggressive,
  };

  const validationErrors = [
    ...validateAssumptions({
      growthRate: growthRates.conservative,
      efficiencyImprovement,
      horizonYears,
    }),
    ...validateAssumptions({ growthRate: growthRates.baseline }),
    ...validateAssumptions({ growthRate: growthRates.aggressive }),
  ];
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(" "));
  }

  for (const iv of interventions) {
    if (!Number.isFinite(iv.reductionTco2e) || iv.reductionTco2e < 0) {
      throw new Error(
        `Intervention reduction must be a non-negative number (got ${iv.reductionTco2e}).`,
      );
    }
  }

  const warnings: string[] = [];
  if (horizonYears > ASSUMPTION_BOUNDS.warnHorizonYears) {
    warnings.push(
      `Extrapolating ${horizonYears} years ahead exceeds the recommended ${ASSUMPTION_BOUNDS.warnHorizonYears}-year horizon; confidence intervals widen and results are less reliable.`,
    );
  }
  if (historical.length < 2) {
    warnings.push(
      "Fewer than 2 years of historical data; trend slope is zero and confidence is low.",
    );
  }

  const { slope } = linearRegression(historical);
  const confidence = resolveForecastConfidence(historical.length);
  const last = historical[historical.length - 1]!;

  const conservative = buildScenario(
    "conservative",
    growthRates.conservative,
    historical,
    slope,
    last,
    horizonYears,
    efficiencyImprovement,
    interventions,
    confidence,
  );
  const baseline = buildScenario(
    "baseline",
    growthRates.baseline,
    historical,
    slope,
    last,
    horizonYears,
    efficiencyImprovement,
    interventions,
    confidence,
  );
  const aggressive = buildScenario(
    "aggressive",
    growthRates.aggressive,
    historical,
    slope,
    last,
    horizonYears,
    efficiencyImprovement,
    interventions,
    confidence,
  );

  return {
    baseline,
    conservative,
    aggressive,
    historical,
    warnings,
    confidence,
    slopePerYear: roundEmissions(slope),
    assumptionsUsed: {
      growthRates,
      efficiencyImprovement,
      interventions,
      horizonYears,
    },
  };
}

/** Summary line for UI / PDF, e.g. "2027 forecast: 2,500 tCO2e (±200)". */
export function formatProjectionSummary(point: ForecastPoint): string {
  const mid = point.emissions;
  const half = Math.max(
    mid - point.confidenceInterval.lower,
    point.confidenceInterval.upper - mid,
  );
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return `${point.year} forecast: ${fmt(mid)} tCO2e (±${fmt(half)})`;
}
