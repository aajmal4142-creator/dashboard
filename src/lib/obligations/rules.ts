/**
 * lib/obligations/rules.ts — reviewed rules table.
 *
 * CRITICAL: Every threshold and filing date below is a PLACEHOLDER for human /
 * counsel review before production. Cite the basis in comments; do not treat
 * these as legal advice. The engine must stay conservative and confirmable.
 *
 * Pure. Zero I/O.
 */

import type { RevenueBand } from "./types";

/** Countries in the onboarding set treated as EU-operating for CSRD heuristics. */
export const EU_OPERATING_COUNTRIES = new Set(["IE", "DE", "NL"]);

/**
 * Revenue bands at or above the large-undertaking turnover proxy (~€50m).
 * Basis: CSRD "large undertaking" turnover criterion (placeholder — Omnibus /
 * delegated acts may revise; confirm before production).
 */
export const LARGE_TURNOVER_BANDS: ReadonlySet<RevenueBand> = new Set([
  "50_250m",
  "gt_250m",
]);

/**
 * Headcount at or above large-undertaking employees proxy.
 * Basis: CSRD large undertaking ≥250 employees (placeholder).
 */
export const LARGE_HEADCOUNT_MIN = 250;

/**
 * Placeholder CSRD Wave 2 calendar used when an org is likely a large
 * undertaking under the simplified/Omnibus-era schedule the product already
 * shipped (FY2027 → filing mid-2028). Confirm against current law.
 */
export const CSRD_WAVE2 = {
  wave: "2" as const,
  standardVersion: "CSRD_SIMPLIFIED" as const,
  firstReportingFY: "FY2027",
  filingDeadline: "2028-06-30",
};

/**
 * Placeholder BRSR listed calendar when India + size suggests a listed filer
 * *might* apply. Listing status is NOT inferred from size — confidence must
 * always be needs_confirmation for BRSR listed candidates.
 * Basis: SEBI BRSR for top listed entities (placeholder year).
 */
export const BRSR_LISTED_PLACEHOLDER = {
  wave: "brsr_listed" as const,
  standardVersion: "BRSR" as const,
  firstReportingFY: "FY2025",
  filingDeadline: "2026-06-30",
};

/** True when revenue band meets the large-turnover proxy. */
export function isLargeTurnover(band: RevenueBand | null): boolean {
  return band !== null && LARGE_TURNOVER_BANDS.has(band);
}

/** True when headcount meets the large-undertaking employees proxy. */
export function isLargeHeadcount(employeeCount: number | null): boolean {
  return employeeCount !== null && employeeCount >= LARGE_HEADCOUNT_MIN;
}

/**
 * Large undertaking proxy: ≥250 employees OR ≥€50m turnover band.
 * Mirrors the educational CsrdScopeChecker heuristic; not legal determination.
 */
export function isLikelyLargeUndertaking(
  employeeCount: number | null,
  revenueBand: RevenueBand | null,
): boolean {
  return isLargeHeadcount(employeeCount) || isLargeTurnover(revenueBand);
}

/**
 * Boundary helper for tests: just under / at the headcount line.
 */
export function headcountJustUnderLarge(): number {
  return LARGE_HEADCOUNT_MIN - 1;
}

export function headcountAtLarge(): number {
  return LARGE_HEADCOUNT_MIN;
}
