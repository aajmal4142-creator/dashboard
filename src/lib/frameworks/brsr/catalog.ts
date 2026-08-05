/**
 * SEBI BRSR principle catalog — Essential (Core) vs Leadership (Comprehensive).
 *
 * Metric keys map only where ClearESG already collects data (MetricDefinition /
 * DATA_METRICS / derived.*). Empty metricKeys = honest unmapped gap, not a guess.
 *
 * Citations are structural (NGRBC principles + BRSR Essential/Leadership split).
 * Do not treat labels as counsel-approved legal determinations.
 */

import type { BrsrDisclosureDef, BrsrPrinciple } from "./types";

export const BRSR_PRINCIPLES: BrsrPrinciple[] = [
  {
    id: "P1",
    number: 1,
    title:
      "Businesses should conduct and govern themselves with integrity in a manner that is ethical, transparent and accountable",
    shortTitle: "Ethics & transparency",
  },
  {
    id: "P2",
    number: 2,
    title:
      "Businesses should provide goods and services in a manner that is sustainable and safe",
    shortTitle: "Sustainable products",
  },
  {
    id: "P3",
    number: 3,
    title:
      "Businesses should respect and promote the well-being of all employees, including those in their value chains",
    shortTitle: "Employee wellbeing",
  },
  {
    id: "P4",
    number: 4,
    title:
      "Businesses should respect the interests of and be responsive to all their stakeholders",
    shortTitle: "Stakeholder engagement",
  },
  {
    id: "P5",
    number: 5,
    title: "Businesses should respect and promote human rights",
    shortTitle: "Human rights",
  },
  {
    id: "P6",
    number: 6,
    title:
      "Businesses should respect and make efforts to protect and restore the environment",
    shortTitle: "Environment",
  },
  {
    id: "P7",
    number: 7,
    title:
      "Businesses, when engaging in influencing public and regulatory policy, should do so in a manner that is responsible and transparent",
    shortTitle: "Public policy",
  },
  {
    id: "P8",
    number: 8,
    title: "Businesses should promote inclusive growth and equitable development",
    shortTitle: "Inclusive growth",
  },
  {
    id: "P9",
    number: 9,
    title:
      "Businesses should engage with and provide value to their consumers in a responsible manner",
    shortTitle: "Consumer value",
  },
];

/**
 * Essential = Core (BRSR Core KPI beachhead).
 * Leadership = Comprehensive (additional depth).
 */
