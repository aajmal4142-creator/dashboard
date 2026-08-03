/**
 * Pure emissions hotspot ranking — share of total and period-over-period change
 * by facility, supplier, category, or metric key.
 * Zero I/O. Missing / non-finite values are excluded, never coerced to zero for charts.
 */

import {
  accumulateByKey,
  calculateChange,
  dimensionFromNote,
  sumMap,
  type ChangeStats,
} from "./compare";

export const HOTSPOT_DIMENSIONS = [
  "facility",
  "supplier",
  "category",
  "metricKey",
] as const;

export type HotspotDimension = (typeof HOTSPOT_DIMENSIONS)[number];

export const HOTSPOT_SORT_MODES = ["share", "value", "change"] as const;

export type HotspotSortMode = (typeof HOTSPOT_SORT_MODES)[number];

export type HotspotQuality = "calculated" | "partial" | "missing";

export type HotspotActivityRow = {
  metricKey: string;
  value: number | null | undefined;
  quality?: "measured" | "calculated" | "estimated" | "missing" | null;
  note?: string | null;
  /** Resolved facility id, or null when absent */
  facilityId?: string | null;
  facilityLabel?: string | null;
  /** Resolved supplier id / key, or null when absent */
  supplierId?: string | null;
  supplierLabel?: string | null;
  /** Optional calcRole from metric definitions — used for category bucketing */
  calcRole?: string | null;
};

export type HotspotPeriodMeta = {
  id: string;
  label: string;
  total: number;
  quality: HotspotQuality;
};

export type HotspotRow = {
  key: string;
  label: string;
  value: number;
  baseline: number | null;
  shareOfTotal: number | null;
  change: ChangeStats | null;
  quality: HotspotQuality;
};

export type HotspotResult = {
  dimension: HotspotDimension;
  period: HotspotPeriodMeta;
  baseline: HotspotPeriodMeta | null;
  sortBy: HotspotSortMode;
  rows: HotspotRow[];
  /** Datapoints skipped because value was null/non-finite or quality was missing */
  excludedMissingCount: number;
  message: string | null;
};

export function isHotspotDimension(value: unknown): value is HotspotDimension {
  return (
    typeof value === "string" && (HOTSPOT_DIMENSIONS as readonly string[]).includes(value)
  );
}

export function isHotspotSortMode(value: unknown): value is HotspotSortMode {
  return (
    typeof value === "string" && (HOTSPOT_SORT_MODES as readonly string[]).includes(value)
  );
}

/**
 * Bucket a calcRole / metric key into a GHG-style category for hotspot ranking.
 * Prefer explicit `category:` note tags via dimensionKeyFor before calling this.
 */
export function categoryFromCalcRole(calcRole: string | null | undefined): string {
  if (!calcRole || calcRole.trim().length === 0) return "uncategorised";
  const role = calcRole.trim().toLowerCase();

  if (role.startsWith("scope1")) return "scope1";
  if (role.startsWith("scope2")) return "scope2";
  if (
    role.startsWith("scope3.businesstravel") ||
    role.startsWith("scope3.business_travel")
  ) {
    return "scope3.business_travel";
  }
  if (
    role.startsWith("scope3.employeecommute") ||
    role.startsWith("scope3.employee_commute")
  ) {
    return "scope3.employee_commute";
  }
  if (role.startsWith("scope3.freight")) return "scope3.freight";
  if (role.startsWith("scope3.spend")) return "scope3.purchased_goods";
  if (role.startsWith("scope3.waste")) return "scope3.waste";
  if (role.startsWith("scope3.investment")) return "scope3.investment";
  if (role.startsWith("scope3")) return "scope3.other";
  if (role.startsWith("operational.waste") || role.startsWith("operational.water")) {
    return "operations";
  }
  if (role.startsWith("score.")) return "score";

  const parts = role.split(".");
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return parts[0] ?? "uncategorised";
}

export const CATEGORY_LABELS: Record<string, string> = {
  scope1: "Scope 1",
  scope2: "Scope 2",
  "scope3.business_travel": "Scope 3 — business travel",
  "scope3.employee_commute": "Scope 3 — employee commute",
  "scope3.freight": "Scope 3 — freight",
  "scope3.purchased_goods": "Scope 3 — purchased goods",
  "scope3.waste": "Scope 3 — waste",
  "scope3.investment": "Scope 3 — investment",
  "scope3.other": "Scope 3 — other",
  operations: "Operations (waste / water)",
  score: "Score / intensity inputs",
  uncategorised: "Uncategorised",
};

/**
 * Resolve the grouping key for one activity row on a hotspot dimension.
 */
