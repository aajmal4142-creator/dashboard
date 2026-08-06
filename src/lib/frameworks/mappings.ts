/**
 * Reviewable framework ↔ metric mappings (Phase 3).
 *
 * Citations are placeholders for counsel — do not treat labels as legal determinations.
 * BRSR rows come from the principle Core / Comprehensive catalog.
 * SECR rows come from the UK SECR Core / Supporting catalog.
 * ISSB S1/S2 and EU Taxonomy rows are structural mappings to existing raw/derived metric
 * keys (same Scope 1/2/3 activity data the calc engine uses) — not counsel-approved
 * determinations of disclosure sufficiency or Taxonomy alignment.
 */
import { brsrCatalogAsFrameworkMappings } from "./brsr/catalog";
import { secrCatalogAsFrameworkMappings } from "./secr/catalog";
import type { FrameworkMappingRow } from "./types";

const EFRAG = {
  sourceDoc: "EFRAG-IG3-datapoints.xlsx",
  sourceSheet: "ESRS E1",
  extractedAt: "2026-07-16T22:12:00.000Z",
} as const;

/** High-leverage energy / climate disclosures for coverage + Data chips. */
export const FRAMEWORK_MAPPINGS: FrameworkMappingRow[] = [
  {
    framework: "CSRD_SET1",
    datapointRef: "E1-5_01",
    label: "Total energy consumption",
    required: true,
    contributionOnly: false,
    metricKeys: ["derived.energy_total_mwh"],
    note: `${EFRAG.sourceDoc} ${EFRAG.sourceSheet} row 84`,
  },
  {
    framework: "CSRD_SET1",
    datapointRef: "E1-5_11",
    label: "Fuel from petroleum products",
    required: false,
    contributionOnly: true,
    metricKeys: ["derived.energy_petroleum_mwh", "diesel_litres", "petrol_litres"],
    note: `${EFRAG.sourceDoc} row 94 — partial feed`,
  },
  {
    framework: "CSRD_SET1",
    datapointRef: "E1-5_12",
    label: "Fuel from natural gas",
    required: false,
    contributionOnly: true,
    metricKeys: ["derived.energy_natural_gas_mwh", "natural_gas_m3"],
  },
  {
    framework: "CSRD_SET1",
    datapointRef: "E1-5_07",
    label: "Purchased renewable electricity",
    required: false,
    contributionOnly: true,
    metricKeys: [
      "derived.energy_electricity_renewable_mwh",
      "electricity_kwh",
      "electricity_renewable_pct",
    ],
  },
  {
    framework: "CSRD_SET1",
    datapointRef: "E1-5_14",
    label: "Purchased fossil electricity / heat",
    required: false,
    contributionOnly: true,
    metricKeys: [
      "derived.energy_electricity_fossil_mwh",
      "derived.energy_district_heat_mwh",
      "electricity_kwh",
      "district_heat_kwh",
    ],
  },
  {
    framework: "CSRD_SET1",
    datapointRef: "E1-5_09",
    label: "Renewable share of total energy",
    required: false,
    contributionOnly: true,
    metricKeys: ["derived.energy_renewable_pct", "electricity_renewable_pct"],
  },
  // CSRD Simplified — same energy beachhead (contribution / eligibility).
  {
    framework: "CSRD_SIMPLIFIED",
    datapointRef: "E1-5_01",
    label: "Total energy consumption (simplified)",
    required: true,
    contributionOnly: false,
    metricKeys: ["derived.energy_total_mwh"],
  },
  // ISSB S2 (climate) — structural metric mapping. Same activity data that feeds the
  // Scope 1/2/3 calc engine (lib/calc/emissions.ts); ClearESG does not independently
  // verify GHG Protocol boundary/methodology choices, so every row stays contribution-only.
  {
    framework: "ISSB_S2",
    datapointRef: "S2-scope1",
    label: "Scope 1 GHG emissions — fuel inputs",
    required: true,
    contributionOnly: true,
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3"],
    note: "Structural mapping — not counsel-approved determination. Full S2 narrative lives in ISSB disclosures (/issb); TCFD pillars in /tcfd.",
  },
  {
    framework: "ISSB_S2",
    datapointRef: "S2-scope2",
    label: "Scope 2 GHG emissions — purchased electricity / heat",
    required: true,
    contributionOnly: true,
    metricKeys: ["electricity_kwh", "electricity_renewable_pct", "district_heat_kwh"],
    note: "Structural mapping — not counsel-approved determination.",
  },
  {
    framework: "ISSB_S2",
    datapointRef: "S2-scope3",
    label: "Scope 3 GHG emissions — value chain (spend + travel basis)",
    required: false,
    contributionOnly: true,
    metricKeys: ["supplier_spend_total", "business_travel_km"],
    note: "Structural mapping — not counsel-approved determination. Spend/travel basis only; not a full value-chain screen.",
  },
  {
    framework: "ISSB_S2",
    datapointRef: "S2-energy",
    label: "Energy consumption disclosure",
    required: false,
    contributionOnly: true,
    metricKeys: ["derived.energy_total_mwh", "electricity_kwh"],
    note: "Structural mapping — not counsel-approved determination.",
  },
  {
    framework: "ISSB_S2",
    datapointRef: "S2-climate-targets",
    label: "Climate-related targets and transition plan",
    required: false,
    contributionOnly: true,
    metricKeys: [],
    note: "Structural mapping — not counsel-approved determination. Pure narrative: ClearESG has no metric proxy for target disclosure quality. See cascaded targets (/analytics/target-cascade) and MACC (/analytics/macc) for the underlying plan.",
  },
  // ISSB S1 (general sustainability-related disclosures) — workforce + governance rows
  // already collected as DATA_METRICS; contribution-only pending counsel review of
  // materiality assessment and cross-industry metric selection.
  {
    framework: "ISSB_S1",
    datapointRef: "S1-workforce",
    label: "Workforce composition and safety",
    required: false,
    contributionOnly: true,
    metricKeys: [
      "employees_total",
      "employees_women",
      "injuries_recordable",
      "hours_worked_total",
    ],
    note: "Structural mapping — not counsel-approved determination. S1 questionnaire lives in ISSB disclosures (/issb).",
  },
  {
    framework: "ISSB_S1",
    datapointRef: "S1-governance",
    label: "Sustainability governance and policies",
    required: false,
    contributionOnly: true,
    metricKeys: [
      "board_size",
      "board_independent",
      "policy_anti_corruption",
      "policy_whistleblower",
      "policy_data_privacy",
    ],
    note: "Structural mapping — not counsel-approved determination.",
  },
  // GRI — contribution placeholders.
  {
    framework: "GRI",
    datapointRef: "GRI-302-1",
    label: "Energy consumption within the organisation",
    required: false,
    contributionOnly: true,
    metricKeys: ["electricity_kwh", "derived.energy_total_mwh"],
  },
  // EU Taxonomy — eligibility contribution rows only. Alignment (substantial
  // contribution + DNSH + minimum safeguards) is scored in the dedicated Green
  // Taxonomy module (/compliance/green-taxonomy), not here.
  {
    framework: "EU_TAXONOMY",
    datapointRef: "TAX-elig-energy",
    label: "Taxonomy eligibility — energy activity",
    required: false,
    contributionOnly: true,
    metricKeys: ["derived.energy_total_mwh"],
    note: "Structural mapping — not counsel-approved determination. Eligibility hook only, not an alignment determination. Full screening: /compliance/green-taxonomy.",
  },
  {
    framework: "EU_TAXONOMY",
    datapointRef: "TAX-elig-ghg-scope1",
    label: "Taxonomy eligibility — Scope 1 GHG activity data",
    required: false,
    contributionOnly: true,
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3"],
    note: "Structural mapping — not counsel-approved determination. Eligibility hook only, not an alignment determination. Full screening: /compliance/green-taxonomy.",
  },
  {
    framework: "EU_TAXONOMY",
    datapointRef: "TAX-elig-ghg-scope2",
    label: "Taxonomy eligibility — Scope 2 GHG activity data",
    required: false,
    contributionOnly: true,
    metricKeys: ["electricity_kwh", "electricity_renewable_pct"],
    note: "Structural mapping — not counsel-approved determination. Eligibility hook only, not an alignment determination. Full screening: /compliance/green-taxonomy.",
  },
  // VSME voluntary beachhead.
  {
    framework: "VSME",
    datapointRef: "VSME-E-energy",
    label: "Energy use (VSME — placeholder)",
    required: false,
    contributionOnly: true,
    metricKeys: ["electricity_kwh", "derived.energy_total_mwh"],
  },
  // BRSR — principle Core / Comprehensive beachhead (see lib/frameworks/brsr).
  ...brsrCatalogAsFrameworkMappings(),
  // UK SECR — Core / Supporting beachhead (see lib/frameworks/secr).
  ...secrCatalogAsFrameworkMappings(),
];

