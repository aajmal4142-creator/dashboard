/**
 * Green Taxonomy types — shared by pure calc, seed data, and service layer.
 */

export type TaxonomyObjectiveId =
  | "climate_mitigation"
  | "climate_adaptation"
  | "water"
  | "circular_economy"
  | "pollution"
  | "biodiversity";

export type AssessmentStatus = "draft" | "completed" | "verified";

export type YesNo = "yes" | "no" | "unanswered";

export type CriteriaAnswer = {
  criteriaId: string;
  met: YesNo;
  evidenceId?: string | null;
  notes?: string | null;
};

export type ObjectiveAnswer = {
  objective: TaxonomyObjectiveId;
  /** User-declared applicability for this assessment. */
  applicable: YesNo;
  answers: CriteriaAnswer[];
};

export type DnshAnswer = {
  objective: TaxonomyObjectiveId;
  criteriaId: string;
  compliant: YesNo;
  notes?: string | null;
};

export type TaxonomyCriterionDef = {
  id: string;
  prompt: string;
  /** Short label for gap analysis / PDF. */
  label: string;
};

export type TaxonomyObjectiveDef = {
  id: TaxonomyObjectiveId;
  label: string;
  shortLabel: string;
  description: string;
  /** Technical screening criteria (substantial contribution). */
  criteria: TaxonomyCriterionDef[];
  /** Do No Significant Harm criteria for this objective. */
  dnsh: TaxonomyCriterionDef[];
};

export type NaceCode = {
  /** NACE Rev. 2 code (section letter, 2-digit division, or 4-digit class). */
  code: string;
  name: string;
  /** Parent section letter A–U. */
  section: string;
  level: "section" | "division" | "class";
  /**
   * Objectives typically eligible for activities under this NACE code
   * (EU Taxonomy Delegated Acts — simplified eligibility hints).
   */
  eligibleObjectives: TaxonomyObjectiveId[];
};

export type ObjectiveAlignmentResult = {
  objective: TaxonomyObjectiveId;
  label: string;
  applicable: boolean;
  criteriaTotal: number;
  criteriaMet: number;
  criteriaUnanswered: number;
  /** 0–100 when applicable; null when not applicable. */
  alignmentPercent: number | null;
  gaps: string[];
  dnshTotal: number;
  dnshCompliant: number;
  dnshUnanswered: number;
  dnshPercent: number | null;
  dnshGaps: string[];
  /** Substantial contribution + DNSH both fully met. */
  fullyAligned: boolean;
};

export type TaxonomyAlignmentReport = {
  naceCode: string;
  naceName: string | null;
  applicableCount: number;
  nonApplicableCount: number;
  /** Mean of applicable objectives only — non-applicable excluded. */
  overallAlignmentPercent: number | null;
  /** Count of applicable objectives that are fully aligned. */
  fullyAlignedCount: number;
  objectives: ObjectiveAlignmentResult[];
  gaps: Array<{
    objective: TaxonomyObjectiveId;
    label: string;
    missingCriteria: string[];
    missingDnsh: string[];
  }>;
  /** Illustrative EU peer average for the NACE section (bundled reference). */
  euAveragePercent: number | null;
  euAverageNote: string | null;
};
