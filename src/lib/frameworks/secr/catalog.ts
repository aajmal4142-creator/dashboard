/**
 * UK SECR disclosure catalog — Core (required) vs Supporting.
 *
 * Metric keys map only where ClearESG already collects data (MetricDefinition /
 * DATA_METRICS / derived.*). Empty metricKeys = honest unmapped gap, not a guess.
 *
 * Citations are structural (Companies Act SECR / Environmental Reporting Guidelines).
 * Do not treat labels as counsel-approved legal determinations.
 */

import type { SecrDisclosureDef, SecrSection } from "./types";

export const SECR_SECTIONS: SecrSection[] = [
  {
    id: "energy",
    title: "Energy use (kWh)",
    shortTitle: "Energy use",
    description:
      "Annual energy consumption underlying GHG figures — electricity, fuels, and heat — typically disclosed in kWh.",
  },
  {
    id: "ghg",
    title: "Greenhouse gas emissions",
    shortTitle: "GHG emissions",
    description:
      "Scope 1 and Scope 2 GHG associated with reported energy use. Scope 3 is voluntary under SECR.",
  },
  {
    id: "intensity",
    title: "Intensity ratio",
    shortTitle: "Intensity",
    description:
      "At least one intensity ratio relating emissions to a relevant activity measure (e.g. turnover, FTE, floor area).",
  },
  {
    id: "methodology",
    title: "Methodology narrative",
    shortTitle: "Methodology",
    description:
      "Description of the methodology used to calculate energy and emissions, including organisational boundary.",
  },
  {
    id: "directors_report",
    title: "Directors' report statements",
    shortTitle: "Directors' report",
    description:
      "Energy efficiency actions taken and confirmation that required SECR content appears in the directors' report.",
  },
];

/**
 * Core = required SECR beachhead for large UK companies / LLPs.
 * Supporting = recommended depth (renewables, Scope 3, global energy).
 */
