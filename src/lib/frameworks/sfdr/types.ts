/**
 * SFDR Principal Adverse Impact (PAI) — Table 1 investee-company indicators,
 * adapted for a corporate ClearESG disclosure workspace.
 * Deterministic only. Labels are product aids, not legal determinations.
 */

export type SfdrSectionId =
  "climate_ghg" | "energy_fossil" | "environment" | "social_governance";

export type SfdrSourceKind = "metric" | "org_field" | "unmapped";

export type SfdrGapKind =
  "missing_data" | "missing_evidence" | "missing_org_field" | "unmapped" | "weak_quality";

export type SfdrDisclosureState = "covered" | "partial" | "gap";

export type SfdrOrgField = "name" | "country" | "sector" | "revenueBand";

/**
 * One Table 1 PAI checklist row (mandatory indicators for investee companies).
 * Empty metricKeys / orgFields with sourceKind unmapped
 * ⇒ ClearESG cannot score it yet (always a gap: unmapped).
 */
export type SfdrIndicatorDef = {
  /** e.g. PAI-1.1 — stable product code. */
  code: string;
  /** Official Annex I Table 1 indicator number (1–14). */
  paiNumber: number;
  sectionId: SfdrSectionId;
  label: string;
  sourceKind: SfdrSourceKind;
  metricKeys?: string[];
  /**
   * `all` — every listed key must be present (default).
   * `any` — at least one listed key present (e.g. Scope 1 fuel mix).
   */
  metricMatch?: "all" | "any";
  orgFields?: SfdrOrgField[];
  requiresEvidence?: boolean;
  note?: string;
  /** Override deep-link (e.g. /data, /settings, /compliance/calendar). */
  href?: string;
};

export type SfdrSection = {
  id: SfdrSectionId;
  title: string;
  shortTitle: string;
  description: string;
};

export type SfdrDatapointInput = {
  metricKey: string;
  quality: "measured" | "calculated" | "estimated" | "missing";
  provenance?: "supplier_primary" | "spend_estimate" | "manual" | null;
  evidenceIds: string[];
};

export type SfdrOrgProfileInput = {
  name: string | null;
  country: string | null;
  sector: string | null;
  revenueBand: string | null;
};

export type SfdrIndicatorStatus = {
  code: string;
  paiNumber: number;
  sectionId: SfdrSectionId;
  label: string;
  state: SfdrDisclosureState;
  gapKind: SfdrGapKind | null;
  missingMetricKeys: string[];
  presentMetricKeys: string[];
  missingOrgFields: SfdrOrgField[];
  evidenceIds: string[];
  /** Deep-link into Metrics, settings, or catalog note. */
  actionHref: string;
  note?: string;
};

export type SfdrSectionSummary = {
  sectionId: SfdrSectionId;
  title: string;
  shortTitle: string;
  total: number;
  covered: number;
  partial: number;
  gap: number;
  /** Integer 0–100: covered / total. */
  pctCovered: number;
  indicators: SfdrIndicatorStatus[];
};

export type SfdrSummary = {
  total: number;
  covered: number;
  partial: number;
  gap: number;
  pctCovered: number;
};

export type SfdrCoverageResult = {
  periodId: string;
  summary: SfdrSummary;
  sections: SfdrSectionSummary[];
  /** Gaps + partials that still need action. */
  gaps: SfdrIndicatorStatus[];
};
