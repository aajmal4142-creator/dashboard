/**
 * Scenario impact calculation and Monte Carlo simulation
 */

export interface Lever {
  id: string;
  name: string;
  category: "renewable" | "efficiency" | "behavior" | "fuel_switching" | "other";
  emissionsFactor: number; // tCO2e reduction per unit
  capexPerUnit: number; // $ per unit
  paybackYears: number;
  implementationTimeline: number; // years
}

export interface ScenarioVariable {
  leverId: string;
  leverName: string;
  currentValue: number; // current % or units
  targetValue: number; // target % or units
  capexRequired: number;
  paybackYears?: number;
  implementationTimeline: number;
}

export interface ScenarioResults {
  year1Emissions: number;
  year5Emissions: number;
  targetYearEmissions: number;
  totalCapex: number;
  annualOperatingCost: number;
  annualSavings: number;
  roi: number; // percentage
  paybackPeriod: number; // years
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

const EMISSION_REDUCTION_FACTORS: Record<string, number> = {
  renewable_energy: 0.8, // switching 1% to renewable = 0.8 tCO2e reduction
  energy_efficiency: 0.5, // 1% efficiency = 0.5 tCO2e reduction
  behavior_change: 0.3, // 1% participation = 0.3 tCO2e reduction
  fuel_switching: 0.7, // 1% fleet switch = 0.7 tCO2e reduction
  hvac_optimization: 0.4,
  waste_reduction: 0.2,
  supplier_engagement: 0.6,
  carbon_offset: 1.0,
};

/**
 * Calculate emissions reduction for a single lever
 */
export function calculateLeverImpact(
  lever: ScenarioVariable,
  baselineEmissions: number,
): number {
  const factor = EMISSION_REDUCTION_FACTORS[lever.leverId] || 0.5;
  const improvement = Math.abs(lever.targetValue - lever.currentValue);

  // Scale by baseline emissions and lever effectiveness
  return (improvement / 100) * baselineEmissions * factor;
}

/**
 * Calculate total scenario impact
 */
export function calculateScenarioImpact(
  variables: ScenarioVariable[],
  baselineEmissions: number,
  targetYear: number,
  baselineYear: number,
): ScenarioResults {
  let totalEmissionReduction = 0;
  let totalCapex = 0;

  const yearsToTarget = targetYear - baselineYear;

  // Calculate each lever's impact
  for (const lever of variables) {
    const reduction = calculateLeverImpact(lever, baselineEmissions);
    totalEmissionReduction += reduction;
    totalCapex += lever.capexRequired;
  }

  // Account for partial implementation over timeline
  const implementationFactor = Math.min(1, yearsToTarget / 5); // Linear ramp to full impact over 5 years
  const actualReduction = totalEmissionReduction * implementationFactor;

  // Calculate financial metrics
  const annualSavings = (actualReduction / baselineEmissions) * (baselineEmissions * 0.1); // Assume 10% cost per tCO2e avoided
  const annualOperatingCost = totalCapex * 0.05; // 5% annual maintenance
  const roi = ((annualSavings - annualOperatingCost) / totalCapex) * 100;
  const paybackPeriod = totalCapex / Math.max(annualSavings, 1);

  // Project emissions by year
  const year1Emissions = baselineEmissions - actualReduction * 0.2; // 20% implementation in year 1
  const year5Emissions = baselineEmissions - actualReduction;
  const targetYearEmissions = Math.max(year5Emissions, baselineEmissions * 0.5); // No lower than 50% of baseline

  // Calculate confidence intervals (simplified)
  const confidenceInterval = {
    p10: targetYearEmissions * 0.85,
    p25: targetYearEmissions * 0.92,
    p50: targetYearEmissions,
    p75: targetYearEmissions * 1.08,
    p90: targetYearEmissions * 1.15,
  };

  return {
    year1Emissions,
    year5Emissions,
    targetYearEmissions,
    totalCapex,
    annualOperatingCost,
    annualSavings,
    roi,
    paybackPeriod,
    confidenceInterval,
  };
}

/**
 * Monte Carlo simulation for scenario uncertainty
 */
export function runMonteCarloSimulation(
  variables: ScenarioVariable[],
  baselineEmissions: number,
  targetYear: number,
  baselineYear: number,
  iterations = 1000,
  uncertaintyRange = 0.15, // ±15% uncertainty
): MonteCarloSimulation {
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Add random variation to each variable
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
 * Sensitivity analysis - determine which levers have most impact
 */
export interface SensitivityResult {
  leverId: string;
  leverName: string;
  impactOnTargetEmissions: number; // percentage change in target emissions
  tornadoRank: number;
}

export function performSensitivityAnalysis(
  variables: ScenarioVariable[],
  baselineEmissions: number,
  targetYear: number,
  baselineYear: number,
): SensitivityResult[] {
  const baseline = calculateScenarioImpact(
    variables,
    baselineEmissions,
    targetYear,
    baselineYear,
  );
  const results: SensitivityResult[] = [];

  for (let i = 0; i < variables.length; i++) {
    // Vary this lever by ±20%
    const varied = [...variables];
    const originalTarget = varied[i]!.targetValue;
    varied[i]!.targetValue = originalTarget * 1.2; // +20%

    const withChange = calculateScenarioImpact(
      varied,
      baselineEmissions,
      targetYear,
      baselineYear,
    );

    const impact =
      ((baseline.targetYearEmissions - withChange.targetYearEmissions) /
        baseline.targetYearEmissions) *
      100;

    results.push({
      leverId: variables[i]!.leverId,
      leverName: variables[i]!.leverName,
      impactOnTargetEmissions: impact,
      tornadoRank: 0, // Set after sorting
    });
  }

  // Sort by impact and assign ranks
  results.sort(
    (a, b) => Math.abs(b.impactOnTargetEmissions) - Math.abs(a.impactOnTargetEmissions),
  );
  results.forEach((r, idx) => {
    r.tornadoRank = idx + 1;
  });

  return results;
}

/**
 * Calculate scenario payback period with investment schedule
 */
export function calculatePaybackSchedule(
  totalCapex: number,
  yearsToImplementation: number,
  annualSavings: number,
): { year: number; cumulative: number }[] {
  const schedule = [];
  let cumulative = 0;

  // Assume capex is spread over implementation period
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
