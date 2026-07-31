/**
 * Pure comparison aggregators for analytics YoY / group / multi-period views.
 * Zero I/O — callers load period totals and maps.
 */

export const COMPARE_TYPES = [
  "yoy",
  "by_department",
  "by_supplier",
  "by_metric",
  "multi_period",
] as const;

export type CompareType = (typeof COMPARE_TYPES)[number];

export type ChangeStats = {
  absolute: number;
  percent: number | null;
  direction: "up" | "down" | "flat";
};

export type PeriodSlice = {
  id: string;
  label: string;
  total: number;
  quality: "calculated" | "missing" | "partial";
  scope1?: number;
  scope2?: number;
  scope3?: number;
};

export type CompareRow = {
  key: string;
  label: string;
  baseline: number;
  current: number;
  change: ChangeStats;
  shareOfCurrent: number | null;
};

export type YoYComparison = {
  kind: "yoy";
  baseline: PeriodSlice;
  current: PeriodSlice;
  change: ChangeStats;
  rows: CompareRow[];
};

export type GroupedComparison = {
  kind: "by_department" | "by_supplier" | "by_metric";
  baseline: PeriodSlice;
  current: PeriodSlice;
  change: ChangeStats;
  rows: CompareRow[];
};

export type MultiPeriodComparison = {
  kind: "multi_period";
  periods: PeriodSlice[];
  rows: Array<{
    id: string;
    label: string;
    total: number;
    changeFromPrevious: ChangeStats | null;
  }>;
};

export type ComparisonResult = YoYComparison | GroupedComparison | MultiPeriodComparison;

export type ComparePreset = {
  id: string;
  label: string;
  description: string;
  type: CompareType;
  /** Relative year offsets from "now" for YoY presets */
  yearOffsetBaseline?: number;
  yearOffsetCurrent?: number;
};

export const COMPARE_PRESETS: ComparePreset[] = [
  {
    id: "yoy_current",
    label: "Year over year",
    description: "Current calendar year vs prior year total emissions",
    type: "yoy",
    yearOffsetBaseline: -1,
    yearOffsetCurrent: 0,
  },
  {
    id: "yoy_prior",
    label: "Prior year YoY",
    description: "Prior year vs two years ago",
    type: "yoy",
    yearOffsetBaseline: -2,
    yearOffsetCurrent: -1,
  },
  {
    id: "by_department",
    label: "By department",
    description: "Group activity values by department / facility between two periods",
    type: "by_department",
  },
  {
    id: "by_supplier",
    label: "By supplier",
    description: "Group activity values by supplier between two periods",
    type: "by_supplier",
  },
  {
    id: "by_metric",
    label: "By metric",
    description: "Group activity values by metric key between two periods",
    type: "by_metric",
  },
  {
    id: "multi_period",
    label: "Multi-period",
    description: "Sequential period totals with period-over-period change",
    type: "multi_period",
  },
];

export function isCompareType(value: unknown): value is CompareType {
  return (
    typeof value === "string" && (COMPARE_TYPES as readonly string[]).includes(value)
  );
}

export function calculateChange(current: number, baseline: number): ChangeStats {
  const absolute = current - baseline;
  let percent: number | null = null;
  if (Number.isFinite(baseline) && baseline !== 0) {
    percent = (absolute / baseline) * 100;
  }
  let direction: ChangeStats["direction"] = "flat";
  if (absolute > 0) direction = "up";
  else if (absolute < 0) direction = "down";
  return { absolute, percent, direction };
}

