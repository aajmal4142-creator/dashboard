/**
 * Base-year restatement types (GHG Protocol structural change — F19).
 * Pure. Zero I/O.
 */

export const RESTATEMENT_REASONS = [
  "acquisition",
  "divestiture",
  "merger",
  "methodology_change",
  "boundary_change",
  "outsourcing_insourcing",
  "other",
] as const;

export type RestatementReason = (typeof RESTATEMENT_REASONS)[number];

export const RESTATEMENT_STATUSES = ["draft", "final"] as const;

export type RestatementStatus = (typeof RESTATEMENT_STATUSES)[number];

export type InventoryQuality = "measured" | "missing";

/**
 * Scope totals for a base-year inventory snapshot.
 * Null means unknown — never coerce to zero.
 */
export type InventorySnapshot = {
  scope1: number | null;
  scope2: number | null;
  scope3: number | null;
  quality: InventoryQuality;
  source?: string | null;
  capturedAt?: string | null;
};

export type ScopeDelta = {
  prior: number | null;
  restated: number | null;
  /** Absolute change (restated − prior); null if either side missing. */
  absolute: number | null;
  /** Relative change vs prior; null if prior missing or prior is 0. */
  relative: number | null;
};

export type BaseYearInventoryComparison = {
  scope1: ScopeDelta;
  scope2: ScopeDelta;
  scope3: ScopeDelta;
  total: ScopeDelta;
  /** Both sides fully measured → comparable; otherwise missing. */
  quality: InventoryQuality;
  message: string | null;
};

export type DisclosureNoteInput = {
  organisationName: string;
  reason: RestatementReason;
  reasonDetail: string;
  methodologyNote: string;
  effectivePeriodLabel: string;
  baseYearPeriodLabel: string;
  comparison: BaseYearInventoryComparison | null;
  auditNarrative?: string | null;
  finalizedAt?: string | null;
};

export function isRestatementReason(value: unknown): value is RestatementReason {
  return (
    typeof value === "string" &&
    (RESTATEMENT_REASONS as readonly string[]).includes(value)
  );
}

export function isRestatementStatus(value: unknown): value is RestatementStatus {
  return (
    typeof value === "string" &&
    (RESTATEMENT_STATUSES as readonly string[]).includes(value)
  );
}
