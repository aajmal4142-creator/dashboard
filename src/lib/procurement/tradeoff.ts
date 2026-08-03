import type {
  ParetoPoint,
  ParetoResult,
  PurchaseOptionInput,
  ResolvedOption,
  ScoredOption,
  TradeoffComparisonResult,
  TradeoffQuality,
  TradeoffRankResult,
  TradeoffWeights,
} from "./tradeoffTypes";

function finiteNonNeg(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
}

/**
 * Resolve estimated tCO₂e from direct value or factor × quantity.
 * Never treats missing inputs as zero.
 */
export function resolveOptionCarbon(input: PurchaseOptionInput): {
  tco2e: number | null;
  carbonSource: "direct" | "factor_x_qty" | null;
  quality: TradeoffQuality;
  message: string | null;
} {
  if (finiteNonNeg(input.tco2e)) {
    return {
      tco2e: input.tco2e,
      carbonSource: "direct",
      quality: "measured",
      message: null,
    };
  }

  if (finiteNonNeg(input.factorTco2ePerUnit) && finiteNonNeg(input.quantity)) {
    return {
      tco2e: input.factorTco2ePerUnit * input.quantity,
      carbonSource: "factor_x_qty",
      quality: "measured",
      message: null,
    };
  }

  const gaps: string[] = [];
  if (!finiteNonNeg(input.tco2e)) {
    if (!finiteNonNeg(input.factorTco2ePerUnit) || !finiteNonNeg(input.quantity)) {
      gaps.push("tCO₂e (or factor × quantity)");
    }
  }

  return {
    tco2e: null,
    carbonSource: null,
    quality: "missing",
    message: `Missing or invalid: ${gaps.join(", ") || "carbon"}. Values are never treated as zero.`,
  };
}

/**
 * Resolve cost + carbon (+ optional lead) for one option.
 */
export function evaluateOption(
  input: PurchaseOptionInput,
  opts?: { requireLead?: boolean },
): ResolvedOption {
  const carbon = resolveOptionCarbon(input);
  const cost = finiteNonNeg(input.cost) ? input.cost : null;
  const leadDays = finiteNonNeg(input.leadDays) ? input.leadDays : null;

  const gaps: string[] = [];
  if (cost === null) gaps.push("cost");
  if (carbon.quality === "missing") {
    gaps.push("tCO₂e (or factor × quantity)");
  }
  if (opts?.requireLead && leadDays === null) {
    gaps.push("lead days");
  }

  if (gaps.length > 0) {
    return {
      id: input.id,
      name: input.name,
      cost,
      tco2e: carbon.tco2e,
      leadDays,
      carbonSource: carbon.carbonSource,
      quality: "missing",
      message: `Missing or invalid: ${gaps.join(", ")}. Values are never treated as zero.`,
    };
  }

  return {
    id: input.id,
    name: input.name,
    cost,
    tco2e: carbon.tco2e,
    leadDays,
    carbonSource: carbon.carbonSource,
    quality: "measured",
    message: null,
  };
}

/**
 * Normalise weights to sum to 1. Non-finite or negative values become 0.
 * If all active weights are zero, equal-weight among dimensions with positive
 * presence in `active` (defaults to cost+carbon; lead only when weightLead requested).
 */
export function normalizeWeights(
  weights: TradeoffWeights,
  opts?: { includeLead?: boolean },
): TradeoffWeights {
  const includeLead = opts?.includeLead ?? weights.lead > 0;
  const cost = Number.isFinite(weights.cost) && weights.cost > 0 ? weights.cost : 0;
  const carbon =
    Number.isFinite(weights.carbon) && weights.carbon > 0 ? weights.carbon : 0;
  const lead =
    includeLead && Number.isFinite(weights.lead) && weights.lead > 0 ? weights.lead : 0;

  const sum = cost + carbon + lead;
  if (sum > 0) {
    return { cost: cost / sum, carbon: carbon / sum, lead: lead / sum };
  }

  if (includeLead) {
    return { cost: 1 / 3, carbon: 1 / 3, lead: 1 / 3 };
  }
  return { cost: 0.5, carbon: 0.5, lead: 0 };
}

