/**
 * California SB 253 (GHG) and SB 261 (climate financial risk) disclosure catalogs.
 *
 * Metric keys map only where ClearESG already collects data.
 * SB 261 rows map to existing TCFD question ids where possible.
 * Empty sources = honest unmapped gap, not a guess.
 *
 * Citations are structural. Do not treat labels as counsel-approved legal determinations.
 */

import type { CaliforniaDisclosureDef, CaliforniaLaw, CaliforniaSection } from "./types";

export const CALIFORNIA_SECTIONS: CaliforniaSection[] = [
  {
    id: "entity",
    title: "Reporting entity",
    shortTitle: "Entity",
    law: "both",
  },
  {
    id: "scope1",
    title: "Scope 1 greenhouse gas emissions",
    shortTitle: "Scope 1",
    law: "253",
  },
  {
    id: "scope2",
    title: "Scope 2 greenhouse gas emissions",
    shortTitle: "Scope 2",
    law: "253",
  },
  {
    id: "scope3",
    title: "Scope 3 greenhouse gas emissions (phased)",
    shortTitle: "Scope 3",
    law: "253",
  },
  {
    id: "assurance",
    title: "Assurance readiness",
    shortTitle: "Assurance",
    law: "253",
  },
  {
    id: "governance",
    title: "Governance (TCFD-aligned)",
    shortTitle: "Governance",
    law: "261",
  },
  {
    id: "strategy",
    title: "Strategy (TCFD-aligned)",
    shortTitle: "Strategy",
    law: "261",
  },
  {
    id: "risk_management",
    title: "Risk management (TCFD-aligned)",
    shortTitle: "Risk",
    law: "261",
  },
  {
    id: "metrics_targets",
    title: "Metrics and targets (TCFD-aligned)",
    shortTitle: "Metrics",
    law: "261",
  },
];

/**
 * SB 253 — Climate Corporate Data Accountability Act (GHG reporting).
 * Scope 1–2 first; Scope 3 when phase requires it.
 */
export const SB253_DISCLOSURES: CaliforniaDisclosureDef[] = [
  {
    code: "CA253-E1",
    law: "253",
    sectionId: "entity",
    label: "Reporting entity legal name",
    sourceKind: "org_field",
    orgFields: ["name"],
    href: "/settings",
    note: "Legal name used on the SB 253 filing pack.",
  },
  {
    code: "CA253-E2",
    law: "253",
    sectionId: "entity",
    label: "Country of incorporation / primary domicile",
    sourceKind: "org_field",
    orgFields: ["country"],
    href: "/settings",
  },
  {
    code: "CA253-E3",
    law: "253",
    sectionId: "entity",
    label: "Revenue band (threshold screening)",
    sourceKind: "org_field",
    orgFields: ["revenueBand"],
    href: "/settings",
    note: "SB 253 applies to large entities doing business in California — confirm counsel thresholds.",
  },
  {
    code: "CA253-E4",
    law: "253",
    sectionId: "entity",
    label: "Fiscal year end for reporting period",
    sourceKind: "org_field",
    orgFields: ["fiscalYearEnd"],
    href: "/settings",
  },
  {
    code: "CA253-E5",
    law: "253",
    sectionId: "entity",
    label: "California nexus / doing-business confirmation",
    sourceKind: "unmapped",
    href: "/compliance/calendar",
    note: "Nexus memo is outside ClearESG metrics — track via legal scoping and the reg calendar deadline.",
  },
  {
    code: "CA253-S1-1",
    law: "253",
    sectionId: "scope1",
    label: "Scope 1 fuel inputs (diesel, petrol, natural gas)",
    sourceKind: "metric",
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "At least one Scope 1 fuel metric present counts toward coverage.",
  },
  {
    code: "CA253-S1-2",
    law: "253",
    sectionId: "scope1",
    label: "Scope 1 inventory completeness note",
    sourceKind: "unmapped",
    href: "/data",
    note: "Boundary and excluded sources narrative — not a numeric metric yet.",
  },
  {
    code: "CA253-S2-1",
    law: "253",
    sectionId: "scope2",
    label: "Scope 2 electricity purchased",
    sourceKind: "metric",
    metricKeys: ["electricity_kwh"],
    requiresEvidence: true,
  },
  {
    code: "CA253-S2-2",
    law: "253",
    sectionId: "scope2",
    label: "Renewable share of electricity (optional depth)",
    sourceKind: "metric",
    metricKeys: ["electricity_renewable_pct"],
    requiresEvidence: false,
    note: "Not a statutory SB 253 minimum; improves inventory quality.",
  },
  {
    code: "CA253-S2-3",
    law: "253",
    sectionId: "scope2",
    label: "District heating / cooling purchased",
    sourceKind: "metric",
    metricKeys: ["district_heat_kwh"],
    requiresEvidence: false,
    note: "Include when material to organisational boundary.",
  },
  {
    code: "CA253-S3-1",
    law: "253",
    sectionId: "scope3",
    label: "Scope 3 — supplier spend basis",
    sourceKind: "metric",
    metricKeys: ["supplier_spend_total"],
    phaseScope3: true,
    requiresEvidence: false,
    note: "Scored when Scope 3 phase is active for the reporting year.",
  },
  {
    code: "CA253-S3-2",
    law: "253",
    sectionId: "scope3",
    label: "Scope 3 — business travel",
    sourceKind: "metric",
    metricKeys: ["business_travel_km"],
    phaseScope3: true,
    requiresEvidence: false,
  },
  {
    code: "CA253-S3-3",
    law: "253",
    sectionId: "scope3",
    label: "Scope 3 category inventory completeness",
    sourceKind: "unmapped",
    phaseScope3: true,
    href: "/scope3/category-1",
    note: "Full Scope 3 category map — use Scope 3 modules; not a single metric.",
  },
  {
    code: "CA253-A1",
    law: "253",
    sectionId: "assurance",
    label: "Limited assurance engagement planned (Scope 1–2)",
    sourceKind: "unmapped",
    href: "/assurance",
    note: "Assurance status is tracked outside metrics. Engage a provider before filing.",
  },
  {
    code: "CA253-A2",
    law: "253",
    sectionId: "assurance",
    label: "Evidence pack for Scope 1–2 activity data",
    sourceKind: "metric",
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3", "electricity_kwh"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "At least one Scope 1 or 2 activity metric with attached evidence.",
  },
];

