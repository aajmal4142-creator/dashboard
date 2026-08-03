/**
 * Social / workforce indicators — typed catalog + coverage shapes.
 * Deterministic only. Labels are product aids, not legal determinations.
 * Non-carbon; does not feed lib/calc/emissions.
 */

export type SocialSectionId =
  "workforce" | "health_safety" | "learning" | "fair_pay" | "labour_practices";

export type SocialSourceKind = "metric" | "unmapped";

export type SocialGapKind =
  "missing_data" | "missing_evidence" | "unmapped" | "weak_quality";

export type SocialDisclosureState = "covered" | "partial" | "gap";

/**
 * One social / workforce checklist row.
 * Empty metricKeys with sourceKind unmapped
 * ⇒ ClearESG cannot score it yet (always a gap: unmapped).
 */
export type SocialIndicatorDef = {
  /** Stable product code, e.g. S-WF-1. */
  code: string;
  sectionId: SocialSectionId;
  label: string;
  sourceKind: SocialSourceKind;
  metricKeys?: string[];
  /**
   * `all` — every listed key must be present (default).
   * `any` — at least one listed key present.
   */
  metricMatch?: "all" | "any";
  requiresEvidence?: boolean;
  note?: string;
  /** Override deep-link (defaults to Metrics). */
  href?: string;
};

export type SocialSection = {
  id: SocialSectionId;
  title: string;
  shortTitle: string;
  description: string;
};

export type SocialDatapointInput = {
  metricKey: string;
  quality: "measured" | "calculated" | "estimated" | "missing";
  provenance?: "supplier_primary" | "spend_estimate" | "manual" | null;
  evidenceIds: string[];
};

export type SocialIndicatorStatus = {
  code: string;
  sectionId: SocialSectionId;
  label: string;
  state: SocialDisclosureState;
  gapKind: SocialGapKind | null;
  missingMetricKeys: string[];
  presentMetricKeys: string[];
  evidenceIds: string[];
  /** Deep-link into Metrics or catalog note. */
  actionHref: string;
  note?: string;
};

export type SocialSectionSummary = {
  sectionId: SocialSectionId;
  title: string;
  shortTitle: string;
  total: number;
  covered: number;
  partial: number;
  gap: number;
  /** Integer 0–100: covered / total. */
  pctCovered: number;
  indicators: SocialIndicatorStatus[];
};

export type SocialSummary = {
  total: number;
  covered: number;
  partial: number;
  gap: number;
  pctCovered: number;
};

export type SocialCoverageResult = {
  periodId: string;
  summary: SocialSummary;
  sections: SocialSectionSummary[];
  /** Gaps + partials that still need action. */
  gaps: SocialIndicatorStatus[];
};
