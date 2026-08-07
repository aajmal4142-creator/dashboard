/**
 * PCAF financed emissions attribution — pure, zero I/O.
 *
 * In-house Cat 15 / financed-emissions beachhead. This is NOT a PCAF
 * Association certification and does not use PCAF's licensed emission
 * factor database — it implements the published attribution formula
 * (PCAF Global GHG Accounting and Reporting Standard, Part A, listed
 * equity & corporate bonds asset class) and its 1–5 data-quality table.
 *
 *   attributionFactor = outstandingAmount / EVIC
 *   financedEmissions = attributionFactor × borrowerEmissions
 *
 * Missing EVIC or missing borrower emissions never produce a silent zero —
 * the result is explicitly `quality: "missing"` with the absent inputs
 * named in `missingInputs`.
 */

export type PcafDataSource =
  | "verified_reported"
  | "unverified_reported"
  | "physical_activity_primary"
  | "physical_activity_proxy"
  | "economic_activity_proxy";

/** PCAF's published 1 (best) – 5 (weakest) data-quality table for this asset class. */
export const PCAF_DATA_QUALITY_SCORE: Record<PcafDataSource, 1 | 2 | 3 | 4 | 5> = {
  verified_reported: 1,
  unverified_reported: 2,
  physical_activity_primary: 3,
  physical_activity_proxy: 4,
  economic_activity_proxy: 5,
};

export const PCAF_DATA_SOURCE_LABEL: Record<PcafDataSource, string> = {
  verified_reported: "Verified reported emissions (score 1)",
  unverified_reported: "Unverified reported emissions (score 2)",
  physical_activity_primary: "Primary physical activity data (score 3)",
  physical_activity_proxy: "Proxy physical activity / sector average (score 4)",
  economic_activity_proxy: "Economic activity proxy (revenue-based, score 5)",
};

export function isPcafDataSource(value: unknown): value is PcafDataSource {
  return (
    value === "verified_reported" ||
    value === "unverified_reported" ||
    value === "physical_activity_primary" ||
    value === "physical_activity_proxy" ||
    value === "economic_activity_proxy"
  );
}

export type PcafQuality = "measured" | "partial" | "missing";

export type PcafExposureInput = {
  outstandingAmount: number;
  /** Enterprise Value Including Cash (listed) or total equity + debt (private). */
  evic: number | null;
  borrowerScope1Tco2e: number | null;
  borrowerScope2Tco2e: number | null;
  /** Optional — PCAF only requires Scope 1+2 for this asset class; Scope 3 is additive. */
  borrowerScope3Tco2e: number | null;
  dataSource: PcafDataSource;
};

export type PcafAttributionResult = {
  outstandingAmount: number;
  attributionFactor: number | null;
  attributionQuality: PcafQuality;
  borrowerEmissionsTco2e: number | null;
  includesScope3: boolean;
  emissionsQuality: PcafQuality;
  financedEmissionsTco2e: number | null;
  financedEmissionsQuality: PcafQuality;
  dataQualityScore: 1 | 2 | 3 | 4 | 5;
  missingInputs: string[];
};

function computeAttributionFactor(
  outstandingAmount: number,
  evic: number | null,
  missingInputs: string[],
): { factor: number | null; quality: PcafQuality } {
  if (evic === null || !(evic > 0)) {
    missingInputs.push("evic");
    return { factor: null, quality: "missing" };
  }
  if (!Number.isFinite(outstandingAmount) || outstandingAmount < 0) {
    missingInputs.push("outstandingAmount");
    return { factor: null, quality: "missing" };
  }
  return { factor: outstandingAmount / evic, quality: "measured" };
}

