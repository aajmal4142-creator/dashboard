/**
 * SFDR PAI Table 1 catalog — mandatory indicators for investee companies,
 * adapted for a corporate ClearESG reporter (company-level beachhead).
 *
 * Metric keys map only where ClearESG already collects data.
 * Empty sources = honest unmapped gap, not a guess.
 * No paid vendor feeds. Citations are structural — not counsel-approved legal determinations.
 *
 * Official template: Commission Delegated Regulation (EU) 2022/1288 Annex I Table 1.
 */

import type { SfdrIndicatorDef, SfdrSection, SfdrSectionId } from "./types";

export const SFDR_SECTIONS: SfdrSection[] = [
  {
    id: "climate_ghg",
    title: "Climate and GHG (PAI 1–3)",
    shortTitle: "GHG",
    description:
      "Scope 1–3 greenhouse gas emissions, carbon footprint, and GHG intensity beachheads for investee-company PAI reporting.",
  },
  {
    id: "energy_fossil",
    title: "Energy and fossil fuel (PAI 4–6)",
    shortTitle: "Energy",
    description:
      "Fossil-fuel sector exposure, non-renewable energy share, and energy consumption intensity.",
  },
  {
    id: "environment",
    title: "Biodiversity, water, and waste (PAI 7–9)",
    shortTitle: "Environment",
    description:
      "Activities affecting biodiversity-sensitive areas, emissions to water, and hazardous / radioactive waste.",
  },
  {
    id: "social_governance",
    title: "Social, human rights, and governance (PAI 10–14)",
    shortTitle: "Social & G",
    description:
      "UNGC / OECD alignment, gender pay gap, board diversity, and controversial weapons exposure.",
  },
];

/**
 * Table 1 mandatory PAI indicators — corporate disclosure workspace mapping.
 * Portfolio-level denominators (EUR invested / EVIC) remain outside ClearESG;
 * mapped rows score company-level inputs FMPs and corporates can feed into PAI templates.
 */
