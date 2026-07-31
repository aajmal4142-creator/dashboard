/**
 * Pure EU Green Taxonomy alignment calculation — zero I/O.
 *
 * Rules:
 * - Non-applicable objectives are EXCLUDED from overall %.
 * - Per-objective alignment = criteria met / total screening criteria × 100.
 * - DNSH tracked separately; fullyAligned requires 100% screening + 100% DNSH.
 * - Unanswered counts as not met / not compliant.
 */

import { findNaceCode, getEuAverageForNace } from "./naceCodes";
import { getObjectiveDef, TAXONOMY_OBJECTIVES } from "./objectives";
import type {
  DnshAnswer,
  ObjectiveAlignmentResult,
  ObjectiveAnswer,
  TaxonomyAlignmentReport,
  TaxonomyObjectiveId,
  YesNo,
} from "./types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function metMap(answers: Array<{ criteriaId: string; met?: YesNo }>): Map<string, YesNo> {
  const map = new Map<string, YesNo>();
  for (const row of answers) {
    if (row.met === "yes" || row.met === "no" || row.met === "unanswered") {
      map.set(row.criteriaId, row.met);
    }
  }
  return map;
}

function compliantMap(
  answers: Array<{ criteriaId: string; compliant?: YesNo }>,
): Map<string, YesNo> {
  const map = new Map<string, YesNo>();
  for (const row of answers) {
    if (
      row.compliant === "yes" ||
      row.compliant === "no" ||
      row.compliant === "unanswered"
    ) {
      map.set(row.criteriaId, row.compliant);
    }
  }
  return map;
}

export type AlignmentInput = {
  naceCode: string;
  objectives: ObjectiveAnswer[];
  dnshCompliance: DnshAnswer[];
};

/**
 * Calculate alignment for one assessment.
 * Non-applicable objectives never enter the overall percentage denominator.
 */
