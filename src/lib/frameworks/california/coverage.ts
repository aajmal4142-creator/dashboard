/**
 * California SB 253 / SB 261 coverage — pure, zero I/O.
 */

import { METRICS_HREF } from "@/lib/metrics";
import { DERIVED_RAW_INPUTS } from "@/lib/frameworks/mappings";
import { resolveMetricGrade } from "@/lib/frameworks/coverage";
import type { DatapointGradeInput } from "@/lib/frameworks/types";

import {
  californiaDisclosuresForLaw,
  californiaSectionsForLaw,
  defaultScope3Required,
} from "./catalog";
import type {
  CaliforniaCoverageResult,
  CaliforniaDatapointInput,
  CaliforniaDisclosureDef,
  CaliforniaDisclosureState,
  CaliforniaDisclosureStatus,
  CaliforniaGapKind,
  CaliforniaLaw,
  CaliforniaLawSummary,
  CaliforniaOrgField,
  CaliforniaOrgProfileInput,
  CaliforniaSectionSummary,
  CaliforniaTcfdAnswerInput,
} from "./types";

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * n) / total);
}

function toGradeMap(
  datapoints: CaliforniaDatapointInput[],
): Map<string, DatapointGradeInput> {
  const map = new Map<string, DatapointGradeInput>();
  for (const dp of datapoints) {
    map.set(dp.metricKey, {
      metricKey: dp.metricKey,
      quality: dp.quality,
      provenance: dp.provenance ?? null,
    });
  }
  return map;
}

function evidenceForKeys(
  keys: string[],
  byKey: Map<string, CaliforniaDatapointInput>,
): string[] {
  const ids = new Set<string>();
  for (const key of keys) {
    const direct = byKey.get(key);
    if (direct) {
      for (const id of direct.evidenceIds) ids.add(id);
    }
    const raw = DERIVED_RAW_INPUTS[key];
    if (raw) {
      for (const rk of raw) {
        const row = byKey.get(rk);
        if (row) {
          for (const id of row.evidenceIds) ids.add(id);
        }
      }
    }
  }
  return [...ids];
}

function orgFieldPresent(
  field: CaliforniaOrgField,
  org: CaliforniaOrgProfileInput | null | undefined,
): boolean {
  if (!org) return false;
  const value = org[field];
  return typeof value === "string" && value.trim().length > 0;
}

function scoreMetricDisclosure(
  def: CaliforniaDisclosureDef,
  gradeByKey: Map<string, DatapointGradeInput>,
  dpByKey: Map<string, CaliforniaDatapointInput>,
): CaliforniaDisclosureStatus {
  const base = {
    code: def.code,
    law: def.law,
    sectionId: def.sectionId,
    label: def.label,
    note: def.note,
    missingOrgFields: [] as CaliforniaOrgField[],
    missingTcfdIds: [] as string[],
  };

  const keys = def.metricKeys ?? [];
  if (keys.length === 0) {
    return {
      ...base,
      state: "gap",
      gapKind: "unmapped",
      missingMetricKeys: [],
      presentMetricKeys: [],
      evidenceIds: [],
      actionHref: def.href ?? METRICS_HREF,
    };
  }

  const match = def.metricMatch ?? "all";
  const grades = keys.map((k) => ({
    key: k,
    grade: resolveMetricGrade(k, gradeByKey),
  }));

  const present = grades.filter((g) => g.grade !== "missing");
  const missing = grades.filter((g) => g.grade === "missing").map((g) => g.key);
  const presentKeys = present.map((g) => g.key);
  const dataSatisfied = match === "any" ? present.length > 0 : missing.length === 0;

  if (!dataSatisfied) {
    const primaryMissing = missing[0] ?? keys[0];
    return {
      ...base,
      state: "gap",
      gapKind: "missing_data",
      missingMetricKeys: missing,
      presentMetricKeys: presentKeys,
      evidenceIds: [],
      actionHref: `${METRICS_HREF}?metric=${encodeURIComponent(primaryMissing)}`,
    };
  }

  const relevantKeys = match === "any" ? presentKeys : keys;
  const evidenceIds = evidenceForKeys(relevantKeys, dpByKey);
  const hasWeak = present.some((g) => g.grade === "weak");

  let state: CaliforniaDisclosureState = "covered";
  let gapKind: CaliforniaGapKind | null = null;

  if (hasWeak) {
    state = "partial";
    gapKind = "weak_quality";
  }

  if (def.requiresEvidence && evidenceIds.length === 0) {
    state = state === "covered" ? "partial" : state;
    gapKind = gapKind ?? "missing_evidence";
  }

  const hrefKey = missing[0] ?? presentKeys[0] ?? keys[0] ?? "";

  return {
    ...base,
    state,
    gapKind,
    missingMetricKeys: missing,
    presentMetricKeys: presentKeys,
    evidenceIds,
    actionHref: def.href
      ? def.href
      : hrefKey
        ? `${METRICS_HREF}?metric=${encodeURIComponent(hrefKey)}`
        : METRICS_HREF,
  };
}

