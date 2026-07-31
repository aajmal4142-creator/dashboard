import {
  bandLabel,
  formatPct,
  formatPublishedAt,
  formatScore,
  formatTco2e,
  reportFrameworkLabel,
} from "./pdfFormat";
import type { ReportSnapshot } from "./types";
import { REPORT_DISCLAIMER } from "./types";

export const SHARE_TOKEN_TTL_DAYS = 7;
/** Allowed TTL range when minting embed/share tokens (days). */
export const SHARE_TOKEN_TTL_MIN_DAYS = 1;
export const SHARE_TOKEN_TTL_MAX_DAYS = 30;

export type ScopeFilter = "all" | "scope1" | "scope2" | "scope3";

export type EmissionsChartRow = {
  key: "scope1" | "scope2" | "scope3";
  label: string;
  value: number;
};

export type DetailTableRow = {
  id: string;
  label: string;
  scope: "scope1" | "scope2" | "scope3" | "other";
  value: number;
  quality: string | null;
  detail: string | null;
  children: DetailTableRow[];
};

export type SortDirection = "asc" | "desc";

export type HtmlReportMeta = {
  organisationName: string;
  periodLabel: string;
  frameworkLabel: string;
  version: number;
  generatedAtLabel: string;
  generatedAtIso: string;
  bandLabel: string;
  disclaimer: string;
};

/** Pure: chart series from snapshot emissions. */
export function buildEmissionsChartRows(
  emissions: ReportSnapshot["emissions"],
): EmissionsChartRow[] {
  return [
    { key: "scope1", label: "Scope 1", value: Number(emissions.scope1) || 0 },
    { key: "scope2", label: "Scope 2", value: Number(emissions.scope2) || 0 },
    { key: "scope3", label: "Scope 3", value: Number(emissions.scope3) || 0 },
  ];
}

/** Pure: filter chart series by scope dropdown. */
export function filterEmissionsByScope(
  rows: EmissionsChartRow[],
  filter: ScopeFilter,
): EmissionsChartRow[] {
  if (filter === "all") return rows;
  return rows.filter((r) => r.key === filter);
}

/** Pure: visible series after legend toggles (missing key = visible). */
export function applyLegendVisibility(
  rows: EmissionsChartRow[],
  hidden: ReadonlySet<string>,
): EmissionsChartRow[] {
  return rows.filter((r) => !hidden.has(r.key));
}

function scopeFromComponent(component: string): DetailTableRow["scope"] {
  const lower = component.toLowerCase();
  if (lower.includes("scope 1") || lower.startsWith("s1") || lower.includes("scope1")) {
    return "scope1";
  }
  if (lower.includes("scope 2") || lower.startsWith("s2") || lower.includes("scope2")) {
    return "scope2";
  }
  if (lower.includes("scope 3") || lower.startsWith("s3") || lower.includes("scope3")) {
    return "scope3";
  }
  return "other";
}

/** Pure: expandable detail rows from scope breakdown + score components. */
export function buildDetailTableRows(snapshot: ReportSnapshot): DetailTableRow[] {
  const rows: DetailTableRow[] = [];
  const scope = snapshot.scopeBreakdown;

  if (scope) {
    for (const key of ["scope1", "scope2", "scope3"] as const) {
      const row = scope[key];
      rows.push({
        id: key,
        label: key === "scope1" ? "Scope 1" : key === "scope2" ? "Scope 2" : "Scope 3",
        scope: key,
        value: row.value,
        quality: row.quality,
        detail: [row.methodology, row.uncertainties].filter(Boolean).join(" · ") || null,
        children: (row.sources ?? []).map((source, i) => ({
          id: `${key}-src-${i}`,
          label: source,
          scope: key,
          value: 0,
          quality: null,
          detail: null,
          children: [],
        })),
      });
    }
  } else {
    for (const chart of buildEmissionsChartRows(snapshot.emissions)) {
      rows.push({
        id: chart.key,
        label: chart.label,
        scope: chart.key,
        value: chart.value,
        quality: null,
        detail: null,
        children: [],
      });
    }
  }

  for (const item of snapshot.breakdown) {
    rows.push({
      id: `bd-${item.component}`,
      label: item.component,
      scope: scopeFromComponent(item.component),
      value: item.contribution,
      quality: null,
      detail: item.explanation,
      children: [],
    });
  }

  return rows;
}

/** Pure: filter detail rows by scope. */
export function filterDetailRows(
  rows: DetailTableRow[],
  filter: ScopeFilter,
): DetailTableRow[] {
  if (filter === "all") return rows;
  return rows.filter((r) => r.scope === filter);
}

/** Pure: sort flat detail rows by column. */
export function sortDetailRows(
  rows: DetailTableRow[],
  column: "label" | "value" | "scope" | "quality",
  direction: SortDirection,
): DetailTableRow[] {
  const mult = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (column === "value") {
      return (a.value - b.value) * mult;
    }
    const av = String(a[column] ?? "");
    const bv = String(b[column] ?? "");
    return av.localeCompare(bv, "en") * mult;
  });
}

