/**
 * BRSR Core vs Comprehensive — typed catalog + coverage shapes.
 * Deterministic only. Labels are product aids, not legal determinations.
 */

export type BrsrLevel = "core" | "comprehensive";

export type BrsrPrincipleId =
  "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9";

export type BrsrGapKind =
  "missing_data" | "missing_evidence" | "unmapped" | "weak_quality";

export type BrsrDisclosureState = "covered" | "partial" | "gap";

export type BrsrPrinciple = {
  id: BrsrPrincipleId;
  number: number;
  title: string;
  shortTitle: string;
};

/**
 * One Essential (core) or Leadership (comprehensive) disclosure under a principle.
 * `metricKeys` empty ⇒ ClearESG cannot score it yet (always a gap: unmapped).
 */
export type BrsrDisclosureDef = {
  code: string;
  principleId: BrsrPrincipleId;
  level: BrsrLevel;
  label: string;
  metricKeys: string[];
  /**
   * `all` — every listed key must be present (default).
   * `any` — at least one listed key present (e.g. Scope 1 fuel mix).
   */
  metricMatch?: "all" | "any";
  requiresEvidence: boolean;
  note?: string;
};

export type BrsrDatapointInput = {
  metricKey: string;
  quality: "measured" | "calculated" | "estimated" | "missing";
  provenance?: "supplier_primary" | "spend_estimate" | "manual" | null;
  evidenceIds: string[];
};

export type BrsrDisclosureStatus = {
  code: string;
  principleId: BrsrPrincipleId;
  level: BrsrLevel;
  label: string;
  state: BrsrDisclosureState;
  gapKind: BrsrGapKind | null;
  missingMetricKeys: string[];
  presentMetricKeys: string[];
  evidenceIds: string[];
  /** Deep-link into Metrics for the primary missing/present key. */
  metricsHref: string;
  note?: string;
};

export type BrsrLevelSummary = {
  level: BrsrLevel;
  total: number;
  covered: number;
  partial: number;
  gap: number;
  /** Integer 0–100: covered / total. */
  pctCovered: number;
};

export type BrsrPrincipleCoverage = {
  principle: BrsrPrinciple;
  core: {
    covered: number;
    partial: number;
    gap: number;
    total: number;
    pctCovered: number;
  };
  comprehensive: {
    covered: number;
    partial: number;
    gap: number;
    total: number;
    pctCovered: number;
  };
  disclosures: BrsrDisclosureStatus[];
};

export type BrsrCoverageResult = {
  periodId: string;
  core: BrsrLevelSummary;
  comprehensive: BrsrLevelSummary;
  principles: BrsrPrincipleCoverage[];
  /** Gaps + partials that still need action (data, evidence, or mapping). */
  gaps: BrsrDisclosureStatus[];
};
