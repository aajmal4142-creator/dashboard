import type { Where } from "payload";

import {
  isSearchResultType,
  SEARCH_TYPES,
  type SearchResultType,
} from "@/lib/search/types";

const MAX_QUERY_LEN = 100;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** High-hit collections queried first for untyped search (fewer regex scans). */
export const PRIMARY_SEARCH_TYPES: readonly SearchResultType[] = [
  "datapoint",
  "supplier",
  "report",
] as const;

/** Queried only if primary results are still under the limit. */
export const SECONDARY_SEARCH_TYPES: readonly SearchResultType[] = [
  "compliance",
  "evidence",
] as const;

/** Strip regex metacharacters and collapse whitespace so Payload `contains` stays safe. */
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .replace(/[.*+?^${}()|[\]\\%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LEN);
}

export function parseSearchLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export function parseSearchType(raw: string | null): SearchResultType | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (isSearchResultType(t)) return t;
  return null;
}

export type ParsedSearchParams = {
  q: string;
  type: SearchResultType | null;
  limit: number;
};

export function parseSearchParams(url: URL): ParsedSearchParams {
  return {
    q: sanitizeSearchQuery(url.searchParams.get("q") ?? ""),
    type: parseSearchType(url.searchParams.get("type")),
    limit: parseSearchLimit(url.searchParams.get("limit")),
  };
}

/** Types to query for a request (single filter or all). */
export function resolveSearchTypes(type: SearchResultType | null): SearchResultType[] {
  if (type) return [type];
  return [...SEARCH_TYPES];
}

/**
 * Two-phase untyped search: primary collections first, secondary only if needed.
 * Typed search returns a single-type list.
 */
export function resolveSearchPhases(type: SearchResultType | null): {
  primary: SearchResultType[];
  secondary: SearchResultType[];
} {
  if (type) {
    return { primary: [type], secondary: [] };
  }
  return {
    primary: [...PRIMARY_SEARCH_TYPES],
    secondary: [...SECONDARY_SEARCH_TYPES],
  };
}

/** Per-collection page size so parallel finds stay small and total ≈ limit. */
export function perTypeLimit(limit: number, typeCount: number): number {
  if (typeCount <= 1) return limit;
  return Math.max(3, Math.ceil(limit / typeCount));
}

/** True when q looks like a metric/key token (prefer equals over contains). */
export function looksLikeMetricKey(q: string): boolean {
  return /^[a-z][a-z0-9_]{1,63}$/i.test(q) && (q.includes("_") || q.length >= 4);
}

/**
 * Org-scoped text search: always AND organisation equals + OR across text fields.
 * Never omit organisation — cross-org leakage is a hard fail.
 * When preferEquals is set for a field, uses equals for that field (index-friendly).
 */
export function buildOrgTextWhere(
  organisationId: string,
  q: string,
  textFields: readonly string[],
  options?: { equalsFields?: readonly string[] },
): Where {
  const equalsSet = new Set(options?.equalsFields ?? []);
  const textOr: Where[] = textFields.map((field) =>
    equalsSet.has(field) ? { [field]: { equals: q } } : { [field]: { contains: q } },
  );

  return {
    and: [{ organisation: { equals: organisationId } }, { or: textOr }],
  };
}

/**
 * Narrow field lists — avoid low-selectivity enums (quality, status, approvalState)
 * that force expensive OR contains scans.
 */
export const SEARCH_FIELDS = {
  datapoint: ["metricKey", "unit", "source"] as const,
  report: ["framework"] as const,
  supplier: ["name", "category", "naceCode"] as const,
  complianceAssessment: ["title"] as const,
  complianceObligation: ["jurisdiction", "standardVersion", "notes"] as const,
  evidence: ["filename", "whyNote"] as const,
} as const;

/** Minimal select maps — fetch only what mappers need. */
export const SEARCH_SELECT = {
  datapoint: {
    metricKey: true,
    value: true,
    unit: true,
    quality: true,
    source: true,
    updatedAt: true,
  },
  report: {
    framework: true,
    status: true,
    version: true,
    dataQualityPct: true,
    updatedAt: true,
  },
  supplier: {
    name: true,
    category: true,
    naceCode: true,
    requestStatus: true,
    updatedAt: true,
  },
  complianceAssessment: {
    title: true,
    status: true,
    updatedAt: true,
  },
  complianceObligation: {
    jurisdiction: true,
    standardVersion: true,
    firstReportingFY: true,
    notes: true,
    owner: true,
    updatedAt: true,
  },
  evidence: {
    filename: true,
    mimeType: true,
    whyNote: true,
    ocrStatus: true,
    updatedAt: true,
  },
} as const;