export function calculateTaxonomyAlignment(
  input: AlignmentInput,
): TaxonomyAlignmentReport {
  const nace = findNaceCode(input.naceCode);
  const objById = new Map(input.objectives.map((o) => [o.objective, o]));
  const dnshByObjective = new Map<TaxonomyObjectiveId, DnshAnswer[]>();
  for (const row of input.dnshCompliance) {
    const list = dnshByObjective.get(row.objective) ?? [];
    list.push(row);
    dnshByObjective.set(row.objective, list);
  }

  const objectives: ObjectiveAlignmentResult[] = [];

  for (const def of TAXONOMY_OBJECTIVES) {
    const answered = objById.get(def.id);
    const applicable = answered?.applicable === "yes";

    const criteriaAnswers = metMap(answered?.answers ?? []);
    let criteriaMet = 0;
    let criteriaUnanswered = 0;
    const gaps: string[] = [];

    for (const crit of def.criteria) {
      const v = criteriaAnswers.get(crit.id) ?? "unanswered";
      if (v === "yes") criteriaMet += 1;
      else {
        if (v === "unanswered") criteriaUnanswered += 1;
        gaps.push(crit.label);
      }
    }

    const dnshRows = dnshByObjective.get(def.id) ?? [];
    const dnshAnswers = compliantMap(dnshRows);
    let dnshCompliant = 0;
    let dnshUnanswered = 0;
    const dnshGaps: string[] = [];

    for (const d of def.dnsh) {
      const v = dnshAnswers.get(d.id) ?? "unanswered";
      if (v === "yes") dnshCompliant += 1;
      else {
        if (v === "unanswered") dnshUnanswered += 1;
        dnshGaps.push(d.label);
      }
    }

    const criteriaTotal = def.criteria.length;
    const dnshTotal = def.dnsh.length;

    if (!applicable) {
      objectives.push({
        objective: def.id,
        label: def.label,
        applicable: false,
        criteriaTotal,
        criteriaMet: 0,
        criteriaUnanswered,
        alignmentPercent: null,
        gaps: [],
        dnshTotal,
        dnshCompliant: 0,
        dnshUnanswered,
        dnshPercent: null,
        dnshGaps: [],
        fullyAligned: false,
      });
      continue;
    }

    const alignmentPercent =
      criteriaTotal > 0 ? round1((criteriaMet / criteriaTotal) * 100) : 0;
    const dnshPercent = dnshTotal > 0 ? round1((dnshCompliant / dnshTotal) * 100) : 0;
    const fullyAligned =
      criteriaMet === criteriaTotal &&
      dnshCompliant === dnshTotal &&
      criteriaTotal > 0 &&
      dnshTotal > 0;

    objectives.push({
      objective: def.id,
      label: def.label,
      applicable: true,
      criteriaTotal,
      criteriaMet,
      criteriaUnanswered,
      alignmentPercent,
      gaps,
      dnshTotal,
      dnshCompliant,
      dnshUnanswered,
      dnshPercent,
      dnshGaps,
      fullyAligned,
    });
  }

  const applicableRows = objectives.filter((o) => o.applicable);
  const applicableCount = applicableRows.length;
  const nonApplicableCount = objectives.length - applicableCount;
  const applicableSum = applicableRows.reduce(
    (sum, o) => sum + (o.alignmentPercent ?? 0),
    0,
  );
  const fullyAlignedCount = objectives.filter((o) => o.fullyAligned).length;

  const overallAlignmentPercent =
    applicableCount > 0 ? round1(applicableSum / applicableCount) : null;

  const gaps = objectives
    .filter((o) => o.applicable && (o.gaps.length > 0 || o.dnshGaps.length > 0))
    .map((o) => ({
      objective: o.objective,
      label: o.label,
      missingCriteria: o.gaps,
      missingDnsh: o.dnshGaps,
    }));

  const eu = getEuAverageForNace(input.naceCode);

  return {
    naceCode: input.naceCode,
    naceName: nace?.name ?? null,
    applicableCount,
    nonApplicableCount,
    overallAlignmentPercent,
    fullyAlignedCount,
    objectives,
    gaps,
    euAveragePercent: eu.percent,
    euAverageNote: eu.note,
  };
}

/**
 * Suggest default applicability from NACE eligibility hints.
 * Returns "yes" for eligible, "no" for non-eligible — user can override.
 */
export function suggestApplicabilityFromNace(
  naceCode: string,
): Record<TaxonomyObjectiveId, "yes" | "no"> {
  const nace = findNaceCode(naceCode);
  const eligible = new Set(nace?.eligibleObjectives ?? []);
  if (nace && eligible.size === 0 && nace.level !== "section") {
    const section = findNaceCode(nace.section);
    for (const id of section?.eligibleObjectives ?? []) eligible.add(id);
  }

  const out = {} as Record<TaxonomyObjectiveId, "yes" | "no">;
  for (const def of TAXONOMY_OBJECTIVES) {
    out[def.id] = eligible.has(def.id) ? "yes" : "no";
  }
  return out;
}

export function countMissingCriteria(report: TaxonomyAlignmentReport): number {
  return report.gaps.reduce(
    (n, g) => n + g.missingCriteria.length + g.missingDnsh.length,
    0,
  );
}

export function gapSummaryLine(report: TaxonomyAlignmentReport): string {
  const parts: string[] = [];
  for (const g of report.gaps) {
    const n = g.missingCriteria.length;
    if (n > 0) {
      parts.push(`You're missing ${n} criteria for ${g.label} alignment`);
    }
  }
  if (parts.length === 0) {
    if (report.applicableCount === 0) {
      return "No applicable objectives selected — overall alignment is not calculated.";
    }
    return "No screening criteria gaps on applicable objectives.";
  }
  return parts.join(". ") + ".";
}

export function isValidObjectiveId(value: string): value is TaxonomyObjectiveId {
  return getObjectiveDef(value as TaxonomyObjectiveId) !== undefined;
}
