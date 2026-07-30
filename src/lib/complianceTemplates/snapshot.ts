import {
  COMPLIANCE_DISCLAIMER,
  type ComplianceAnswersMap,
  type ComplianceAssessmentSnapshot,
  type ComplianceCalcResultsMap,
  type ComplianceCalculation,
  type ComplianceIndustry,
  type ComplianceQuestion,
  type ComplianceSection,
  type ComplianceTemplateSnapshot,
} from "./types";
import { parseAnswers, parseCalcResults, runCalculations } from "./calculate";

export function buildTemplateSnapshot(opts: {
  templateId: string;
  templateName: string;
  industry?: string | null;
  description?: string | null;
  sections?: unknown;
  questions?: unknown;
  calculations?: unknown;
}): ComplianceTemplateSnapshot {
  return {
    templateId: opts.templateId,
    templateName: opts.templateName,
    industry: asIndustry(opts.industry),
    description: opts.description ?? null,
    sections: normalizeSections(opts.sections),
    questions: normalizeQuestions(opts.questions),
    calculations: normalizeCalculations(opts.calculations),
  };
}

export function buildAssessmentSnapshot(opts: {
  organisationName: string;
  title: string;
  reportingYear: number;
  status: "draft" | "final";
  template: ComplianceTemplateSnapshot;
  answers: unknown;
  calculationResults?: unknown;
  preparedBy?: { id: string; name: string } | null;
}): ComplianceAssessmentSnapshot {
  const answers = parseAnswers(opts.answers);
  const calcs =
    opts.calculationResults != null
      ? parseCalcResults(opts.calculationResults)
      : runCalculations(opts.template.calculations, answers);

  const sectionKeys = orderedSectionKeys(opts.template);

  return {
    organisationName: opts.organisationName,
    title: opts.title,
    reportingYear: opts.reportingYear,
    status: opts.status,
    industry: opts.template.industry,
    templateName: opts.template.templateName,
    publishedAt: new Date().toISOString(),
    sections: sectionKeys.map((sectionKey) => {
      const section = opts.template.sections.find((s) => s.sectionKey === sectionKey);
      return {
        sectionKey,
        title: section?.sectionTitle ?? sectionKey,
        questions: opts.template.questions
          .filter((q) => q.sectionKey === sectionKey)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((q) => ({
            questionId: q.questionId,
            label: q.label,
            prompt: q.prompt,
            answerType: q.answerType,
            value: answers[q.questionId]?.value ?? null,
            unit: q.unit ?? null,
            required: q.required,
          })),
        calculations: opts.template.calculations
          .filter((c) => (c.sectionKey ?? "derived") === sectionKey)
          .map((c) => {
            const r = calcs[c.calcId];
            return {
              calcId: c.calcId,
              label: c.label,
              value: r?.value ?? null,
              unit: r?.unit ?? c.unit ?? null,
              quality: r?.quality ?? "missing",
            };
          }),
      };
    }),
    disclaimer: COMPLIANCE_DISCLAIMER,
    preparedBy: opts.preparedBy ?? null,
  };
}

function orderedSectionKeys(template: ComplianceTemplateSnapshot): string[] {
  const fromSections = [...template.sections]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => s.sectionKey)
    .filter(Boolean);
  const extras = new Set<string>();
  for (const q of template.questions) extras.add(q.sectionKey);
  for (const c of template.calculations) {
    if (c.sectionKey) extras.add(c.sectionKey);
  }
  const keys = [...fromSections];
  for (const k of extras) {
    if (!keys.includes(k)) keys.push(k);
  }
  return keys.length > 0 ? keys : ["general"];
}

function asIndustry(value: unknown): ComplianceIndustry | null {
  const allowed: ComplianceIndustry[] = [
    "general",
    "oil_gas",
    "manufacturing",
    "finance",
    "retail",
  ];
  if (typeof value === "string" && allowed.includes(value as ComplianceIndustry)) {
    return value as ComplianceIndustry;
  }
  return null;
}

function normalizeSections(raw: unknown): ComplianceSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): ComplianceSection | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const sectionTitle = String(r.sectionTitle ?? "");
      const sectionKey = String(
        r.sectionKey ?? sectionTitle.toLowerCase().replace(/\s+/g, "_"),
      );
      if (!sectionTitle && !sectionKey) return null;
      const st = String(r.sectionType ?? "questions");
      const sectionType =
        st === "calculations" || st === "narrative" || st === "text" ? st : "questions";
      return {
        sectionTitle: sectionTitle || sectionKey,
        sectionKey,
        sectionType,
        order: typeof r.order === "number" ? r.order : null,
      };
    })
    .filter((x): x is ComplianceSection => x != null);
}

function normalizeQuestions(raw: unknown): ComplianceQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): ComplianceQuestion | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const questionId = String(r.questionId ?? "");
      if (!questionId) return null;
      const answerTypeRaw = String(r.answerType ?? "text");
      const answerType =
        answerTypeRaw === "number" ||
        answerTypeRaw === "boolean" ||
        answerTypeRaw === "select" ||
        answerTypeRaw === "calculated"
          ? answerTypeRaw
          : "text";
      let options: string[] | null = null;
      if (Array.isArray(r.options)) {
        options = r.options.filter((x): x is string => typeof x === "string");
      }
      return {
        questionId,
        sectionKey: String(r.sectionKey ?? "general"),
        label: String(r.label ?? questionId),
        prompt: String(r.prompt ?? ""),
        answerType,
        options,
        unit: typeof r.unit === "string" ? r.unit : null,
        required: Boolean(r.required),
        order: typeof r.order === "number" ? r.order : null,
      };
    })
    .filter((x): x is ComplianceQuestion => x != null);
}

function normalizeCalculations(raw: unknown): ComplianceCalculation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): ComplianceCalculation | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const calcId = String(r.calcId ?? "");
      if (!calcId) return null;
      const opRaw = String(r.op ?? "sum");
      const op =
        opRaw === "product" || opRaw === "ratio" || opRaw === "difference"
          ? opRaw
          : "sum";
      let inputs: string[] = [];
      if (Array.isArray(r.inputs)) {
        inputs = r.inputs.filter((x): x is string => typeof x === "string");
      }
      return {
        calcId,
        label: String(r.label ?? calcId),
        op,
        inputs,
        unit: typeof r.unit === "string" ? r.unit : null,
        sectionKey: typeof r.sectionKey === "string" ? r.sectionKey : null,
      };
    })
    .filter((x): x is ComplianceCalculation => x != null);
}

export function recomputeResults(
  template: ComplianceTemplateSnapshot,
  answers: ComplianceAnswersMap,
): ComplianceCalcResultsMap {
  return runCalculations(template.calculations, answers);
}