export const SFDR_INDICATORS: SfdrIndicatorDef[] = [
  // ── PAI 1 GHG emissions ────────────────────────────────────────────────
  {
    code: "PAI-1.1",
    paiNumber: 1,
    sectionId: "climate_ghg",
    label: "Scope 1 GHG — fuel activity data (diesel, petrol, natural gas)",
    sourceKind: "metric",
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "Company-level Scope 1 beachhead. Convert to tCO₂e with factors before PAI filing.",
  },
  {
    code: "PAI-1.2",
    paiNumber: 1,
    sectionId: "climate_ghg",
    label: "Scope 2 GHG — purchased electricity",
    sourceKind: "metric",
    metricKeys: ["electricity_kwh"],
    requiresEvidence: true,
    note: "Company-level Scope 2 beachhead. Apply location- or market-based factors externally.",
  },
  {
    code: "PAI-1.3",
    paiNumber: 1,
    sectionId: "climate_ghg",
    label: "Scope 3 GHG — value-chain proxies (supplier spend / business travel)",
    sourceKind: "metric",
    metricKeys: ["supplier_spend_total", "business_travel_km"],
    metricMatch: "any",
    requiresEvidence: false,
    href: "/scope3/category-1",
    note: "Proxy only — not a full Scope 3 inventory. Expand via Scope 3 modules before claiming completeness.",
  },
  {
    code: "PAI-1.4",
    paiNumber: 1,
    sectionId: "climate_ghg",
    label: "Total GHG emissions narrative / inventory completeness",
    sourceKind: "unmapped",
    href: "/data",
    note: "Sum of Scopes 1–3 with boundary notes — not a single ClearESG metric. Complete after Scope coverage.",
  },

  // ── PAI 2 Carbon footprint ─────────────────────────────────────────────
  {
    code: "PAI-2",
    paiNumber: 2,
    sectionId: "climate_ghg",
    label: "Carbon footprint (GHG / portfolio value)",
    sourceKind: "unmapped",
    href: "/compliance/calendar",
    note: "Requires current value of all investments (EUR). ClearESG holds company GHG inputs, not portfolio EVIC.",
  },

  // ── PAI 3 GHG intensity ────────────────────────────────────────────────
  {
    code: "PAI-3",
    paiNumber: 3,
    sectionId: "climate_ghg",
    label: "GHG intensity of investee companies (GHG / revenue)",
    sourceKind: "unmapped",
    href: "/settings",
    note: "Needs enterprise revenue in EUR million plus total GHG. Revenue band alone is not sufficient.",
  },

  // ── PAI 4 Fossil fuel sector ───────────────────────────────────────────
  {
    code: "PAI-4",
    paiNumber: 4,
    sectionId: "energy_fossil",
    label: "Fossil fuel sector activity / exposure flag",
    sourceKind: "org_field",
    orgFields: ["sector"],
    href: "/settings",
    note: "Sector classification is a screening beachhead. Confirm fossil-fuel activity definitions with counsel.",
  },

  // ── PAI 5 Non-renewable energy ─────────────────────────────────────────
  {
    code: "PAI-5",
    paiNumber: 5,
    sectionId: "energy_fossil",
    label: "Share of non-renewable energy consumption (via renewable %)",
    sourceKind: "metric",
    metricKeys: ["electricity_renewable_pct", "derived.energy_renewable_pct"],
    metricMatch: "any",
    requiresEvidence: false,
    note: "ClearESG stores renewable share; non-renewable = 100 − renewable. Production share not collected.",
  },

  // ── PAI 6 Energy intensity ─────────────────────────────────────────────
  {
    code: "PAI-6",
    paiNumber: 6,
    sectionId: "energy_fossil",
    label: "Energy consumption (intensity numerator)",
    sourceKind: "metric",
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
    note: "Energy use beachhead. Full PAI 6 needs GWh per EUR million revenue in high-impact NACE sectors.",
  },

  // ── PAI 7 Biodiversity ─────────────────────────────────────────────────
  {
    code: "PAI-7",
    paiNumber: 7,
    sectionId: "environment",
    label: "Activities negatively affecting biodiversity-sensitive areas",
    sourceKind: "unmapped",
    href: "/data",
    note: "Not collected as a ClearESG metric. No paid biodiversity vendor feed.",
  },

  // ── PAI 8 Water ────────────────────────────────────────────────────────
  {
    code: "PAI-8",
    paiNumber: 8,
    sectionId: "environment",
    label: "Emissions to water",
    sourceKind: "unmapped",
    href: "/data",
    note: "Water pollutant emissions — not collected as a ClearESG metric yet.",
  },

  // ── PAI 9 Hazardous waste ──────────────────────────────────────────────
  {
    code: "PAI-9",
    paiNumber: 9,
    sectionId: "environment",
    label: "Hazardous waste and radioactive waste ratio",
    sourceKind: "unmapped",
    href: "/data",
    note: "Hazardous / radioactive waste — not collected as a ClearESG metric yet.",
  },

  // ── PAI 10 UNGC / OECD violations ──────────────────────────────────────
  {
    code: "PAI-10",
    paiNumber: 10,
    sectionId: "social_governance",
    label: "Violations of UNGC principles and OECD Guidelines",
    sourceKind: "unmapped",
    href: "/compliance/calendar",
    note: "Incident / controversy registry — outside ClearESG metrics. Track via compliance process.",
  },

  // ── PAI 11 Lack of compliance mechanisms ───────────────────────────────
  {
    code: "PAI-11",
    paiNumber: 11,
    sectionId: "social_governance",
    label: "Processes to monitor UNGC / OECD compliance (policy proxies)",
    sourceKind: "metric",
    metricKeys: ["policy_anti_corruption", "policy_whistleblower"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "Proxy: anti-corruption or whistleblower policy in force. Dedicated UNGC monitoring metric not yet collected.",
  },

  // ── PAI 12 Gender pay gap ──────────────────────────────────────────────
  {
    code: "PAI-12",
    paiNumber: 12,
    sectionId: "social_governance",
    label: "Unadjusted gender pay gap",
    sourceKind: "unmapped",
    href: "/data",
    note: "Pay-gap % not collected. Workforce gender counts (employees_women) are not a substitute.",
  },

  // ── PAI 13 Board gender diversity ──────────────────────────────────────
  {
    code: "PAI-13",
    paiNumber: 13,
    sectionId: "social_governance",
    label: "Board gender diversity",
    sourceKind: "unmapped",
    href: "/data",
    note: "Board female/male ratio not collected. board_size / board_independent exist but do not score this PAI.",
  },

  // ── PAI 14 Controversial weapons ───────────────────────────────────────
  {
    code: "PAI-14",
    paiNumber: 14,
    sectionId: "social_governance",
    label: "Exposure to controversial weapons",
    sourceKind: "unmapped",
    href: "/compliance/calendar",
    note: "Anti-personnel mines, cluster munitions, chemical and biological weapons — not tracked in ClearESG.",
  },

  // ── Entity context (helps PAI packs; not a numbered Table 1 indicator) ─
  {
    code: "PAI-E1",
    paiNumber: 0,
    sectionId: "climate_ghg",
    label: "Reporting entity legal name",
    sourceKind: "org_field",
    orgFields: ["name"],
    href: "/settings",
    note: "Entity identification for the PAI statement pack.",
  },
  {
    code: "PAI-E2",
    paiNumber: 0,
    sectionId: "climate_ghg",
    label: "Country of incorporation / primary domicile",
    sourceKind: "org_field",
    orgFields: ["country"],
    href: "/settings",
  },
];

export function sfdrSectionById(id: SfdrSection["id"]): SfdrSection | undefined {
  return SFDR_SECTIONS.find((s) => s.id === id);
}

export function sfdrIndicatorsForSection(sectionId: SfdrSectionId): SfdrIndicatorDef[] {
  return SFDR_INDICATORS.filter((d) => d.sectionId === sectionId);
}

export function sfdrMandatoryIndicators(): SfdrIndicatorDef[] {
  return SFDR_INDICATORS.filter((d) => d.paiNumber >= 1 && d.paiNumber <= 14);
}
