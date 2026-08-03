/**
 * Limited vs reasonable assurance pathway templates (Gap #38).
 * Pure definitions + coverage math — no I/O.
 * Evidence type ids are shared with the F17 evidence pack surface.
 */

import type { AssuranceLevel } from "./types";

export const ASSURANCE_EVIDENCE_TYPES = [
  "engagement_letter",
  "inventory_boundary",
  "methodology_memo",
  "activity_data",
  "emission_factors",
  "calculation_workpapers",
  "source_documents",
  "control_description",
  "sample_testing",
  "site_visit",
  "analytical_review",
  "management_representation",
  "completeness_cut_off",
  "prior_period_comparison",
  "materiality_memo",
] as const;

export type AssuranceEvidenceType = (typeof ASSURANCE_EVIDENCE_TYPES)[number];

export type PathwayCheckpoint = {
  id: string;
  label: string;
  /** Evidence types typically collected at this checkpoint */
  evidenceTypes: AssuranceEvidenceType[];
  /** How deep the procedure runs at this level */
  depthNote: string;
  required: boolean;
};

export type AssurancePathwayDefinition = {
  level: AssuranceLevel;
  label: string;
  summary: string;
  /** Overall depth guidance for the engagement letter / room */
  depthNotes: string;
  requiredEvidenceTypes: AssuranceEvidenceType[];
  checkpoints: PathwayCheckpoint[];
};

const LIMITED_CHECKPOINTS: PathwayCheckpoint[] = [
  {
    id: "lim_engagement_letter",
    label: "Engagement letter & scope",
    evidenceTypes: ["engagement_letter", "materiality_memo"],
    depthNote: "Agree limited-assurance objective, boundary, and materiality threshold.",
    required: true,
  },
  {
    id: "lim_boundary_walkthrough",
    label: "Boundary walkthrough",
    evidenceTypes: ["inventory_boundary"],
    depthNote:
      "Inquire on organisational and operational boundaries; no site visit required.",
    required: true,
  },
  {
    id: "lim_methodology_inquiry",
    label: "Methodology inquiry",
    evidenceTypes: ["methodology_memo", "emission_factors"],
    depthNote: "Discuss GHG Protocol method choices and factor sources with management.",
    required: true,
  },
  {
    id: "lim_analytical_review",
    label: "Analytical review",
    evidenceTypes: ["analytical_review", "prior_period_comparison", "activity_data"],
    depthNote:
      "Compare totals and intensities to prior period; investigate outliers via inquiry.",
    required: true,
  },
  {
    id: "lim_limited_trace",
    label: "Limited source trace",
    evidenceTypes: ["source_documents", "activity_data"],
    depthNote: "Trace a small judgmental sample of material lines to source docs.",
    required: true,
  },
  {
    id: "lim_factor_check",
    label: "Factor source check",
    evidenceTypes: ["emission_factors"],
    depthNote:
      "Confirm pinned factors match the registry vintage cited in the inventory.",
    required: true,
  },
  {
    id: "lim_management_rep",
    label: "Management representation",
    evidenceTypes: ["management_representation"],
    depthNote: "Obtain written reps on completeness and disclosure of known gaps.",
    required: true,
  },
  {
    id: "lim_draft_opinion",
    label: "Draft limited opinion",
    evidenceTypes: ["engagement_letter"],
    depthNote: "Negative-form conclusion draft for internal review before sign-off.",
    required: true,
  },
];

const REASONABLE_CHECKPOINTS: PathwayCheckpoint[] = [
  {
    id: "rea_engagement_letter",
    label: "Engagement letter & scope",
    evidenceTypes: ["engagement_letter", "materiality_memo"],
    depthNote: "Agree reasonable-assurance objective, risk assessment, and materiality.",
    required: true,
  },
  {
    id: "rea_boundary_test",
    label: "Boundary & completeness test",
    evidenceTypes: ["inventory_boundary", "completeness_cut_off"],
    depthNote: "Test entity listing, facilities, and cut-off against org hierarchy.",
    required: true,
  },
  {
    id: "rea_control_walkthrough",
    label: "Control walkthrough",
    evidenceTypes: ["control_description"],
    depthNote:
      "Walk through data collection controls; document design (not only inquiry).",
    required: true,
  },
  {
    id: "rea_methodology_test",
    label: "Methodology & factor testing",
    evidenceTypes: ["methodology_memo", "emission_factors", "calculation_workpapers"],
    depthNote:
      "Re-perform factor selection and recalculate a risk-based sample of lines.",
    required: true,
  },
  {
    id: "rea_substantive_sample",
    label: "Substantive sample testing",
    evidenceTypes: ["sample_testing", "source_documents", "activity_data"],
    depthNote:
      "Statistically or risk-based sample of activity data to original invoices/meters.",
    required: true,
  },
  {
    id: "rea_recalculation",
    label: "Independent recalculation",
    evidenceTypes: ["calculation_workpapers"],
    depthNote:
      "Independently recompute Scope totals from sampled activity × pinned factors.",
    required: true,
  },
  {
    id: "rea_site_visit",
    label: "Site visit / observation",
    evidenceTypes: ["site_visit"],
    depthNote:
      "Observe meters or processes at material sites (or equivalent remote evidence).",
    required: true,
  },
  {
    id: "rea_analytical_review",
    label: "Analytical procedures",
    evidenceTypes: ["analytical_review", "prior_period_comparison"],
    depthNote: "Trend and ratio analysis with documented follow-up on variances.",
    required: true,
  },
  {
    id: "rea_cut_off",
    label: "Cut-off & completeness",
    evidenceTypes: ["completeness_cut_off"],
    depthNote: "Test period cut-off and missing-category completeness assertions.",
    required: true,
  },
  {
    id: "rea_management_rep",
    label: "Management representation",
    evidenceTypes: ["management_representation"],
    depthNote:
      "Obtain written reps covering controls, completeness, and subsequent events.",
    required: true,
  },
  {
    id: "rea_draft_opinion",
    label: "Draft reasonable opinion",
    evidenceTypes: ["engagement_letter"],
    depthNote: "Positive-form conclusion draft with findings summary for sign-off.",
    required: true,
  },
  {
    id: "rea_optional_peer_review",
    label: "Engagement quality review",
    evidenceTypes: ["engagement_letter", "materiality_memo"],
    depthNote: "Optional EQCR for high-risk or first-year engagements.",
    required: false,
  },
];

