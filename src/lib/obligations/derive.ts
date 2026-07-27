/**
 * lib/obligations/derive.ts — map onboarding baseline → obligations.
 * Pure. Deterministic. Zero I/O.
 */

import {
  BRSR_LISTED_PLACEHOLDER,
  CSRD_WAVE2,
  EU_OPERATING_COUNTRIES,
  isLikelyLargeUndertaking,
} from "./rules";
import type {
  DeriveObligationsResult,
  DerivedInputs,
  ObligationInput,
  ObligationResult,
  RevenueBand,
} from "./types";

function toAsOfDate(asOf?: Date | string): Date {
  if (!asOf) return new Date();
  if (asOf instanceof Date) return asOf;
  return new Date(asOf);
}

function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function snapshot(input: ObligationInput, asOf: Date): DerivedInputs {
  return {
    country: input.country.toUpperCase(),
    headcount: input.employeeCount,
    revenueBand: input.revenueBand,
    asOf: toIsoDay(asOf),
  };
}

function voluntaryOutcome(inputs: DerivedInputs, reason: string): ObligationResult {
  return {
    name: "Voluntary / not in mandatory scope",
    wave: "other",
    jurisdiction: inputs.country,
    standardVersion: "VSME",
    firstReportingFY: "n/a",
    filingDeadline: null,
    reason,
    confidence: "derived",
    derivedInputs: inputs,
  };
}

/**
 * Derive compliance obligation(s) from the onboarding baseline.
 * Never fabricates a deadline for orgs not in mandatory scope.
 */
export function deriveObligations(input: ObligationInput): DeriveObligationsResult {
  const asOf = toAsOfDate(input.asOf);
  const country = input.country.trim().toUpperCase() || "XX";
  const inputs = snapshot({ ...input, country }, asOf);
  const obligations: ObligationResult[] = [];

  // --- India: SEBI BRSR (listed entities). Size does NOT prove listing. ---
  if (country === "IN") {
    obligations.push({
      name: "SEBI BRSR (if listed)",
      wave: BRSR_LISTED_PLACEHOLDER.wave,
      jurisdiction: "IN",
      standardVersion: BRSR_LISTED_PLACEHOLDER.standardVersion,
      firstReportingFY: BRSR_LISTED_PLACEHOLDER.firstReportingFY,
      filingDeadline: BRSR_LISTED_PLACEHOLDER.filingDeadline,
      reason:
        "BRSR applies to SEBI-listed entities in India. We cannot confirm your listing status from headcount or revenue bands alone — size does not determine BRSR. Confirm whether you are listed (or a value-chain filer asked by a listed buyer). The suggested filing date is a placeholder calendar only if BRSR applies to you.",
      confidence: "needs_confirmation",
      derivedInputs: inputs,
    });
    return { obligations, voluntary: false };
  }

  // --- EU-operating countries in the onboarding set: CSRD wave heuristics ---
  if (EU_OPERATING_COUNTRIES.has(country)) {
    if (isLikelyLargeUndertaking(input.employeeCount, input.revenueBand)) {
      const head =
        input.employeeCount !== null
          ? `${input.employeeCount} employees`
          : "unknown headcount";
      const rev = input.revenueBand ?? "unknown revenue";
      obligations.push({
        name: "CSRD Wave 2",
        wave: CSRD_WAVE2.wave,
        jurisdiction: "EU",
        standardVersion: CSRD_WAVE2.standardVersion,
        firstReportingFY: CSRD_WAVE2.firstReportingFY,
        filingDeadline: CSRD_WAVE2.filingDeadline,
        reason: `You're likely in CSRD Wave 2 because you operate in ${country} and meet a large-undertaking size proxy (${head}, revenue band ${rev}). Thresholds and the Wave 2 calendar are placeholders — confirm against current law and your fiscal year end.`,
        confidence: "needs_confirmation",
        derivedInputs: inputs,
      });
      return { obligations, voluntary: false };
    }

    obligations.push(
      voluntaryOutcome(
        inputs,
        `Based on ${country} plus your current size bands, you are not in a mandatory CSRD wave yet under our conservative size proxy. Buyers or banks may still ask for ESG data — you can start voluntarily with VSME-style reporting.`,
      ),
    );
    return { obligations, voluntary: true };
  }

  // --- GB / US / other non-IN, non-EU-operating: voluntary only ---
  // Do NOT route to brsr_supply on size alone — non-Indian firms are not in
  // the SEBI BRSR cascade by virtue of headcount or revenue.
  obligations.push(
    voluntaryOutcome(
      inputs,
      `You're not in mandatory CSRD or BRSR scope from this baseline (${country}). Large buyers may still send questionnaires — treat those as operational deadlines and start voluntarily if useful.`,
    ),
  );
  return { obligations, voluntary: true };
}

/** Compare two derived-input snapshots (ignores asOf). */
export function baselineFiguresEqual(
  a: Pick<DerivedInputs, "country" | "headcount" | "revenueBand"> | null | undefined,
  b: Pick<DerivedInputs, "country" | "headcount" | "revenueBand"> | null | undefined,
): boolean {
  if (!a || !b) return false;
  return (
    a.country.toUpperCase() === b.country.toUpperCase() &&
    a.headcount === b.headcount &&
    a.revenueBand === b.revenueBand
  );
}

/**
 * True when the org's current baseline differs from what was stored on a
 * manual (sticky) obligation — UI should nudge "figures changed — re-derive?"
 * without silently overwriting.
 */
export function hasBaselineDrift(
  stored: DerivedInputs | null | undefined,
  current: ObligationInput,
): boolean {
  if (!stored) return false;
  const currentSnap: Pick<DerivedInputs, "country" | "headcount" | "revenueBand"> = {
    country: current.country.toUpperCase(),
    headcount: current.employeeCount,
    revenueBand: current.revenueBand,
  };
  return !baselineFiguresEqual(stored, currentSnap);
}

/** Normalise a revenue band string from the org schema. */
export function parseRevenueBand(value: string | null | undefined): RevenueBand | null {
  if (
    value === "lt_2m" ||
    value === "2_10m" ||
    value === "10_50m" ||
    value === "50_250m" ||
    value === "gt_250m"
  ) {
    return value;
  }
  return null;
}

/** Manual overrides are sticky unless force=true. */
export function shouldSkipEngineWrite(
  existing: { source?: string | null } | null | undefined,
  force: boolean,
): boolean {
  return !force && existing?.source === "manual";
}
