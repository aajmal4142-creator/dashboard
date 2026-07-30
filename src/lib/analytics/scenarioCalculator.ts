/**
 * Scenario impact calculation, Monte Carlo, and sensitivity analysis.
 * Pure — no I/O. Baseline emissions are injected by the caller (org calc / registry).
 */

export type ScenarioScope = 1 | 2 | 3;

export type ScenarioCategory =
  "renewable" | "efficiency" | "behavior" | "fuel_switching" | "other";

export interface Lever {
  id: string;
  name: string;
  category: ScenarioCategory;
  /** Fraction of applicable baseline reduced per percentage-point of lever change (0–1). Injected; never hardcoded fake factors. */
  effectiveness?: number;
  capexPerUnit: number;
  paybackYears: number;
  implementationTimeline: number;
}

export interface ScenarioVariable {
  leverId: string;
  leverName: string;
  currentValue: number;
  targetValue: number;
  capexRequired: number;
  paybackYears?: number;
  implementationTimeline: number;
  /** Optional effectiveness 0–1; default 1 = percentage points map 1:1 onto applicable baseline. */
  effectiveness?: number;
}

export interface ScopeBaseline {
  scope1: number;
  scope2: number;
  scope3: number;
}

export interface ScopeEmissions {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface TrajectoryPoint {
  year: number;
  emissions: number;
}

export interface ScenarioResults {
  baseline: ScopeEmissions;
  scenario: ScopeEmissions;
  delta: number;
  reductionPercentApplied: number;
  trajectory: TrajectoryPoint[];
  /** Calendar year when projected trajectory reaches ≤0, or null if never. */
  netZeroYear: number | null;
  year1Emissions: number;
  year5Emissions: number;
  targetYearEmissions: number;
  totalCapex: number;
  /** Null when no cost-per-tCO2e / savings data was provided. */
  annualOperatingCost: number | null;
  annualSavings: number | null;
  roi: number | null;
  paybackPeriod: number | null;
  confidenceInterval: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

export interface MonteCarloSimulation {
  iterations: number;
  results: number[];
  mean: number;
  median: number;
  stdDev: number;
  confidenceIntervals: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

export interface SensitivityResult {
  leverId: string;
  leverName: string;
  /** % change in target emissions when this lever target moves +10%. */
  impactOnTargetEmissions: number;
  /** Absolute swing between −10% and +10% lever target (tCO2e). */
  swingTco2e: number;
  tornadoRank: number;
}

export interface ReductionScenarioInput {
  baseline: ScopeBaseline;
  reductionPercent: number;
  scopes: ScenarioScope[];
  baselineYear: number;
  targetYear: number;
  timelineYears?: number;
  capex?: number;
  /** Optional $ / tCO2e avoided — enables cost-benefit fields. */
  costPerTco2e?: number;
  annualOperatingCostRate?: number;
}

function totalOf(b: ScopeBaseline): number {
  return b.scope1 + b.scope2 + b.scope3;
}

function toScopeEmissions(b: ScopeBaseline): ScopeEmissions {
  return {
    scope1: b.scope1,
    scope2: b.scope2,
    scope3: b.scope3,
    total: totalOf(b),
  };
}

function clampNonNegative(n: number): number {
  return Math.max(0, n);
}

function applicableBaseline(baseline: ScopeBaseline, scopes: ScenarioScope[]): number {
  let sum = 0;
  for (const s of scopes) {
    if (s === 1) sum += baseline.scope1;
    else if (s === 2) sum += baseline.scope2;
    else if (s === 3) sum += baseline.scope3;
  }
  return sum;
}

function applyReductionToScopes(
  baseline: ScopeBaseline,
  scopes: ScenarioScope[],
  reductionTco2e: number,
): ScopeBaseline {
  const applicable = applicableBaseline(baseline, scopes);
  if (applicable <= 0 || reductionTco2e <= 0) {
    return { ...baseline };
  }

  const capped = Math.min(reductionTco2e, applicable);
  const next: ScopeBaseline = {
    scope1: baseline.scope1,
    scope2: baseline.scope2,
    scope3: baseline.scope3,
  };

  for (const s of scopes) {
    const key = s === 1 ? "scope1" : s === 2 ? "scope2" : "scope3";
    const share = baseline[key] / applicable;
    next[key] = clampNonNegative(baseline[key] - capped * share);
  }

  return next;
}

function buildTrajectory(
  baselineTotal: number,
  scenarioTotal: number,
  baselineYear: number,
  targetYear: number,
): TrajectoryPoint[] {
  const years = Math.max(1, targetYear - baselineYear);
  const points: TrajectoryPoint[] = [];
  for (let i = 0; i <= years; i++) {
    const t = i / years;
    points.push({
      year: baselineYear + i,
      emissions: clampNonNegative(baselineTotal + (scenarioTotal - baselineTotal) * t),
    });
  }
  return points;
}

function estimateNetZeroYear(
  trajectory: TrajectoryPoint[],
  baselineTotal: number,
  annualReduction: number,
  baselineYear: number,
): number | null {
  if (annualReduction <= 0 || baselineTotal <= 0) return null;

  for (const p of trajectory) {
    if (p.emissions <= 0) return p.year;
  }

  const yearsNeeded = baselineTotal / annualReduction;
  if (!Number.isFinite(yearsNeeded) || yearsNeeded <= 0) return null;
  return Math.ceil(baselineYear + yearsNeeded);
}

function financials(
  delta: number,
  totalCapex: number,
  costPerTco2e: number | undefined,
  annualOperatingCostRate: number | undefined,
): Pick<
  ScenarioResults,
  "annualSavings" | "annualOperatingCost" | "roi" | "paybackPeriod"
> {
  if (
    costPerTco2e === undefined ||
    costPerTco2e === null ||
    !Number.isFinite(costPerTco2e)
  ) {
    return {
      annualSavings: null,
      annualOperatingCost: null,
      roi: null,
      paybackPeriod: null,
    };
  }

  const annualSavings = delta * costPerTco2e;
  const annualOperatingCost =
    totalCapex > 0 ? totalCapex * (annualOperatingCostRate ?? 0.05) : 0;
  const roi =
    totalCapex > 0 ? ((annualSavings - annualOperatingCost) / totalCapex) * 100 : null;
  const paybackPeriod =
    annualSavings > 0 ? totalCapex / annualSavings : totalCapex > 0 ? Infinity : 0;

  return {
    annualSavings,
    annualOperatingCost,
    roi,
    paybackPeriod: Number.isFinite(paybackPeriod) ? paybackPeriod : null,
  };
}

function confidenceAround(target: number) {
  return {
    p10: target * 0.85,
    p25: target * 0.92,
    p50: target,
    p75: target * 1.08,
    p90: target * 1.15,
  };
}

/**
 * Primary AC path: reduction % applied to selected scope(s) over a timeline.
 */
export function calculateScopeReductionImpact(
  input: ReductionScenarioInput,
): ScenarioResults {
  const reductionPercent = Math.min(100, Math.max(0, input.reductionPercent));
  const scopes = input.scopes.length > 0 ? input.scopes : ([1, 2, 3] as ScenarioScope[]);
  const baselineEmissions = toScopeEmissions(input.baseline);
  const applicable = applicableBaseline(input.baseline, scopes);
  const reductionTco2e = (reductionPercent / 100) * applicable;
  const scenarioBaseline = applyReductionToScopes(input.baseline, scopes, reductionTco2e);
  const scenarioEmissions = toScopeEmissions(scenarioBaseline);
  const delta = clampNonNegative(baselineEmissions.total - scenarioEmissions.total);

  const yearsSpan = Math.max(
    1,
    input.timelineYears ?? input.targetYear - input.baselineYear,
  );
  const targetYear = input.baselineYear + yearsSpan;
  const trajectory = buildTrajectory(
    baselineEmissions.total,
    scenarioEmissions.total,
    input.baselineYear,
    Math.max(targetYear, input.targetYear),
  );

  const annualReduction = delta / yearsSpan;
  const netZeroYear = estimateNetZeroYear(
    trajectory,
    baselineEmissions.total,
    annualReduction,
    input.baselineYear,
  );

  const year1Emissions =
    trajectory.find((p) => p.year === input.baselineYear + 1)?.emissions ??
    clampNonNegative(baselineEmissions.total - annualReduction);
  const year5Point = trajectory.find((p) => p.year === input.baselineYear + 5);
  const year5Emissions = year5Point
    ? year5Point.emissions
    : clampNonNegative(
        baselineEmissions.total - annualReduction * Math.min(5, yearsSpan),
      );

  const totalCapex = input.capex ?? 0;
  const money = financials(
    delta,
    totalCapex,
    input.costPerTco2e,
    input.annualOperatingCostRate,
  );

  return {
    baseline: baselineEmissions,
    scenario: scenarioEmissions,
    delta,
    reductionPercentApplied: reductionPercent,
    trajectory,
    netZeroYear,
    year1Emissions,
    year5Emissions,
    targetYearEmissions: scenarioEmissions.total,
    totalCapex,
    ...money,
    confidenceInterval: confidenceAround(scenarioEmissions.total),
  };
}

/**
 * Lever impact: percentage-point improvement × applicable baseline × optional effectiveness.
 * Effectiveness must be injected (or defaults to 1). No silent fake registry factors.
 */
export function calculateLeverImpact(
  lever: ScenarioVariable,
  baselineEmissions: number,
): number {
  const improvement = Math.abs(lever.targetValue - lever.currentValue);
  const effectiveness =
    typeof lever.effectiveness === "number" && Number.isFinite(lever.effectiveness)
      ? Math.min(1, Math.max(0, lever.effectiveness))
      : 1;
  return (improvement / 100) * baselineEmissions * effectiveness;
}

/**
 * Aggregate lever-based scenario impact (Monte Carlo / sensitivity still use this).
 */
export function calculateScenarioImpact(
  variables: ScenarioVariable[],
  baselineEmissions: number,
  targetYear: number,
  baselineYear: number,
  opts?: {
    costPerTco2e?: number;
    scopes?: ScenarioScope[];
    scopeBaseline?: ScopeBaseline;
  },
): ScenarioResults {
  const scopeBaseline: ScopeBaseline = opts?.scopeBaseline ?? {
    scope1: baselineEmissions,
    scope2: 0,
    scope3: 0,
  };
  const scopes = opts?.scopes ?? ([1, 2, 3] as ScenarioScope[]);
  const applicable = applicableBaseline(scopeBaseline, scopes);
  const baseTotal = totalOf(scopeBaseline) || baselineEmissions;
  const workingBaseline = applicable > 0 ? applicable : baseTotal;

  let totalEmissionReduction = 0;
  let totalCapex = 0;

  const yearsToTarget = Math.max(1, targetYear - baselineYear);

  for (const lever of variables) {
    totalEmissionReduction += calculateLeverImpact(lever, workingBaseline);
    totalCapex += lever.capexRequired;
  }

  const implementationFactor = Math.min(1, yearsToTarget / 5);
  const actualReduction = Math.min(
    workingBaseline,
    totalEmissionReduction * implementationFactor,
  );

  const scenarioScopes = applyReductionToScopes(scopeBaseline, scopes, actualReduction);
  // If baseline was a flat total only, reduce total proportionally
  const scenarioTotal =
    totalOf(scopeBaseline) > 0
      ? totalOf(scenarioScopes)
      : clampNonNegative(baseTotal - actualReduction);

  const baselineScopeEmissions =
    totalOf(scopeBaseline) > 0
      ? toScopeEmissions(scopeBaseline)
      : { scope1: baseTotal, scope2: 0, scope3: 0, total: baseTotal };

  const scenarioScopeEmissions =
    totalOf(scopeBaseline) > 0
      ? toScopeEmissions(scenarioScopes)
      : { scope1: scenarioTotal, scope2: 0, scope3: 0, total: scenarioTotal };

  const delta = clampNonNegative(
    baselineScopeEmissions.total - scenarioScopeEmissions.total,
  );
  const trajectory = buildTrajectory(
    baselineScopeEmissions.total,
    scenarioScopeEmissions.total,
    baselineYear,
    targetYear,
  );
  const annualReduction = delta / yearsToTarget;
  const netZeroYear = estimateNetZeroYear(
    trajectory,
    baselineScopeEmissions.total,
    annualReduction,
    baselineYear,
  );

  const year1Emissions = clampNonNegative(
    baselineScopeEmissions.total - actualReduction * Math.min(1, 1 / yearsToTarget),
  );
  const year5Emissions = scenarioScopeEmissions.total;
  const targetYearEmissions = scenarioScopeEmissions.total;

  const money = financials(delta, totalCapex, opts?.costPerTco2e, 0.05);
  const reductionPercentApplied =
    workingBaseline > 0 ? (actualReduction / workingBaseline) * 100 : 0;

  return {
    baseline: baselineScopeEmissions,
    scenario: scenarioScopeEmissions,
    delta,
    reductionPercentApplied,
    trajectory,
    netZeroYear,
    year1Emissions,
    year5Emissions,
    targetYearEmissions,
    totalCapex,
    ...money,
    confidenceInterval: confidenceAround(targetYearEmissions),
  };
}

/**
 * Monte Carlo simulation — default uncertainty ±10%.
 */
export function runMonteCarloSimulation(
  variables: ScenarioVariable[],
  baselineEmissions: number,
  targetYear: number,
  baselineYear: number,
  iterations = 1000,
  uncertaintyRange = 0.1,
  opts?: {
    costPerTco2e?: number;
    scopes?: ScenarioScope[];
    scopeBaseline?: ScopeBaseline;
  },
): MonteCarloSimulation {
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const variatedVariables = variables.map((v) => ({
      ...v,
      currentValue: v.currentValue * (1 + (Math.random() - 0.5) * uncertaintyRange),
      targetValue: v.targetValue * (1 + (Math.random() - 0.5) * uncertaintyRange),
      capexRequired:
        v.capexRequired * (1 + (Math.random() - 0.5) * uncertaintyRange * 0.5),
    }));

    const scenario = calculateScenarioImpact(
      variatedVariables,
      baselineEmissions,
      targetYear,
      baselineYear,
      opts,
    );
    results.push(scenario.targetYearEmissions);
  }