/**
 * SB 261 — Climate-Related Financial Risk Act.
 * Maps to ClearESG TCFD pillars / question ids where the platform already collects narrative.
 */
export const SB261_DISCLOSURES: CaliforniaDisclosureDef[] = [
  {
    code: "CA261-E1",
    law: "261",
    sectionId: "entity",
    label: "Reporting entity legal name",
    sourceKind: "org_field",
    orgFields: ["name"],
    href: "/settings",
  },
  {
    code: "CA261-E2",
    law: "261",
    sectionId: "entity",
    label: "Revenue band (threshold screening)",
    sourceKind: "org_field",
    orgFields: ["revenueBand"],
    href: "/settings",
    note: "SB 261 applies to large entities doing business in California — confirm counsel thresholds.",
  },
  {
    code: "CA261-E3",
    law: "261",
    sectionId: "entity",
    label: "Sector / industry classification",
    sourceKind: "org_field",
    orgFields: ["sector"],
    href: "/settings",
  },
  {
    code: "CA261-G1",
    law: "261",
    sectionId: "governance",
    label: "Board oversight of climate-related risks",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["gov-board"],
    href: "/tcfd",
  },
  {
    code: "CA261-G2",
    law: "261",
    sectionId: "governance",
    label: "Management role in climate risk",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["gov-management"],
    href: "/tcfd",
  },
  {
    code: "CA261-G3",
    law: "261",
    sectionId: "governance",
    label: "Climate-linked incentives (optional depth)",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["gov-incentives"],
    href: "/tcfd",
    note: "Optional TCFD depth — improves SB 261 narrative quality.",
  },
  {
    code: "CA261-ST1",
    law: "261",
    sectionId: "strategy",
    label: "Climate risks and opportunities over horizons",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["str-risks"],
    href: "/tcfd",
  },
  {
    code: "CA261-ST2",
    law: "261",
    sectionId: "strategy",
    label: "Business and financial impact",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["str-impact"],
    href: "/tcfd",
  },
  {
    code: "CA261-ST3",
    law: "261",
    sectionId: "strategy",
    label: "Scenario analysis / strategy resilience",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["str-scenarios"],
    href: "/tcfd",
  },
  {
    code: "CA261-R1",
    law: "261",
    sectionId: "risk_management",
    label: "Climate risk identification process",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["risk-process"],
    href: "/tcfd",
  },
  {
    code: "CA261-R2",
    law: "261",
    sectionId: "risk_management",
    label: "Climate risk management process",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["risk-manage"],
    href: "/tcfd",
  },
  {
    code: "CA261-R3",
    law: "261",
    sectionId: "risk_management",
    label: "Integration into overall risk management",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["risk-integrate"],
    href: "/tcfd",
  },
  {
    code: "CA261-M1",
    law: "261",
    sectionId: "metrics_targets",
    label: "GHG emissions metrics (TCFD)",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["met-ghg"],
    href: "/tcfd",
    note: "Narrative may autofill from ClearESG emissions; confirm in TCFD.",
  },
  {
    code: "CA261-M2",
    law: "261",
    sectionId: "metrics_targets",
    label: "Climate targets and performance",
    sourceKind: "tcfd",
    tcfdQuestionIds: ["met-targets"],
    href: "/tcfd",
  },
  {
    code: "CA261-M3",
    law: "261",
    sectionId: "metrics_targets",
    label: "Scope 1–2 activity data supporting metrics",
    sourceKind: "metric",
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3", "electricity_kwh"],
    metricMatch: "any",
    requiresEvidence: false,
    note: "Quantitative beachhead for metrics pillar; pair with TCFD GHG answer.",
  },
  {
    code: "CA261-M4",
    law: "261",
    sectionId: "metrics_targets",
    label: "Public climate risk report publication channel",
    sourceKind: "unmapped",
    href: "/reports",
    note: "SB 261 requires a public report — publication channel is outside platform scoring.",
  },
];

export const CALIFORNIA_DISCLOSURES: CaliforniaDisclosureDef[] = [
  ...SB253_DISCLOSURES,
  ...SB261_DISCLOSURES,
];

export function californiaDisclosuresForLaw(
  law: CaliforniaLaw,
): CaliforniaDisclosureDef[] {
  return CALIFORNIA_DISCLOSURES.filter((d) => d.law === law);
}

export function californiaSectionsForLaw(law: CaliforniaLaw): CaliforniaSection[] {
  return CALIFORNIA_SECTIONS.filter((s) => s.law === law || s.law === "both");
}

export function californiaSectionById(
  id: CaliforniaSection["id"],
): CaliforniaSection | undefined {
  return CALIFORNIA_SECTIONS.find((s) => s.id === id);
}

/**
 * SB 253 Scope 3 phase heuristic — product aid, not a legal determination.
 * Scope 3 typically follows Scope 1–2 by one reporting cycle (~2027+).
 */
export function defaultScope3Required(reportingYear: number | null | undefined): boolean {
  if (typeof reportingYear !== "number" || !Number.isFinite(reportingYear)) {
    return false;
  }
  return reportingYear >= 2027;
}
