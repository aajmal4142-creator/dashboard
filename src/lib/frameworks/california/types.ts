/**
 * California SB 253 / SB 261 disclosure packs — typed catalog + coverage shapes.
 * Deterministic only. Labels are product aids, not legal determinations.
 */

export type CaliforniaLaw = "253" | "261";

export type CaliforniaSectionId =
  | "entity"
  | "scope1"
  | "scope2"
  | "scope3"
  | "assurance"
  | "governance"
  | "strategy"
  | "risk_management"
  | "metrics_targets";

export type CaliforniaSourceKind = "metric" | "org_field" | "tcfd" | "unmapped";

export type CaliforniaGapKind =
  | "missing_data"
  | "missing_evidence"
  | "missing_org_field"
  | "missing_tcfd"
  | "unmapped"
  | "weak_quality"
  | "phase_pending";

export type CaliforniaDisclosureState = "covered" | "partial" | "gap" | "deferred";

export type CaliforniaOrgField =
  "name" | "country" | "revenueBand" | "fiscalYearEnd" | "sector";

/**
 * One checklist row under SB 253 or SB 261.
 * Empty metricKeys / orgFields / tcfdQuestionIds with sourceKind unmapped
 * ⇒ ClearESG cannot score it yet (always a gap: unmapped).
 */
export type CaliforniaDisclosureDef = {
  code: string;
  law: CaliforniaLaw;
  sectionId: CaliforniaSectionId;
  label: string;
  sourceKind: CaliforniaSourceKind;
  metricKeys?: string[];
  /**
   * `all` — every listed key must be present (default).
   * `any` — at least one listed key present (e.g. Scope 1 fuel mix).
   */
  metricMatch?: "all" | "any";
  orgFields?: CaliforniaOrgField[];
  tcfdQuestionIds?: string[];
  /** SB 253 Scope 3 phase — scored only when scope3Required is true. */
  phaseScope3?: boolean;
  requiresEvidence?: boolean;
  note?: string;
  /** Override deep-link (e.g. /tcfd, /settings). */
  href?: string;
};

export type CaliforniaSection = {
  id: CaliforniaSectionId;
  title: string;
  shortTitle: string;
  law: CaliforniaLaw | "both";
};

export type CaliforniaDatapointInput = {
  metricKey: string;
  quality: "measured" | "calculated" | "estimated" | "missing";
  provenance?: "supplier_primary" | "spend_estimate" | "manual" | null;
  evidenceIds: string[];
};

export type CaliforniaOrgProfileInput = {
  name: string | null;
  country: string | null;
  revenueBand: string | null;
  fiscalYearEnd: string | null;
  sector: string | null;
};

export type CaliforniaTcfdAnswerInput = {
  questionId: string;
  /** Non-empty answer text present. */
  hasText: boolean;
};

export type CaliforniaDisclosureStatus = {
  code: string;
  law: CaliforniaLaw;
  sectionId: CaliforniaSectionId;
  label: string;
  state: CaliforniaDisclosureState;
  gapKind: CaliforniaGapKind | null;
  missingMetricKeys: string[];
  presentMetricKeys: string[];
  missingOrgFields: CaliforniaOrgField[];
  missingTcfdIds: string[];
  evidenceIds: string[];
  /** Deep-link into Metrics, TCFD, settings, or catalog note. */
  actionHref: string;
  note?: string;
};

export type CaliforniaSectionSummary = {
  sectionId: CaliforniaSectionId;
  title: string;
  shortTitle: string;
  total: number;
  covered: number;
  partial: number;
  gap: number;
  deferred: number;
  /** Integer 0–100: covered / (total − deferred). */
  pctCovered: number;
  disclosures: CaliforniaDisclosureStatus[];
};

export type CaliforniaLawSummary = {
  law: CaliforniaLaw;
  total: number;
  covered: number;
  partial: number;
  gap: number;
  deferred: number;
  pctCovered: number;
};

export type CaliforniaCoverageResult = {
  law: CaliforniaLaw;
  periodId: string;
  scope3Required: boolean;
  summary: CaliforniaLawSummary;
  sections: CaliforniaSectionSummary[];
  /** Gaps + partials that still need action (excludes deferred phase items). */
  gaps: CaliforniaDisclosureStatus[];
};
