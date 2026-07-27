/**
 * Reviewable framework ↔ metric mappings (Phase 3).
 *
 * Citations are placeholders for counsel — do not treat labels as legal determinations.
 * BRSR rows are stubs only (hooks); depth pending India GTM.
 */
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
  // ISSB — placeholders (counsel); contribution only.
  {
    framework: "ISSB_S2",
    datapointRef: "S2-energy",
    label: "Energy consumption (ISSB S2 climate — placeholder)",
    required: false,
    contributionOnly: true,
    metricKeys: ["electricity_kwh", "derived.energy_total_mwh"],
    note: "Placeholder pending counsel — contributes to, does not satisfy.",
  },
  {
    framework: "ISSB_S1",
    datapointRef: "S1-general",
    label: "General sustainability disclosures (ISSB S1 — placeholder)",
    required: false,
    contributionOnly: true,
    metricKeys: ["employees_total"],
    note: "Placeholder hook only.",
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
  // EU Taxonomy — eligibility stub only.
  {
    framework: "EU_TAXONOMY",
    datapointRef: "TAX-elig-energy",
    label: "Taxonomy eligibility — energy activity (stub)",
    required: false,
    contributionOnly: true,
    metricKeys: ["derived.energy_total_mwh"],
    note: "Eligibility hook only — not a determination of alignment.",
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
  // BRSR — stub hooks only (pending).
  {
    framework: "BRSR",
    datapointRef: "BRSR-P6-energy",
    label: "Energy (BRSR Principle 6 — stub)",
    required: false,
    contributionOnly: true,
    metricKeys: ["electricity_kwh"],
    note: "BRSR disclosure depth pending — hook only.",
  },
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