export function dimensionKeyFor(
  row: HotspotActivityRow,
  dimension: HotspotDimension,
): string {
  if (dimension === "metricKey") {
    return row.metricKey || "unknown";
  }

  if (dimension === "facility") {
    if (row.facilityId && row.facilityId.trim().length > 0) return row.facilityId.trim();
    const fromNote = dimensionFromNote(row.note, "facility");
    return fromNote;
  }

  if (dimension === "supplier") {
    if (row.supplierId && row.supplierId.trim().length > 0) return row.supplierId.trim();
    return "_none";
  }

  // category — note tag wins, then calcRole bucket, then metricKey heuristic
  if (row.note) {
    const match = row.note.match(/category:([^\s,;]+)/i);
    if (match?.[1]) return match[1];
  }
  if (row.calcRole) return categoryFromCalcRole(row.calcRole);
  // Heuristic when calcRole not loaded: treat metricKey prefixes
  return categoryFromCalcRole(row.metricKey);
}

export function dimensionLabelFor(
  key: string,
  dimension: HotspotDimension,
  row: HotspotActivityRow | undefined,
  labels?: Record<string, string>,
): string {
  if (labels?.[key]) return labels[key];
  if (dimension === "facility") {
    return row?.facilityLabel?.trim() || (key === "Unassigned" ? "Unassigned" : key);
  }
  if (dimension === "supplier") {
    if (key === "_none") return "No supplier";
    return row?.supplierLabel?.trim() || key;
  }
  if (dimension === "category") {
    return CATEGORY_LABELS[key] ?? key;
  }
  return key;
}

export function isUsableActivityValue(
  value: number | null | undefined,
  quality?: HotspotActivityRow["quality"],
): boolean {
  if (quality === "missing") return false;
  if (value == null || !Number.isFinite(value)) return false;
  return true;
}

export type AccumulateHotspotsResult = {
  map: Record<string, number>;
  labels: Record<string, string>;
  excludedMissingCount: number;
  usableCount: number;
};

/**
 * Aggregate usable activity rows into a dimension map. Skips missing / non-finite.
 */
export function accumulateHotspotDimension(
  rows: HotspotActivityRow[],
  dimension: HotspotDimension,
  extraLabels?: Record<string, string>,
): AccumulateHotspotsResult {
  const usable: Array<{ key: string; value: number }> = [];
  const labels: Record<string, string> = { ...(extraLabels ?? {}) };
  let excludedMissingCount = 0;

  for (const row of rows) {
    if (!isUsableActivityValue(row.value, row.quality)) {
      excludedMissingCount += 1;
      continue;
    }
    const key = dimensionKeyFor(row, dimension);
    usable.push({ key, value: row.value as number });
    if (!labels[key]) {
      labels[key] = dimensionLabelFor(key, dimension, row, extraLabels);
    }
  }

  return {
    map: accumulateByKey(usable),
    labels,
    excludedMissingCount,
    usableCount: usable.length,
  };
}

function periodQuality(
  total: number,
  usableCount: number,
  excluded: number,
): HotspotQuality {
  if (usableCount === 0) return "missing";
  if (excluded > 0 || total <= 0) return "partial";
  return "calculated";
}

function emptyMessage(dimension: HotspotDimension, excludedMissingCount: number): string {
  const dim =
    dimension === "metricKey"
      ? "metric"
      : dimension === "facility"
        ? "facility"
        : dimension === "supplier"
          ? "supplier"
          : "category";
  if (excludedMissingCount > 0) {
    return `No usable ${dim} values for this period. ${excludedMissingCount} datapoint(s) excluded as missing or non-numeric.`;
  }
  return `No ${dim} datapoints found for this period.`;
}

/**
 * Rank hotspots for a single period (share of total) or vs an optional baseline (change).
 * Sorted by absolute change when baseline is present and sortBy is change (default in that case),
 * otherwise by share / value descending.
 */
