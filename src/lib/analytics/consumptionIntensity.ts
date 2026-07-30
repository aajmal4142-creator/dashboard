/**
 * Consumption intensity metrics and decoupling analysis
 */

export interface IntensityMetric {
  metricKey: string;
  value: number;
  unit: string;
  calculation: string;
}

export interface IntensityTrend {
  year: number;
  emissions: number;
  driver: number;
  intensity: number;
  yoYChange: number;
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
  perRevenue: number; // tCO2e per $M revenue
  perEmployee: number; // tCO2e per employee
  perUnit?: number; // tCO2e per production unit (if applicable)
  trends: IntensityTrend[];
  decoupling: DecouplingAnalysis;
  targetVsActual: {
    intensityTarget: number;
    intensityActual: number;
    onTrack: boolean;
  };
}

/**
 * Calculate emissions per revenue (tCO2e/$M revenue)
 */
export function calculateEmissionsPerRevenue(
  totalEmissions: number, // tCO2e
  annualRevenue: number, // $ (actual dollars)
): number {
  if (annualRevenue <= 0) return 0;
  return (totalEmissions / annualRevenue) * 1000; // per $M
}

/**
 * Calculate emissions per employee (tCO2e/employee)
 */
export function calculateEmissionsPerEmployee(
  totalEmissions: number, // tCO2e
  employeeCount: number,
): number {
  if (employeeCount <= 0) return 0;
  return totalEmissions / employeeCount;
}

/**
 * Calculate emissions per production unit
 */
export function calculateEmissionsPerUnit(
  totalEmissions: number, // tCO2e
  productionUnits: number,
): number {
  if (productionUnits <= 0) return 0;
  return totalEmissions / productionUnits;
}

/**
 * Calculate year-over-year intensity change
 */