/** Pure: next sort direction when clicking a header. */
export function nextSortDirection(
  currentColumn: string | null,
  currentDirection: SortDirection,
  clickedColumn: string,
): { column: string; direction: SortDirection } {
  if (currentColumn === clickedColumn) {
    return {
      column: clickedColumn,
      direction: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return { column: clickedColumn, direction: "asc" };
}

/** Pure: executive summary highlight lines. */
export function buildExecutiveHighlights(snapshot: ReportSnapshot): string[] {
  const highlights: string[] = [];
  highlights.push(
    `Total GHG emissions ${formatTco2e(snapshot.emissions.total)} tCO₂e for ${snapshot.periodLabel}.`,
  );
  highlights.push(
    `Overall score ${formatScore(snapshot.scores.overall)} of 100 (${bandLabel(snapshot.band)}).`,
  );
  highlights.push(`Data quality ${formatPct(snapshot.emissions.dataQualityPct)}.`);

  const yoy = snapshot.yoy;
  if (yoy) {
    if (yoy.changePct === null) {
      highlights.push(
        `Prior period (${yoy.previousPeriodLabel}): ${formatTco2e(yoy.previousTotal)} tCO₂e. Change not defined.`,
      );
    } else {
      const sign = yoy.changePct > 0 ? "+" : "";
      highlights.push(
        `YoY vs ${yoy.previousPeriodLabel}: ${sign}${yoy.changePct.toFixed(1)}%.`,
      );
    }
  }

  const gaps = snapshot.dataGaps?.length ?? 0;
  if (gaps > 0) {
    highlights.push(`${gaps} data gap(s) flagged on this snapshot.`);
  }

  return highlights;
}

/** Pure: header / footer meta for HTML report. Generated timestamp only (no server internals). */
export function buildHtmlReportMeta(
  snapshot: ReportSnapshot,
  generatedAt: Date = new Date(),
): HtmlReportMeta {
  return {
    organisationName: snapshot.organisationName,
    periodLabel: snapshot.periodLabel,
    frameworkLabel: reportFrameworkLabel(snapshot.framework),
    version: snapshot.version,
    generatedAtLabel: formatPublishedAt(generatedAt.toISOString()),
    generatedAtIso: generatedAt.toISOString(),
    bandLabel: bandLabel(snapshot.band),
    disclaimer: snapshot.disclaimer || REPORT_DISCLAIMER,
  };
}

/** Pure: classify an embed token for list UI / access checks. */
export function classifyEmbedTokenStatus(
  input: {
    expiresAt: string | Date;
    revokedAt?: string | Date | null;
  },
  now: Date = new Date(),
): "active" | "expired" | "revoked" {
  if (input.revokedAt) return "revoked";
  if (isShareTokenExpired(input.expiresAt, now)) return "expired";
  return "active";
}

/** Pure: iframe embed snippet. */
export function buildEmbedCode(embedUrl: string, height = 600): string {
  const safe = embedUrl.replace(/"/g, "&quot;");
  return `<iframe src="${safe}" width="100%" height="${height}" style="border:0;max-width:100%;" loading="lazy" title="ClearESG sustainability report" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
}

/** Pure: whether a share token is past expiry. */
export function isShareTokenExpired(
  expiresAt: string | Date,
  now: Date = new Date(),
): boolean {
  const end = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return true;
  return end.getTime() <= now.getTime();
}

/** Pure: clamp requested TTL into the allowed mint range. */
export function clampShareTtlDays(ttlDays: number | undefined | null): number {
  if (ttlDays == null || !Number.isFinite(ttlDays)) return SHARE_TOKEN_TTL_DAYS;
  const rounded = Math.round(ttlDays);
  if (rounded < SHARE_TOKEN_TTL_MIN_DAYS) return SHARE_TOKEN_TTL_MIN_DAYS;
  if (rounded > SHARE_TOKEN_TTL_MAX_DAYS) return SHARE_TOKEN_TTL_MAX_DAYS;
  return rounded;
}

/** Pure: expiry timestamp for a newly minted share token. */
export function computeShareExpiry(
  from: Date = new Date(),
  ttlDays: number = SHARE_TOKEN_TTL_DAYS,
): Date {
  const days = clampShareTtlDays(ttlDays);
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Pure: public share + embed URLs from opaque token (org id never in token). */
export function buildShareUrls(
  origin: string,
  token: string,
): { shareUrl: string; embedUrl: string; legacyEmbedUrl: string } {
  const base = origin.replace(/\/$/, "");
  const shareUrl = `${base}/r/html/${token}`;
  return {
    shareUrl,
    embedUrl: `${base}/public/reports/embed/${token}`,
    legacyEmbedUrl: `${shareUrl}?embed=1`,
  };
}
