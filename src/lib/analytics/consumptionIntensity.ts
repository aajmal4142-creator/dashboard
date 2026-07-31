/**
 * Emissions intensity metrics and decoupling analysis.
 * Pure — zero I/O. Missing/zero denominators return null, never silent 0.
 */

export type IntensityType =
  "per_revenue" | "per_employee" | "per_output" | "per_square_meter";

export type IntensityConfidence = "high" | "medium" | "low" | "missing";

export type IntensityPeerStatus =
  "better_than_median" | "worse_than_median" | "at_median" | "unavailable";

export type EmissionsIntensityResult = {
  value: number | null;
  unit: string;
  confidence: IntensityConfidence;
  changePercent: number | null;
  explanation: string | null;
};

export type CalculateEmissionsIntensityOptions = {
  /** Prior-period intensity for YoY change% */
  previousValue?: number | null;
  /**
   * Divide denominator by this before intensity (e.g. 1_000_000 → per $M
   * when annualRevenue is in absolute currency units).
   */
  denominatorScale?: number;
  /** Override default missing/zero explanation */
  missingExplanation?: string;
  /** Confidence when value is present */
  confidence?: IntensityConfidence;
};

/** Default unit labels — override via `unit` argument (never hardcode-only). */
export const DEFAULT_INTENSITY_UNITS: Record<IntensityType, string> = {
  per_revenue: "tCO2e/$M",
  per_employee: "tCO2e/employee",
  per_output: "tCO2e/unit",
  per_square_meter: "tCO2e/m²",
};

export const INTENSITY_TYPES = [
  "per_revenue",
  "per_employee",
  "per_output",
  "per_square_meter",
] as const satisfies ReadonlyArray<IntensityType>;

export interface IntensityMetric {
  metricKey: string;
  value: number | null;
  unit: string;
  calculation: string;
}

export interface IntensityTrend {
  year: number;
  emissions: number;
  driver: number | null;
  intensity: number | null;
  yoYChange: number | null;
}

export interface DecouplingAnalysis {
  periods: Array<{
    startYear: number;
    endYear: number;
    emissionGrowth: number;
    driverGrowth: number;
    decoupling: "relative" | "absolute" | "none";
  }>;
  summary: string;
}

export interface IntensityMetrics {
  perRevenue: number | null;
  perEmployee: number | null;
  perUnit: number | null;
  perSquareMeter: number | null;
  trends: IntensityTrend[];
  decoupling: DecouplingAnalysis;
  targetVsActual: {
    intensityTarget: number | null;
    intensityActual: number | null;
    onTrack: boolean | null;
  };
}

/**
 * Core intensity calculator.
 * value is null when denominator is missing or ≤ 0 — never silent 0.
 */
export function calculateEmissionsIntensity(
  totalEmissions: number,
  denominator: number | null | undefined,
  unit: string,
  options: CalculateEmissionsIntensityOptions = {},
): EmissionsIntensityResult {
  const {
    previousValue = null,
    denominatorScale = 1,
    missingExplanation,
    confidence = "high",
  } = options;

  if (denominator === null || denominator === undefined) {
    return {
      value: null,
      unit,
      confidence: "missing",
      changePercent: null,
      explanation:
        missingExplanation ??
        "Denominator is missing. Intensity cannot be calculated without a positive activity driver.",
    };
  }

  if (!(denominator > 0) || !Number.isFinite(denominator)) {
    return {
      value: null,
      unit,
      confidence: "missing",
      changePercent: null,
      explanation:
        missingExplanation ??
        "Denominator is zero or invalid. Intensity cannot be calculated (division by zero avoided).",
    };
  }

  if (!Number.isFinite(totalEmissions)) {
    return {
      value: null,
      unit,
      confidence: "missing",
      changePercent: null,
      explanation: "Total emissions is not a finite number.",
    };
  }

  const scale =
    denominatorScale > 0 && Number.isFinite(denominatorScale) ? denominatorScale : 1;
  const scaledDenominator = denominator / scale;
  if (!(scaledDenominator > 0)) {
    return {
      value: null,
      unit,
      confidence: "missing",
      changePercent: null,
      explanation:
        missingExplanation ??
        "Scaled denominator is zero or invalid. Intensity cannot be calculated.",
    };
  }

  const value = totalEmissions / scaledDenominator;
  const changePercent = calculateYoYChange(value, previousValue ?? null);

  return {
    value,
    unit,
    confidence,
    changePercent,
    explanation: null,
  };
}

/**
 * Emissions per $M revenue. `annualRevenue` in absolute currency units.
 * Returns null when revenue missing/zero.
 */