function minMaxNorm(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Rank options by weighted score. Lower cost, carbon, and lead are better.
 * Missing-quality options are excluded from ranking (rank null).
 */
export function rankByWeightedScore(
  inputs: PurchaseOptionInput[],
  rawWeights: TradeoffWeights,
): TradeoffRankResult {
  const includeLead = Number.isFinite(rawWeights.lead) && rawWeights.lead > 0;
  const weights = normalizeWeights(rawWeights, { includeLead });
  const requireLead = weights.lead > 0;

  const resolved = inputs.map((o) => evaluateOption(o, { requireLead }));
  const measured = resolved.filter((o) => o.quality === "measured");
  const missingCount = resolved.length - measured.length;

  if (measured.length === 0) {
    const options: ScoredOption[] = resolved.map((o) => ({
      ...o,
      costNorm: null,
      carbonNorm: null,
      leadNorm: null,
      weightedScore: null,
      rank: null,
    }));
    return {
      options,
      ranked: [],
      weights,
      measuredCount: 0,
      missingCount,
      quality: "missing",
      message:
        missingCount > 0
          ? "No options have measurable cost and carbon. Missing values are never treated as zero."
          : "Add at least one purchase option with cost and estimated carbon.",
    };
  }

  const costs = measured.map((o) => o.cost as number);
  const carbons = measured.map((o) => o.tco2e as number);
  const leads = measured.map((o) => (requireLead ? (o.leadDays as number) : 0));

  const costMin = Math.min(...costs);
  const costMax = Math.max(...costs);
  const carbonMin = Math.min(...carbons);
  const carbonMax = Math.max(...carbons);
  const leadMin = Math.min(...leads);
  const leadMax = Math.max(...leads);

  const scoredMeasured: ScoredOption[] = measured.map((o) => {
    const costNorm = minMaxNorm(o.cost as number, costMin, costMax);
    const carbonNorm = minMaxNorm(o.tco2e as number, carbonMin, carbonMax);
    const leadNorm = requireLead ? minMaxNorm(o.leadDays as number, leadMin, leadMax) : 0;
    const weightedScore =
      weights.cost * costNorm + weights.carbon * carbonNorm + weights.lead * leadNorm;
    return {
      ...o,
      costNorm,
      carbonNorm: carbonNorm,
      leadNorm: requireLead ? leadNorm : null,
      weightedScore,
      rank: null,
    };
  });

  const ranked = scoredMeasured
    .slice()
    .sort((a, b) => {
      const sa = a.weightedScore as number;
      const sb = b.weightedScore as number;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    })
    .map((o, i) => ({ ...o, rank: i + 1 }));

  const byId = new Map(ranked.map((o) => [o.id, o]));
  const options: ScoredOption[] = resolved.map((o) => {
    const hit = byId.get(o.id);
    if (hit) return hit;
    return {
      ...o,
      costNorm: null,
      carbonNorm: null,
      leadNorm: null,
      weightedScore: null,
      rank: null,
    };
  });

  return {
    options,
    ranked,
    weights,
    measuredCount: ranked.length,
    missingCount,
    quality: missingCount > 0 ? "missing" : "measured",
    message:
      missingCount > 0
        ? `${missingCount} option(s) excluded from ranking — missing cost or carbon (never treated as zero).`
        : null,
  };
}

function toParetoPoint(o: ResolvedOption): ParetoPoint | null {
  if (o.quality !== "measured" || o.cost === null || o.tco2e === null) {
    return null;
  }
  return {
    id: o.id,
    name: o.name,
    cost: o.cost,
    tco2e: o.tco2e,
    leadDays: o.leadDays,
  };
}

function dominates(a: ParetoPoint, b: ParetoPoint, includeLead: boolean): boolean {
  const costLe = a.cost <= b.cost;
  const carbonLe = a.tco2e <= b.tco2e;
  let leadLe = true;
  if (includeLead) {
    const al = a.leadDays;
    const bl = b.leadDays;
    if (al === null || bl === null) return false;
    leadLe = al <= bl;
  }

  if (!(costLe && carbonLe && leadLe)) return false;

  const costLt = a.cost < b.cost;
  const carbonLt = a.tco2e < b.tco2e;
  let leadLt = false;
  if (includeLead && a.leadDays !== null && b.leadDays !== null) {
    leadLt = a.leadDays < b.leadDays;
  }

  return costLt || carbonLt || leadLt;
}

/**
 * Pareto frontier on cost and carbon (and lead when `includeLead`).
 * Lower is better on every objective. Missing options are excluded.
 */
export function findParetoFront(
  inputs: PurchaseOptionInput[],
  opts?: { includeLead?: boolean },
): ParetoResult {
  const includeLead = opts?.includeLead ?? false;
  const resolved = inputs.map((o) => evaluateOption(o, { requireLead: includeLead }));
  const excluded = resolved.filter((o) => o.quality === "missing");
  const points = resolved.map(toParetoPoint).filter((p): p is ParetoPoint => p !== null);

  if (points.length === 0) {
    return {
      frontier: [],
      dominated: [],
      excluded,
      includeLead,
      quality: "missing",
      message:
        excluded.length > 0
          ? "No options have measurable cost and carbon for a Pareto front. Missing values are never treated as zero."
          : "Add at least one purchase option with cost and estimated carbon.",
    };
  }

  const frontier: ParetoPoint[] = [];
  const dominated: ParetoPoint[] = [];

  for (const candidate of points) {
    const isDominated = points.some(
      (other) => other.id !== candidate.id && dominates(other, candidate, includeLead),
    );
    if (isDominated) dominated.push(candidate);
    else frontier.push(candidate);
  }

  frontier.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.tco2e !== b.tco2e) return a.tco2e - b.tco2e;
    return a.name.localeCompare(b.name);
  });

  return {
    frontier,
    dominated,
    excluded,
    includeLead,
    quality: excluded.length > 0 ? "missing" : "measured",
    message:
      excluded.length > 0
        ? `${excluded.length} option(s) excluded from Pareto — missing cost or carbon (never treated as zero).`
        : null,
  };
}

/**
 * Full comparison: weighted ranking + Pareto frontier.
 */
export function buildTradeoffComparison(
  inputs: PurchaseOptionInput[],
  rawWeights: TradeoffWeights,
): TradeoffComparisonResult {
  const ranked = rankByWeightedScore(inputs, rawWeights);
  const includeLead = ranked.weights.lead > 0;
  const pareto = findParetoFront(inputs, { includeLead });
  return { ranked, pareto };
}
