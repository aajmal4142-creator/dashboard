/**
 * Green Taxonomy assessment service — Payload I/O + DTO mapping.
 */

import type { Payload } from "payload";

import { GREEN_TAXONOMY_ASSESSMENTS_SLUG } from "@/collections/GreenTaxonomyAssessments";

import { calculateTaxonomyAlignment, suggestApplicabilityFromNace } from "./alignment";
import { findNaceCode } from "./naceCodes";
import {
  buildEmptyDnshAnswers,
  buildEmptyObjectiveAnswers,
  TAXONOMY_OBJECTIVES,
} from "./objectives";
import type {
  AssessmentStatus,
  DnshAnswer,
  ObjectiveAnswer,
  TaxonomyAlignmentReport,
  TaxonomyObjectiveId,
  YesNo,
} from "./types";

export type GreenTaxonomyAssessmentDto = {
  id: string;
  organisationId: string;
  periodId: string | null;
  status: AssessmentStatus;
  naceCode: string;
  naceName: string | null;
  objectives: ObjectiveAnswer[];
  dnshCompliance: DnshAnswer[];
  overallAlignmentPercent: number | null;
  wizardStep: number;
  completedAt: string | null;
  notes: string | null;
  report: TaxonomyAlignmentReport;
  updatedAt: string;
  createdAt: string;
};

function relationId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  ) {
    return (value as { id: string }).id;
  }
  return null;
}

function asYesNo(value: unknown): YesNo {
  if (value === "yes" || value === "no" || value === "unanswered") return value;
  return "unanswered";
}

function asStatus(value: unknown): AssessmentStatus {
  if (value === "draft" || value === "completed" || value === "verified") {
    return value;
  }
  return "draft";
}

function asObjectiveId(value: unknown): TaxonomyObjectiveId | null {
  if (
    value === "climate_mitigation" ||
    value === "climate_adaptation" ||
    value === "water" ||
    value === "circular_economy" ||
    value === "pollution" ||
    value === "biodiversity"
  ) {
    return value;
  }
  return null;
}

