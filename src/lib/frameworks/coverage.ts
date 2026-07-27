import { DERIVED_RAW_INPUTS, FRAMEWORK_MAPPINGS } from "./mappings";
import type {
  CoverageState,
  DatapointGradeInput,
  DisclosureCoverage,
  FrameworkCoverageSummary,
  FrameworkId,
  FrameworkMappingRow,
} from "./types";

type GradeKind = "honest" | "weak" | "missing";

function gradeOf(dp: DatapointGradeInput | undefined): GradeKind {
  if (!dp || dp.quality === "missing") return "missing";
  if (dp.quality === "estimated" || dp.provenance === "spend_estimate") return "weak";
  return "honest";
}

/**
 * Worst grade across keys (missing < weak < honest for “present” purposes).
 * missing wins as gap; else weak → partial; else honest.
 */
function combineGrades(grades: GradeKind[]): GradeKind {
  if (grades.length === 0 || grades.every((g) => g === "missing")) return "missing";
  if (grades.some((g) => g === "weak")) return "weak";
  if (grades.some((g) => g === "honest")) return "honest";
  return "missing";
}

/**
 * Resolve grade for a metric key — derived.* rolls up raw inputs when no direct row.
 */
export function resolveMetricGrade(
  metricKey: string,
  byKey: Map<string, DatapointGradeInput>,
): GradeKind {
  const direct = byKey.get(metricKey);
  if (direct) return gradeOf(direct);

  const rawKeys = DERIVED_RAW_INPUTS[metricKey];
  if (!rawKeys) return "missing";

  return combineGrades(rawKeys.map((k) => gradeOf(byKey.get(k))));
}

export function coverageStateForMapping(
  row: FrameworkMappingRow,
  byKey: Map<string, DatapointGradeInput>,
): CoverageState {
  const grades = row.metricKeys.map((k) => resolveMetricGrade(k, byKey));
  const combined = combineGrades(grades);

  if (combined === "missing") return "gap";

  if (combined === "weak") return "partial";

  // honest grade present
  if (row.contributionOnly || !row.required) return "contributes";
  return "satisfied";
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * n) / total);
}

export function coverageFromData(input: {
  applicable: FrameworkId[];
  datapoints: DatapointGradeInput[];
  /** Override mapping table in tests. */
  mappings?: FrameworkMappingRow[];
}): {
  disclosures: DisclosureCoverage[];
  byFramework: FrameworkCoverageSummary[];
} {
  const applicable = new Set(input.applicable);
  const byKey = new Map(input.datapoints.map((d) => [d.metricKey, d]));
  const mappings = (input.mappings ?? FRAMEWORK_MAPPINGS).filter((m) =>
    applicable.has(m.framework),
  );

  const disclosures: DisclosureCoverage[] = mappings.map((row) => ({
    framework: row.framework,
    disclosureCode: row.datapointRef,
    label: row.label,
    state: coverageStateForMapping(row, byKey),
    required: row.required,
    contributionOnly: row.contributionOnly,
  }));

  const frameworks = [...new Set(mappings.map((m) => m.framework))];
  const byFramework: FrameworkCoverageSummary[] = frameworks.map((framework) => {
    const rows = disclosures.filter((d) => d.framework === framework);
    const total = rows.length;
    const satisfied = rows.filter((d) => d.state === "satisfied").length;
    const partial = rows.filter((d) => d.state === "partial").length;
    const contributes = rows.filter((d) => d.state === "contributes").length;
    const gap = rows.filter((d) => d.state === "gap").length;
    return {
      framework,
      total,
      satisfied,
      partial,
      contributes,
      gap,
      pctSatisfied: pct(satisfied, total),
      pctPartial: pct(partial, total),
      pctGap: pct(gap, total),
    };
  });

  return { disclosures, byFramework };
}
