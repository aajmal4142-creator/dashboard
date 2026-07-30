/** Custom compliance assessment types (F13). */

export type ComplianceIndustry =
  "general" | "oil_gas" | "manufacturing" | "finance" | "retail";

export type ComplianceAnswerType =
  "text" | "number" | "boolean" | "select" | "calculated";

export type ComplianceCalcOp = "sum" | "product" | "ratio" | "difference";

export type ComplianceQuestion = {
  questionId: string;
  sectionKey: string;
  label: string;
  prompt: string;
  answerType: ComplianceAnswerType;
  options?: string[] | null;
  unit?: string | null;
  required: boolean;
  order?: number | null;
};

export type ComplianceCalculation = {
  calcId: string;
  label: string;
  op: ComplianceCalcOp;
  inputs: string[];
  unit?: string | null;
  sectionKey?: string | null;
};

export type ComplianceSection = {
  sectionTitle: string;
  sectionKey: string;
  sectionType: "questions" | "calculations" | "narrative" | "text";
  order?: number | null;
};

export type ComplianceTemplateDefinition = {
  starterKey: string;
  templateName: string;
  description: string;
  industry: ComplianceIndustry;
  framework: "custom" | "gri" | "sasb";
  sections: ComplianceSection[];
  questions: ComplianceQuestion[];
  calculations: ComplianceCalculation[];
};

export type ComplianceAnswerValue = string | number | boolean | null;

export type ComplianceAnswer = {
  value: ComplianceAnswerValue;
  updatedAt: string;
};

export type ComplianceAnswersMap = Record<string, ComplianceAnswer>;

export type ComplianceCalcResult = {
  calcId: string;
  label: string;
  value: number | null;
  unit: string | null;
  quality: "calculated" | "missing";
  detail?: string;
};

export type ComplianceCalcResultsMap = Record<string, ComplianceCalcResult>;

export type ComplianceTemplateSnapshot = {
  templateId: string;
  templateName: string;
  industry: ComplianceIndustry | null;
  description: string | null;
  sections: ComplianceSection[];
  questions: ComplianceQuestion[];
  calculations: ComplianceCalculation[];
};

export type ComplianceAssessmentSnapshot = {
  organisationName: string;
  title: string;
  reportingYear: number;
  status: "draft" | "final";
  industry: ComplianceIndustry | null;
  templateName: string;
  publishedAt: string;
  sections: Array<{
    sectionKey: string;
    title: string;
    questions: Array<{
      questionId: string;
      label: string;
      prompt: string;
      answerType: ComplianceAnswerType;
      value: ComplianceAnswerValue;
      unit: string | null;
      required: boolean;
    }>;
    calculations: Array<{
      calcId: string;
      label: string;
      value: number | null;
      unit: string | null;
      quality: "calculated" | "missing";
    }>;
  }>;
  disclaimer: string;
  preparedBy?: { id: string; name: string } | null;
};

export const COMPLIANCE_DISCLAIMER =
  "ClearESG is not an assurance provider. This assessment summarises management-reported answers and derived calculations. It is not an audit opinion.";

export const INDUSTRY_LABELS: Record<ComplianceIndustry, string> = {
  general: "General",
  oil_gas: "Oil & Gas",
  manufacturing: "Manufacturing",
  finance: "Finance",
  retail: "Retail",
};