function scoreOrgDisclosure(
  def: CaliforniaDisclosureDef,
  org: CaliforniaOrgProfileInput | null | undefined,
): CaliforniaDisclosureStatus {
  const fields = def.orgFields ?? [];
  const missing = fields.filter((f) => !orgFieldPresent(f, org));

  if (fields.length === 0) {
    return {
      code: def.code,
      law: def.law,
      sectionId: def.sectionId,
      label: def.label,
      note: def.note,
      state: "gap",
      gapKind: "unmapped",
      missingMetricKeys: [],
      presentMetricKeys: [],
      missingOrgFields: [],
      missingTcfdIds: [],
      evidenceIds: [],
      actionHref: def.href ?? "/settings",
    };
  }

  if (missing.length > 0) {
    return {
      code: def.code,
      law: def.law,
      sectionId: def.sectionId,
      label: def.label,
      note: def.note,
      state: "gap",
      gapKind: "missing_org_field",
      missingMetricKeys: [],
      presentMetricKeys: [],
      missingOrgFields: missing,
      missingTcfdIds: [],
      evidenceIds: [],
      actionHref: def.href ?? "/settings",
    };
  }

  return {
    code: def.code,
    law: def.law,
    sectionId: def.sectionId,
    label: def.label,
    note: def.note,
    state: "covered",
    gapKind: null,
    missingMetricKeys: [],
    presentMetricKeys: [],
    missingOrgFields: [],
    missingTcfdIds: [],
    evidenceIds: [],
    actionHref: def.href ?? "/settings",
  };
}

function scoreTcfdDisclosure(
  def: CaliforniaDisclosureDef,
  tcfdById: Map<string, CaliforniaTcfdAnswerInput>,
): CaliforniaDisclosureStatus {
  const ids = def.tcfdQuestionIds ?? [];
  const missing = ids.filter((id) => {
    const row = tcfdById.get(id);
    return !row || !row.hasText;
  });
  const present = ids.filter((id) => {
    const row = tcfdById.get(id);
    return Boolean(row?.hasText);
  });

  if (ids.length === 0) {
    return {
      code: def.code,
      law: def.law,
      sectionId: def.sectionId,
      label: def.label,
      note: def.note,
      state: "gap",
      gapKind: "unmapped",
      missingMetricKeys: [],
      presentMetricKeys: [],
      missingOrgFields: [],
      missingTcfdIds: [],
      evidenceIds: [],
      actionHref: def.href ?? "/tcfd",
    };
  }

  if (missing.length > 0) {
    return {
      code: def.code,
      law: def.law,
      sectionId: def.sectionId,
      label: def.label,
      note: def.note,
      state: "gap",
      gapKind: "missing_tcfd",
      missingMetricKeys: [],
      presentMetricKeys: [],
      missingOrgFields: [],
      missingTcfdIds: missing,
      evidenceIds: [],
      actionHref: def.href ?? "/tcfd",
    };
  }

  return {
    code: def.code,
    law: def.law,
    sectionId: def.sectionId,
    label: def.label,
    note: def.note,
    state: "covered",
    gapKind: null,
    missingMetricKeys: [],
    presentMetricKeys: present,
    missingOrgFields: [],
    missingTcfdIds: [],
    evidenceIds: [],
    actionHref: def.href ?? "/tcfd",
  };
}

function scoreUnmapped(def: CaliforniaDisclosureDef): CaliforniaDisclosureStatus {
  return {
    code: def.code,
    law: def.law,
    sectionId: def.sectionId,
    label: def.label,
    note: def.note,
    state: "gap",
    gapKind: "unmapped",
    missingMetricKeys: [],
    presentMetricKeys: [],
    missingOrgFields: [],
    missingTcfdIds: [],
    evidenceIds: [],
    actionHref: def.href ?? METRICS_HREF,
  };
}

