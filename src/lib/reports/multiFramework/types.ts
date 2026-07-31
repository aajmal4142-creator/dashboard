/** Frameworks that may appear in a multi-framework consolidated report. */
export type MultiFrameworkId = "csrd" | "tcfd" | "issb" | "gri";

export type SharedEmissionsBlock = {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  dataQualityPct: number;
  emissionsStandard?: string;
  periodLabel?: string | null;
};

export type FrameworkCompletenessInput = {
  framework: MultiFrameworkId;
  /** True when the source artefact is done (published / final / material topics present). */
  complete: boolean;
  /** Optional human reason when incomplete — never shown as a finished section. */
  skipReason?: string;
};

export type MultiFrameworkTarget = {
  metricKey: string;
  metricLabel?: string | null;
  targetValue: number;
  baselineYear: number;
  targetYear: number;
  status: string;
};

export type TcfdRiskItem = {
  id: string;
  pillar: string;
  label: string;
  answer: string;
};

export type TcfdScenarioItem = {
  id: string;
  name: string;
  type: string;
  baselineYear: number;
  targetYear: number;
  reductionPercent: number;
  category: string | null;
};

export type IssbMetricItem = {
  id: string;
  standard: "S1" | "S2";
  label: string;
  answer: string;
};

export type GriMaterialTopic = {
  esrsTopic: string;
  label: string;
  impactScore: number;
  financialScore: number;
};

export type CsrdSectionContent = {
  framework: "csrd";
  sectionNumber: number;
  reportId: string | null;
  reportFramework: string | null;
  /** Emissions printed only when this section owns the shared block. */
  includeEmissions: boolean;
  emissions: SharedEmissionsBlock | null;
  emissionsCrossRef: string | null;
  targets: MultiFrameworkTarget[];
  scores: { overall: number; e: number; s: number; g: number } | null;
};

export type TcfdSectionContent = {
  framework: "tcfd";
  sectionNumber: number;
  disclosureId: string | null;
  riskItems: TcfdRiskItem[];
  scenarios: TcfdScenarioItem[];
  /** Never embeds Scope totals when another framework owns emissions. */
  includeEmissions: boolean;
  emissions: SharedEmissionsBlock | null;
  emissionsCrossRef: string | null;
};

export type IssbSectionContent = {
  framework: "issb";
  sectionNumber: number;
  disclosureId: string | null;
  metrics: IssbMetricItem[];
  includeEmissions: boolean;
  emissions: SharedEmissionsBlock | null;
  emissionsCrossRef: string | null;
  linkedTcfdCrossRef: string | null;
};

export type GriSectionContent = {
  framework: "gri";
  sectionNumber: number;
  narrative: string | null;
  materialTopics: GriMaterialTopic[];
};

export type MultiFrameworkSection =
  CsrdSectionContent | TcfdSectionContent | IssbSectionContent | GriSectionContent;

export type MultiFrameworkExecutiveSummary = {
  paragraph: string;
  includedFrameworks: MultiFrameworkId[];
  skippedFrameworks: Array<{ framework: MultiFrameworkId; reason: string }>;
  highlights: string[];
};

export type MultiFrameworkReport = {
  organisationId: string;
  organisationName: string;
  periodId: string;
  periodLabel: string;
  reportingYear: number;
  generatedAt: string;
  /** Shared emissions printed once; sections cross-reference this owner. */
  emissionsOwner: MultiFrameworkId | null;
  emissions: SharedEmissionsBlock | null;
  executiveSummary: MultiFrameworkExecutiveSummary;
  sections: MultiFrameworkSection[];
  disclaimer: string;
};

export const MULTI_FRAMEWORK_DISCLAIMER =
  "ClearESG is not an assurance provider. This multi-framework report summarises management-reported data and calculated estimates across available completed disclosures. Incomplete frameworks are omitted. It is not an audit opinion.";

/** React-PDF light tokens — framework section accent colours. */
export const FRAMEWORK_SECTION_COLORS: Record<MultiFrameworkId, string> = {
  csrd: "#7A2E2E", // accent
  tcfd: "#1E3A5F", // cobalt
  issb: "#0E7C4A", // signal
  gri: "#B45309", // amber
};

export const FRAMEWORK_LABELS: Record<MultiFrameworkId, string> = {
  csrd: "CSRD",
  tcfd: "TCFD",
  issb: "ISSB",
  gri: "GRI",
};
