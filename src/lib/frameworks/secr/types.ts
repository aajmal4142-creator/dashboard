/**
 * UK SECR (Streamlined Energy and Carbon Reporting) — typed catalog + coverage.
 * Deterministic only. Labels are product aids, not legal determinations.
 */

export type SecrLevel = "core" | "supporting";

export type SecrSectionId =
  "energy" | "ghg" | "intensity" | "methodology" | "directors_report";

export type SecrGapKind =
  "missing_data" | "missing_evidence" | "unmapped" | "weak_quality";

export type SecrDisclosureState = "covered" | "partial" | "gap";

export type SecrSection = {
  id: SecrSectionId;
  title: string;
  shortTitle: string;
  description: string;
};

/**
 * One Core (required) or Supporting disclosure under a SECR section.
 * `metricKeys` empty ⇒ ClearESG cannot score it yet (always a gap: unmapped).
 */
export type SecrDisclosureDef = {
  code: string;
  sectionId: SecrSectionId;
  level: SecrLevel;
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

export type SecrDatapointInput = {
  metricKey: string;
  quality: "measured" | "calculated" | "estimated" | "missing";
  provenance?: "supplier_primary" | "spend_estimate" | "manual" | null;
  evidenceIds: string[];
};

export type SecrDisclosureStatus = {
  code: string;
  sectionId: SecrSectionId;
  level: SecrLevel;
  label: string;
  state: SecrDisclosureState;
  gapKind: SecrGapKind | null;
  missingMetricKeys: string[];
  presentMetricKeys: string[];
  evidenceIds: string[];
  /** Deep-link into Metrics (/data) for the primary missing/present key. */
  metricsHref: string;
  note?: string;
};

export type SecrLevelSummary = {
  level: SecrLevel;
  total: number;
  covered: number;
  partial: number;
  gap: number;
  /** Integer 0–100: covered / total. */
  pctCovered: number;
};

export type SecrSectionCoverage = {
  section: SecrSection;
  core: {
    covered: number;
    partial: number;
    gap: number;
    total: number;
    pctCovered: number;
  };
  supporting: {
    covered: number;
    partial: number;
    gap: number;
    total: number;
    pctCovered: number;
  };
  disclosures: SecrDisclosureStatus[];
};

export type SecrCoverageResult = {
  periodId: string;
  core: SecrLevelSummary;
  supporting: SecrLevelSummary;
  sections: SecrSectionCoverage[];
  /** Gaps + partials that still need action (data, evidence, or mapping). */
  gaps: SecrDisclosureStatus[];
};

/** Plain-text / JSON draft pack for directors' report preparation. */
export type SecrDraftSummary = {
  title: string;
  periodId: string;
  generatedAt: string;
  corePctCovered: number;
  supportingPctCovered: number;
  lines: string[];
};
