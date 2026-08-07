/**
 * Scope 3 organisational boundary — inclusion/exclusion per GHG category.
 * Feature Y01. Pure. Zero I/O — callers inject persisted rows; this module
 * only merges them against the canonical 15-category catalog.
 */

import {
  getScope3CategoryDef,
  SCOPE3_CATEGORIES,
  type Scope3CategoryDef,
  type Scope3CategoryNumber,
} from "./categories";

export const SCOPE3_BOUNDARY_STATUSES = ["included", "excluded", "not_assessed"] as const;
export type Scope3BoundaryStatus = (typeof SCOPE3_BOUNDARY_STATUSES)[number];

export function isScope3BoundaryStatus(value: unknown): value is Scope3BoundaryStatus {
  return (
    typeof value === "string" &&
    (SCOPE3_BOUNDARY_STATUSES as readonly string[]).includes(value)
  );
}

/** A persisted boundary decision for one category, as loaded from storage. */
export interface Scope3BoundaryEntry {
  category: Scope3CategoryNumber;
  status: Scope3BoundaryStatus;
  rationale: string | null;
  updatedAt: string | null;
}

/** One row of the Cat 1–15 matrix: catalog definition + org decision, merged. */
export type Scope3BoundaryRow = Scope3CategoryDef & {
  status: Scope3BoundaryStatus;
  rationale: string | null;
  updatedAt: string | null;
  /** True when this category still lacks a decision — never silently "included". */
  isUndecided: boolean;
};

/**
 * Merges the canonical 15-category catalog with the org's persisted boundary
 * entries. Categories without a persisted entry are "not_assessed" — the
 * absence of a decision is never treated as inclusion or exclusion.
 */
export function buildScope3BoundaryMatrix(
  entries: readonly Scope3BoundaryEntry[],
): Scope3BoundaryRow[] {
  const byCategory = new Map(entries.map((e) => [e.category, e]));
  return SCOPE3_CATEGORIES.map((def) => {
    const entry = byCategory.get(def.number);
    const status = entry?.status ?? "not_assessed";
    return {
      ...def,
      status,
      rationale: entry?.rationale ?? null,
      updatedAt: entry?.updatedAt ?? null,
      isUndecided: status === "not_assessed",
    };
  });
}

export interface Scope3BoundarySummary {
  included: number;
  excluded: number;
  notAssessed: number;
  total: number;
}

export function summariseScope3Boundary(
  rows: readonly Scope3BoundaryRow[],
): Scope3BoundarySummary {
  let included = 0;
  let excluded = 0;
  let notAssessed = 0;
  for (const row of rows) {
    if (row.status === "included") included += 1;
    else if (row.status === "excluded") excluded += 1;
    else notAssessed += 1;
  }
  return { included, excluded, notAssessed, total: rows.length };
}

/**
 * A boundary decision to exclude a category without a documented rationale
 * is a data-quality gap, surfaced explicitly rather than hidden.
 */
export function excludedWithoutRationale(
  rows: readonly Scope3BoundaryRow[],
): Scope3CategoryNumber[] {
  return rows
    .filter((r) => r.status === "excluded" && !r.rationale?.trim())
    .map((r) => r.number);
}

export { getScope3CategoryDef };
