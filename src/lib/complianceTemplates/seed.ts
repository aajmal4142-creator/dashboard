import type { Payload } from "payload";

import { REPORT_TEMPLATES_SLUG } from "@/collections/ReportTemplates";

import { INDUSTRY_STARTERS } from "./starters";
import { buildTemplateSnapshot } from "./snapshot";

/**
 * Ensure the four industry starter compliance templates exist as public system templates.
 * Idempotent — skips when templateName already present.
 */
export async function ensureIndustryStarters(payload: Payload): Promise<{
  created: string[];
  existing: string[];
}> {
  const created: string[] = [];
  const existing: string[] = [];

  for (const starter of INDUSTRY_STARTERS) {
    const found = await payload.find({
      collection: REPORT_TEMPLATES_SLUG,
      where: { templateName: { equals: starter.templateName } },
      limit: 1,
      overrideAccess: true,
    });

    if (found.docs[0]) {
      existing.push(starter.templateName);
      continue;
    }

    await payload.create({
      collection: REPORT_TEMPLATES_SLUG,
      data: {
        organisation: null,
        templateName: starter.templateName,
        description: starter.description,
        purpose: "compliance",
        industry: starter.industry,
        framework: starter.framework,
        type: "pdf",
        isPublic: true,
        version: 1,
        sections: starter.sections.map((s) => ({
          sectionTitle: s.sectionTitle,
          sectionKey: s.sectionKey,
          sectionType: s.sectionType,
          order: s.order ?? undefined,
        })),
        questions: starter.questions.map((q) => ({
          questionId: q.questionId,
          sectionKey: q.sectionKey,
          label: q.label,
          prompt: q.prompt,
          answerType: q.answerType,
          options: q.options ?? undefined,
          unit: q.unit ?? undefined,
          required: q.required,
          order: q.order ?? undefined,
        })),
        calculations: starter.calculations.map((c) => ({
          calcId: c.calcId,
          label: c.label,
          op: c.op,
          inputs: c.inputs,
          unit: c.unit ?? undefined,
          sectionKey: c.sectionKey ?? undefined,
        })),
      },
      overrideAccess: true,
    });
    created.push(starter.templateName);
  }

  return { created, existing };
}

export function templateDocToSnapshot(doc: {
  id: string;
  templateName: string;
  industry?: string | null;
  description?: string | null;
  sections?: unknown;
  questions?: unknown;
  calculations?: unknown;
}) {
  return buildTemplateSnapshot({
    templateId: String(doc.id),
    templateName: doc.templateName,
    industry: doc.industry,
    description: doc.description,
    sections: doc.sections,
    questions: doc.questions,
    calculations: doc.calculations,
  });
}