function scoreDisclosure(
  def: CaliforniaDisclosureDef,
  gradeByKey: Map<string, DatapointGradeInput>,
  dpByKey: Map<string, CaliforniaDatapointInput>,
  org: CaliforniaOrgProfileInput | null | undefined,
  tcfdById: Map<string, CaliforniaTcfdAnswerInput>,
  scope3Required: boolean,
): CaliforniaDisclosureStatus {
  if (def.phaseScope3 && !scope3Required) {
    return {
      code: def.code,
      law: def.law,
      sectionId: def.sectionId,
      label: def.label,
      note: def.note
        ? `${def.note} Deferred until Scope 3 phase.`
        : "Deferred until Scope 3 phase is required for the reporting year.",
      state: "deferred",
      gapKind: "phase_pending",
      missingMetricKeys: [],
      presentMetricKeys: [],
      missingOrgFields: [],
      missingTcfdIds: [],
      evidenceIds: [],
      actionHref: def.href ?? METRICS_HREF,
    };
  }

  switch (def.sourceKind) {
    case "metric":
      return scoreMetricDisclosure(def, gradeByKey, dpByKey);
    case "org_field":
      return scoreOrgDisclosure(def, org);
    case "tcfd":
      return scoreTcfdDisclosure(def, tcfdById);
    case "unmapped":
      return scoreUnmapped(def);
  }
}

function summariseLaw(
  law: CaliforniaLaw,
  statuses: CaliforniaDisclosureStatus[],
): CaliforniaLawSummary {
  const active = statuses.filter((s) => s.state !== "deferred");
  const covered = active.filter((s) => s.state === "covered").length;
  const partial = active.filter((s) => s.state === "partial").length;
  const gap = active.filter((s) => s.state === "gap").length;
  const deferred = statuses.filter((s) => s.state === "deferred").length;
  const total = statuses.length;
  return {
    law,
    total,
    covered,
    partial,
    gap,
    deferred,
    pctCovered: pct(covered, active.length),
  };
}

/**
 * Compute SB 253 or SB 261 coverage for a period.
 */
export function computeCaliforniaCoverage(input: {
  law: CaliforniaLaw;
  periodId: string;
  datapoints: CaliforniaDatapointInput[];
  orgProfile?: CaliforniaOrgProfileInput | null;
  tcfdAnswers?: CaliforniaTcfdAnswerInput[];
  /** Override Scope 3 phase. Defaults from reportingYear heuristic. */
  scope3Required?: boolean;
  reportingYear?: number | null;
  /** Override catalog in tests. */
  disclosures?: CaliforniaDisclosureDef[];
}): CaliforniaCoverageResult {
  const scope3Required =
    typeof input.scope3Required === "boolean"
      ? input.scope3Required
      : defaultScope3Required(input.reportingYear);

  const disclosures = input.disclosures ?? californiaDisclosuresForLaw(input.law);
  const gradeByKey = toGradeMap(input.datapoints);
  const dpByKey = new Map(input.datapoints.map((d) => [d.metricKey, d]));
  const tcfdById = new Map((input.tcfdAnswers ?? []).map((a) => [a.questionId, a]));

  const statuses = disclosures.map((def) =>
    scoreDisclosure(def, gradeByKey, dpByKey, input.orgProfile, tcfdById, scope3Required),
  );

  const sectionDefs = californiaSectionsForLaw(input.law);
  const sections: CaliforniaSectionSummary[] = sectionDefs
    .map((section) => {
      const rows = statuses.filter((s) => s.sectionId === section.id);
      if (rows.length === 0) return null;
      const active = rows.filter((s) => s.state !== "deferred");
      const covered = active.filter((s) => s.state === "covered").length;
      const partial = active.filter((s) => s.state === "partial").length;
      const gap = active.filter((s) => s.state === "gap").length;
      const deferred = rows.filter((s) => s.state === "deferred").length;
      return {
        sectionId: section.id,
        title: section.title,
        shortTitle: section.shortTitle,
        total: rows.length,
        covered,
        partial,
        gap,
        deferred,
        pctCovered: pct(covered, active.length),
        disclosures: rows,
      };
    })
    .filter((s): s is CaliforniaSectionSummary => s !== null);

  const gaps = statuses.filter((s) => s.state === "gap" || s.state === "partial");

  return {
    law: input.law,
    periodId: input.periodId,
    scope3Required,
    summary: summariseLaw(input.law, statuses),
    sections,
    gaps,
  };
}