function uniqueEvidence(types: AssuranceEvidenceType[]): AssuranceEvidenceType[] {
  return [...new Set(types)];
}

export const ASSURANCE_PATHWAYS: Record<AssuranceLevel, AssurancePathwayDefinition> = {
  limited: {
    level: "limited",
    label: "Limited assurance",
    summary:
      "Inquiry and analytical procedures with limited tracing. Lower cost; negative-form conclusion.",
    depthNotes:
      "Procedures are primarily inquiry, analytical review, and limited tracing. Suitable as a first-year or SMB pathway; upgrade to reasonable when controls and evidence depth mature.",
    requiredEvidenceTypes: uniqueEvidence(
      LIMITED_CHECKPOINTS.filter((c) => c.required).flatMap((c) => c.evidenceTypes),
    ),
    checkpoints: LIMITED_CHECKPOINTS,
  },
  reasonable: {
    level: "reasonable",
    label: "Reasonable assurance",
    summary:
      "Substantive testing, recalculation, and site observation. Higher confidence; positive-form conclusion.",
    depthNotes:
      "Procedures include control walkthroughs, substantive sampling, independent recalculation, and site observation. Expect a denser evidence pack and longer fieldwork.",
    requiredEvidenceTypes: uniqueEvidence(
      REASONABLE_CHECKPOINTS.filter((c) => c.required).flatMap((c) => c.evidenceTypes),
    ),
    checkpoints: REASONABLE_CHECKPOINTS,
  },
};

export function getPathway(level: AssuranceLevel): AssurancePathwayDefinition {
  return ASSURANCE_PATHWAYS[level];
}

export function isAssuranceLevel(value: unknown): value is AssuranceLevel {
  return value === "limited" || value === "reasonable";
}

export function isAssuranceEvidenceType(value: unknown): value is AssuranceEvidenceType {
  return (
    typeof value === "string" &&
    (ASSURANCE_EVIDENCE_TYPES as readonly string[]).includes(value)
  );
}

export type PathwayCoverageInput = {
  /** Checkpoint ids defined for the selected pathway */
  checkpointIds: string[];
  /** Ids marked complete on the engagement */
  completedIds: string[];
  /** When set, only these ids count toward the denominator (required checkpoints) */
  requiredIds?: string[];
};

export type PathwayCoverage = {
  completed: number;
  total: number;
  percent: number;
};

/**
 * Checklist coverage as a percentage of pathway checkpoints.
 * Uses required checkpoints when `requiredIds` is provided; otherwise all ids.
 */
export function calculatePathwayCoverage(input: PathwayCoverageInput): PathwayCoverage {
  const denomIds =
    input.requiredIds && input.requiredIds.length > 0
      ? input.requiredIds
      : input.checkpointIds;

  const total = denomIds.length;
  if (total === 0) {
    return { completed: 0, total: 0, percent: 0 };
  }

  const completedSet = new Set(input.completedIds);
  let completed = 0;
  for (const id of denomIds) {
    if (completedSet.has(id)) completed += 1;
  }

  const percent = Math.round((completed / total) * 100);
  return { completed, total, percent };
}

export function coverageForPathway(
  level: AssuranceLevel,
  completedIds: string[],
): PathwayCoverage {
  const pathway = getPathway(level);
  const checkpointIds = pathway.checkpoints.map((c) => c.id);
  const requiredIds = pathway.checkpoints.filter((c) => c.required).map((c) => c.id);
  return calculatePathwayCoverage({ checkpointIds, completedIds, requiredIds });
}

export function listPathways(): AssurancePathwayDefinition[] {
  return [ASSURANCE_PATHWAYS.limited, ASSURANCE_PATHWAYS.reasonable];
}
