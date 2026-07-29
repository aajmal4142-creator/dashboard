export type ChartType = "bar" | "line" | "pie" | "area" | "scatter";

export type ChartConfig = {
  type: ChartType;
  title: string;
  xAxis?: string;
  yAxis?: string;
  dataKey?: string;
  categories?: string[];
};

export type ChartDatapoint = Record<string, unknown> & {
  scope?: string;
  value?: number;
  createdAt?: string | Date;
  name?: string;
  category?: string;
};

export type ChartSeriesPoint = {
  name: string;
  value: number;
  count: number;
};

export function transformDatapointsToChartData(
  datapoints: ChartDatapoint[],
  config: ChartConfig,
): ChartSeriesPoint[] {
  const grouped: Record<string, ChartSeriesPoint> = {};

  for (const dp of datapoints) {
    const categoryKey = config.categories?.[0];
    const category = categoryKey
      ? String(dp[categoryKey] ?? "unknown")
      : String(dp.scope || "unknown");
    if (!grouped[category]) {
      grouped[category] = { name: category, value: 0, count: 0 };
    }
    grouped[category].value += Number(dp.value) || 0;
    grouped[category].count++;
  }

  return Object.values(grouped);
}

export function transformEmissionsForStackedChart(datapoints: ChartDatapoint[]): {
  scope1: number;
  scope2: number;
  scope3: number;
} {
  let scope1 = 0;
  let scope2 = 0;
  let scope3 = 0;

  for (const dp of datapoints) {
    const scope = dp.scope || "1";
    const value = Number(dp.value) || 0;

    if (scope === "1") scope1 += value;
    if (scope === "2") scope2 += value;
    if (scope === "3") scope3 += value;
  }

  return { scope1, scope2, scope3 };
}

export function transformTrendData(
  datapoints: ChartDatapoint[],
): Array<{ date: string; value: number }> {
  // Sort by date and return time series
  return datapoints
    .map((dp) => ({
      date: new Date(String(dp.createdAt)).toISOString().split("T")[0],
      value: Number(dp.value) || 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function buildPieChartData(
  datapoints: ChartDatapoint[],
  groupBy: string = "category",
): Array<{ name: string; value: number }> {
  const grouped: Record<string, number> = {};

  for (const dp of datapoints) {
    const category = String(dp[groupBy] ?? "Unknown");
    grouped[category] = (grouped[category] || 0) + (Number(dp.value) || 0);
  }

  return Object.entries(grouped).map(([name, value]) => ({ name, value }));
}

export function buildScatterChartData(
  datapoints: ChartDatapoint[],
  xField: string,
  yField: string,
): Array<{ x: number; y: number; name?: string }> {
  return datapoints
    .filter((dp) => dp[xField] != null && dp[yField] != null)
    .map((dp) => ({
      x: Number(dp[xField]) || 0,
      y: Number(dp[yField]) || 0,
      name: typeof dp.name === "string" ? dp.name : undefined,
    }));
}
