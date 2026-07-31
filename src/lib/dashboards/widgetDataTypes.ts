export type WidgetMetricPayload = {
  kind: "metric";
  value: number | null;
  unit?: string;
  label?: string;
};

export type WidgetChartPayload = {
  kind: "chart";
  points: Array<{ label: string; value: number }>;
};

export type WidgetTableRow = {
  title: string;
  subtitle?: string;
  value?: string;
};

export type WidgetTableOrListPayload = {
  kind: "table" | "list";
  rows: WidgetTableRow[];
};

export type WidgetDataPayload =
  WidgetMetricPayload | WidgetChartPayload | WidgetTableOrListPayload;