function computeBorrowerEmissions(
  scope1: number | null,
  scope2: number | null,
  scope3: number | null,
  missingInputs: string[],
): { total: number | null; quality: PcafQuality; includesScope3: boolean } {
  const includesScope3 = scope3 !== null;
  if (scope1 === null && scope2 === null) {
    missingInputs.push("borrowerScope1Tco2e", "borrowerScope2Tco2e");
    return { total: null, quality: "missing", includesScope3 };
  }
  if (scope1 === null) missingInputs.push("borrowerScope1Tco2e");
  if (scope2 === null) missingInputs.push("borrowerScope2Tco2e");
  const total = (scope1 ?? 0) + (scope2 ?? 0) + (scope3 ?? 0);
  const quality: PcafQuality =
    scope1 === null || scope2 === null ? "partial" : "measured";
  return { total, quality, includesScope3 };
}

/** Computes attribution + financed emissions for a single exposure. Pure. */
export function computePcafAttribution(input: PcafExposureInput): PcafAttributionResult {
  const missingInputs: string[] = [];

  const { factor: attributionFactor, quality: attributionQuality } =
    computeAttributionFactor(input.outstandingAmount, input.evic, missingInputs);

  const {
    total: borrowerEmissionsTco2e,
    quality: emissionsQuality,
    includesScope3,
  } = computeBorrowerEmissions(
    input.borrowerScope1Tco2e,
    input.borrowerScope2Tco2e,
    input.borrowerScope3Tco2e,
    missingInputs,
  );

  const financedEmissionsTco2e =
    attributionFactor !== null && borrowerEmissionsTco2e !== null
      ? attributionFactor * borrowerEmissionsTco2e
      : null;

  const financedEmissionsQuality: PcafQuality =
    financedEmissionsTco2e === null
      ? "missing"
      : attributionQuality === "measured" && emissionsQuality === "measured"
        ? "measured"
        : "partial";

  return {
    outstandingAmount: input.outstandingAmount,
    attributionFactor,
    attributionQuality,
    borrowerEmissionsTco2e,
    includesScope3,
    emissionsQuality,
    financedEmissionsTco2e,
    financedEmissionsQuality,
    dataQualityScore: PCAF_DATA_QUALITY_SCORE[input.dataSource],
    missingInputs,
  };
}

export type PcafPortfolioSummary = {
  exposureCount: number;
  measuredCount: number;
  partialCount: number;
  missingCount: number;
  totalOutstanding: number;
  /** Sum of financed emissions across measured/partial rows only — missing rows never count as 0. */
  totalFinancedEmissionsTco2e: number | null;
  /** PCAF-style weighted average data-quality score, weighted by each row's financed emissions. */
  weightedDataQualityScore: number | null;
  quality: PcafQuality;
};

/** Portfolio roll-up. Missing-quality exposures are counted but never folded in as zero. */
export function summarisePcafPortfolio(
  rows: PcafAttributionResult[],
): PcafPortfolioSummary {
  let totalOutstanding = 0;
  let measuredCount = 0;
  let partialCount = 0;
  let missingCount = 0;
  let emissionsSum = 0;
  let weightedScoreNumerator = 0;
  let weightedScoreDenominator = 0;
  let anyComputed = false;

  for (const row of rows) {
    totalOutstanding += row.outstandingAmount;
    if (row.financedEmissionsQuality === "measured") measuredCount += 1;
    else if (row.financedEmissionsQuality === "partial") partialCount += 1;
    else missingCount += 1;

    if (row.financedEmissionsTco2e !== null) {
      anyComputed = true;
      emissionsSum += row.financedEmissionsTco2e;
      weightedScoreNumerator += row.financedEmissionsTco2e * row.dataQualityScore;
      weightedScoreDenominator += row.financedEmissionsTco2e;
    }
  }

  const quality: PcafQuality =
    rows.length === 0 || missingCount === rows.length
      ? "missing"
      : missingCount > 0 || partialCount > 0
        ? "partial"
        : "measured";

  return {
    exposureCount: rows.length,
    measuredCount,
    partialCount,
    missingCount,
    totalOutstanding,
    totalFinancedEmissionsTco2e: anyComputed ? emissionsSum : null,
    weightedDataQualityScore:
      weightedScoreDenominator > 0
        ? Math.round((weightedScoreNumerator / weightedScoreDenominator) * 100) / 100
        : null,
    quality,
  };
}
