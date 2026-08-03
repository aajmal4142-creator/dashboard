/**
 * BRSR Core / Comprehensive coverage — pure, zero I/O.
 */

import { METRICS_HREF } from "@/lib/metrics";
import { DERIVED_RAW_INPUTS } from "@/lib/frameworks/mappings";
import { resolveMetricGrade } from "@/lib/frameworks/coverage";
import type { DatapointGradeInput } from "@/lib/frameworks/types";

import { BRSR_DISCLOSURES, BRSR_PRINCIPLES } from "./catalog";
import type {
  BrsrCoverageResult,
  BrsrDatapointInput,
  BrsrDisclosureDef,
  BrsrDisclosureState,
  BrsrDisclosureStatus,
  BrsrGapKind,
  BrsrLevel,
  BrsrLevelSummary,
  BrsrPrincipleCoverage,
} from "./types";

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * n) / total);
}

function toGradeMap(datapoints: BrsrDatapointInput[]): Map<string, DatapointGradeInput> {
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
  byKey: Map<string, BrsrDatapointInput>,
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

function scoreDisclosure(
  def: BrsrDisclosureDef,
  gradeByKey: Map<string, DatapointGradeInput>,
  dpByKey: Map<string, BrsrDatapointInput>,
): BrsrDisclosureStatus {
  const base = {
    code: def.code,
    principleId: def.principleId,
    level: def.level,
    label: def.label,
    note: def.note,
  };

  if (def.metricKeys.length === 0) {
    return {
      ...base,
      state: "gap",
      gapKind: "unmapped",
      missingMetricKeys: [],
      presentMetricKeys: [],
      evidenceIds: [],
      metricsHref: METRICS_HREF,
    };
  }

  const match = def.metricMatch ?? "all";
  const grades = def.metricKeys.map((k) => ({
    key: k,
    grade: resolveMetricGrade(k, gradeByKey),
  }));

  const present = grades.filter((g) => g.grade !== "missing");
  const missing = grades.filter((g) => g.grade === "missing").map((g) => g.key);
  const presentKeys = present.map((g) => g.key);

  const dataSatisfied = match === "any" ? present.length > 0 : missing.length === 0;

  if (!dataSatisfied) {
    const primaryMissing = missing[0] ?? def.metricKeys[0];
    return {
      ...base,
      state: "gap",
      gapKind: "missing_data",
      missingMetricKeys: missing,
      presentMetricKeys: presentKeys,
      evidenceIds: [],
      metricsHref: `${METRICS_HREF}?metric=${encodeURIComponent(primaryMissing)}`,
    };
  }

  const relevantKeys = match === "any" ? presentKeys : def.metricKeys;
  const evidenceIds = evidenceForKeys(relevantKeys, dpByKey);
  const hasWeak = present.some((g) => g.grade === "weak");

  let state: BrsrDisclosureState = "covered";
  let gapKind: BrsrGapKind | null = null;

  if (hasWeak) {
    state = "partial";
    gapKind = "weak_quality";
  }

  if (def.requiresEvidence && evidenceIds.length === 0) {
    state = state === "covered" ? "partial" : state;
    gapKind = gapKind ?? "missing_evidence";
  }

  const hrefKey = missing[0] ?? presentKeys[0] ?? def.metricKeys[0] ?? "";

  return {
    ...base,
    state,
    gapKind,
    missingMetricKeys: missing,
    presentMetricKeys: presentKeys,
    evidenceIds,
    metricsHref: hrefKey
      ? `${METRICS_HREF}?metric=${encodeURIComponent(hrefKey)}`
      : METRICS_HREF,
  };
}

function summariseLevel(
  level: BrsrLevel,
  statuses: BrsrDisclosureStatus[],
): BrsrLevelSummary {
  const rows = statuses.filter((s) => s.level === level);
  const covered = rows.filter((s) => s.state === "covered").length;
  const partial = rows.filter((s) => s.state === "partial").length;
  const gap = rows.filter((s) => s.state === "gap").length;
  const total = rows.length;
  return {
    level,
    total,
    covered,
    partial,
    gap,
    pctCovered: pct(covered, total),
  };
}

function levelSlice(statuses: BrsrDisclosureStatus[], level: BrsrLevel) {
  const rows = statuses.filter((s) => s.level === level);
  const covered = rows.filter((s) => s.state === "covered").length;
  const partial = rows.filter((s) => s.state === "partial").length;
  const gap = rows.filter((s) => s.state === "gap").length;
  const total = rows.length;
  return { covered, partial, gap, total, pctCovered: pct(covered, total) };
}

/**
 * Compute BRSR Core vs Comprehensive coverage for a period's datapoints.
 */
export function computeBrsrCoverage(input: {
  periodId: string;
  datapoints: BrsrDatapointInput[];
  /** Override catalog in tests. */
  disclosures?: BrsrDisclosureDef[];
}): BrsrCoverageResult {
  const disclosures = input.disclosures ?? BRSR_DISCLOSURES;
  const gradeByKey = toGradeMap(input.datapoints);
  const dpByKey = new Map(input.datapoints.map((d) => [d.metricKey, d]));

  const statuses = disclosures.map((def) => scoreDisclosure(def, gradeByKey, dpByKey));

  const principles: BrsrPrincipleCoverage[] = BRSR_PRINCIPLES.map((principle) => {
    const rows = statuses.filter((s) => s.principleId === principle.id);
    return {
      principle,
      core: levelSlice(rows, "core"),
      comprehensive: levelSlice(rows, "comprehensive"),
      disclosures: rows,
    };
  });

  const gaps = statuses.filter((s) => s.state === "gap" || s.state === "partial");

  return {
    periodId: input.periodId,
    core: summariseLevel("core", statuses),
    comprehensive: summariseLevel("comprehensive", statuses),
    principles,
    gaps,
  };
}