export function sumMap(values: Record<string, number>): number {
  return Object.values(values).reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

export function compareTwoTotals(
  baseline: PeriodSlice,
  current: PeriodSlice,
): YoYComparison {
  const change = calculateChange(current.total, baseline.total);
  const rows: CompareRow[] = [];

  const scopeKeys = [
    { key: "scope1", label: "Scope 1" },
    { key: "scope2", label: "Scope 2" },
    { key: "scope3", label: "Scope 3" },
  ] as const;

  for (const s of scopeKeys) {
    const b = baseline[s.key] ?? 0;
    const c = current[s.key] ?? 0;
    if (b === 0 && c === 0) continue;
    rows.push({
      key: s.key,
      label: s.label,
      baseline: b,
      current: c,
      change: calculateChange(c, b),
      shareOfCurrent: current.total > 0 ? (c / current.total) * 100 : null,
    });
  }

  return { kind: "yoy", baseline, current, change, rows };
}

/**
 * Side-by-side group comparison. Includes keys present in either map.
 * Sorted by absolute change descending.
 */
export function compareGrouped(
  kind: GroupedComparison["kind"],
  baseline: PeriodSlice,
  current: PeriodSlice,
  baselineMap: Record<string, number>,
  currentMap: Record<string, number>,
  labels?: Record<string, string>,
): GroupedComparison {
  const keys = new Set([...Object.keys(baselineMap), ...Object.keys(currentMap)]);
  const rows: CompareRow[] = [];
  const currentTotal = sumMap(currentMap);

  for (const key of keys) {
    const b = baselineMap[key] ?? 0;
    const c = currentMap[key] ?? 0;
    rows.push({
      key,
      label: labels?.[key] ?? key,
      baseline: b,
      current: c,
      change: calculateChange(c, b),
      shareOfCurrent: currentTotal > 0 ? (c / currentTotal) * 100 : null,
    });
  }

  rows.sort((a, b) => Math.abs(b.change.absolute) - Math.abs(a.change.absolute));

  const change = calculateChange(current.total, baseline.total);
  return { kind, baseline, current, change, rows };
}

export function compareMultiPeriod(periods: PeriodSlice[]): MultiPeriodComparison {
  const rows = periods.map((p, i) => {
    const prev = i > 0 ? periods[i - 1] : null;
    return {
      id: p.id,
      label: p.label,
      total: p.total,
      changeFromPrevious: prev ? calculateChange(p.total, prev.total) : null,
    };
  });
  return { kind: "multi_period", periods, rows };
}

/**
 * Parse department / facility tag from datapoint note.
 * Accepts `department:X` or `facility:X`; otherwise Unassigned.
 */
export function dimensionFromNote(
  note: string | null | undefined,
  kind: "department" | "facility",
): string {
  if (!note) return "Unassigned";
  const re = new RegExp(`${kind}:([^\\s,;]+)`, "i");
  const match = note.match(re);
  if (match?.[1]) return match[1];
  // Fall back across tags so facility notes still group under department view.
  if (kind === "department") {
    const facility = note.match(/facility:([^\s,;]+)/i);
    if (facility?.[1]) return facility[1];
  }
  return "Unassigned";
}

export function accumulateByKey(
  rows: Array<{ key: string; value: number | null | undefined }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const v = row.value;
    if (v == null || !Number.isFinite(v)) continue;
    out[row.key] = (out[row.key] ?? 0) + v;
  }
  return out;
}

export function comparisonToCsv(result: ComparisonResult): string {
  const escape = (cell: string): string => {
    if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const lines: string[] = [];

  if (result.kind === "multi_period") {
    lines.push(
      ["period_id", "label", "total", "change_absolute", "change_percent"].join(","),
    );
    for (const row of result.rows) {
      lines.push(
        [
          escape(row.id),
          escape(row.label),
          String(row.total),
          row.changeFromPrevious ? String(row.changeFromPrevious.absolute) : "",
          row.changeFromPrevious?.percent != null
            ? String(row.changeFromPrevious.percent)
            : "",
        ].join(","),
      );
    }
    return lines.join("\n");
  }

  lines.push(
    [
      "key",
      "label",
      "baseline",
      "current",
      "change_absolute",
      "change_percent",
      "share_of_current",
    ].join(","),
  );
  for (const row of result.rows) {
    lines.push(
      [
        escape(row.key),
        escape(row.label),
        String(row.baseline),
        String(row.current),
        String(row.change.absolute),
        row.change.percent != null ? String(row.change.percent) : "",
        row.shareOfCurrent != null ? String(row.shareOfCurrent) : "",
      ].join(","),
    );
  }

  // Summary footer
  lines.push(
    [
      "_total",
      "Total",
      String(result.baseline.total),
      String(result.current.total),
      String(result.change.absolute),
      result.change.percent != null ? String(result.change.percent) : "",
      "",
    ].join(","),
  );

  return lines.join("\n");
}

export function resolvePresetYears(
  presetId: string,
  nowYear = new Date().getFullYear(),
): { baselineYear: number; currentYear: number } | null {
  const preset = COMPARE_PRESETS.find((p) => p.id === presetId && p.type === "yoy");
  if (!preset) return null;
  const bOff = preset.yearOffsetBaseline ?? -1;
  const cOff = preset.yearOffsetCurrent ?? 0;
  return {
    baselineYear: nowYear + bOff,
    currentYear: nowYear + cOff,
  };
}