export function rankHotspots(options: {
  dimension: HotspotDimension;
  period: { id: string; label: string };
  currentRows: HotspotActivityRow[];
  baselinePeriod?: { id: string; label: string } | null;
  baselineRows?: HotspotActivityRow[] | null;
  labels?: Record<string, string>;
  sortBy?: HotspotSortMode;
  limit?: number;
}): HotspotResult {
  const {
    dimension,
    period,
    currentRows,
    baselinePeriod = null,
    baselineRows = null,
    labels: extraLabels,
    limit,
  } = options;

  const current = accumulateHotspotDimension(currentRows, dimension, extraLabels);
  const hasBaseline = Boolean(baselinePeriod && baselineRows);
  const baseline = hasBaseline
    ? accumulateHotspotDimension(baselineRows ?? [], dimension, extraLabels)
    : null;

  const sortBy: HotspotSortMode = options.sortBy ?? (hasBaseline ? "change" : "share");

  const currentTotal = sumMap(current.map);
  const baselineTotal = baseline ? sumMap(baseline.map) : 0;

  const keys = new Set<string>([
    ...Object.keys(current.map),
    ...(baseline ? Object.keys(baseline.map) : []),
  ]);

  const mergedLabels: Record<string, string> = {
    ...(baseline?.labels ?? {}),
    ...current.labels,
    ...(extraLabels ?? {}),
  };

  const rows: HotspotRow[] = [];

  for (const key of keys) {
    const value = current.map[key];
    const baselineValue = baseline?.map[key];
    const hasCurrent = value != null && Number.isFinite(value);
    const hasBase = baselineValue != null && Number.isFinite(baselineValue);

    // Single-period: only keys with a real current value (do not invent zeros for charts)
    if (!hasBaseline && !hasCurrent) continue;

    // Change mode: include keys present in either period; absent side is null (not chart-filled)
    const currentVal = hasCurrent ? (value as number) : 0;
    const baseVal = hasBase ? (baselineValue as number) : hasBaseline ? 0 : null;

    let quality: HotspotQuality = "calculated";
    if (!hasCurrent && hasBaseline) quality = "partial";
    else if (hasCurrent && hasBaseline && !hasBase) quality = "partial";
    else if (!hasCurrent) quality = "missing";

    rows.push({
      key,
      label: mergedLabels[key] ?? key,
      value: hasCurrent ? (value as number) : 0,
      baseline: hasBaseline ? (hasBase ? (baselineValue as number) : 0) : null,
      shareOfTotal:
        hasCurrent && currentTotal > 0 ? ((value as number) / currentTotal) * 100 : null,
      change:
        hasBaseline && baseVal != null ? calculateChange(currentVal, baseVal) : null,
      quality,
    });
  }

  rows.sort((a, b) => {
    if (sortBy === "change") {
      const ac = Math.abs(a.change?.absolute ?? 0);
      const bc = Math.abs(b.change?.absolute ?? 0);
      if (bc !== ac) return bc - ac;
    }
    if (sortBy === "share") {
      const as = a.shareOfTotal ?? -1;
      const bs = b.shareOfTotal ?? -1;
      if (bs !== as) return bs - as;
    }
    return b.value - a.value;
  });

  const limited = limit != null && limit > 0 ? rows.slice(0, limit) : rows;

  const excludedMissingCount =
    current.excludedMissingCount + (baseline?.excludedMissingCount ?? 0);

  const periodMeta: HotspotPeriodMeta = {
    id: period.id,
    label: period.label,
    total: currentTotal,
    quality: periodQuality(
      currentTotal,
      current.usableCount,
      current.excludedMissingCount,
    ),
  };

  const baselineMeta: HotspotPeriodMeta | null =
    hasBaseline && baselinePeriod
      ? {
          id: baselinePeriod.id,
          label: baselinePeriod.label,
          total: baselineTotal,
          quality: periodQuality(
            baselineTotal,
            baseline?.usableCount ?? 0,
            baseline?.excludedMissingCount ?? 0,
          ),
        }
      : null;

  const message =
    limited.length === 0 ? emptyMessage(dimension, current.excludedMissingCount) : null;

  return {
    dimension,
    period: periodMeta,
    baseline: baselineMeta,
    sortBy,
    rows: limited,
    excludedMissingCount,
    message,
  };
}

export function hotspotsToCsv(result: HotspotResult): string {
  const escape = (cell: string): string => {
    if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const lines: string[] = [
    [
      "key",
      "label",
      "value",
      "baseline",
      "share_of_total",
      "change_absolute",
      "change_percent",
      "quality",
    ].join(","),
  ];

  for (const row of result.rows) {
    lines.push(
      [
        escape(row.key),
        escape(row.label),
        String(row.value),
        row.baseline != null ? String(row.baseline) : "",
        row.shareOfTotal != null ? String(row.shareOfTotal) : "",
        row.change ? String(row.change.absolute) : "",
        row.change?.percent != null ? String(row.change.percent) : "",
        row.quality,
      ].join(","),
    );
  }

  lines.push(
    [
      "_total",
      "Total",
      String(result.period.total),
      result.baseline != null ? String(result.baseline.total) : "",
      result.period.total > 0 ? "100" : "",
      "",
      "",
      result.period.quality,
    ].join(","),
  );

  return lines.join("\n");
}
