/**
 * ISO 14064 Part 1 / Part 2 checklist catalog (30 items).
 * Copied into each org's ISO14064Compliance document on create.
 * Never hardcode these strings in UI components.
 */

export type Iso14064Part = "part1" | "part2";

export type Iso14064AutoLinkHint =
  "none" | "csrd_report" | "datapoints" | "audit_logs" | "emission_factors";

export type Iso14064SeedItem = {
  itemKey: string;
  sectionNumber: string;
  part: Iso14064Part;
  requirement: string;
  description: string;
  autoLinkHint: Iso14064AutoLinkHint;
};

/**
 * 30 pre-built requirements spanning ISO 14064-1 (org GHG inventory)
 * and ISO 14064-2 (project GHG quantification + verification).
 */
export const ISO_14064_CHECKLIST_SEEDS: Iso14064SeedItem[] = [
  // —— Part 1: Organisation-level GHG (14064-1) — 18 items ——
  {
    itemKey: "p1-01",
    sectionNumber: "1.1",
    part: "part1",
    requirement: "Define organisational boundary (Scope 1, 2, 3)",
    description:
      "Document equity share, financial control, or operational control approach and list entities in scope.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p1-02",
    sectionNumber: "1.2",
    part: "part1",
    requirement: "Identify emission sources",
    description:
      "Inventory stationary combustion, mobile, process, fugitive, purchased energy, and material Scope 3 categories.",
    autoLinkHint: "datapoints",
  },
  {
    itemKey: "p1-03",
    sectionNumber: "1.3",
    part: "part1",
    requirement: "Establish quantification methods",
    description:
      "Select calculation, measurement, or hybrid methods per source; record methodology references.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p1-04",
    sectionNumber: "1.4",
    part: "part1",
    requirement: "Set base year and reference year",
    description:
      "Choose and justify base year; document recalculation policy for structural changes.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p1-05",
    sectionNumber: "1.5",
    part: "part1",
    requirement: "Collect activity data",
    description:
      "Gather measured or estimated activity data covering the reporting period with quality notes.",
    autoLinkHint: "datapoints",
  },
  {
    itemKey: "p1-06",
    sectionNumber: "1.6",
    part: "part1",
    requirement: "Apply emission factors",
    description:
      "Use registry factors with documented source, vintage, and geography; no silent fallbacks.",
    autoLinkHint: "emission_factors",
  },
  {
    itemKey: "p1-07",
    sectionNumber: "1.7",
    part: "part1",
    requirement: "Calculate total GHG emissions",
    description:
      "Compute Scope 1, 2, and in-scope Scope 3 totals in tCO2e with transparent formulas.",
    autoLinkHint: "datapoints",
  },
  {
    itemKey: "p1-08",
    sectionNumber: "1.8",
    part: "part1",
    requirement: "Manage uncertainty",
    description:
      "Assess and document uncertainty for activity data and factors; state materiality thresholds.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p1-09",
    sectionNumber: "1.9",
    part: "part1",
    requirement: "Document assumptions and exclusions",
    description:
      "Record all material assumptions, excluded sources, and rationale for exclusions.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p1-10",
    sectionNumber: "1.10",
    part: "part1",
    requirement: "Establish internal QA/QC procedures",
    description:
      "Define review checkpoints, dual-control for key figures, and correction workflows.",
    autoLinkHint: "audit_logs",
  },
  {
    itemKey: "p1-11",
    sectionNumber: "1.11",
    part: "part1",
    requirement: "Establish internal audit procedures",
    description:
      "Schedule periodic internal audits of inventory boundary, data, and calculations.",
    autoLinkHint: "audit_logs",
  },
  {
    itemKey: "p1-12",
    sectionNumber: "1.12",
    part: "part1",
    requirement: "Prepare GHG inventory report",
    description:
      "Assemble an organisation-level GHG report covering boundary, methods, results, and uncertainty.",
    autoLinkHint: "csrd_report",
  },
  {
    itemKey: "p1-13",
    sectionNumber: "1.13",
    part: "part1",
    requirement: "Select GWP values and gas coverage",
    description:
      "Document IPCC assessment report vintage and gases included (CO2, CH4, N2O, etc.).",
    autoLinkHint: "none",
  },
  {
    itemKey: "p1-14",
    sectionNumber: "1.14",
    part: "part1",
    requirement: "Define reporting period and frequency",
    description:
      "Set fiscal or calendar reporting period and cadence for inventory updates.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p1-15",
    sectionNumber: "1.15",
    part: "part1",
    requirement: "Document data management system",
    description:
      "Describe systems of record, retention, access controls, and change history for activity data.",
    autoLinkHint: "audit_logs",
  },
  {
    itemKey: "p1-16",
    sectionNumber: "1.16",
    part: "part1",
    requirement: "Address biogenic and removals accounting",
    description:
      "If applicable, separate biogenic CO2 and removals from fossil inventory totals.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p1-17",
    sectionNumber: "1.17",
    part: "part1",
    requirement: "Disclose intensity metrics (optional but recommended)",
    description:
      "Report intensity alongside absolute emissions where useful for stakeholders.",
    autoLinkHint: "datapoints",
  },
  {
    itemKey: "p1-18",
    sectionNumber: "1.18",
    part: "part1",
    requirement: "Request third-party verification (Part 1)",
    description:
      "Engage an independent verifier for the organisation-level GHG inventory statement.",
    autoLinkHint: "none",
  },
  // —— Part 2: Project-level GHG (14064-2) — 12 items ——
  {
    itemKey: "p2-01",
    sectionNumber: "2.1",
    part: "part2",
    requirement: "Define GHG project and objectives",
    description:
      "Describe the project, baseline scenario, and intended GHG reductions or removals.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p2-02",
    sectionNumber: "2.2",
    part: "part2",
    requirement: "Set project boundary and SSRs",
    description:
      "Identify sources, sinks, and reservoirs (SSRs) inside and affected by the project.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p2-03",
    sectionNumber: "2.3",
    part: "part2",
    requirement: "Establish baseline scenario",
    description:
      "Document the most plausible baseline and justify additionality assumptions.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p2-04",
    sectionNumber: "2.4",
    part: "part2",
    requirement: "Select quantification methodology",
    description:
      "Choose an approved or justified methodology for project GHG quantification.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p2-05",
    sectionNumber: "2.5",
    part: "part2",
    requirement: "Collect project monitoring data",
    description:
      "Implement the monitoring plan; retain raw readings and calibration records.",
    autoLinkHint: "datapoints",
  },
  {
    itemKey: "p2-06",
    sectionNumber: "2.6",
    part: "part2",
    requirement: "Quantify project GHG reductions / removals",
    description:
      "Calculate ex-post reductions or removals versus baseline for the crediting period.",
    autoLinkHint: "datapoints",
  },
  {
    itemKey: "p2-07",
    sectionNumber: "2.7",
    part: "part2",
    requirement: "Assess leakage and permanence",
    description:
      "Evaluate leakage effects and permanence risks; apply discounts where required.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p2-08",
    sectionNumber: "2.8",
    part: "part2",
    requirement: "Manage project uncertainty",
    description:
      "Quantify uncertainty for project estimates and document conservative approaches.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p2-09",
    sectionNumber: "2.9",
    part: "part2",
    requirement: "Prepare project GHG report",
    description:
      "Compile project documentation suitable for verification under ISO 14064-2 / 14064-3.",
    autoLinkHint: "csrd_report",
  },
  {
    itemKey: "p2-10",
    sectionNumber: "2.10",
    part: "part2",
    requirement: "Establish project monitoring plan",
    description:
      "Define parameters, frequency, responsibilities, and QA for ongoing monitoring.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p2-11",
    sectionNumber: "2.11",
    part: "part2",
    requirement: "Document safeguards and stakeholder consultation",
    description:
      "Record environmental/social safeguards and any stakeholder consultation evidence.",
    autoLinkHint: "none",
  },
  {
    itemKey: "p2-12",
    sectionNumber: "2.12",
    part: "part2",
    requirement: "Request third-party verification (Part 2)",
    description:
      "Engage an independent verifier for project GHG assertions and issue a verification statement.",
    autoLinkHint: "none",
  },
];

export const ISO_14064_CHECKLIST_COUNT = ISO_14064_CHECKLIST_SEEDS.length;

export function buildSeededSections(): Array<{
  itemKey: string;
  sectionNumber: string;
  part: Iso14064Part;
  requirement: string;
  description: string;
  status: "not_started";
  evidenceIds: string[];
  notes: string;
  autoLinkHint: Iso14064AutoLinkHint;
}> {
  return ISO_14064_CHECKLIST_SEEDS.map((item) => ({
    itemKey: item.itemKey,
    sectionNumber: item.sectionNumber,
    part: item.part,
    requirement: item.requirement,
    description: item.description,
    status: "not_started" as const,
    evidenceIds: [],
    notes: "",
    autoLinkHint: item.autoLinkHint,
  }));
}