export function calculateYoYChange(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * Build intensity trends over multiple years
 */
export function buildIntensityTrends(
  yearlyData: Array<{
    year: number;
    emissions: number; // tCO2e
    revenue?: number;
    employees?: number;
    productionUnits?: number;
  }>,
  driverType: "revenue" | "employees" | "production",
): IntensityTrend[] {
  const trends: IntensityTrend[] = [];

  for (let i = 0; i < yearlyData.length; i++) {
    const data = yearlyData[i]!;
    let driver = 0;

    if (driverType === "revenue" && data.revenue) {
      driver = data.revenue;
    } else if (driverType === "employees" && data.employees) {
      driver = data.employees;
    } else if (driverType === "production" && data.productionUnits) {
      driver = data.productionUnits;
    }

    const intensity = driver > 0 ? data.emissions / driver : 0;

    let yoYChange = 0;
    if (i > 0) {
      const prevData = yearlyData[i - 1]!;
      let prevDriver = 0;

      if (driverType === "revenue" && prevData.revenue) {
        prevDriver = prevData.revenue;
      } else if (driverType === "employees" && prevData.employees) {
        prevDriver = prevData.employees;
      } else if (driverType === "production" && prevData.productionUnits) {
        prevDriver = prevData.productionUnits;
      }

      const prevIntensity = prevDriver > 0 ? prevData.emissions / prevDriver : 0;
      yoYChange = calculateYoYChange(intensity, prevIntensity);
    }

    trends.push({
      year: data.year,
      emissions: data.emissions,
      driver,
      intensity,
      yoYChange,
    });
  }

  return trends;
}

/**
 * Analyze decoupling: emissions growing slower than business activity
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

  const periods = [];
  const firstYear = yearlyData[0]!;
  const lastYear = yearlyData[yearlyData.length - 1]!;

  // Calculate total growth over period
  const emissionGrowth = (lastYear.emissions - firstYear.emissions) / firstYear.emissions;
  const driverGrowth = (lastYear.driver - firstYear.driver) / firstYear.driver;

  let decoupling: "relative" | "absolute" | "none" = "none";

  if (emissionGrowth < 0 && driverGrowth > 0) {
    decoupling = "absolute"; // Emissions decreased while business grew
  } else if (emissionGrowth < driverGrowth) {
    decoupling = "relative"; // Emissions growing slower than business
  }

  periods.push({
    startYear: firstYear.year,
    endYear: lastYear.year,
    emissionGrowth: emissionGrowth * 100,
    driverGrowth: driverGrowth * 100,
    decoupling,
  });

  // Generate summary
  let summary = "";
  if (decoupling === "absolute") {
    summary = `✓ Absolute decoupling achieved: Emissions decreased ${Math.abs(emissionGrowth * 100).toFixed(1)}% while business grew ${(driverGrowth * 100).toFixed(1)}%.`;
  } else if (decoupling === "relative") {
    summary = `✓ Relative decoupling achieved: Emissions grew ${(emissionGrowth * 100).toFixed(1)}% vs. business growth of ${(driverGrowth * 100).toFixed(1)}%.`;
  } else if (emissionGrowth <= 0) {
    summary = `✓ Strong performance: Emissions decreased while maintaining business.`;
  } else {
    summary = `✗ No decoupling: Emissions growing faster than business activity.`;
  }

  return { periods, summary };
}

/**
 * Calculate intensity metrics for comprehensive ESG reporting
 */
export function calculateIntensityMetrics(
  data: {
    year: number;
    emissions: number;
    revenue: number;
    employees: number;
    productionUnits?: number;
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

  const perRevenue = calculateEmissionsPerRevenue(latest.emissions, latest.revenue);
  const perEmployee = calculateEmissionsPerEmployee(latest.emissions, latest.employees);
  const perUnit = latest.productionUnits
    ? calculateEmissionsPerUnit(latest.emissions, latest.productionUnits)
    : undefined;

  // Build trends for revenue-driven intensity
  const revenueTrends = buildIntensityTrends(data, "revenue");

  // Analyze decoupling
  const decouplingData = revenueTrends.map((t) => ({
    year: t.year,
    emissions: t.emissions,
    driver: t.driver,
  }));
  const decoupling = analyzeDecoupling(decouplingData);

  // Check if on track for targets
  const targetVsActual = {
    intensityTarget: intensityTargets?.perRevenue || 0,
    intensityActual: perRevenue,
    onTrack: true,
  };

  if (intensityTargets?.perRevenue) {
    targetVsActual.onTrack = perRevenue <= intensityTargets.perRevenue;
  }

  return {
    perRevenue,
    perEmployee,
    perUnit,
    trends: revenueTrends,
    decoupling,
    targetVsActual,
  };
}

/**
 * Generate intensity report for board presentation
 */
export interface IntensityReport {
  title: string;
  keyMetrics: {
    label: string;
    value: number;
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

  const perRevenueTrend = previousTrend
    ? calculateYoYChange(metrics.perRevenue, previousTrend.intensity)
    : 0;

  const recommendations: string[] = [];

  if (perRevenueTrend < -5) {
    recommendations.push("✓ Excellent: Intensity improving faster than business growth");
  } else if (perRevenueTrend > 5) {
    recommendations.push(
      "⚠ Warning: Intensity increasing; review energy consumption patterns",
    );
  }

  if (metrics.decoupling.periods[0]?.decoupling === "absolute") {
    recommendations.push("✓ Achieved absolute decoupling; maintain current initiatives");
  } else if (metrics.decoupling.periods[0]?.decoupling === "relative") {
    recommendations.push(
      "→ Relative decoupling in progress; accelerate efficiency programs",
    );
  }

  if (!metrics.targetVsActual.onTrack && metrics.targetVsActual.intensityTarget > 0) {
    recommendations.push(
      `⚠ Off target: Current intensity ${metrics.perRevenue.toFixed(2)} vs. target ${metrics.targetVsActual.intensityTarget.toFixed(2)}`,
    );
  }

  return {
    title: "Emissions Intensity Report",
    keyMetrics: [
      {
        label: "tCO2e per $M Revenue",
        value: metrics.perRevenue,
        unit: "tCO2e/$M",
        trend: perRevenueTrend.toFixed(1) + "%",
      },
      {
        label: "tCO2e per Employee",
        value: metrics.perEmployee,
        unit: "tCO2e/emp",
        trend: latestTrend?.yoYChange.toFixed(1) + "%" || "N/A",
      },
    ],
    decouplingStatus: metrics.decoupling.summary,
    recommendations,
  };
}
