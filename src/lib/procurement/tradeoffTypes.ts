/**
 * Pure procurement trade-off types. Zero I/O. No Next/Payload imports.
 *
 * Compare purchase options on cost vs estimated carbon (and optional lead time).
 * Missing cost or carbon are never coerced to zero — quality is "missing".
 */

export type TradeoffQuality = "measured" | "missing";

/**
 * One purchase option. Carbon may be supplied directly as tCO₂e, or as
 * factor × quantity when `tco2e` is absent.
 */
export type PurchaseOptionInput = {
  id: string;
  name: string;
  /** Total purchase cost in org currency units. */
  cost: number | null;
  /** Direct estimated emissions in tCO₂e. */
  tco2e: number | null;
  /** Emission factor in tCO₂e per unit — used with `quantity` when `tco2e` is null. */
  factorTco2ePerUnit: number | null;
  quantity: number | null;
  /** Optional lead time in calendar days. */
  leadDays: number | null;
};

/** Relative importance of each objective. Higher = care more. Normalised before scoring. */
export type TradeoffWeights = {
  cost: number;
  carbon: number;
  lead: number;
};

export type ResolvedOption = {
  id: string;
  name: string;
  cost: number | null;
  tco2e: number | null;
  leadDays: number | null;
  /** How carbon was obtained when measured. */
  carbonSource: "direct" | "factor_x_qty" | null;
  quality: TradeoffQuality;
  message: string | null;
};

export type ScoredOption = ResolvedOption & {
  /** 0 = best among measured set on cost; null when not scored. */
  costNorm: number | null;
  carbonNorm: number | null;
  leadNorm: number | null;
  /** Lower is better. Null when quality is missing or excluded from ranking. */
  weightedScore: number | null;
  rank: number | null;
};

export type TradeoffRankResult = {
  options: ScoredOption[];
  /** Measured options only, ascending weighted score. */
  ranked: ScoredOption[];
  weights: TradeoffWeights;
  measuredCount: number;
  missingCount: number;
  quality: TradeoffQuality;
  message: string | null;
};

export type ParetoPoint = {
  id: string;
  name: string;
  cost: number;
  tco2e: number;
  leadDays: number | null;
};

export type ParetoResult = {
  /** Non-dominated measured options (cost + carbon; lead if included). */
  frontier: ParetoPoint[];
  /** Measured options dominated by at least one other. */
  dominated: ParetoPoint[];
  /** Options excluded because cost or carbon is missing. */
  excluded: ResolvedOption[];
  includeLead: boolean;
  quality: TradeoffQuality;
  message: string | null;
};

export type TradeoffComparisonResult = {
  ranked: TradeoffRankResult;
  pareto: ParetoResult;
};
