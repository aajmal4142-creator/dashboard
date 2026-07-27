import type { DerivedMetricDefinition } from "./types";

/**
 * Derived metrics — frameworkMappings live HERE, never on raw MetricDefinition.
 * Mappings approved for the derivation architecture (raw inputs rejected 2026-07-16).
 * Product coverage table (incl. ISSB/GRI/Taxonomy placeholders): lib/frameworks/mappings.ts
 */
export const DERIVED_METRICS: DerivedMetricDefinition[] = [
  {
    key: "derived.energy_total_mwh",
    label: "Total energy consumption (derived)",
    unit: "MWh",
    description:
      "Sum of derived fossil petroleum, natural gas, electricity, and district heat energy.",
    frameworkMappings: [
      {
        framework: "CSRD_SET1",
        datapointRef: "E1-5_01",
        label: "Total energy consumption",
        required: true,
        contributionOnly: false,
        validFrom: "2024-01-01",
        validUntil: null,
        sourceDoc: "EFRAG-IG3-datapoints.xlsx",
        sourceSheet: "ESRS E1",
        sourceRow: 84,
        extractedAt: "2026-07-16T22:12:00.000Z",
        approved: true,
      },
    ],
  },
  {
    key: "derived.energy_petroleum_mwh",
    label: "Fuel consumption from petroleum products (derived)",
    unit: "MWh",
    description: "Diesel L + petrol L converted to MWh via published energy densities.",
    frameworkMappings: [
      {
        framework: "CSRD_SET1",
        datapointRef: "E1-5_11",
        label: "Fuel from petroleum products",
        required: false,
        contributionOnly: true,
        validFrom: "2024-01-01",
        validUntil: null,
        sourceDoc: "EFRAG-IG3-datapoints.xlsx",
        sourceSheet: "ESRS E1",
        sourceRow: 94,
        extractedAt: "2026-07-16T22:12:00.000Z",
        approved: true,
      },
    ],
  },
  {
    key: "derived.energy_natural_gas_mwh",
    label: "Fuel consumption from natural gas (derived)",
    unit: "MWh",
    description: "Natural gas m³ converted to MWh via published energy density.",
    frameworkMappings: [
      {
        framework: "CSRD_SET1",
        datapointRef: "E1-5_12",
        label: "Fuel from natural gas",
        required: false,
        contributionOnly: true,
        validFrom: "2024-01-01",
        validUntil: null,
        sourceDoc: "EFRAG-IG3-datapoints.xlsx",
        sourceSheet: "ESRS E1",
        sourceRow: 95,
        extractedAt: "2026-07-16T22:12:00.000Z",
        approved: true,
      },
    ],
  },
  {
    key: "derived.energy_electricity_renewable_mwh",
    label: "Purchased electricity from renewable sources (derived)",
    unit: "MWh",
    description:
      "electricity_kWh × renewable_pct / 100 / 1000. Partial feed into E1-5_07 (electricity portion).",
    frameworkMappings: [
      {
        framework: "CSRD_SET1",
        datapointRef: "E1-5_07",
        label: "Purchased renewable electricity",
        required: false,
        contributionOnly: true,
        validFrom: "2024-01-01",
        validUntil: null,
        sourceDoc: "EFRAG-IG3-datapoints.xlsx",
        sourceSheet: "ESRS E1",
        sourceRow: 90,
        extractedAt: "2026-07-16T22:12:00.000Z",
        approved: true,
      },
    ],
  },
  {
    key: "derived.energy_electricity_fossil_mwh",
    label: "Purchased electricity from fossil sources (derived)",
    unit: "MWh",
    description:
      "electricity_kWh × (1 − renewable_pct/100) / 1000. Partial feed into E1-5_14 (electricity portion).",
    frameworkMappings: [
      {
        framework: "CSRD_SET1",
        datapointRef: "E1-5_14",
        label: "Purchased fossil electricity / heat",
        required: false,
        contributionOnly: true,
        validFrom: "2024-01-01",
        validUntil: null,
        sourceDoc: "EFRAG-IG3-datapoints.xlsx",
        sourceSheet: "ESRS E1",
        sourceRow: 97,
        extractedAt: "2026-07-16T22:12:00.000Z",
        approved: true,
      },
    ],
  },
  {
    key: "derived.energy_district_heat_mwh",
    label: "Purchased district heat / cooling (derived)",
    unit: "MWh",
    description:
      "district_heat_kWh / 1000. Feeds the heat portion of E1-5 purchased energy DPs.",
    frameworkMappings: [
      {
        framework: "CSRD_SET1",
        datapointRef: "E1-5_14",
        label: "Purchased fossil electricity / heat",
        required: false,
        contributionOnly: true,
        validFrom: "2024-01-01",
        validUntil: null,
        sourceDoc: "EFRAG-IG3-datapoints.xlsx",
        sourceSheet: "ESRS E1",
        sourceRow: 97,
        extractedAt: "2026-07-16T22:12:00.000Z",
        approved: true,
      },
    ],
  },
  {
    key: "derived.energy_renewable_pct",
    label: "Percentage of renewable sources in total energy (derived)",
    unit: "%",
    description:
      "100 × (renewable electricity + renewable heat if any) / total derived energy MWh.",
    frameworkMappings: [
      {
        framework: "CSRD_SET1",
        datapointRef: "E1-5_09",
        label: "Renewable share of total energy",
        required: false,
        contributionOnly: true,
        validFrom: "2024-01-01",
        validUntil: null,
        sourceDoc: "EFRAG-IG3-datapoints.xlsx",
        sourceSheet: "ESRS E1",
        sourceRow: 92,
        extractedAt: "2026-07-16T22:12:00.000Z",
        approved: true,
      },
    ],
  },
];
