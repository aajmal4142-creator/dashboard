/**
 * Pure Tier 2/3 hybrid emissions estimation.
 * Zero I/O. No double-counting. Always returns confidence (actual vs estimate).
 *
 * Option A (bottom-up): actual emissions × allocation
 * Option B (estimator): spend × industry intensity × allocation
 * Tier 3 recurses from Tier 2 the same way.
 */

import {
  emissionsFromSpendAndIntensity,
  resolveIndustryIntensity,
} from "./industryIntensity";

export const SUPPLY_TIERS = [1, 2, 3] as const;
export type SupplyTier = (typeof SUPPLY_TIERS)[number];

export const ESTIMATION_METHODS = ["actual", "industry_avg", "top_down"] as const;
export type EstimationMethod = (typeof ESTIMATION_METHODS)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export type TierNodeInput = {
  id: string;
  name: string;
  tier: SupplyTier;
  /** Spend by the immediate buyer on this node (USD). */
  spend: number;
  /** Actual reported / measured emissions (tCO₂e), if known. */
  actualEmissions: number | null;
  /**
   * NACE industry code. Required for industry_avg path.
   * Never invent — omit / null when unknown (caller must ask).
   */
  naceCode: string | null;
  /** Optional override intensity (tCO₂e per $M spend). */
  intensityOverride: number | null;
  /**
   * Supplier's total revenue / sales (USD) for allocation.
   * allocation = spend / totalRevenue when known; else 1 for spend-based estimates.
   */
  totalRevenue: number | null;
  parentId: string | null;
};

export type TierNodeResult = {
  id: string;
  name: string;
  tier: SupplyTier;
  parentId: string | null;
  spend: number;
  /** Attributable tCO₂e for this node (already allocated). */
  attributableEmissions: number;
  estimationMethod: EstimationMethod;
  confidence: ConfidenceLevel;
  /** True when industry_avg or top_down was used. */
  estimated: boolean;
  naceCode: string | null;
  intensityUsed: number | null;
  allocationPct: number;
  /** Gross emissions before allocation (actual or estimated). */
  grossEmissions: number;
};

export type Tier1CascadeResult = {
  tier1Id: string;
  tier1Name: string;
  /** Tier 1 direct (own) emissions — actual preferred, else industry estimate. */
  tier1Direct: TierNodeResult;
  tier2: TierNodeResult[];
  tier3: TierNodeResult[];
  /** Sum of Tier 2 attributable only (no Tier 1, no Tier 3). */
  tier2Total: number;
  /** Sum of Tier 3 attributable only. */
  tier3Total: number;
  /** Tier 1 direct + Tier 2 + Tier 3 (each node once). */
  totalCategory1ForSupplier: number;
  /** Comparison: industry estimate of Tier 1 alone vs actual (when both exist). */
  actualVsEstimated: {
    actual: number | null;
    estimated: number | null;
    delta: number | null;
  };
};

export type Category1Breakdown = {
  tier1Direct: number;
  tier2: number;
  tier3: number;
  /** Sum of the three — no double-count. */
  total: number;
  byTier: Array<{
    tier: SupplyTier;
    emissions: number;
    actualShare: number;
    estimatedShare: number;
    nodeCount: number;
  }>;
  nodes: TierNodeResult[];
  confidenceSummary: {
    high: number;
    medium: number;
    low: number;
  };
};

