/**
 * ESRS Set 1 beachhead catalog — climate (E1) + governance (G1) stubs.
 * Empty metricKeys = honest unmapped gap. Not counsel-approved legal text.
 */

import type { CsrdDisclosureDef, CsrdSection } from "./types";

export const CSRD_SECTIONS: CsrdSection[] = [
  {
    id: "e1_climate",
    title: "ESRS E1 — Climate change",
    shortTitle: "E1 Climate",
    description:
      "Energy, Scope 1–3 GHG, intensity, and transition-plan related datapoints ClearESG can score today.",
  },
  {
    id: "e2_pollution",
    title: "ESRS E2 — Pollution",
    shortTitle: "E2 Pollution",
    description: "Pollution metrics — largely unmapped until dedicated keys exist.",
  },
  {
    id: "e3_water",
    title: "ESRS E3 — Water and marine resources",
    shortTitle: "E3 Water",
    description:
      "Water withdrawal / discharge where ClearESG collects operational water data.",
  },
  {
    id: "e5_circular",
    title: "ESRS E5 — Resource use and circular economy",
    shortTitle: "E5 Circular",
    description: "Waste and circularity metrics where collected.",
  },
  {
    id: "g1_business",
    title: "ESRS G1 — Business conduct",
    shortTitle: "G1 Conduct",
    description: "Governance disclosures — mostly narrative; metric gaps stay honest.",
  },
];

export const CSRD_DISCLOSURES: CsrdDisclosureDef[] = [
  {
    code: "E1-5",
    sectionId: "e1_climate",
    level: "core",
    label: "Energy consumption and mix",
    metricKeys: [
      "electricity_kwh",
      "natural_gas_m3",
      "diesel_litres",
      "petrol_litres",
      "district_heat_kwh",
      "derived.energy_total_mwh",
    ],
    metricMatch: "any",
    requiresEvidence: true,
    note: "ESRS E1-5 energy. At least one energy activity metric required.",
  },
  {
    code: "E1-6-S1",
    sectionId: "e1_climate",
    level: "core",
    label: "Gross Scope 1 GHG emissions",
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "Scope 1 fuels → calculated Scope 1 in inventory.",
  },
  {
    code: "E1-6-S2",
    sectionId: "e1_climate",
    level: "core",
    label: "Gross Scope 2 GHG emissions (location-based inputs)",
    metricKeys: ["electricity_kwh", "district_heat_kwh"],
    metricMatch: "any",
    requiresEvidence: true,
  },
  {
    code: "E1-6-S3",
    sectionId: "e1_climate",
    level: "core",
    label: "Gross Scope 3 GHG emissions (value-chain activity)",
    metricKeys: [
      "business_travel_km",
      "employee_commute_km",
      "spend_usd",
      "freight_tonne_km",
    ],
    metricMatch: "any",
    requiresEvidence: false,
    note: "At least one Scope 3 activity path. Primary supplier data preferred over spend.",
  },
  {
    code: "E1-Intensity",
    sectionId: "e1_climate",
    level: "supporting",
    label: "GHG intensity (activity denominator)",
    metricKeys: ["revenue_usd", "employees_fte", "floor_area_m2"],
    metricMatch: "any",
    requiresEvidence: false,
  },
  {
    code: "E3-Water",
    sectionId: "e3_water",
    level: "supporting",
    label: "Water withdrawal / consumption",
    metricKeys: ["water_m3", "water_withdrawal_m3"],
    metricMatch: "any",
    requiresEvidence: true,
  },
  {
    code: "E5-Waste",
    sectionId: "e5_circular",
    level: "supporting",
    label: "Waste generated",
    metricKeys: ["waste_tonnes", "waste_recycled_tonnes"],
    metricMatch: "any",
    requiresEvidence: true,
  },
  {
    code: "E2-Unmapped",
    sectionId: "e2_pollution",
    level: "supporting",
    label: "Pollution to air/water/soil (not yet mapped)",
    metricKeys: [],
    requiresEvidence: false,
    note: "Honest gap — no ClearESG pollution metric keys yet.",
  },
  {
    code: "G1-Unmapped",
    sectionId: "g1_business",
    level: "supporting",
    label: "Business conduct policies (narrative)",
    metricKeys: [],
    requiresEvidence: false,
    note: "Use Policy library + Reports narrative; not scored from Metrics.",
  },
];

export function csrdSectionById(id: string) {
  return CSRD_SECTIONS.find((s) => s.id === id);
}

export function csrdDisclosuresForLevel(level: "core" | "supporting") {
  return CSRD_DISCLOSURES.filter((d) => d.level === level);
}