export function calculateEmissionsPerRevenue(
  totalEmissions: number,
  annualRevenue: number | null | undefined,
  unit: string = DEFAULT_INTENSITY_UNITS.per_revenue,
): EmissionsIntensityResult {
  return calculateEmissionsIntensity(totalEmissions, annualRevenue, unit, {
    denominatorScale: 1_000_000,
    missingExplanation:
      "Annual revenue is missing or zero. Add annualRevenue on the organisation to compute per-revenue intensity.",
  });
}

/**
 * Emissions per employee. Returns null when headcount missing/zero.
 */
export function calculateEmissionsPerEmployee(
  totalEmissions: number,
  employeeCount: number | null | undefined,
  unit: string = DEFAULT_INTENSITY_UNITS.per_employee,
): EmissionsIntensityResult {
  return calculateEmissionsIntensity(totalEmissions, employeeCount, unit, {
    missingExplanation:
      "Employee count is missing or zero. Add employeeCount on the organisation to compute per-employee intensity.",
  });
}

/**
 * Emissions per production / output unit. Unit label is caller-configurable.
 */
export function calculateEmissionsPerUnit(
  totalEmissions: number,
  productionUnits: number | null | undefined,
  unit: string = DEFAULT_INTENSITY_UNITS.per_output,
): EmissionsIntensityResult {
  return calculateEmissionsIntensity(totalEmissions, productionUnits, unit, {
    missingExplanation:
      "Annual output units are missing or zero. Add annualOutputUnits on the organisation to compute per-output intensity.",
  });
}

/**
 * Emissions per square meter of floor area.
 */
export function calculateEmissionsPerSquareMeter(
  totalEmissions: number,
  floorAreaSqm: number | null | undefined,
  unit: string = DEFAULT_INTENSITY_UNITS.per_square_meter,
): EmissionsIntensityResult {
  return calculateEmissionsIntensity(totalEmissions, floorAreaSqm, unit, {
    missingExplanation:
      "Floor area (m²) is missing or zero. Configure floorAreaSqm on the organisation to compute intensity per square meter.",
  });
}

/**
 * Build a configurable unit string for output intensity, e.g. "tCO2e/widgets".
 */
export function buildOutputIntensityUnit(
  outputUnitLabel: string | null | undefined,
  emissionsUnit = "tCO2e",
): string {
  const label = (outputUnitLabel ?? "").trim();
  if (!label) return `${emissionsUnit}/unit`;
  return `${emissionsUnit}/${label}`;
}

/**
 * Year-over-year intensity change %. Null when either side missing or previous is 0.
 */
