/**
 * Pure residual-emissions / carbon-credit types.
 * Zero I/O. No Next/Payload imports.
 *
 * Net position: inventory − reductions − retired credits.
 * Missing inventory or reductions → quality "missing"; never silent zero.
 * Empty credit ledger → retired volume 0 (measured absence of offsets).
 *
 * Energy certificates (REC / GO / EAC) are out of scope — see lib/certificates.
 */

export type CreditType = "avoidance" | "removal" | "mixed" | "other";

export type CreditStatus = "held" | "retired";

export type ResidualQuality = "measured" | "missing";

export type OffsetLotInput = {
  volumeTco2e: number | null;
  status: CreditStatus;
  creditType: CreditType;
};

export type OffsetVolumeByType = Record<CreditType, number>;

export type OffsetLedgerSummary = {
  lineCount: number;
  totalVolumeTco2e: number;
  heldVolumeTco2e: number;
  retiredVolumeTco2e: number;
  byType: OffsetVolumeByType;
  byTypeRetired: OffsetVolumeByType;
  quality: ResidualQuality;
  message: string | null;
};

/**
 * Residual / net position after inventory reductions and retired offsets.
 * residualTco2e is null when inventory or reductions input is incomplete.
 */
export type ResidualPosition = {
  grossInventoryTco2e: number | null;
  reductionsTco2e: number | null;
  retiredOffsetsTco2e: number;
  heldOffsetsTco2e: number;
  /** gross − reductions − retired; null when inputs incomplete. */
  residualTco2e: number | null;
  quality: ResidualQuality;
  message: string | null;
  ledger: OffsetLedgerSummary;
};