export const BRSR_DISCLOSURES: BrsrDisclosureDef[] = [
  // ── P1 Ethics ──────────────────────────────────────────────────────────
  {
    code: "P1-E1",
    principleId: "P1",
    level: "core",
    label: "Anti-corruption / anti-bribery policy in force",
    metricKeys: ["policy_anti_corruption"],
    requiresEvidence: true,
  },
  {
    code: "P1-E2",
    principleId: "P1",
    level: "core",
    label: "Whistleblower / vigil mechanism available",
    metricKeys: ["policy_whistleblower"],
    requiresEvidence: true,
  },
  {
    code: "P1-E3",
    principleId: "P1",
    level: "core",
    label: "Board composition — size and independence",
    metricKeys: ["board_size", "board_independent"],
    requiresEvidence: false,
  },
  {
    code: "P1-L1",
    principleId: "P1",
    level: "comprehensive",
    label: "Data privacy / protection policy in force",
    metricKeys: ["policy_data_privacy"],
    requiresEvidence: true,
  },
  {
    code: "P1-L2",
    principleId: "P1",
    level: "comprehensive",
    label: "Details of fines / penalties for anti-corruption breaches",
    metricKeys: ["fines_anti_corruption_count"],
    requiresEvidence: true,
    note: "Count metric; attach narrative evidence for SEBI narrative cells.",
  },

  // ── P2 Sustainable products ────────────────────────────────────────────
  {
    code: "P2-E1",
    principleId: "P2",
    level: "core",
    label: "R&D / capital investment toward sustainable products (qualitative)",
    metricKeys: [],
    requiresEvidence: true,
    note: "Leadership narrative in full BRSR; no platform metric yet.",
  },
  {
    code: "P2-L1",
    principleId: "P2",
    level: "comprehensive",
    label: "Percentage of recycled / reused input material",
    metricKeys: ["input_recycled_pct"],
    requiresEvidence: true,
    note: "Circularity KPI — enter input_recycled_pct on Metrics.",
  },

  // ── P3 Employee wellbeing ──────────────────────────────────────────────
  {
    code: "P3-E1",
    principleId: "P3",
    level: "core",
    label: "Total permanent employees (FTE)",
    metricKeys: ["employees_total"],
    requiresEvidence: false,
  },
  {
    code: "P3-E2",
    principleId: "P3",
    level: "core",
    label: "Recordable work-related injuries",
    metricKeys: ["injuries_recordable"],
    requiresEvidence: true,
  },
  {
    code: "P3-E3",
    principleId: "P3",
    level: "core",
    label: "Total hours worked (injury-rate denominator)",
    metricKeys: ["hours_worked_total"],
    requiresEvidence: false,
  },
  {
    code: "P3-L1",
    principleId: "P3",
    level: "comprehensive",
    label: "Training hours delivered to employees",
    metricKeys: ["training_hours_total"],
    requiresEvidence: false,
  },
  {
    code: "P3-L2",
    principleId: "P3",
    level: "comprehensive",
    label: "Return to work and retention rates after parental leave",
    metricKeys: ["parental_return_rate"],
    requiresEvidence: true,
    note: "Enter parental_return_rate on Metrics; attach HR evidence.",
  },

  // ── P4 Stakeholders ────────────────────────────────────────────────────
  {
    code: "P4-E1",
    principleId: "P4",
    level: "core",
    label: "Processes for stakeholder identification and engagement",
    metricKeys: ["stakeholder_engagement_events"],
    requiresEvidence: true,
    note: "Event count is a beachhead proxy; policy narrative still needs evidence.",
  },
  {
    code: "P4-L1",
    principleId: "P4",
    level: "comprehensive",
    label: "Instances of stakeholder engagement outcomes disclosed",
    metricKeys: ["stakeholder_engagement_events"],
    requiresEvidence: true,
    note: "Same engagement events metric; attach outcome narrative in evidence.",
  },

  // ── P5 Human rights ────────────────────────────────────────────────────
  {
    code: "P5-E1",
    principleId: "P5",
    level: "core",
    label: "Human rights / labour policy coverage (proxy: whistleblower channel)",
    metricKeys: ["policy_whistleblower"],
    requiresEvidence: true,
    note: "Proxy only until a dedicated human-rights policy metric ships.",
  },
  {
    code: "P5-L1",
    principleId: "P5",
    level: "comprehensive",
    label: "Value-chain human rights assessment coverage",
    metricKeys: ["value_chain_hr_assessment_pct"],
    requiresEvidence: true,
    note: "Enter value_chain_hr_assessment_pct on Metrics.",
  },

  // ── P6 Environment ─────────────────────────────────────────────────────
  {
    code: "P6-E1",
    principleId: "P6",
    level: "core",
    label: "Total energy consumption",
    metricKeys: ["derived.energy_total_mwh", "electricity_kwh"],
    metricMatch: "any",
    requiresEvidence: true,
  },
  {
    code: "P6-E2",
    principleId: "P6",
    level: "core",
    label: "Scope 1 fuel inputs (diesel, petrol, natural gas)",
    metricKeys: ["diesel_litres", "petrol_litres", "natural_gas_m3"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "At least one Scope 1 fuel metric present counts toward coverage.",
  },
  {
    code: "P6-E3",
    principleId: "P6",
    level: "core",
    label: "Scope 2 electricity purchased",
    metricKeys: ["electricity_kwh"],
    requiresEvidence: true,
  },
  {
    code: "P6-E4",
    principleId: "P6",
    level: "core",
    label: "Renewable share of electricity",
    metricKeys: ["electricity_renewable_pct"],
    requiresEvidence: true,
  },
  {
    code: "P6-E5",
    principleId: "P6",
    level: "core",
    label: "Water withdrawal / consumption",
    metricKeys: ["water_withdrawal_m3", "water_discharge_m3"],
    metricMatch: "any",
    requiresEvidence: true,
    note: "At least one operational water metric (withdrawal or discharge) counts toward coverage.",
  },
  {
    code: "P6-E6",
    principleId: "P6",
    level: "core",
    label: "Waste generated and disposed",
    metricKeys: [
      "waste_generated_tonnes",
      "waste_tonnes",
      "waste_recycled_tonnes",
      "waste_to_landfill_tonnes",
    ],
    metricMatch: "any",
    requiresEvidence: true,
    note: "At least one waste metric present counts toward coverage. Prefer waste_generated_tonnes over legacy waste_tonnes.",
  },
  {
    code: "P6-L1",
    principleId: "P6",
    level: "comprehensive",
    label: "Scope 3 — supplier spend basis",
    metricKeys: ["supplier_spend_total"],
    requiresEvidence: false,
  },
  {
    code: "P6-L2",
    principleId: "P6",
    level: "comprehensive",
    label: "Scope 3 — business travel",
    metricKeys: ["business_travel_km"],
    requiresEvidence: false,
  },
  {
    code: "P6-L3",
    principleId: "P6",
    level: "comprehensive",
    label: "District heating / cooling purchased",
    metricKeys: ["district_heat_kwh"],
    requiresEvidence: false,
  },
  {
    code: "P6-L4",
    principleId: "P6",
    level: "comprehensive",
    label: "Renewable share of total energy (derived)",
    metricKeys: ["derived.energy_renewable_pct", "electricity_renewable_pct"],
    metricMatch: "any",
    requiresEvidence: false,
  },

  // ── P7 Public policy ───────────────────────────────────────────────────
  {
    code: "P7-E1",
    principleId: "P7",
    level: "core",
    label: "Public policy advocacy affiliations disclosed",
    metricKeys: [],
    requiresEvidence: true,
    note: "Governance narrative — not collected as a ClearESG metric yet.",
  },
  {
    code: "P7-L1",
    principleId: "P7",
    level: "comprehensive",
    label: "Details of public policy positions taken",
    metricKeys: [],
    requiresEvidence: true,
    note: "Leadership narrative — not collected as a ClearESG metric yet.",
  },

  // ── P8 Inclusive growth ────────────────────────────────────────────────
  {
    code: "P8-E1",
    principleId: "P8",
    level: "core",
    label: "Gender diversity — women in workforce",
    metricKeys: ["employees_women", "employees_total"],
    requiresEvidence: false,
  },
  {
    code: "P8-L1",
    principleId: "P8",
    level: "comprehensive",
    label: "CSR / community development spend",
    metricKeys: ["csr_spend_inr"],
    requiresEvidence: true,
    note: "Enter csr_spend_inr on Metrics (INR).",
  },

  // ── P9 Consumers ───────────────────────────────────────────────────────
  {
    code: "P9-E1",
    principleId: "P9",
    level: "core",
    label: "Consumer complaints / data privacy incidents",
    metricKeys: ["policy_data_privacy"],
    requiresEvidence: true,
    note: "Policy presence is a proxy until incident-count metrics ship.",
  },
  {
    code: "P9-L1",
    principleId: "P9",
    level: "comprehensive",
    label: "Product recall instances and corrective actions",
    metricKeys: ["product_recall_count"],
    requiresEvidence: true,
    note: "Enter product_recall_count; attach corrective-action evidence.",
  },
];

export function brsrPrincipleById(id: BrsrPrinciple["id"]): BrsrPrinciple | undefined {
  return BRSR_PRINCIPLES.find((p) => p.id === id);
}

export function brsrDisclosuresForLevel(
  level: BrsrDisclosureDef["level"],
): BrsrDisclosureDef[] {
  return BRSR_DISCLOSURES.filter((d) => d.level === level);
}

/** FrameworkMappingRow-compatible rows for disclosures with ClearESG metrics. */
export function brsrCatalogAsFrameworkMappings(): Array<{
  framework: "BRSR";
  datapointRef: string;
  label: string;
  required: boolean;
  contributionOnly: boolean;
  metricKeys: string[];
  note?: string;
}> {
  return BRSR_DISCLOSURES.filter((d) => d.metricKeys.length > 0).map((d) => ({
    framework: "BRSR" as const,
    datapointRef: d.code,
    label: `${d.label} (${d.level === "core" ? "Core" : "Comprehensive"})`,
    required: d.level === "core",
    contributionOnly: d.level === "comprehensive",
    metricKeys: d.metricKeys,
    note: d.note,
  }));
}