/** Raw metric keys that contribute to each derived energy figure (for chip resolution). */
export const DERIVED_RAW_INPUTS: Record<string, string[]> = {
  "derived.energy_petroleum_mwh": ["diesel_litres", "petrol_litres"],
  "derived.energy_natural_gas_mwh": ["natural_gas_m3"],
  "derived.energy_electricity_renewable_mwh": [
    "electricity_kwh",
    "electricity_renewable_pct",
  ],
  "derived.energy_electricity_fossil_mwh": [
    "electricity_kwh",
    "electricity_renewable_pct",
  ],
  "derived.energy_district_heat_mwh": ["district_heat_kwh"],
  "derived.energy_total_mwh": [
    "diesel_litres",
    "petrol_litres",
    "natural_gas_m3",
    "electricity_kwh",
    "electricity_renewable_pct",
    "district_heat_kwh",
  ],
  "derived.energy_renewable_pct": [
    "electricity_kwh",
    "electricity_renewable_pct",
    "district_heat_kwh",
  ],
};

/** Mappings whose metricKeys (or derived raw inputs) include this raw/derived key. */
export function mappingsForMetricKey(metricKey: string): FrameworkMappingRow[] {
  return FRAMEWORK_MAPPINGS.filter((row) => {
    if (row.metricKeys.includes(metricKey)) return true;
    return row.metricKeys.some((mk) => DERIVED_RAW_INPUTS[mk]?.includes(metricKey));
  });
}