export class MissingNaceError extends Error {
  readonly code = "MISSING_NACE" as const;
  constructor(supplierId: string, supplierName: string) {
    super(
      `NACE industry code required to estimate emissions for "${supplierName}" (${supplierId}). Ask the supplier for their industry before estimating.`,
    );
    this.name = "MissingNaceError";
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Allocation fraction: spend / totalRevenue when revenue known; else 1
 * (spend-based EEIO already scopes to the buyer's spend).
 */
export function allocationFraction(spend: number, totalRevenue: number | null): number {
  if (!(spend > 0)) return 0;
  if (totalRevenue != null && totalRevenue > 0) {
    return clamp01(spend / totalRevenue);
  }
  return 1;
}

function confidenceFor(method: EstimationMethod): ConfidenceLevel {
  if (method === "actual") return "high";
  if (method === "top_down") return "medium";
  return "low";
}

/**
 * Hybrid estimate for a single node.
 * Prefer actual → else industry intensity × spend → else throw if NACE missing.
 * Optional parentGross enables top_down fallback when intensity unavailable.
 */
export function estimateNodeEmissions(
  node: TierNodeInput,
  opts?: { parentGrossEmissions?: number | null; allowTopDown?: boolean },
): TierNodeResult {
  const spend = Number.isFinite(node.spend) && node.spend > 0 ? node.spend : 0;
  const allocation = allocationFraction(spend, node.totalRevenue);

  if (
    node.actualEmissions != null &&
    Number.isFinite(node.actualEmissions) &&
    node.actualEmissions >= 0
  ) {
    const gross = node.actualEmissions;
    const attributable = round4(gross * allocation);
    return {
      id: node.id,
      name: node.name,
      tier: node.tier,
      parentId: node.parentId,
      spend,
      attributableEmissions: attributable,
      estimationMethod: "actual",
      confidence: confidenceFor("actual"),
      estimated: false,
      naceCode: node.naceCode,
      intensityUsed: null,
      allocationPct: round4(allocation * 100),
      grossEmissions: round4(gross),
    };
  }

  if (!(spend > 0)) {
    return {
      id: node.id,
      name: node.name,
      tier: node.tier,
      parentId: node.parentId,
      spend: 0,
      attributableEmissions: 0,
      estimationMethod: "industry_avg",
      confidence: "low",
      estimated: true,
      naceCode: node.naceCode,
      intensityUsed: null,
      allocationPct: 0,
      grossEmissions: 0,
    };
  }

  const override =
    node.intensityOverride != null && Number.isFinite(node.intensityOverride)
      ? node.intensityOverride
      : null;
  const intensityRow = override == null ? resolveIndustryIntensity(node.naceCode) : null;
  const intensity = override ?? intensityRow?.tco2ePerMillionUsd ?? null;

  if (intensity != null && intensity >= 0) {
    const gross = emissionsFromSpendAndIntensity(spend, intensity);
    // Spend-based estimate is already scoped to buyer's spend → allocation 1
    // unless totalRevenue was provided (then scale further).
    const useAlloc = node.totalRevenue != null && node.totalRevenue > 0;
    const attributable = round4(gross * (useAlloc ? allocation : 1));
    return {
      id: node.id,
      name: node.name,
      tier: node.tier,
      parentId: node.parentId,
      spend,
      attributableEmissions: attributable,
      estimationMethod: "industry_avg",
      confidence: confidenceFor("industry_avg"),
      estimated: true,
      naceCode: node.naceCode,
      intensityUsed: intensity,
      allocationPct: round4((useAlloc ? allocation : 1) * 100),
      grossEmissions: round4(gross),
    };
  }

  const parentGross = opts?.parentGrossEmissions;
  if (
    opts?.allowTopDown &&
    parentGross != null &&
    Number.isFinite(parentGross) &&
    parentGross > 0
  ) {
    // Top-down: attribute a share of parent gross (conservative 40% pool × allocation).
    const pool = parentGross * 0.4;
    const attributable = round4(pool * allocation);
    return {
      id: node.id,
      name: node.name,
      tier: node.tier,
      parentId: node.parentId,
      spend,
      attributableEmissions: attributable,
      estimationMethod: "top_down",
      confidence: confidenceFor("top_down"),
      estimated: true,
      naceCode: node.naceCode,
      intensityUsed: null,
      allocationPct: round4(allocation * 100),
      grossEmissions: round4(pool),
    };
  }

  // No actual, no intensity, no top-down — require NACE (never invent).
  throw new MissingNaceError(node.id, node.name);
}

/**
 * Cascade for one Tier-1 supplier and its Tier 2/3 children.
 * Each child id is counted once. Tier 3 under a Tier 2 uses that Tier 2's gross for top-down.
 */
export function calculateTier1Cascade(args: {
  tier1: TierNodeInput;
  tier2: TierNodeInput[];
  tier3: TierNodeInput[];
  allowTopDown?: boolean;
}): Tier1CascadeResult {
  const allowTopDown = args.allowTopDown === true;
  const tier1Direct = estimateNodeEmissions(args.tier1, { allowTopDown: false });

  // Industry-only estimate of Tier 1 for actual-vs-estimated comparison
  let industryEstimateOfTier1: number | null = null;
  if (args.tier1.actualEmissions != null) {
    try {
      const asEstimate = estimateNodeEmissions({
        ...args.tier1,
        actualEmissions: null,
      });
      industryEstimateOfTier1 = asEstimate.attributableEmissions;
    } catch {
      industryEstimateOfTier1 = null;
    }
  }

  const seen = new Set<string>([tier1Direct.id]);
  const tier2Results: TierNodeResult[] = [];

  for (const child of args.tier2) {
    if (seen.has(child.id)) continue;
    if (child.tier !== 2) continue;
    const result = estimateNodeEmissions(child, {
      parentGrossEmissions: tier1Direct.grossEmissions,
      allowTopDown,
    });
    seen.add(child.id);
    tier2Results.push(result);
  }

  const tier3Results: TierNodeResult[] = [];
  for (const child of args.tier3) {
    if (seen.has(child.id)) continue;
    if (child.tier !== 3) continue;
    const parent = tier2Results.find((t2) => t2.id === child.parentId);
    const result = estimateNodeEmissions(child, {
      parentGrossEmissions: parent?.grossEmissions ?? tier1Direct.grossEmissions,
      allowTopDown,
    });
    seen.add(child.id);
    tier3Results.push(result);
  }

  const tier2Total = round4(
    tier2Results.reduce((s, n) => s + n.attributableEmissions, 0),
  );
  const tier3Total = round4(
    tier3Results.reduce((s, n) => s + n.attributableEmissions, 0),
  );
  const total = round4(tier1Direct.attributableEmissions + tier2Total + tier3Total);

  const actual = args.tier1.actualEmissions;
  const estimated = industryEstimateOfTier1;
  const delta = actual != null && estimated != null ? round4(actual - estimated) : null;

  return {
    tier1Id: args.tier1.id,
    tier1Name: args.tier1.name,
    tier1Direct,
    tier2: tier2Results,
    tier3: tier3Results,
    tier2Total,
    tier3Total,
    totalCategory1ForSupplier: total,
    actualVsEstimated: { actual, estimated, delta },
  };
}

/**
 * Org-level Scope 3 Category 1 breakdown.
 * Dedupes by node id so a Tier 2 under two parents cannot be counted twice.
 */
export function composeCategory1Breakdown(
  cascades: Tier1CascadeResult[],
): Category1Breakdown {
  const byId = new Map<string, TierNodeResult>();

  for (const c of cascades) {
    if (!byId.has(c.tier1Direct.id)) byId.set(c.tier1Direct.id, c.tier1Direct);
    for (const n of c.tier2) {
      if (!byId.has(n.id)) byId.set(n.id, n);
    }
    for (const n of c.tier3) {
      if (!byId.has(n.id)) byId.set(n.id, n);
    }
  }

  const nodes = [...byId.values()];
  let tier1Direct = 0;
  let tier2 = 0;
  let tier3 = 0;
  const conf = { high: 0, medium: 0, low: 0 };

  const tierMeta: Record<
    SupplyTier,
    { emissions: number; actual: number; estimated: number; count: number }
  > = {
    1: { emissions: 0, actual: 0, estimated: 0, count: 0 },
    2: { emissions: 0, actual: 0, estimated: 0, count: 0 },
    3: { emissions: 0, actual: 0, estimated: 0, count: 0 },
  };

  for (const n of nodes) {
    conf[n.confidence] += 1;
    const meta = tierMeta[n.tier];
    meta.count += 1;
    meta.emissions += n.attributableEmissions;
    if (n.estimationMethod === "actual") meta.actual += n.attributableEmissions;
    else meta.estimated += n.attributableEmissions;

    if (n.tier === 1) tier1Direct += n.attributableEmissions;
    else if (n.tier === 2) tier2 += n.attributableEmissions;
    else tier3 += n.attributableEmissions;
  }

  return {
    tier1Direct: round4(tier1Direct),
    tier2: round4(tier2),
    tier3: round4(tier3),
    total: round4(tier1Direct + tier2 + tier3),
    byTier: ([1, 2, 3] as const).map((tier) => {
      const m = tierMeta[tier];
      return {
        tier,
        emissions: round4(m.emissions),
        actualShare: round4(m.actual),
        estimatedShare: round4(m.estimated),
        nodeCount: m.count,
      };
    }),
    nodes,
    confidenceSummary: conf,
  };
}

/**
 * Formula check helper: spend × intensity × allocation (industry path).
 * intensity = tCO₂e per $M; allocation in 0–1.
 */
export function spendTimesIntensity(
  spendUsd: number,
  tco2ePerMillionUsd: number,
  allocationPct: number,
): number {
  const alloc = clamp01(allocationPct / 100);
  return round4(emissionsFromSpendAndIntensity(spendUsd, tco2ePerMillionUsd) * alloc);
}
