/**
 * Root Cause Analysis Engine
 * Enables drill-down analysis by supplier, facility, category, and source
 */

export interface DrilldownDimension {
  name: "supplier" | "facility" | "category" | "source" | "period";
  value: string | number;
  label: string;
}

export interface ContributorChart {
  contributor: string;
  value: number;
  percentageChange: number;
  percentageOfTotal: number;
  contribution: "increase" | "decrease" | "neutral";
}

export interface RootCauseAnalysis {
  metricKey: string;
  totalValue: number;
  previousValue: number;
  change: number;
  percentageChange: number;
  contributors: ContributorChart[];
  dimensions: {
    bySupplier: Record<string, { value: number; change: number }>;
    byFacility: Record<string, { value: number; change: number }>;
    byCategory: Record<string, { value: number; change: number }>;
    bySource: Record<string, { value: number; change: number }>;
  };
  topDrivers: Array<{ dimension: string; contributor: string; impact: number }>;
}

export interface ExportFormat {
  format: "csv" | "json" | "excel";
  data: string | object;
  filename: string;
  mimeType: string;
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function analyzeContributors(
  current: Record<string, number>,
  previous: Record<string, number>,
): ContributorChart[] {
  const contributors: ContributorChart[] = [];
  const totalCurrent = Object.values(current).reduce((a, b) => a + b, 0);

  Object.entries(current).forEach(([contributor, value]) => {
    const prevValue = previous[contributor] || 0;
    const change = value - prevValue;
    const percentageChange = calculatePercentageChange(value, prevValue);
    const percentageOfTotal = totalCurrent > 0 ? (value / totalCurrent) * 100 : 0;

    contributors.push({
      contributor,
      value,
      percentageChange,
      percentageOfTotal,
      contribution: change > 0 ? "increase" : change < 0 ? "decrease" : "neutral",
    });
  });

  // Sort by absolute change
  return contributors.sort((a, b) =>
    Math.abs(
      b.value -
        (previous[b.contributor] || 0) -
        (a.value - (previous[a.contributor] || 0)),
    ),
  );
}

export function performRootCauseAnalysis(
  metricKey: string,
  current: {
    bySupplier: Record<string, number>;
    byFacility: Record<string, number>;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
  },
  previous: {
    bySupplier: Record<string, number>;
    byFacility: Record<string, number>;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
  },
): RootCauseAnalysis {
  const totalCurrent = Object.values(current.bySupplier).reduce((a, b) => a + b, 0);
  const totalPrevious = Object.values(previous.bySupplier).reduce((a, b) => a + b, 0);
  const change = totalCurrent - totalPrevious;
  const percentageChange = calculatePercentageChange(totalCurrent, totalPrevious);

  // Analyze each dimension
  const supplierContributors = analyzeContributors(
    current.bySupplier,
    previous.bySupplier,
  );
  const facilityContributors = analyzeContributors(
    current.byFacility,
    previous.byFacility,
  );
  const categoryContributors = analyzeContributors(
    current.byCategory,
    previous.byCategory,
  );
  const sourceContributors = analyzeContributors(current.bySource, previous.bySource);

  // Calculate contribution by dimension
  const dimensions = {
    bySupplier: {} as Record<string, { value: number; change: number }>,
    byFacility: {} as Record<string, { value: number; change: number }>,
    byCategory: {} as Record<string, { value: number; change: number }>,
    bySource: {} as Record<string, { value: number; change: number }>,
  };

  Object.entries(current.bySupplier).forEach(([key, value]) => {
    dimensions.bySupplier[key] = {
      value,
      change: value - (previous.bySupplier[key] || 0),
    };
  });

  Object.entries(current.byFacility).forEach(([key, value]) => {
    dimensions.byFacility[key] = {
      value,
      change: value - (previous.byFacility[key] || 0),
    };
  });

  Object.entries(current.byCategory).forEach(([key, value]) => {
    dimensions.byCategory[key] = {
      value,
      change: value - (previous.byCategory[key] || 0),
    };
  });

  Object.entries(current.bySource).forEach(([key, value]) => {
    dimensions.bySource[key] = {
      value,
      change: value - (previous.bySource[key] || 0),
    };
  });

  // Identify top drivers
  const allDrivers = [
    ...supplierContributors.map((c) => ({
      dimension: "supplier",
      contributor: c.contributor,
      impact: Math.abs(c.value - (previous.bySupplier[c.contributor] || 0)),
    })),
    ...facilityContributors.map((c) => ({
      dimension: "facility",
      contributor: c.contributor,
      impact: Math.abs(c.value - (previous.byFacility[c.contributor] || 0)),
    })),
    ...categoryContributors.map((c) => ({
      dimension: "category",
      contributor: c.contributor,
      impact: Math.abs(c.value - (previous.byCategory[c.contributor] || 0)),
    })),
    ...sourceContributors.map((c) => ({
      dimension: "source",
      contributor: c.contributor,
      impact: Math.abs(c.value - (previous.bySource[c.contributor] || 0)),
    })),
  ];

  const topDrivers = allDrivers.sort((a, b) => b.impact - a.impact).slice(0, 5);

  return {
    metricKey,
    totalValue: totalCurrent,
    previousValue: totalPrevious,
    change,
    percentageChange,
    contributors: supplierContributors,
    dimensions,
    topDrivers,
  };
}

export function exportRootCauseAnalysis(
  analysis: RootCauseAnalysis,
  format: "csv" | "json" | "excel" = "csv",
): ExportFormat {
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `root-cause-${analysis.metricKey}-${timestamp}`;

  if (format === "json") {
    return {
      format: "json",
      data: JSON.stringify(analysis, null, 2),
      filename: `${filename}.json`,
      mimeType: "application/json",
    };
  }

  if (format === "csv") {
    const rows: string[] = [];
    rows.push("Root Cause Analysis Export");
    rows.push(`Metric: ${analysis.metricKey}`);
    rows.push(`Total Value: ${analysis.totalValue}`);
    rows.push(`Previous Value: ${analysis.previousValue}`);
    rows.push(`Change: ${analysis.change} (${analysis.percentageChange.toFixed(2)}%)`);
    rows.push("");

    rows.push("Top Drivers");
    rows.push("Dimension,Contributor,Impact");
    analysis.topDrivers.forEach((driver) => {
      rows.push(`${driver.dimension},${driver.contributor},${driver.impact.toFixed(2)}`);
    });
    rows.push("");

    rows.push("By Supplier");
    rows.push("Supplier,Value,Change");
    Object.entries(analysis.dimensions.bySupplier).forEach(([key, data]) => {
      rows.push(`${key},${data.value},${data.change}`);
    });

    return {
      format: "csv",
      data: rows.join("\n"),
      filename: `${filename}.csv`,
      mimeType: "text/csv",
    };
  }

  return {
    format: "excel",
    data: analysis,
    filename: `${filename}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
