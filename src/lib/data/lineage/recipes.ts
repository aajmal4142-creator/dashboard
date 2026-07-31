import { DATA_METRICS } from "@/lib/data/metrics";

/**
 * Static calculation recipes for lineage edges.
 * Derived formulas mirror lib/derive/deriveEnergy — kept here as pure metadata
 * so lineage builders stay free of Payload / Next imports.
 */
export type MetricLineageRecipe = {
  metricKey: string;
  label: string;
  inputKeys: string[];
  formula: string | null;
  emissionFactorKey: string | null;
};

const DERIVED_RECIPES: MetricLineageRecipe[] = [
  {
    metricKey: "derived.energy_petroleum_mwh",
    label: "Fuel consumption from petroleum products (derived)",
    inputKeys: ["diesel_litres", "petrol_litres"],
    formula: "diesel_L × 0.0101 + petrol_L × 0.0097",
    emissionFactorKey: null,
  },
  {
    metricKey: "derived.energy_natural_gas_mwh",
    label: "Fuel consumption from natural gas (derived)",
    inputKeys: ["natural_gas_m3"],
    formula: "natural_gas_m3 × 0.011",
    emissionFactorKey: null,
  },
  {
    metricKey: "derived.energy_electricity_renewable_mwh",
    label: "Purchased electricity from renewable sources (derived)",
    inputKeys: ["electricity_kwh", "electricity_renewable_pct"],
    formula: "(electricity_kWh / 1000) × (renewable_pct / 100)",
    emissionFactorKey: null,
  },
  {
    metricKey: "derived.energy_electricity_fossil_mwh",
    label: "Purchased electricity from fossil sources (derived)",
    inputKeys: ["electricity_kwh", "electricity_renewable_pct"],
    formula: "(electricity_kWh / 1000) × (1 − renewable_pct / 100)",
    emissionFactorKey: null,
  },
  {
    metricKey: "derived.energy_district_heat_mwh",
    label: "Purchased district heat / cooling (derived)",
    inputKeys: ["district_heat_kwh"],
    formula: "district_heat_kWh / 1000",
    emissionFactorKey: null,
  },
  {
    metricKey: "derived.energy_total_mwh",
    label: "Total energy consumption (derived)",
    inputKeys: [
      "diesel_litres",
      "petrol_litres",
      "natural_gas_m3",
      "electricity_kwh",
      "electricity_renewable_pct",
      "district_heat_kwh",
    ],
    formula: "Σ derived energy components present",
    emissionFactorKey: null,
  },
  {
    metricKey: "derived.energy_renewable_pct",
    label: "Percentage of renewable sources in total energy (derived)",
    inputKeys: [
      "electricity_kwh",
      "electricity_renewable_pct",
      "district_heat_kwh",
      "diesel_litres",
      "petrol_litres",
      "natural_gas_m3",
    ],
    formula: "100 × derived.energy_electricity_renewable_mwh / derived.energy_total_mwh",
    emissionFactorKey: null,
  },
];

const ACTIVITY_RECIPES: MetricLineageRecipe[] = DATA_METRICS.map((m) => ({
  metricKey: m.key,
  label: m.label,
  inputKeys: [],
  formula: m.emissionFactorKey ? `value × ${m.emissionFactorKey} / 1000 → tCO₂e` : null,
  emissionFactorKey: m.emissionFactorKey ?? null,
}));

const BY_KEY = new Map<string, MetricLineageRecipe>(
  [...ACTIVITY_RECIPES, ...DERIVED_RECIPES].map((r) => [r.metricKey, r]),
);

export function recipeForMetric(metricKey: string): MetricLineageRecipe | null {
  return BY_KEY.get(metricKey) ?? null;
}

export function allLineageRecipes(): MetricLineageRecipe[] {
  return [...BY_KEY.values()];
}
