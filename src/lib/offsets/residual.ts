import type {
  CreditStatus,
  CreditType,
  OffsetLedgerSummary,
  OffsetLotInput,
  OffsetVolumeByType,
  ResidualPosition,
  ResidualQuality,
} from "./types";

const EMPTY_BY_TYPE: OffsetVolumeByType = {
  avoidance: 0,
  removal: 0,
  mixed: 0,
  other: 0,
};

function emptyByType(): OffsetVolumeByType {
  return { ...EMPTY_BY_TYPE };
}

function finiteNonNeg(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Aggregate offset lot volumes for the ledger UI.
 *
 * - Totals include every line with a finite non-negative volume.
 * - Held volume is inventory still available; retired volume claims against residual.
 * - Invalid / null volumes contribute 0 to sums (do not invent inventory figures).
 */
export function summariseOffsetLots(opts: {
  lots: OffsetLotInput[];
}): OffsetLedgerSummary {
  const byType = emptyByType();
  const byTypeRetired = emptyByType();
  let totalVolumeTco2e = 0;
  let heldVolumeTco2e = 0;
  let retiredVolumeTco2e = 0;
  let invalidLines = 0;

  for (const lot of opts.lots) {
    const vol = finiteNonNeg(lot.volumeTco2e);
    if (vol === null) {
      invalidLines += 1;
      continue;
    }
    totalVolumeTco2e += vol;
    byType[lot.creditType] = (byType[lot.creditType] ?? 0) + vol;

    if (lot.status === "held") {
      heldVolumeTco2e += vol;
    } else if (lot.status === "retired") {
      retiredVolumeTco2e += vol;
      byTypeRetired[lot.creditType] = (byTypeRetired[lot.creditType] ?? 0) + vol;
    }
  }

  let quality: ResidualQuality = "measured";
  let message: string | null = null;

  if (opts.lots.length === 0) {
    message =
      "No offset lots recorded. Retired volume is 0 until credits are entered and retired.";
  } else if (invalidLines > 0) {
    quality = "missing";
    message = `${invalidLines} lot(s) have missing or invalid volume and are excluded from totals.`;
  }

  return {
    lineCount: opts.lots.length,
    totalVolumeTco2e,
    heldVolumeTco2e,
    retiredVolumeTco2e,
    byType,
    byTypeRetired,
    quality,
    message,
  };
}

/**
 * Net residual position:
 *   residual = gross inventory − reductions − retired offsets
 *
 * Missing or invalid gross inventory / reductions → residual null, quality missing.
 * Never coerce missing inventory or reductions to zero.
 * Empty offset ledger contributes retired = 0 (explicit absence of credits).
 */
export function calculateResidual(opts: {
  grossInventoryTco2e: number | null | undefined;
  reductionsTco2e: number | null | undefined;
  lots: OffsetLotInput[];
}): ResidualPosition {
  const ledger = summariseOffsetLots({ lots: opts.lots });
  const gross = finiteNonNeg(opts.grossInventoryTco2e ?? null);
  const reductions = finiteNonNeg(opts.reductionsTco2e ?? null);

  const missingParts: string[] = [];
  if (gross === null) missingParts.push("gross inventory (tCO₂e)");
  if (reductions === null) missingParts.push("reductions (tCO₂e)");

  if (gross === null || reductions === null) {
    const base =
      ledger.message && ledger.quality === "missing" ? `${ledger.message} ` : "";
    return {
      grossInventoryTco2e: gross,
      reductionsTco2e: reductions,
      retiredOffsetsTco2e: ledger.retiredVolumeTco2e,
      heldOffsetsTco2e: ledger.heldVolumeTco2e,
      residualTco2e: null,
      quality: "missing",
      message: `${base}Enter ${missingParts.join(" and ")} to compute residual. Missing inputs are never treated as zero.`,
      ledger,
    };
  }

  const residualTco2e = gross - reductions - ledger.retiredVolumeTco2e;

  let quality: ResidualQuality = ledger.quality;
  let message = ledger.message;

  if (reductions > gross) {
    quality = quality === "missing" ? "missing" : "measured";
    message = message
      ? `${message} Reductions exceed gross inventory — review figures.`
      : "Reductions exceed gross inventory — review figures.";
  } else if (residualTco2e < 0) {
    message = message
      ? `${message} Retired offsets exceed inventory after reductions — net residual is negative.`
      : "Retired offsets exceed inventory after reductions — net residual is negative.";
  }

  return {
    grossInventoryTco2e: gross,
    reductionsTco2e: reductions,
    retiredOffsetsTco2e: ledger.retiredVolumeTco2e,
    heldOffsetsTco2e: ledger.heldVolumeTco2e,
    residualTco2e,
    quality,
    message,
    ledger,
  };
}

export function isCreditType(value: unknown): value is CreditType {
  return (
    value === "avoidance" || value === "removal" || value === "mixed" || value === "other"
  );
}

export function isCreditStatus(value: unknown): value is CreditStatus {
  return value === "held" || value === "retired";
}
