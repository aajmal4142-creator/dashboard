import type {
  AbatementLeverCategory,
  AbatementLeverInput,
  LeverCostResult,
  LeverRoiResult,
  MaccBuildResult,
  MaccCurvePoint,
  MaccQuality,
} from "./maccTypes";

const CATEGORIES: readonly AbatementLeverCategory[] = [
  "energy_efficiency",
  "renewable_electricity",
  "process_fuel",
  "fleet_transport",
  "nature_offsets",
  "other",
] as const;

export function isAbatementLeverCategory(
  value: unknown,
): value is AbatementLeverCategory {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function finiteNonNeg(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
}

function finitePositive(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

/**
 * Annualised abatement cost and cost per tCO₂e for one lever.
 * Never treats missing fields as zero.
 */
export function calculateLeverCost(input: AbatementLeverInput): LeverCostResult {
  const base = {
    id: input.id,
    name: input.name,
    category: input.category,
    annualAbatementTco2e: finiteNonNeg(input.annualAbatementTco2e)
      ? input.annualAbatementTco2e
      : null,
    capex: finiteNonNeg(input.capex) ? input.capex : null,
    opexPerYear: finiteNonNeg(input.opexPerYear) ? input.opexPerYear : null,
    lifetimeYears: finitePositive(input.lifetimeYears)
      ? Math.floor(input.lifetimeYears)
      : null,
  };

  const gaps: string[] = [];
  if (base.annualAbatementTco2e === null) {
    gaps.push("annual abatement");
  } else if (base.annualAbatementTco2e === 0) {
    gaps.push("annual abatement (must be > 0 for cost/tCO₂e)");
  }
  if (base.capex === null) gaps.push("CAPEX");
  if (base.opexPerYear === null) gaps.push("OPEX/year");
  if (base.lifetimeYears === null) gaps.push("lifetime years");

  if (gaps.length > 0) {
    return {
      ...base,
      annualisedCost: null,
      costPerTco2e: null,
      lifetimeCost: null,
      lifetimeAbatementTco2e: null,
      quality: "missing",
      message: `Missing or invalid: ${gaps.join(", ")}. Values are never treated as zero.`,
    };
  }

  const annualAbatementTco2e = base.annualAbatementTco2e as number;
  const capex = base.capex as number;
  const opexPerYear = base.opexPerYear as number;
  const lifetimeYears = base.lifetimeYears as number;

  const annualisedCost = capex / lifetimeYears + opexPerYear;
  const costPerTco2e = annualisedCost / annualAbatementTco2e;
  const lifetimeCost = capex + opexPerYear * lifetimeYears;
  const lifetimeAbatementTco2e = annualAbatementTco2e * lifetimeYears;

  return {
    ...base,
    annualisedCost,
    costPerTco2e,
    lifetimeCost,
    lifetimeAbatementTco2e,
    quality: "measured",
    message: null,
  };
}

/**
 * Sort measured levers by ascending cost/tCO₂e (classic MACC order).
 * Missing-quality levers are excluded from ranking.
 */
export function sortLeversByCostPerTco2e(levers: LeverCostResult[]): LeverCostResult[] {
  return levers
    .filter(
      (l) =>
        l.quality === "measured" &&
        l.costPerTco2e !== null &&
        Number.isFinite(l.costPerTco2e),
    )
    .slice()
    .sort((a, b) => {
      const ca = a.costPerTco2e as number;
      const cb = b.costPerTco2e as number;
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Build step-curve points from ranked measured levers.
 * X axis = cumulative annual abatement (tCO₂e/year); Y = cost/tCO₂e.
 */
export function buildMaccCurvePoints(ranked: LeverCostResult[]): MaccCurvePoint[] {
  const points: MaccCurvePoint[] = [];
  let cumulative = 0;

  for (const lever of ranked) {
    if (
      lever.costPerTco2e === null ||
      lever.annualAbatementTco2e === null ||
      lever.annualisedCost === null
    ) {
      continue;
    }
    const start = cumulative;
    cumulative += lever.annualAbatementTco2e;
    points.push({
      id: lever.id,
      name: lever.name,
      category: lever.category,
      abatementStart: start,
      abatementEnd: cumulative,
      annualAbatementTco2e: lever.annualAbatementTco2e,
      costPerTco2e: lever.costPerTco2e,
      annualisedCost: lever.annualisedCost,
    });
  }

  return points;
}

/**
 * ROI / payback against an operator-supplied carbon price (same currency as CAPEX/OPEX).
 * Missing carbon price → all ROI rows quality missing (never invent a price).
 */
export function calculateLeverRoi(
  lever: LeverCostResult,
  carbonPricePerTco2e: number | null,
): LeverRoiResult {
  if (
    carbonPricePerTco2e === null ||
    !Number.isFinite(carbonPricePerTco2e) ||
    carbonPricePerTco2e < 0
  ) {
    return {
      id: lever.id,
      lifetimeRoi: null,
      paybackYears: null,
      annualNetBenefit: null,
      lifetimeNetBenefit: null,
      quality: "missing",
      message:
        "Carbon price (€ or org currency / tCO₂e) is not set — ROI and payback cannot be computed.",
    };
  }

  if (
    lever.quality !== "measured" ||
    lever.annualAbatementTco2e === null ||
    lever.capex === null ||
    lever.opexPerYear === null ||
    lever.lifetimeYears === null ||
    lever.lifetimeCost === null ||
    lever.lifetimeAbatementTco2e === null
  ) {
    return {
      id: lever.id,
      lifetimeRoi: null,
      paybackYears: null,
      annualNetBenefit: null,
      lifetimeNetBenefit: null,
      quality: "missing",
      message: lever.message ?? "Lever costs or abatement incomplete for ROI.",
    };
  }

  const annualNetBenefit =
    lever.annualAbatementTco2e * carbonPricePerTco2e - lever.opexPerYear;
  const lifetimeNetBenefit =
    lever.lifetimeAbatementTco2e * carbonPricePerTco2e - lever.lifetimeCost;
  const lifetimeRoi =
    lever.lifetimeCost > 0
      ? lifetimeNetBenefit / lever.lifetimeCost
      : lifetimeNetBenefit > 0
        ? null
        : 0;

  let paybackYears: number | null = null;
  if (annualNetBenefit > 0) {
    paybackYears = lever.capex / annualNetBenefit;
  }

  return {
    id: lever.id,
    lifetimeRoi,
    paybackYears,
    annualNetBenefit,
    lifetimeNetBenefit,
    quality: "measured",
    message:
      annualNetBenefit <= 0
        ? "Annual net benefit ≤ 0 at this carbon price — payback is undefined."
        : null,
  };
}

export type BuildMaccOptions = {
  levers: AbatementLeverInput[];
  /** Optional carbon price for ROI helpers. Missing → roi is null on the result. */
  carbonPricePerTco2e?: number | null;
  /**
   * When true, refuse to return a curve if any lever is missing quality.
   * Default false: curve includes measured levers only; aggregate quality reflects gaps.
   */
  strict?: boolean;
};

/**
 * Full MACC build: per-lever costs → sort → cumulative curve → optional ROI.
 */
export function buildMacc(opts: BuildMaccOptions): MaccBuildResult {
  const levers = opts.levers.map(calculateLeverCost);
  const measuredCount = levers.filter((l) => l.quality === "measured").length;
  const missingCount = levers.length - measuredCount;

  if (opts.strict && missingCount > 0) {
    const names = levers
      .filter((l) => l.quality === "missing")
      .map((l) => l.name)
      .join(", ");
    throw new Error(
      `Cannot build MACC: ${missingCount} lever(s) have missing costs or abatement (${names}). Enter complete values or omit incomplete levers.`,
    );
  }

  const ranked = sortLeversByCostPerTco2e(levers);
  const curve = buildMaccCurvePoints(ranked);

  let totalAnnualAbatementTco2e: number | null = null;
  let totalAnnualisedCost: number | null = null;
  let weightedAverageCostPerTco2e: number | null = null;

  if (ranked.length > 0) {
    let abatementSum = 0;
    let costSum = 0;
    for (const l of ranked) {
      abatementSum += l.annualAbatementTco2e as number;
      costSum += l.annualisedCost as number;
    }
    totalAnnualAbatementTco2e = abatementSum;
    totalAnnualisedCost = costSum;
    weightedAverageCostPerTco2e = abatementSum > 0 ? costSum / abatementSum : null;
  }

  let quality: MaccQuality = "measured";
  let message: string | null = null;

  if (levers.length === 0) {
    quality = "missing";
    message =
      "No abatement levers. Add levers with CAPEX, OPEX, lifetime, and abatement.";
  } else if (missingCount > 0) {
    quality = "missing";
    message = `${missingCount} lever(s) excluded from the curve due to missing or invalid costs/abatement.`;
  } else if (ranked.length === 0) {
    quality = "missing";
    message = "No measured levers available for the MACC curve.";
  }

  const carbonPrice =
    opts.carbonPricePerTco2e === undefined ? null : opts.carbonPricePerTco2e;

  const roi =
    carbonPrice === null ? null : levers.map((l) => calculateLeverRoi(l, carbonPrice));

  if (roi && carbonPrice !== null) {
    const roiMissing = roi.filter((r) => r.quality === "missing").length;
    if (roiMissing === roi.length && roi.length > 0) {
      quality = "missing";
      message = message
        ? `${message} ROI incomplete for all levers.`
        : "ROI incomplete — check carbon price and lever completeness.";
    }
  }

  return {
    levers,
    ranked,
    curve,
    totalAnnualAbatementTco2e,
    totalAnnualisedCost,
    weightedAverageCostPerTco2e,
    measuredCount,
    missingCount,
    quality,
    message,
    roi,
  };
}
