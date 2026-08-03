export type CsrdLevel = "core" | "supporting";

export type CsrdSectionId =
  "e1_climate" | "e2_pollution" | "e3_water" | "e5_circular" | "g1_business";

export type CsrdGapKind =
  "missing_data" | "missing_evidence" | "unmapped" | "weak_quality";

export type CsrdDisclosureState = "covered" | "partial" | "gap";

export type CsrdSection = {
  id: CsrdSectionId;
  title: string;
  shortTitle: string;
  description: string;
};

export type CsrdDisclosureDef = {
  code: string;
  sectionId: CsrdSectionId;
  level: CsrdLevel;
  label: string;
  metricKeys: string[];
  metricMatch?: "all" | "any";
  requiresEvidence: boolean;
  note?: string;
};

export type CsrdDatapointInput = {
  metricKey: string;
  quality: "measured" | "calculated" | "estimated" | "missing";
  provenance?: "supplier_primary" | "spend_estimate" | "manual" | null;
  evidenceIds: string[];
};

export type CsrdDisclosureStatus = {
  code: string;
  sectionId: CsrdSectionId;
  level: CsrdLevel;
  label: string;
  state: CsrdDisclosureState;
  gapKind: CsrdGapKind | null;
  missingMetricKeys: string[];
  presentMetricKeys: string[];
  evidenceIds: string[];
  metricsHref: string;
  note?: string;
};

export type CsrdLevelSummary = {
  level: CsrdLevel;
  total: number;
  covered: number;
  partial: number;
  gap: number;
  pctCovered: number;
};

export type CsrdSectionCoverage = {
  section: CsrdSection;
  disclosures: CsrdDisclosureStatus[];
};

export type CsrdCoverageResult = {
  periodId: string;
  core: CsrdLevelSummary;
  supporting: CsrdLevelSummary;
  sections: CsrdSectionCoverage[];
  disclosures: CsrdDisclosureStatus[];
};
