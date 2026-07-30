/** TCFD pillar identifiers — Task Force on Climate-related Financial Disclosures. */
export type TcfdPillar =
  "governance" | "strategy" | "risk_management" | "metrics_targets";

export type TcfdAnswerSource = "manual" | "clearesg" | "scenario";

export type TcfdAnswer = {
  text: string;
  source: TcfdAnswerSource;
  autoFilled: boolean;
  updatedAt: string;
};

export type TcfdAnswersMap = Record<string, TcfdAnswer>;

export type TcfdQuestion = {
  id: string;
  pillar: TcfdPillar;
  label: string;
  prompt: string;
  /** When true, autofill may overwrite empty answers from ClearESG calc / scenarios. */
  autofillKey?: "emissions" | "scenarios" | "quality";
  required: boolean;
};

export type TcfdEmissionsSnapshot = {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  dataQualityPct: number;
  periodId: string | null;
  periodLabel: string | null;
  quality: "calculated" | "missing";
  emissionsStandard?: string;
  capturedAt: string;
};

export type TcfdScenarioSummary = {
  id: string;
  name: string;
  type: string;
  baselineYear: number;
  targetYear: number;
  reductionPercent: number;
  category: string | null;
};

export type TcfdDisclosureSnapshot = {
  organisationName: string;
  reportingYear: number;
  status: "draft" | "final";
  versionLabel: string;
  publishedAt: string;
  pillars: Array<{
    pillar: TcfdPillar;
    title: string;
    questions: Array<{
      id: string;
      label: string;
      prompt: string;
      answer: string;
      source: TcfdAnswerSource;
      autoFilled: boolean;
    }>;
  }>;
  emissions: TcfdEmissionsSnapshot | null;
  scenarios: TcfdScenarioSummary[];
  disclaimer: string;
  preparedBy?: { id: string; name: string } | null;
  yoy?: {
    previousYear: number;
    previousTotal: number | null;
    changePct: number | null;
  } | null;
};

export const TCFD_DISCLAIMER =
  "ClearESG is not an assurance provider. This TCFD disclosure summarises management-reported answers and calculated emissions estimates. It is not an audit opinion.";

export const TCFD_PILLAR_TITLES: Record<TcfdPillar, string> = {
  governance: "Governance",
  strategy: "Strategy",
  risk_management: "Risk Management",
  metrics_targets: "Metrics & Targets",
};
