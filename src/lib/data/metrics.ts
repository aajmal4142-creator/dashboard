import type { Quality } from "@/lib/calc";

export type DataMetricDef = {
  key: string;
  label: string;
  unit: string | null;
  category: "E" | "S" | "G";
  inputType: "number" | "boolean";
  /** Factor key for live tCO2e preview when applicable */
  emissionFactorKey?: string;
};

/** Canonical metrics for the Data grid / import templates. */
export const DATA_METRICS: DataMetricDef[] = [
  {
    key: "electricity_kwh",
    label: "Electricity consumed",
    unit: "kWh",
    category: "E",
    inputType: "number",
    emissionFactorKey: "grid_electricity",
  },
  {
    key: "electricity_renewable_pct",
    label: "Renewable share of electricity",
    unit: "%",
    category: "E",
    inputType: "number",
  },
  {
    key: "diesel_litres",
    label: "Diesel consumed",
    unit: "L",
    category: "E",
    inputType: "number",
    emissionFactorKey: "diesel",
  },
  {
    key: "natural_gas_m3",
    label: "Natural gas consumed",
    unit: "m³",
    category: "E",
    inputType: "number",
    emissionFactorKey: "natural_gas",
  },
  {
    key: "petrol_litres",
    label: "Petrol consumed",
    unit: "L",
    category: "E",
    inputType: "number",
    emissionFactorKey: "petrol",
  },
  {
    key: "district_heat_kwh",
    label: "District heating or cooling",
    unit: "kWh",
    category: "E",
    inputType: "number",
  },
  {
    key: "supplier_spend_total",
    label: "Total supplier spend",
    unit: "currency",
    category: "E",
    inputType: "number",
    emissionFactorKey: "spend_purchased_goods",
  },
  {
    key: "business_travel_km",
    label: "Business travel distance",
    unit: "km",
    category: "E",
    inputType: "number",
    emissionFactorKey: "business_travel_avg",
  },
  {
    key: "employees_total",
    label: "Total employees",
    unit: "FTE",
    category: "S",
    inputType: "number",
  },
  {
    key: "employees_women",
    label: "Women employees",
    unit: "FTE",
    category: "S",
    inputType: "number",
  },
  {
    key: "injuries_recordable",
    label: "Recordable injuries",
    unit: "count",
    category: "S",
    inputType: "number",
  },
  {
    key: "hours_worked_total",
    label: "Total hours worked",
    unit: "hours",
    category: "S",
    inputType: "number",
  },
  {
    key: "training_hours_total",
    label: "Training hours",
    unit: "hours",
    category: "S",
    inputType: "number",
  },
  {
    key: "board_size",
    label: "Board members",
    unit: "count",
    category: "G",
    inputType: "number",
  },
  {
    key: "board_independent",
    label: "Independent directors",
    unit: "count",
    category: "G",
    inputType: "number",
  },
  {
    key: "policy_anti_corruption",
    label: "Anti-corruption policy",
    unit: null,
    category: "G",
    inputType: "boolean",
  },
  {
    key: "policy_whistleblower",
    label: "Whistleblower policy",
    unit: null,
    category: "G",
    inputType: "boolean",
  },
  {
    key: "policy_data_privacy",
    label: "Data privacy policy",
    unit: null,
    category: "G",
    inputType: "boolean",
  },
];

export const DATA_METRIC_BY_KEY = Object.fromEntries(
  DATA_METRICS.map((m) => [m.key, m]),
) as Record<string, DataMetricDef>;

export const QUALITY_VALUES: Quality[] = [
  "measured",
  "calculated",
  "estimated",
  "missing",
];

export const IMPORT_COLUMNS = [
  "metricKey",
  "label",
  "value",
  "unit",
  "period",
  "quality",
  "evidenceRef",
  "note",
  "frameworkCell",
  "assignee",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
