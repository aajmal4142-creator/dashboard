/**
 * lib/calc/resolveFactor.ts — BUILD_PLAN §5, hard rule 1.
 *
 * Fallback ladder, in order, first match wins:
 *   1. exact region + year
 *   2. region + latest available year (any year)
 *   3. GLOBAL + year
 *
 * When `standard` is provided, only rows tagged with that methodology are considered.
 *
 * If nothing matches, throw. Never silently default — a wrong factor is a filing error.
 */
import type { FactorRecord } from "./types";

const GLOBAL_REGION = "GLOBAL";

function yearOf(dateStr: string): number {
  return new Date(dateStr).getUTCFullYear();
}

/**
 * True if `year` falls inside the factor's validity window when one is declared,
 * otherwise true only if it matches the factor's publication year.
 */
function coversYear(factor: FactorRecord, year: number): boolean {
  if (factor.validFrom !== undefined || factor.validUntil !== undefined) {
    const from = factor.validFrom !== undefined ? yearOf(factor.validFrom) : -Infinity;
    const until = factor.validUntil !== undefined ? yearOf(factor.validUntil) : Infinity;
    return year >= from && year <= until;
  }
  return factor.publicationYear === year;
}

function latestOf(candidates: FactorRecord[]): FactorRecord {
  return candidates.reduce((latest, current) =>
    current.publicationYear > latest.publicationYear ? current : latest,
  );
}

export function resolveFactor(
  factors: FactorRecord[],
  key: string,
  region: string,
  year: number,
  standard?: string,
): FactorRecord {
  let byKey = factors.filter((f) => f.key === key);
  if (standard !== undefined) {
    byKey = byKey.filter((f) => f.standard === standard);
  }

  const exactRegionYear = byKey.filter((f) => f.region === region && coversYear(f, year));
  if (exactRegionYear.length > 0) return latestOf(exactRegionYear);

  const regionAnyYear = byKey.filter((f) => f.region === region);
  if (regionAnyYear.length > 0) return latestOf(regionAnyYear);

  const globalYear = byKey.filter(
    (f) => f.region === GLOBAL_REGION && coversYear(f, year),
  );
  if (globalYear.length > 0) return latestOf(globalYear);

  const standardClause = standard !== undefined ? ` standard="${standard}"` : "";
  throw new Error(
    `resolveFactor: no factor for key="${key}" region="${region}" year=${year}${standardClause}. ` +
      `Checked exact region+year, region+latest, and GLOBAL+year — refusing to silently default.`,
  );
}