export const SECR_DISCLOSURES: SecrDisclosureDef[] = [
  // ── Energy ─────────────────────────────────────────────────────────────
  {
    code: "SECR-E1",
    sectionId: "energy",
    level: "core",
    label: "Total energy consumption (derived or primary fuels/electricity)",
    metricKeys: [
      "derived.energy_total_mwh",
      "electricity_kwh",
      "diesel_litres",
      "petrol_litres",
      "natural_gas_m3",
      "district_heat_kwh",
    ],
    metricMatch: "any",
    requiresEvidence: true,
    note: "SECR expects kWh. ClearESG stores primary activity data; derived.energy_total_mwh converts fuels to energy.",
  },
  {
    code: "SECR-E2",
    sectionId: "energy",
    level: "core",
    label: "Purchased electricity (kWh)",
    metricKeys: ["electricity_kwh"],
    requiresEvidence: true,
  },
  {
    code: "SECR-E3",
    sectionId: "energy",
    level: "core",
    label: "Combustion fuels (diesel, petrol, natural gas)",
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "At least one Scope 1 fuel metric present counts toward coverage.",
  },
  {
    code: "SECR-E4",
    sectionId: "energy",
    level: "supporting",
    label: "District heating or cooling purchased",
    metricKeys: ["district_heat_kwh"],
    requiresEvidence: false,
  },
  {
    code: "SECR-E5",
    sectionId: "energy",
    level: "supporting",
    label: "Renewable share of electricity",
    metricKeys: ["electricity_renewable_pct"],
    requiresEvidence: false,
  },
  {
    code: "SECR-E6",
    sectionId: "energy",
    level: "supporting",
    label: "Global energy use outside the UK (quoted companies)",
    metricKeys: [],
    requiresEvidence: true,
    note: "Quoted-company global energy — not collected as a ClearESG metric yet.",
  },

  // ── GHG ────────────────────────────────────────────────────────────────
  {
    code: "SECR-G1",
    sectionId: "ghg",
    level: "core",
    label: "Scope 1 GHG — fuel combustion inputs",
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "Platform factors convert activity data to tCO2e; disclose calculated Scope 1 in the pack.",
  },
  {
    code: "SECR-G2",
    sectionId: "ghg",
    level: "core",
    label: "Scope 2 GHG — purchased electricity / heat",
    metricKeys: ["electricity_kwh", "district_heat_kwh"],
    metricMatch: "any",
    requiresEvidence: true,
  },
  {
    code: "SECR-G3",
    sectionId: "ghg",
    level: "supporting",
    label: "Scope 3 GHG (voluntary under SECR)",
    metricKeys: ["supplier_spend_total", "business_travel_km"],
    metricMatch: "any",
    requiresEvidence: false,
    note: "Optional. Spend and travel are proxies until a full Scope 3 inventory ships.",
  },

  // ── Intensity ──────────────────────────────────────────────────────────
  {
    code: "SECR-I1",
    sectionId: "intensity",
    level: "core",
    label: "Intensity denominator — employees (FTE)",
    metricKeys: ["employees_total"],
    requiresEvidence: false,
    note: "One accepted intensity basis. Turnover / floor-area denominators live on the organisation profile, not as datapoints.",
  },
  {
    code: "SECR-I2",
    sectionId: "intensity",
    level: "core",
    label: "Intensity numerator — energy / GHG activity data present",
    metricKeys: [
      "derived.energy_total_mwh",
      "electricity_kwh",
      "diesel_litres",
      "petrol_litres",
      "natural_gas_m3",
    ],
    metricMatch: "any",
    requiresEvidence: false,
  },
  {
    code: "SECR-I3",
    sectionId: "intensity",
    level: "supporting",
    label: "Turnover-based intensity (tCO2e / £ turnover)",
    metricKeys: [],
    requiresEvidence: false,
    note: "Uses organisation annualRevenue in analytics — not a datapoint metric yet.",
  },

  // ── Methodology ────────────────────────────────────────────────────────
  {
    code: "SECR-M1",
    sectionId: "methodology",
    level: "core",
    label: "Calculation methodology statement",
    metricKeys: [],
    requiresEvidence: true,
    note: "Narrative placeholder — describe factors, conversion, and GHG Protocol / DEFRA approach used.",
  },
  {
    code: "SECR-M2",
    sectionId: "methodology",
    level: "core",
    label: "Organisational boundary statement",
    metricKeys: [],
    requiresEvidence: true,
    note: "Narrative placeholder — operational vs equity control; UK vs global scope.",
  },
  {
    code: "SECR-M3",
    sectionId: "methodology",
    level: "supporting",
    label: "Prior-year comparative figures",
    metricKeys: [],
    requiresEvidence: false,
    note: "Comparative year disclosure — not tracked as a ClearESG metric yet.",
  },

  // ── Directors' report ──────────────────────────────────────────────────
  {
    code: "SECR-D1",
    sectionId: "directors_report",
    level: "core",
    label: "Energy efficiency actions taken in the period",
    metricKeys: [],
    requiresEvidence: true,
    note: "Narrative placeholder for the directors' report — measures taken to improve energy efficiency.",
  },
  {
    code: "SECR-D2",
    sectionId: "directors_report",
    level: "core",
    label: "Directors' report inclusion confirmation",
    metricKeys: [],
    requiresEvidence: true,
    note: "Process check — confirm required SECR content appears in the annual directors' report.",
  },
];

export function secrSectionById(id: SecrSection["id"]): SecrSection | undefined {
  return SECR_SECTIONS.find((s) => s.id === id);
}

export function secrDisclosuresForLevel(
  level: SecrDisclosureDef["level"],
): SecrDisclosureDef[] {
  return SECR_DISCLOSURES.filter((d) => d.level === level);
}

/** FrameworkMappingRow-compatible rows for disclosures with ClearESG metrics. */
export function secrCatalogAsFrameworkMappings(): Array<{
  framework: "SECR";
  datapointRef: string;
  label: string;
  required: boolean;
  contributionOnly: boolean;
  metricKeys: string[];
  note?: string;
}> {
  return SECR_DISCLOSURES.filter((d) => d.metricKeys.length > 0).map((d) => ({
    framework: "SECR" as const,
    datapointRef: d.code,
    label: `${d.label} (${d.level === "core" ? "Core" : "Supporting"})`,
    required: d.level === "core",
    contributionOnly: d.level === "supporting",
    metricKeys: d.metricKeys,
    note: d.note,
  }));
}