export function calculateYoYChange(
  currentValue: number | null,
  previousValue: number | null,
): number | null {
  if (currentValue === null || previousValue === null) return null;
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null;
  if (previousValue === 0) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * Compare intensity to peer median. Lower intensity is better.
 */
export function compareIntensityToMedian(
  value: number | null,
  median: number | null,
  tolerancePct = 5,
): IntensityPeerStatus {
  if (
    value === null ||
    median === null ||
    !Number.isFinite(value) ||
    !Number.isFinite(median)
  ) {
    return "unavailable";
  }
  if (median === 0) {
    return value === 0
      ? "at_median"
      : value < 0
        ? "better_than_median"
        : "worse_than_median";
  }
  const deltaPct = ((value - median) / Math.abs(median)) * 100;
  if (Math.abs(deltaPct) <= tolerancePct) return "at_median";
  // Lower intensity = better
  return deltaPct < 0 ? "better_than_median" : "worse_than_median";
}

export type IntensityDenominators = {
  annualRevenue?: number | null;
  employeeCount?: number | null;
  annualOutputUnits?: number | null;
  outputUnitLabel?: string | null;
  floorAreaSqm?: number | null;
  /** Override default units per type */
  units?: Partial<Record<IntensityType, string>>;
};

/**
 * Resolve intensity for one type given emissions + org denominators.
 */
export function resolveIntensityForType(
  type: IntensityType,
  totalEmissions: number,
  denominators: IntensityDenominators,
  previousValue: number | null = null,
): EmissionsIntensityResult {
  const units = denominators.units ?? {};

  let result: EmissionsIntensityResult;
  switch (type) {
    case "per_revenue":
      result = calculateEmissionsPerRevenue(
        totalEmissions,
        denominators.annualRevenue,
        units.per_revenue ?? DEFAULT_INTENSITY_UNITS.per_revenue,
      );
      break;
    case "per_employee":
      result = calculateEmissionsPerEmployee(
        totalEmissions,
        denominators.employeeCount,
        units.per_employee ?? DEFAULT_INTENSITY_UNITS.per_employee,
      );
      break;
    case "per_output": {
      const unit =
        units.per_output ?? buildOutputIntensityUnit(denominators.outputUnitLabel);
      result = calculateEmissionsPerUnit(
        totalEmissions,
        denominators.annualOutputUnits,
        unit,
      );
      break;
    }
    case "per_square_meter":
      result = calculateEmissionsPerSquareMeter(
        totalEmissions,
        denominators.floorAreaSqm,
        units.per_square_meter ?? DEFAULT_INTENSITY_UNITS.per_square_meter,
      );
      break;
    default: {
      const _exhaustive: never = type;
      return {
        value: null,
        unit: String(_exhaustive),
        confidence: "missing",
        changePercent: null,
        explanation: "Unknown intensity type.",
      };
    }
  }

  if (previousValue !== null && result.value !== null) {
    return {
      ...result,
      changePercent: calculateYoYChange(result.value, previousValue),
    };
  }
  return result;
}

/**
 * Build intensity trends over multiple years.
 */
export function buildIntensityTrends(
  yearlyData: Array<{
    year: number;
    emissions: number;
    revenue?: number | null;
    employees?: number | null;
    productionUnits?: number | null;
    floorAreaSqm?: number | null;
  }>,
  driverType: "revenue" | "employees" | "production" | "floor_area",
): IntensityTrend[] {
  const trends: IntensityTrend[] = [];

  for (let i = 0; i < yearlyData.length; i++) {
    const data = yearlyData[i]!;
    let driver: number | null = null;
    let intensityType: IntensityType = "per_revenue";

    if (driverType === "revenue") {
      driver = data.revenue ?? null;
      intensityType = "per_revenue";
    } else if (driverType === "employees") {
      driver = data.employees ?? null;
      intensityType = "per_employee";
    } else if (driverType === "production") {
      driver = data.productionUnits ?? null;
      intensityType = "per_output";
    } else {
      driver = data.floorAreaSqm ?? null;
      intensityType = "per_square_meter";
    }

    const intensityResult = resolveIntensityForType(intensityType, data.emissions, {
      annualRevenue: driverType === "revenue" ? driver : null,
      employeeCount: driverType === "employees" ? driver : null,
      annualOutputUnits: driverType === "production" ? driver : null,
      floorAreaSqm: driverType === "floor_area" ? driver : null,
    });

    let yoYChange: number | null = null;
    if (i > 0) {
      const prev = trends[i - 1]!;
      yoYChange = calculateYoYChange(intensityResult.value, prev.intensity);
    }

    trends.push({
      year: data.year,
      emissions: data.emissions,
      driver,
      intensity: intensityResult.value,
      yoYChange,
    });
  }

  return trends;
}

/**
 * Analyze decoupling: emissions growing slower than business activity.
 */
export function analyzeDecoupling(
  yearlyData: Array<{
    year: number;
    emissions: number;
    driver: number;
  }>,
): DecouplingAnalysis {
  if (yearlyData.length < 2) {
    return {
      periods: [],
      summary: "Not enough data for decoupling analysis",
    };
  }

  const firstYear = yearlyData[0]!;
  const lastYear = yearlyData[yearlyData.length - 1]!;

  if (!(firstYear.emissions > 0) || !(firstYear.driver > 0)) {
    return {
      periods: [],
      summary:
        "Baseline emissions or driver is missing or zero; decoupling cannot be assessed.",
    };
  }

  const emissionGrowth = (lastYear.emissions - firstYear.emissions) / firstYear.emissions;
  const driverGrowth = (lastYear.driver - firstYear.driver) / firstYear.driver;

  let decoupling: "relative" | "absolute" | "none" = "none";

  if (emissionGrowth < 0 && driverGrowth > 0) {
    decoupling = "absolute";
  } else if (emissionGrowth < driverGrowth) {
    decoupling = "relative";
  }

  const periods = [
    {
      startYear: firstYear.year,
      endYear: lastYear.year,
      emissionGrowth: emissionGrowth * 100,
      driverGrowth: driverGrowth * 100,
      decoupling,
    },
  ];

  let summary = "";
  if (decoupling === "absolute") {
    summary = `Absolute decoupling: emissions decreased ${Math.abs(emissionGrowth * 100).toFixed(1)}% while activity grew ${(driverGrowth * 100).toFixed(1)}%.`;
  } else if (decoupling === "relative") {
    summary = `Relative decoupling: emissions grew ${(emissionGrowth * 100).toFixed(1)}% vs activity growth of ${(driverGrowth * 100).toFixed(1)}%.`;
  } else if (emissionGrowth <= 0) {
    summary = "Emissions decreased while activity held steady or declined.";
  } else {
    summary = "No decoupling: emissions growing at or above activity growth.";
  }

  return { periods, summary };
}

/**
 * Calculate intensity metrics for comprehensive ESG reporting.
 */
export function calculateIntensityMetrics(
  data: {
    year: number;
    emissions: number;
    revenue: number | null;
    employees: number | null;
    productionUnits?: number | null;
    floorAreaSqm?: number | null;
  }[],
  intensityTargets?: {
    perRevenue?: number;
    perEmployee?: number;
    perUnit?: number;
  },
): IntensityMetrics {
  if (data.length === 0) {
    throw new Error("No data provided");
  }

  const latest = data[data.length - 1]!;

  const perRevenue = calculateEmissionsPerRevenue(latest.emissions, latest.revenue).value;
  const perEmployee = calculateEmissionsPerEmployee(
    latest.emissions,
    latest.employees,
  ).value;
  const perUnit =
    latest.productionUnits != null
      ? calculateEmissionsPerUnit(latest.emissions, latest.productionUnits).value
      : null;
  const perSquareMeter =
    latest.floorAreaSqm != null
      ? calculateEmissionsPerSquareMeter(latest.emissions, latest.floorAreaSqm).value
      : null;

  const revenueTrends = buildIntensityTrends(data, "revenue");

  const decouplingData = revenueTrends
    .filter(
      (t): t is IntensityTrend & { driver: number } => t.driver != null && t.driver > 0,
    )
    .map((t) => ({
      year: t.year,
      emissions: t.emissions,
      driver: t.driver,
    }));
  const decoupling = analyzeDecoupling(decouplingData);

  const targetVsActual = {
    intensityTarget: intensityTargets?.perRevenue ?? null,
    intensityActual: perRevenue,
    onTrack: null as boolean | null,
  };

  if (intensityTargets?.perRevenue != null && perRevenue != null) {
    targetVsActual.onTrack = perRevenue <= intensityTargets.perRevenue;
  }

  return {
    perRevenue,
    perEmployee,
    perUnit,
    perSquareMeter,
    trends: revenueTrends,
    decoupling,
    targetVsActual,
  };
}

export interface IntensityReport {
  title: string;
  keyMetrics: {
    label: string;
    value: number | null;
    unit: string;
    trend: string;
  }[];
  decouplingStatus: string;
  recommendations: string[];
}

export function generateIntensityReport(metrics: IntensityMetrics): IntensityReport {
  const trends = metrics.trends;
  const latestTrend = trends[trends.length - 1];
  const previousTrend = trends.length > 1 ? trends[trends.length - 2] : null;

  const perRevenueTrend =
    previousTrend && metrics.perRevenue != null && previousTrend.intensity != null
      ? calculateYoYChange(metrics.perRevenue, previousTrend.intensity)
      : null;

  const recommendations: string[] = [];

  if (perRevenueTrend != null && perRevenueTrend < -5) {
    recommendations.push("Intensity improving faster than activity growth.");
  } else if (perRevenueTrend != null && perRevenueTrend > 5) {
    recommendations.push("Intensity increasing; review energy consumption patterns.");
  }

  if (metrics.decoupling.periods[0]?.decoupling === "absolute") {
    recommendations.push("Absolute decoupling achieved; maintain current initiatives.");
  } else if (metrics.decoupling.periods[0]?.decoupling === "relative") {
    recommendations.push(
      "Relative decoupling in progress; accelerate efficiency programs.",
    );
  }

  if (
    metrics.targetVsActual.onTrack === false &&
    metrics.targetVsActual.intensityTarget != null &&
    metrics.perRevenue != null
  ) {
    recommendations.push(
      `Off target: current intensity ${metrics.perRevenue.toFixed(2)} vs target ${metrics.targetVsActual.intensityTarget.toFixed(2)}.`,
    );
  }

  return {
    title: "Emissions Intensity Report",
    keyMetrics: [
      {
        label: "tCO2e per $M Revenue",
        value: metrics.perRevenue,
        unit: DEFAULT_INTENSITY_UNITS.per_revenue,
        trend: perRevenueTrend != null ? `${perRevenueTrend.toFixed(1)}%` : "N/A",
      },
      {
        label: "tCO2e per Employee",
        value: metrics.perEmployee,
        unit: DEFAULT_INTENSITY_UNITS.per_employee,
        trend:
          latestTrend?.yoYChange != null ? `${latestTrend.yoYChange.toFixed(1)}%` : "N/A",
      },
    ],
    decouplingStatus: metrics.decoupling.summary,
    recommendations,
  };
}

/** Metric keys used for peer intensity cohort lookups */
export function intensityBenchmarkMetricKey(type: IntensityType): string {
  switch (type) {
    case "per_revenue":
      return "emissions_intensity_revenue";
    case "per_employee":
      return "emissions_intensity_employee";
    case "per_output":
      return "emissions_intensity_output";
    case "per_square_meter":
      return "emissions_intensity_sqm";
    default: {
      const _exhaustive: never = type;
      return String(_exhaustive);
    }
  }
}
