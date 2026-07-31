export const CUSTOM_METRIC_CATEGORIES = [
  "intensity",
  "efficiency",
  "ratio",
  "total",
  "other",
] as const;

export type CustomMetricCategory = (typeof CUSTOM_METRIC_CATEGORIES)[number];

export type CustomMetricSource = "system" | "custom";

export type CustomMetricSummary = {
  id: string;
  key: string;
  label: string;
  description: string;
  unit: string;
  formula: string;
  category: CustomMetricCategory;
  enabled: boolean;
  usageCount: number;
  source: CustomMetricSource;
  organisationId: string | null;
  inputKeys: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomMetricInput = {
  label: string;
  description: string;
  unit: string;
  formula: string;
  category: CustomMetricCategory;
  enabled?: boolean;
  key?: string;
};

export type UpdateCustomMetricInput = {
  label?: string;
  description?: string;
  unit?: string;
  formula?: string;
  category?: CustomMetricCategory;
  enabled?: boolean;
};

export type PreviewCustomMetricInput = {
  formula: string;
  /** Explicit sample values keyed by metric key. */
  sampleValues?: Record<string, number>;
  /** When set, load datapoint values for this reporting period. */
  periodId?: string;
};

export type MetricKeyOption = {
  key: string;
  label: string;
  unit: string | null;
  source: "raw" | "derived" | "alias";
};

export type CustomMetricDoc = {
  id: string;
  key?: string | null;
  label?: string | null;
  description?: string | null;
  unit?: string | null;
  formula?: string | null;
  category?: string | null;
  enabled?: boolean | null;
  usageCount?: number | null;
  source?: string | null;
  organisation?: string | { id: string } | null;
  createdAt?: string;
  updatedAt?: string;
};
