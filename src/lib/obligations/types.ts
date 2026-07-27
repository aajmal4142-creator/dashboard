/**
 * lib/obligations/types.ts — Phase 1 obligation engine.
 * Pure types. Zero I/O, zero framework imports.
 *
 * Thresholds and dates in the rules table are PLACEHOLDERS for human legal
 * review. Product voice is always "likely in scope," never authoritative.
 */

export type RevenueBand = "lt_2m" | "2_10m" | "10_50m" | "50_250m" | "gt_250m";

export type ObligationWave = "1" | "2" | "3" | "brsr_listed" | "brsr_supply" | "other";

export type ObligationStandard =
  "CSRD_SET1" | "CSRD_SIMPLIFIED" | "BRSR" | "VSME" | "GRI";

export type ObligationConfidence = "derived" | "needs_confirmation";

export type ObligationSource = "engine" | "manual";

/** Baseline snapshot used at derivation time (also persisted on the obligation). */
export type DerivedInputs = {
  country: string;
  headcount: number | null;
  revenueBand: RevenueBand | null;
  /** ISO date (YYYY-MM-DD) the rules were evaluated against. */
  asOf: string;
};

export type ObligationInput = {
  country: string;
  /** FTE headcount; null if unknown. */
  employeeCount: number | null;
  revenueBand: RevenueBand | null;
  /** Override "today" for deterministic tests. Defaults to UTC now. */
  asOf?: Date | string;
};

export type ObligationResult = {
  /** Short display name, e.g. "CSRD Wave 2". */
  name: string;
  wave: ObligationWave;
  jurisdiction: string;
  standardVersion: ObligationStandard;
  firstReportingFY: string;
  /**
   * ISO date (YYYY-MM-DD) or null.
   * Null = not in mandatory scope — NEVER invent a deadline for voluntary outcomes.
   */
  filingDeadline: string | null;
  /** Plain-language reason shown to the user. */
  reason: string;
  confidence: ObligationConfidence;
  derivedInputs: DerivedInputs;
};

export type DeriveObligationsResult = {
  obligations: ObligationResult[];
  /** True when no mandatory rule matched. */
  voluntary: boolean;
};