  results.sort((a, b) => a - b);

  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  const median = results[Math.floor(results.length / 2)]!;
  const variance =
    results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / results.length;
  const stdDev = Math.sqrt(variance);

  return {
    iterations,
    results,
    mean,
    median,
    stdDev,
    confidenceIntervals: {
      p10: results[Math.floor(results.length * 0.1)]!,
      p25: results[Math.floor(results.length * 0.25)]!,
      p50: median,
      p75: results[Math.floor(results.length * 0.75)]!,
      p90: results[Math.floor(results.length * 0.9)]!,
    },
  };
}

/**
 * Sensitivity analysis — vary each lever target by ±10%.
 */
export function performSensitivityAnalysis(
  variables: ScenarioVariable[],
  baselineEmissions: number,
  targetYear: number,
  baselineYear: number,
  opts?: {
    costPerTco2e?: number;
    scopes?: ScenarioScope[];
    scopeBaseline?: ScopeBaseline;
  },
): SensitivityResult[] {
  const baseline = calculateScenarioImpact(
    variables,
    baselineEmissions,
    targetYear,
    baselineYear,
    opts,
  );
  const results: SensitivityResult[] = [];

  for (let i = 0; i < variables.length; i++) {
    const plus = variables.map((v, idx) =>
      idx === i ? { ...v, targetValue: v.targetValue * 1.1 } : { ...v },
    );
    const minus = variables.map((v, idx) =>
      idx === i ? { ...v, targetValue: v.targetValue * 0.9 } : { ...v },
    );

    const withPlus = calculateScenarioImpact(
      plus,
      baselineEmissions,
      targetYear,
      baselineYear,
      opts,
    );
    const withMinus = calculateScenarioImpact(
      minus,
      baselineEmissions,
      targetYear,
      baselineYear,
      opts,
    );

    const impact =
      baseline.targetYearEmissions === 0
        ? 0
        : ((baseline.targetYearEmissions - withPlus.targetYearEmissions) /
            baseline.targetYearEmissions) *
          100;

    results.push({
      leverId: variables[i]!.leverId,
      leverName: variables[i]!.leverName,
      impactOnTargetEmissions: impact,
      swingTco2e: Math.abs(withMinus.targetYearEmissions - withPlus.targetYearEmissions),
      tornadoRank: 0,
    });
  }

  results.sort(
    (a, b) => Math.abs(b.impactOnTargetEmissions) - Math.abs(a.impactOnTargetEmissions),
  );
  results.forEach((r, idx) => {
    r.tornadoRank = idx + 1;
  });

  return results;
}

/**
 * Payback schedule when cost-benefit data is present.
 */
export function calculatePaybackSchedule(
  totalCapex: number,
  yearsToImplementation: number,
  annualSavings: number,
): { year: number; cumulative: number }[] {
  const schedule = [];
  let cumulative = 0;
  const yearlyCapex = totalCapex / Math.max(yearsToImplementation, 1);

  for (let year = 1; year <= 10; year++) {
    const yearCost = year <= yearsToImplementation ? yearlyCapex : 0;
    const yearlySavings =
      year > yearsToImplementation
        ? annualSavings
        : annualSavings * (year / yearsToImplementation);

    cumulative += yearlySavings - yearCost;
    schedule.push({ year, cumulative });
  }

  return schedule;
}

export interface ScenarioCompareRow {
  year: number;
  baseline: number;
  scenarios: Record<string, number>;
}

/**
 * Side-by-side trajectory compare for up to 3 scenarios.
 */
export function compareScenarioTrajectories(
  baselineTotal: number,
  baselineYear: number,
  scenarios: Array<{
    id: string;
    name: string;
    trajectory: TrajectoryPoint[];
  }>,
): { rows: ScenarioCompareRow[]; names: Record<string, string> } {
  const selected = scenarios.slice(0, 3);
  const yearSet = new Set<number>([baselineYear]);
  for (const s of selected) {
    for (const p of s.trajectory) yearSet.add(p.year);
  }
  const years = Array.from(yearSet).sort((a, b) => a - b);
  const names: Record<string, string> = {};
  for (const s of selected) names[s.id] = s.name;

  const rows: ScenarioCompareRow[] = years.map((year) => {
    const scenariosAtYear: Record<string, number> = {};
    for (const s of selected) {
      const point = s.trajectory.find((p) => p.year === year);
      const last = s.trajectory[s.trajectory.length - 1];
      scenariosAtYear[s.id] = point?.emissions ?? last?.emissions ?? baselineTotal;
    }
    return {
      year,
      baseline: baselineTotal,
      scenarios: scenariosAtYear,
    };
  });

  return { rows, names };
}