function parseObjectives(raw: unknown): ObjectiveAnswer[] {
  if (!Array.isArray(raw)) return buildEmptyObjectiveAnswers();
  const byId = new Map<TaxonomyObjectiveId, ObjectiveAnswer>();

  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const objective = asObjectiveId(r.objective);
    if (!objective) continue;
    const answersRaw = Array.isArray(r.answers) ? r.answers : [];
    const answers = answersRaw
      .map((a) => {
        if (!a || typeof a !== "object") return null;
        const ar = a as Record<string, unknown>;
        if (typeof ar.criteriaId !== "string") return null;
        return {
          criteriaId: ar.criteriaId,
          met: asYesNo(ar.met),
          evidenceId: relationId(ar.evidence),
          notes: typeof ar.notes === "string" ? ar.notes : null,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    byId.set(objective, {
      objective,
      applicable: asYesNo(r.applicable),
      answers,
    });
  }

  // Ensure all six objectives present with full criteria scaffolding
  return TAXONOMY_OBJECTIVES.map((def) => {
    const existing = byId.get(def.id);
    if (!existing) {
      return {
        objective: def.id,
        applicable: "unanswered" as const,
        answers: def.criteria.map((c) => ({
          criteriaId: c.id,
          met: "unanswered" as const,
        })),
      };
    }
    const answerById = new Map(existing.answers.map((a) => [a.criteriaId, a]));
    return {
      objective: def.id,
      applicable: existing.applicable,
      answers: def.criteria.map((c) => {
        const a = answerById.get(c.id);
        return {
          criteriaId: c.id,
          met: a?.met ?? ("unanswered" as const),
          evidenceId: a?.evidenceId ?? null,
          notes: a?.notes ?? null,
        };
      }),
    };
  });
}

function parseDnsh(raw: unknown): DnshAnswer[] {
  if (!Array.isArray(raw)) return buildEmptyDnshAnswers();
  const byKey = new Map<string, DnshAnswer>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const objective = asObjectiveId(r.objective);
    if (!objective || typeof r.criteriaId !== "string") continue;
    byKey.set(`${objective}:${r.criteriaId}`, {
      objective,
      criteriaId: r.criteriaId,
      compliant: asYesNo(r.compliant),
      notes: typeof r.notes === "string" ? r.notes : null,
    });
  }
  return TAXONOMY_OBJECTIVES.flatMap((def) =>
    def.dnsh.map((d) => {
      const existing = byKey.get(`${def.id}:${d.id}`);
      return (
        existing ?? {
          objective: def.id,
          criteriaId: d.id,
          compliant: "unanswered" as const,
        }
      );
    }),
  );
}

function toStoredObjectives(
  objectives: ObjectiveAnswer[],
  report: TaxonomyAlignmentReport,
) {
  const alignById = new Map(
    report.objectives.map((o) => [o.objective, o.alignmentPercent]),
  );
  return objectives.map((o) => ({
    objective: o.objective,
    applicable: o.applicable,
    criteriasMet: alignById.get(o.objective) ?? undefined,
    evidence: o.answers
      .map((a) => a.evidenceId)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
    answers: o.answers.map((a) => ({
      criteriaId: a.criteriaId,
      met: a.met,
      evidence: a.evidenceId ?? undefined,
      notes: a.notes ?? undefined,
    })),
  }));
}

function toStoredDnsh(dnsh: DnshAnswer[]) {
  return dnsh.map((d) => ({
    objective: d.objective,
    criteriaId: d.criteriaId,
    compliant: d.compliant,
    notes: d.notes ?? undefined,
  }));
}

export function docToAssessment(
  doc: Record<string, unknown>,
): GreenTaxonomyAssessmentDto {
  const objectives = parseObjectives(doc.objectives);
  const dnshCompliance = parseDnsh(doc.dnshCompliance);
  const naceCode = typeof doc.naceCode === "string" ? doc.naceCode : "";
  const report = calculateTaxonomyAlignment({
    naceCode,
    objectives,
    dnshCompliance,
  });

  return {
    id: String(doc.id),
    organisationId: relationId(doc.organisation) ?? "",
    periodId: relationId(doc.period),
    status: asStatus(doc.status),
    naceCode,
    naceName:
      typeof doc.naceName === "string"
        ? doc.naceName
        : (findNaceCode(naceCode)?.name ?? null),
    objectives,
    dnshCompliance,
    overallAlignmentPercent:
      typeof doc.overallAlignmentPercent === "number"
        ? doc.overallAlignmentPercent
        : report.overallAlignmentPercent,
    wizardStep:
      typeof doc.wizardStep === "number" && doc.wizardStep >= 1 && doc.wizardStep <= 7
        ? doc.wizardStep
        : 1,
    completedAt: typeof doc.completedAt === "string" ? doc.completedAt : null,
    notes: typeof doc.notes === "string" ? doc.notes : null,
    report,
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : "",
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : "",
  };
}

export async function listOrgAssessments(
  payload: Payload,
  organisationId: string,
): Promise<GreenTaxonomyAssessmentDto[]> {
  const result = await payload.find({
    collection: GREEN_TAXONOMY_ASSESSMENTS_SLUG,
    where: { organisation: { equals: organisationId } },
    sort: "-updatedAt",
    limit: 50,
    depth: 0,
    overrideAccess: true,
  });
  return result.docs.map((doc) =>
    docToAssessment(doc as unknown as Record<string, unknown>),
  );
}

export async function getOrgAssessmentById(
  payload: Payload,
  organisationId: string,
  id: string,
): Promise<GreenTaxonomyAssessmentDto | null> {
  let doc;
  try {
    doc = await payload.findByID({
      collection: GREEN_TAXONOMY_ASSESSMENTS_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return null;
  }
  if (relationId(doc.organisation) !== organisationId) return null;
  return docToAssessment(doc as unknown as Record<string, unknown>);
}

export async function createAssessment(
  payload: Payload,
  args: {
    organisationId: string;
    naceCode: string;
    periodId?: string | null;
    applyNaceSuggestions?: boolean;
  },
): Promise<GreenTaxonomyAssessmentDto> {
  const nace = findNaceCode(args.naceCode);
  if (!nace) {
    throw new Error(
      `Unknown NACE code "${args.naceCode}". Select a code from the official NACE Rev. 2 catalog.`,
    );
  }

  let objectives: ObjectiveAnswer[] = buildEmptyObjectiveAnswers();
  if (args.applyNaceSuggestions !== false) {
    const suggestions = suggestApplicabilityFromNace(args.naceCode);
    objectives = objectives.map((o) => ({
      ...o,
      applicable: suggestions[o.objective],
    }));
  }

  const dnshCompliance = buildEmptyDnshAnswers();
  const report = calculateTaxonomyAlignment({
    naceCode: args.naceCode,
    objectives,
    dnshCompliance,
  });

  const created = await payload.create({
    collection: GREEN_TAXONOMY_ASSESSMENTS_SLUG,
    data: {
      organisation: args.organisationId,
      period: args.periodId ?? undefined,
      status: "draft",
      naceCode: nace.code,
      naceName: nace.name,
      objectives: toStoredObjectives(objectives, report),
      dnshCompliance: toStoredDnsh(dnshCompliance),
      overallAlignmentPercent: report.overallAlignmentPercent ?? undefined,
      wizardStep: 2,
    },
    overrideAccess: true,
  });

  return docToAssessment(created as unknown as Record<string, unknown>);
}

export type AnswersPatch = {
  naceCode?: string;
  periodId?: string | null;
  wizardStep?: number;
  status?: AssessmentStatus;
  notes?: string | null;
  objectives?: Array<{
    objective: TaxonomyObjectiveId;
    applicable?: YesNo;
    answers?: Array<{
      criteriaId: string;
      met?: YesNo;
      evidenceId?: string | null;
      notes?: string | null;
    }>;
  }>;
  dnshCompliance?: Array<{
    objective: TaxonomyObjectiveId;
    criteriaId: string;
    compliant?: YesNo;
    notes?: string | null;
  }>;
};

export async function saveAssessmentAnswers(
  payload: Payload,
  organisationId: string,
  id: string,
  patch: AnswersPatch,
): Promise<GreenTaxonomyAssessmentDto> {
  const existing = await getOrgAssessmentById(payload, organisationId, id);
  if (!existing) {
    throw new Error("Assessment not found");
  }
  if (existing.status === "verified") {
    throw new Error("Verified assessments cannot be edited");
  }

  let naceCode = existing.naceCode;
  let naceName = existing.naceName;
  if (typeof patch.naceCode === "string" && patch.naceCode.trim()) {
    const nace = findNaceCode(patch.naceCode);
    if (!nace) {
      throw new Error(
        `Unknown NACE code "${patch.naceCode}". Select a code from the official NACE Rev. 2 catalog.`,
      );
    }
    naceCode = nace.code;
    naceName = nace.name;
  }

  const objectives = existing.objectives.map((o) => ({ ...o, answers: [...o.answers] }));
  const objIndex = new Map(objectives.map((o, i) => [o.objective, i]));

  if (patch.objectives) {
    for (const row of patch.objectives) {
      const idx = objIndex.get(row.objective);
      if (idx === undefined) continue;
      const current = objectives[idx]!;
      if (row.applicable) current.applicable = row.applicable;
      if (row.answers) {
        const byCrit = new Map(current.answers.map((a, i) => [a.criteriaId, i]));
        for (const a of row.answers) {
          const ai = byCrit.get(a.criteriaId);
          if (ai === undefined) continue;
          const target = current.answers[ai]!;
          if (a.met) target.met = a.met;
          if (a.evidenceId !== undefined) target.evidenceId = a.evidenceId;
          if (a.notes !== undefined) target.notes = a.notes;
        }
      }
    }
  }

  const dnshCompliance = [...existing.dnshCompliance];
  const dnshIndex = new Map(
    dnshCompliance.map((d, i) => [`${d.objective}:${d.criteriaId}`, i]),
  );
  if (patch.dnshCompliance) {
    for (const row of patch.dnshCompliance) {
      const key = `${row.objective}:${row.criteriaId}`;
      const idx = dnshIndex.get(key);
      if (idx === undefined) continue;
      const target = dnshCompliance[idx]!;
      if (row.compliant) target.compliant = row.compliant;
      if (row.notes !== undefined) target.notes = row.notes;
    }
  }

  const report = calculateTaxonomyAlignment({
    naceCode,
    objectives,
    dnshCompliance,
  });

  let status: AssessmentStatus = existing.status;
  if (
    patch.status === "draft" ||
    patch.status === "completed" ||
    patch.status === "verified"
  ) {
    status = patch.status;
  }

  const wizardStep =
    typeof patch.wizardStep === "number" && patch.wizardStep >= 1 && patch.wizardStep <= 7
      ? patch.wizardStep
      : existing.wizardStep;

  const completedAt =
    status === "completed" || status === "verified"
      ? (existing.completedAt ?? new Date().toISOString())
      : existing.completedAt;

  const updated = await payload.update({
    collection: GREEN_TAXONOMY_ASSESSMENTS_SLUG,
    id,
    data: {
      naceCode,
      naceName: naceName ?? undefined,
      period:
        patch.periodId === null
          ? null
          : patch.periodId !== undefined
            ? patch.periodId
            : undefined,
      status,
      objectives: toStoredObjectives(objectives, report),
      dnshCompliance: toStoredDnsh(dnshCompliance),
      overallAlignmentPercent: report.overallAlignmentPercent ?? undefined,
      wizardStep,
      completedAt: completedAt ?? undefined,
      notes:
        patch.notes === null
          ? null
          : typeof patch.notes === "string"
            ? patch.notes
            : undefined,
    },
    overrideAccess: true,
  });

  return docToAssessment(updated as unknown as Record<string, unknown>);
}

export function buildReportPayload(assessment: GreenTaxonomyAssessmentDto) {
  return {
    assessmentId: assessment.id,
    status: assessment.status,
    naceCode: assessment.naceCode,
    naceName: assessment.naceName,
    periodId: assessment.periodId,
    overallAlignmentPercent: assessment.report.overallAlignmentPercent,
    applicableCount: assessment.report.applicableCount,
    nonApplicableCount: assessment.report.nonApplicableCount,
    fullyAlignedCount: assessment.report.fullyAlignedCount,
    objectives: assessment.report.objectives.map((o) => ({
      objective: o.objective,
      label: o.label,
      applicable: o.applicable,
      alignmentPercent: o.alignmentPercent,
      criteriaMet: o.criteriaMet,
      criteriaTotal: o.criteriaTotal,
      dnshCompliant: o.dnshCompliant,
      dnshTotal: o.dnshTotal,
      dnshPercent: o.dnshPercent,
      fullyAligned: o.fullyAligned,
      gaps: o.gaps,
      dnshGaps: o.dnshGaps,
    })),
    gaps: assessment.report.gaps,
    euAveragePercent: assessment.report.euAveragePercent,
    euAverageNote: assessment.report.euAverageNote,
    completedAt: assessment.completedAt,
    updatedAt: assessment.updatedAt,
  };
}
