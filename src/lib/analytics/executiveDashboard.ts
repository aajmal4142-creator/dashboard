/**
 * Executive Dashboard Metrics
 * Provides KPI cards, status indicators, and YoY trends
 */

export type StatusIndicator = "green" | "yellow" | "red";

export interface KPICard {
  id: string;
  title: string;
  value: number;
  unit: string;
  status: StatusIndicator;
  trend: number; // YoY percentage change
  trendDirection: "up" | "down" | "neutral";
  comparison?: string;
  drill?: {
    route: string;
    params: Record<string, string>;
  };
}

export interface ExecutiveDashboard {
  kpis: KPICard[];
  summary: {
    totalEmissions: number;
    scopeCoverage: { scope1: number; scope2: number; scope3: number };
    yearOverYearChange: number;
    targetProgress: number;
  };
  alerts: Array<{
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
  }>;
  customLayout?: {
    gridColumns: number;
    order: string[];
  };
}

export interface DashboardThresholds {
  green: { min: number; max: number };
  yellow: { min: number; max: number };
  red: { min: number; max: number };
}

const DEFAULT_THRESHOLDS: Record<string, DashboardThresholds> = {
  emissions: {
    green: { min: 0, max: 100 },
    yellow: { min: 100, max: 150 },
    red: { min: 150, max: Infinity },
  },
  intensity: {
    green: { min: 0, max: 50 },
    yellow: { min: 50, max: 100 },
    red: { min: 100, max: Infinity },
  },
  renewable: {
    green: { min: 70, max: 100 },
    yellow: { min: 40, max: 70 },
    red: { min: 0, max: 40 },
  },
};

export function getStatusIndicator(
  value: number,
  thresholds: DashboardThresholds,
): StatusIndicator {
  if (value >= thresholds.green.min && value <= thresholds.green.max) return "green";
  if (value >= thresholds.yellow.min && value <= thresholds.yellow.max) return "yellow";
  return "red";
}

export function calculateKPIs(
  current: Record<string, number>,
  previous: Record<string, number>,
  thresholds?: Record<string, DashboardThresholds>,
): KPICard[] {
  const kpis: KPICard[] = [];

  const metrics = [
    {
      key: "total_emissions",
      title: "Total GHG Emissions",
      unit: "tCO2e",
      category: "emissions",
    },
    {
      key: "scope1_emissions",
      title: "Scope 1 Emissions",
      unit: "tCO2e",
      category: "emissions",
    },
    {
      key: "scope2_emissions",
      title: "Scope 2 Emissions",
      unit: "tCO2e",
      category: "emissions",
    },
    {
      key: "scope3_emissions",
      title: "Scope 3 Emissions",
      unit: "tCO2e",
      category: "emissions",
    },
    {
      key: "emissions_intensity",
      title: "Emissions Intensity",
      unit: "kgCO2e/€",
      category: "intensity",
    },
    {
      key: "renewable_percentage",
      title: "Renewable Energy Share",
      unit: "%",
      category: "renewable",
    },
    {
      key: "waste_diversion",
      title: "Waste Diversion Rate",
      unit: "%",
      category: "renewable",
    },
  ];

  metrics.forEach(({ key, title, unit, category }) => {
    const currentValue = current[key] || 0;
    const previousValue = previous[key] || 0;
    const change =
      previousValue === 0 ? 0 : ((currentValue - previousValue) / previousValue) * 100;

    const thresholdSet = thresholds?.[category] || DEFAULT_THRESHOLDS[category];
    const status = getStatusIndicator(currentValue, thresholdSet);

    kpis.push({
      id: key,
      title,
      value: Math.round(currentValue * 100) / 100,
      unit,
      status,
      trend: Math.round(change * 10) / 10,
      trendDirection: change > 0 ? "up" : change < 0 ? "down" : "neutral",
      comparison: `vs. ${Math.round(previousValue * 100) / 100} ${unit}`,
      drill: {
        route: `/analytics?metric=${key}`,
        params: { metric: key },
      },
    });
  });

  return kpis;
}

export function generateExecutiveSummary(kpis: KPICard[]): ExecutiveDashboard["summary"] {
  const emissions = kpis.find((k) => k.id === "total_emissions");
  const scope1 = kpis.find((k) => k.id === "scope1_emissions");
  const scope2 = kpis.find((k) => k.id === "scope2_emissions");
  const scope3 = kpis.find((k) => k.id === "scope3_emissions");

  const totalEmissions = emissions?.value || 0;
  const yearOverYearChange = emissions?.trend || 0;

  return {
    totalEmissions,
    scopeCoverage: {
      scope1: scope1?.value || 0,
      scope2: scope2?.value || 0,
      scope3: scope3?.value || 0,
    },
    yearOverYearChange,
    targetProgress: 0, // To be calculated based on targets
  };
}

export function generateAlerts(kpis: KPICard[]): ExecutiveDashboard["alerts"] {
  const alerts: ExecutiveDashboard["alerts"] = [];

  const redKPIs = kpis.filter((k) => k.status === "red");
  const yellowKPIs = kpis.filter((k) => k.status === "yellow");
  const negativeKPIs = kpis.filter((k) => k.trend > 5);

  if (redKPIs.length > 0) {
    alerts.push({
      severity: "critical",
      title: `${redKPIs.length} Critical KPI${redKPIs.length > 1 ? "s" : ""}`,
      description: `${redKPIs.map((k) => k.title).join(", ")} ${redKPIs.length > 1 ? "are" : "is"} above threshold.`,
    });
  }

  if (yellowKPIs.length > 0) {
    alerts.push({
      severity: "warning",
      title: `${yellowKPIs.length} Warning KPI${yellowKPIs.length > 1 ? "s" : ""}`,
      description: `${yellowKPIs.map((k) => k.title).join(", ")} ${yellowKPIs.length > 1 ? "are" : "is"} in caution zone.`,
    });
  }

  if (negativeKPIs.length > 0) {
    alerts.push({
      severity: "warning",
      title: `${negativeKPIs.length} Negative Trend${negativeKPIs.length > 1 ? "s" : ""}`,
      description: `${negativeKPIs.map((k) => k.title).join(",")} showing YoY increase.`,
    });
  }

  return alerts;
}

export function buildExecutiveDashboard(
  currentMetrics: Record<string, number>,
  previousMetrics: Record<string, number>,
  thresholds?: Record<string, DashboardThresholds>,
  customLayout?: { gridColumns?: number; order?: string[] },
): ExecutiveDashboard {
  const kpis = calculateKPIs(currentMetrics, previousMetrics, thresholds);
  const summary = generateExecutiveSummary(kpis);
  const alerts = generateAlerts(kpis);

  return {
    kpis,
    summary,
    alerts,
    customLayout: {
      gridColumns: customLayout?.gridColumns || 3,
      order: customLayout?.order || kpis.map((k) => k.id),
    },
  };
}
