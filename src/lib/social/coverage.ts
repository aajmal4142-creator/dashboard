/**
 * Social / workforce coverage — pure, zero I/O.
 * Does not import Next/Payload. Does not touch lib/calc/emissions.
 */

import { METRICS_HREF } from "@/lib/metrics";
import { DERIVED_RAW_INPUTS } from "@/lib/frameworks/mappings";
import { resolveMetricGrade } from "@/lib/frameworks/coverage";
import type { DatapointGradeInput } from "@/lib/frameworks/types";

import { SOCIAL_INDICATORS, SOCIAL_SECTIONS } from "./catalog";
import type {
  SocialCoverageResult,
  SocialDatapointInput,
  SocialDisclosureState,
  SocialGapKind,
  SocialIndicatorDef,
  SocialIndicatorStatus,
  SocialSectionSummary,
  SocialSummary,
} from "./types";

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * n) / total);
}

function toGradeMap(
  datapoints: SocialDatapointInput[],
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
  byKey: Map<string, SocialDatapointInput>,
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

function scoreMetricIndicator(
  def: SocialIndicatorDef,
  gradeByKey: Map<string, DatapointGradeInput>,
  dpByKey: Map<string, SocialDatapointInput>,
): SocialIndicatorStatus {
  const base = {
    code: def.code,
    sectionId: def.sectionId,
    label: def.label,
    note: def.note,
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
      actionHref: def.href
        ? def.href
        : `${METRICS_HREF}?metric=${encodeURIComponent(primaryMissing)}`,
    };
  }

  const relevantKeys = match === "any" ? presentKeys : keys;
  const evidenceIds = evidenceForKeys(relevantKeys, dpByKey);
  const hasWeak = present.some((g) => g.grade === "weak");

  let state: SocialDisclosureState = "covered";
  let gapKind: SocialGapKind | null = null;

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

function scoreUnmapped(def: SocialIndicatorDef): SocialIndicatorStatus {
  return {
    code: def.code,
    sectionId: def.sectionId,
    label: def.label,
    note: def.note,
    state: "gap",
    gapKind: "unmapped",
    missingMetricKeys: [],
    presentMetricKeys: [],
    evidenceIds: [],
    actionHref: def.href ?? METRICS_HREF,
  };
}

function scoreIndicator(
  def: SocialIndicatorDef,
  gradeByKey: Map<string, DatapointGradeInput>,
  dpByKey: Map<string, SocialDatapointInput>,
): SocialIndicatorStatus {
  if (def.sourceKind === "unmapped") return scoreUnmapped(def);
  return scoreMetricIndicator(def, gradeByKey, dpByKey);
}

function summarise(statuses: SocialIndicatorStatus[]): SocialSummary {
  const covered = statuses.filter((s) => s.state === "covered").length;
  const partial = statuses.filter((s) => s.state === "partial").length;
  const gap = statuses.filter((s) => s.state === "gap").length;
  const total = statuses.length;
  return {
    total,
    covered,
    partial,
    gap,
    pctCovered: pct(covered, total),
  };
}

/**
 * Compute social / workforce indicator coverage for a period's datapoints.
 */
export function computeSocialCoverage(input: {
  periodId: string;
  datapoints: SocialDatapointInput[];
  /** Override catalog in tests. */
  indicators?: SocialIndicatorDef[];
}): SocialCoverageResult {
  const indicators = input.indicators ?? SOCIAL_INDICATORS;
  const gradeByKey = toGradeMap(input.datapoints);
  const dpByKey = new Map(input.datapoints.map((d) => [d.metricKey, d]));

  const statuses = indicators.map((def) => scoreIndicator(def, gradeByKey, dpByKey));

  const sections: SocialSectionSummary[] = SOCIAL_SECTIONS.map((section) => {
    const rows = statuses.filter((s) => s.sectionId === section.id);
    const covered = rows.filter((s) => s.state === "covered").length;
    const partial = rows.filter((s) => s.state === "partial").length;
    const gap = rows.filter((s) => s.state === "gap").length;
    return {
      sectionId: section.id,
      title: section.title,
      shortTitle: section.shortTitle,
      total: rows.length,
      covered,
      partial,
      gap,
      pctCovered: pct(covered, rows.length),
      indicators: rows,
    };
  }).filter((s) => s.total > 0);

  const gaps = statuses.filter((s) => s.state === "gap" || s.state === "partial");

  return {
    periodId: input.periodId,
    summary: summarise(statuses),
    sections,
    gaps,
  };
}
