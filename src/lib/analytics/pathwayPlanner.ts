/**
 * Decarbonization pathway planning — pure functions, zero I/O.
 * Work backward from target → required reductions → milestones + feasibility.
 */

export type MilestoneStatus = "planned" | "in_progress" | "completed" | "missed";

export type PathwayScope = "1" | "2" | "3" | "cross";

export type FeasibilityLevel = "achievable" | "aggressive" | "unrealistic";

/** Configurable intervention template — never the sole source; callers may override. */
export type InterventionTemplate = {
  id: string;
  action: string;
  scope: PathwayScope;
  /** Absolute tCO2e reduction this intervention can deliver (one-shot / annualised). */
  emissionsSaved: number;
  cost: number;
};

export type PathwayMilestone = {
  year: number;
  action: string;
  emissionsSaved: number;
  cost: number;
  status: MilestoneStatus;
  scope: PathwayScope;
  /** Running total of emissionsSaved through this milestone. */
  cumulativeEmissionsSaved: number;
  /** Pathway emissions level after applying this milestone. */
  pathwayEmissions: number;
};

export type PathwayTimelinePoint = {
  year: number;
  /** Flat baseline (no action). */
  baselineHold: number;
  /** Emissions on the planned pathway. */
  pathwayEmissions: number;
  isMilestone: boolean;
};

export type FeasibilityResult = {
  baselineEmissions: number;
  targetEmissions: number;
  years: number;
  requiredAnnualReduction: number;
  requiredAnnualReductionPercent: number;
  /** Typical peer annual reduction % (injected; default used only as reference). */
  peerTypicalAnnualPercent: number;
  level: FeasibilityLevel;
  warning: string | null;
  message: string;
};

export type PathwayPlanInput = {
  baselineEmissions: number;
  targetEmissions: number;
  baselineYear: number;
  targetYear: number;
  name?: string;
  /** Even pace (default) or caller-supplied year→share weights. */
  distribution?: "even" | "front_loaded" | "back_loaded";
  /** User-selected / scenario-derived interventions. */
  interventions?: InterventionTemplate[];
  /**
   * Fallback templates when interventions are empty.
   * Must be injectable — do not rely on hardcode-only defaults for production plans.
   */
  interventionTemplates?: InterventionTemplate[];
  /** Peer org typical YoY reduction % for feasibility comparison (default 5). */
  peerTypicalAnnualPercent?: number;
  /** Aggressive flag threshold as fraction of baseline (default 0.15 = 15%). */
  aggressiveThresholdPercent?: number;
};

export type PathwayPlanResult = {
  name: string;
  baselineYear: number;
  targetYear: number;
  baselineEmissions: number;
  targetEmissions: number;
  targetReduction: number;
  milestones: PathwayMilestone[];
  feasibility: FeasibilityResult;
  timeline: PathwayTimelinePoint[];
  costEstimate: number;
  scienceBasedTargetAlignment: {
    warming1_5C: boolean;
    warming2_0C: boolean;
    alignedWith: string;
  };
};

export type ActualProgressInput = {
  baselineEmissions: number;
  targetEmissions: number;
  baselineYear: number;
  targetYear: number;
  asOfYear: number;
  actualEmissions: number;
  milestones?: PathwayMilestone[];
};

export type ActualProgressComparison = {
  asOfYear: number;
  expectedEmissions: number;
  actualEmissions: number;
  varianceTco2e: number;
  /** Positive = ahead of pathway (lower emissions than expected). */
  aheadByTco2e: number;
  status: "ahead" | "on_track" | "behind";
  onTrack: boolean;
  message: string;
};

/** Default templates — configurable overrides via PathwayPlanInput.interventionTemplates. */
export const DEFAULT_INTERVENTION_TEMPLATES: InterventionTemplate[] = [
  {
    id: "scope1-fleet",
    action: "Switch to electric fleet",
    scope: "1",
    emissionsSaved: 500,
    cost: 250_000,
  },
  {
    id: "scope2-renewable",
    action: "Renewable energy transition",
    scope: "2",
    emissionsSaved: 200,
    cost: 120_000,
  },
  {
    id: "scope3-suppliers",
    action: "Supplier engagement program",
    scope: "3",
    emissionsSaved: 100,
    cost: 40_000,
  },
];

const SBTi_TARGETS = {
  warming1_5C: { annual_reduction: 0.07 },
  warming2_0C: { annual_reduction: 0.042 },
} as const;

const DEFAULT_PEER_TYPICAL_PERCENT = 5;
const DEFAULT_AGGRESSIVE_THRESHOLD = 15;
/** Variance within this band of expected = on_track. */
const ON_TRACK_TOLERANCE_FRACTION = 0.05;

export function validatePathwayTargets(args: {
  baselineEmissions: number;
  targetEmissions: number;
  baselineYear: number;
  targetYear: number;
}): string | null {
  const { baselineEmissions, targetEmissions, baselineYear, targetYear } = args;
  if (!Number.isFinite(baselineEmissions) || !(baselineEmissions > 0)) {
    return "baselineEmissions must be a finite number greater than zero";
  }
  if (!Number.isFinite(targetEmissions) || targetEmissions < 0) {
    return "targetEmissions must be a finite number ≥ 0";
  }
  if (targetEmissions > baselineEmissions) {
    return "targetEmissions must not exceed baselineEmissions";
  }
  if (!Number.isInteger(baselineYear) || !Number.isInteger(targetYear)) {
    return "baselineYear and targetYear must be integers";
  }
  if (targetYear <= baselineYear) {
    return "targetYear must be after baselineYear";
  }
  return null;
}

/**
 * Required annual reduction = (baseline − target) / years.
 */
export function calculateRequiredAnnualReduction(
  baselineEmissions: number,
  targetEmissions: number,
  years: number,
): { absolute: number; percentOfBaseline: number } {
  if (!(years > 0)) {
    throw new Error("years must be greater than zero");
  }
  const absolute = (baselineEmissions - targetEmissions) / years;
  const percentOfBaseline =
    baselineEmissions > 0 ? (absolute / baselineEmissions) * 100 : 0;
  return { absolute, percentOfBaseline };
}

/**
 * Feasibility: green ≤ peer-typical band, yellow up to 15%, red >15% annual.
 * Unrealistic pathways always include a warning (must not be silent).
 */
export function calculateFeasibility(args: {
  baselineEmissions: number;
  targetEmissions: number;
  baselineYear: number;
  targetYear: number;
  peerTypicalAnnualPercent?: number;
  aggressiveThresholdPercent?: number;
}): FeasibilityResult {
  const validation = validatePathwayTargets(args);
  if (validation) {
    throw new Error(validation);
  }

  const years = args.targetYear - args.baselineYear;
  const peerTypical = args.peerTypicalAnnualPercent ?? DEFAULT_PEER_TYPICAL_PERCENT;
  const aggressiveThreshold =
    args.aggressiveThresholdPercent ?? DEFAULT_AGGRESSIVE_THRESHOLD;

  const { absolute, percentOfBaseline } = calculateRequiredAnnualReduction(
    args.baselineEmissions,
    args.targetEmissions,
    years,
  );

  let level: FeasibilityLevel;
  let warning: string | null = null;
  let message: string;

  if (percentOfBaseline > aggressiveThreshold) {
    level = "unrealistic";
    warning = `Required annual reduction of ${percentOfBaseline.toFixed(1)}% exceeds ${aggressiveThreshold}% — very aggressive relative to typical peer achievements (~${peerTypical}%/year). Revise target year, target level, or interventions.`;
    message = "Unrealistic with current trajectory";
  } else if (percentOfBaseline > peerTypical * 1.4 || percentOfBaseline > 10) {
    level = "aggressive";
    warning = `Required annual reduction of ${percentOfBaseline.toFixed(1)}% is aggressive versus typical peer achievements (~${peerTypical}%/year). Sustained intervention delivery is required.`;
    message = "Requires aggressive action";
  } else {
    level = "achievable";
    message = "Path is achievable";
  }

  return {
    baselineEmissions: args.baselineEmissions,
    targetEmissions: args.targetEmissions,
    years,
    requiredAnnualReduction: absolute,
    requiredAnnualReductionPercent: percentOfBaseline,
    peerTypicalAnnualPercent: peerTypical,
    level,
    warning,
    message,
  };
}

/**
 * Distribute total reduction across years (even / front / back loaded).
 * Returns per-year absolute reduction for years baselineYear+1 … targetYear.
 */
export function distributeReductionsAcrossYears(args: {
  totalReduction: number;
  baselineYear: number;
  targetYear: number;
  distribution?: "even" | "front_loaded" | "back_loaded";
}): Array<{ year: number; reduction: number }> {
  const years = args.targetYear - args.baselineYear;
  if (!(years > 0)) {
    throw new Error("targetYear must be after baselineYear");
  }
  const mode = args.distribution ?? "even";
  const weights: number[] = [];

  for (let i = 0; i < years; i++) {
    if (mode === "even") {
      weights.push(1);
    } else if (mode === "front_loaded") {
      weights.push(years - i);
    } else {
      weights.push(i + 1);
    }
  }

  const weightSum = weights.reduce((a, b) => a + b, 0);
  const out: Array<{ year: number; reduction: number }> = [];
  let allocated = 0;

  for (let i = 0; i < years; i++) {
    const year = args.baselineYear + 1 + i;
    const isLast = i === years - 1;
    const reduction = isLast
      ? args.totalReduction - allocated
      : (args.totalReduction * weights[i]!) / weightSum;
    allocated += reduction;
    out.push({ year, reduction });
  }

  return out;
}

function pickTemplates(
  interventions: InterventionTemplate[] | undefined,
  templates: InterventionTemplate[] | undefined,
): InterventionTemplate[] {
  if (interventions && interventions.length > 0) return interventions;
  if (templates && templates.length > 0) return templates;
  return DEFAULT_INTERVENTION_TEMPLATES;
}

/**
 * Map annual reduction slots onto intervention templates (configurable).
 * Cumulative saved = Q1 + Q2 + Q3 … by year.
 */
export function buildMilestonesFromDistribution(args: {
  annualSlots: Array<{ year: number; reduction: number }>;
  baselineEmissions: number;
  interventions?: InterventionTemplate[];
  interventionTemplates?: InterventionTemplate[];
}): PathwayMilestone[] {
  const templates = pickTemplates(args.interventions, args.interventionTemplates);
  const milestones: PathwayMilestone[] = [];
  let cumulative = 0;
  let emissions = args.baselineEmissions;
  let templateIndex = 0;

  for (const slot of args.annualSlots) {
    if (!(slot.reduction > 0)) continue;

    const template = templates[templateIndex % templates.length]!;
    templateIndex += 1;

    const emissionsSaved = slot.reduction;
    cumulative += emissionsSaved;
    emissions = Math.max(0, emissions - emissionsSaved);

    const scale =
      template.emissionsSaved > 0 ? emissionsSaved / template.emissionsSaved : 1;
    const cost = template.cost * scale;

    milestones.push({
      year: slot.year,
      action: template.action,
      emissionsSaved,
      cost,
      status: "planned",
      scope: template.scope,
      cumulativeEmissionsSaved: cumulative,
      pathwayEmissions: emissions,
    });
  }

  return milestones;
}

/**
 * When the caller supplies explicit interventions with years (or ordered),
 * schedule them and fill residual even reductions if needed.
 */
export function scheduleInterventions(args: {
  baselineEmissions: number;
  targetEmissions: number;
  baselineYear: number;
  targetYear: number;
  interventions: InterventionTemplate[];
  distribution?: "even" | "front_loaded" | "back_loaded";
}): PathwayMilestone[] {
  const totalNeeded = args.baselineEmissions - args.targetEmissions;
  const years = args.targetYear - args.baselineYear;
  const ordered = [...args.interventions];

  const milestones: PathwayMilestone[] = [];
  let cumulative = 0;
  let emissions = args.baselineEmissions;

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i]!;
    if (cumulative >= totalNeeded) break;

    const year = args.baselineYear + 1 + Math.min(i, Math.max(years - 1, 0));
    const remaining = totalNeeded - cumulative;
    const emissionsSaved = Math.min(item.emissionsSaved, remaining);
    if (!(emissionsSaved > 0)) continue;

    cumulative += emissionsSaved;
    emissions = Math.max(args.targetEmissions, emissions - emissionsSaved);

    milestones.push({
      year: Math.min(year, args.targetYear),
      action: item.action,
      emissionsSaved,
      cost: item.cost,
      status: "planned",
      scope: item.scope,
      cumulativeEmissionsSaved: cumulative,
      pathwayEmissions: emissions,
    });
  }

  if (cumulative + 1e-9 < totalNeeded) {
    const residual = totalNeeded - cumulative;
    const slots = distributeReductionsAcrossYears({
      totalReduction: residual,
      baselineYear: args.baselineYear,
      targetYear: args.targetYear,
      distribution: args.distribution,
    });
    const fill = buildMilestonesFromDistribution({
      annualSlots: slots,
      baselineEmissions: emissions,
      interventions: args.interventions,
    });
    for (const m of fill) {
      cumulative += m.emissionsSaved;
      emissions = Math.max(args.targetEmissions, emissions - m.emissionsSaved);
      milestones.push({
        ...m,
        cumulativeEmissionsSaved: cumulative,
        pathwayEmissions: emissions,
      });
    }
  }

  return milestones.sort((a, b) => a.year - b.year || a.action.localeCompare(b.action));
}

export function buildTimeline(args: {
  baselineEmissions: number;
  baselineYear: number;
  targetYear: number;
  milestones: PathwayMilestone[];
}): PathwayTimelinePoint[] {
  const byYear = new Map<number, PathwayMilestone[]>();
  for (const m of args.milestones) {
    const list = byYear.get(m.year) ?? [];
    list.push(m);
    byYear.set(m.year, list);
  }

  const points: PathwayTimelinePoint[] = [];
  let pathwayEmissions = args.baselineEmissions;

  for (let year = args.baselineYear; year <= args.targetYear; year++) {
    const yearMilestones = byYear.get(year) ?? [];
    if (year > args.baselineYear) {
      for (const m of yearMilestones) {
        pathwayEmissions = Math.max(0, pathwayEmissions - m.emissionsSaved);
      }
    }
    points.push({
      year,
      baselineHold: args.baselineEmissions,
      pathwayEmissions:
        year === args.baselineYear ? args.baselineEmissions : pathwayEmissions,
      isMilestone: yearMilestones.length > 0,
    });
  }

  return points;
}

export function checkSBTiAlignment(
  baselineEmissions: number,
  targetEmissions: number,
  baselineYear: number,
  targetYear: number,
): {
  warming1_5C: boolean;
  warming2_0C: boolean;
  alignedWith: string;
} {
  const yearsToTarget = targetYear - baselineYear;
  if (!(yearsToTarget > 0) || !(baselineEmissions > 0)) {
    return {
      warming1_5C: false,
      warming2_0C: false,
      alignedWith: "No alignment",
    };
  }

  const ratio = targetEmissions / baselineEmissions;
  const requiredAnnualReduction = 1 - ratio ** (1 / yearsToTarget);

  const alignment1_5C =
    requiredAnnualReduction >= SBTi_TARGETS.warming1_5C.annual_reduction;
  const alignment2_0C =
    requiredAnnualReduction >= SBTi_TARGETS.warming2_0C.annual_reduction;

  return {
    warming1_5C: alignment1_5C,
    warming2_0C: alignment2_0C,
    alignedWith: alignment1_5C
      ? "1.5°C pathway"
      : alignment2_0C
        ? "2.0°C pathway"
        : "No alignment",
  };
}

/**
 * Core pathway calculator.
 * Input: baseline, target year, target emissions, optional scenarios/interventions.
 * Output: milestones, feasibility, timeline, costEstimate.
 */
export function calculatePathway(input: PathwayPlanInput): PathwayPlanResult {
  const validation = validatePathwayTargets(input);
  if (validation) {
    throw new Error(validation);
  }

  const totalReduction = input.baselineEmissions - input.targetEmissions;
  const feasibility = calculateFeasibility({
    baselineEmissions: input.baselineEmissions,
    targetEmissions: input.targetEmissions,
    baselineYear: input.baselineYear,
    targetYear: input.targetYear,
    peerTypicalAnnualPercent: input.peerTypicalAnnualPercent,
    aggressiveThresholdPercent: input.aggressiveThresholdPercent,
  });

  let milestones: PathwayMilestone[];
  if (input.interventions && input.interventions.length > 0) {
    milestones = scheduleInterventions({
      baselineEmissions: input.baselineEmissions,
      targetEmissions: input.targetEmissions,
      baselineYear: input.baselineYear,
      targetYear: input.targetYear,
      interventions: input.interventions,
      distribution: input.distribution,
    });
  } else {
    const slots = distributeReductionsAcrossYears({
      totalReduction,
      baselineYear: input.baselineYear,
      targetYear: input.targetYear,
      distribution: input.distribution,
    });
    milestones = buildMilestonesFromDistribution({
      annualSlots: slots,
      baselineEmissions: input.baselineEmissions,
      interventionTemplates: input.interventionTemplates,
    });
  }

  const timeline = buildTimeline({
    baselineEmissions: input.baselineEmissions,
    baselineYear: input.baselineYear,
    targetYear: input.targetYear,
    milestones,
  });

  const costEstimate = milestones.reduce((sum, m) => sum + m.cost, 0);
  const targetReduction = (totalReduction / input.baselineEmissions) * 100;
  const alignment = checkSBTiAlignment(
    input.baselineEmissions,
    input.targetEmissions,
    input.baselineYear,
    input.targetYear,
  );

  const reductionLabel = targetReduction.toFixed(0);
  const name =
    input.name?.trim() ||
    `Path to ${input.targetEmissions === 0 ? "net-zero" : `${reductionLabel}% reduction`} by ${input.targetYear}`;

  return {
    name,
    baselineYear: input.baselineYear,
    targetYear: input.targetYear,
    baselineEmissions: input.baselineEmissions,
    targetEmissions: input.targetEmissions,
    targetReduction,
    milestones,
    feasibility,
    timeline,
    costEstimate,
    scienceBasedTargetAlignment: alignment,
  };
}

/**
 * Expected pathway emissions at asOfYear (linear even pace, or from milestones).
 */
export function expectedEmissionsAtYear(args: {
  baselineEmissions: number;
  targetEmissions: number;
  baselineYear: number;
  targetYear: number;
  asOfYear: number;
  milestones?: PathwayMilestone[];
}): number {
  const { baselineYear, targetYear, asOfYear } = args;
  if (asOfYear <= baselineYear) return args.baselineEmissions;
  if (asOfYear >= targetYear) return args.targetEmissions;

  if (args.milestones && args.milestones.length > 0) {
    const timeline = buildTimeline({
      baselineEmissions: args.baselineEmissions,
      baselineYear,
      targetYear,
      milestones: args.milestones,
    });
    const point = timeline.find((p) => p.year === asOfYear);
    if (point) return point.pathwayEmissions;
    // Interpolate between surrounding points
    const before = [...timeline].reverse().find((p) => p.year < asOfYear);
    const after = timeline.find((p) => p.year > asOfYear);
    if (before && after) {
      const t = (asOfYear - before.year) / (after.year - before.year);
      return (
        before.pathwayEmissions + t * (after.pathwayEmissions - before.pathwayEmissions)
      );
    }
  }

  const years = targetYear - baselineYear;
  const elapsed = asOfYear - baselineYear;
  const totalReduction = args.baselineEmissions - args.targetEmissions;
  return args.baselineEmissions - (totalReduction * elapsed) / years;
}

/**
 * Actual progress vs pathway — are we on track?
 */
export function compareActualToPathway(
  input: ActualProgressInput,
): ActualProgressComparison {
  const expected = expectedEmissionsAtYear({
    baselineEmissions: input.baselineEmissions,
    targetEmissions: input.targetEmissions,
    baselineYear: input.baselineYear,
    targetYear: input.targetYear,
    asOfYear: input.asOfYear,
    milestones: input.milestones,
  });

  const actual = input.actualEmissions;
  const varianceTco2e = actual - expected;
  const tolerance = Math.max(Math.abs(expected) * ON_TRACK_TOLERANCE_FRACTION, 1);

  let status: ActualProgressComparison["status"];
  if (varianceTco2e < -tolerance) {
    status = "ahead";
  } else if (varianceTco2e > tolerance) {
    status = "behind";
  } else {
    status = "on_track";
  }

  const aheadByTco2e = expected - actual;
  const message =
    status === "ahead"
      ? `Ahead of pathway by ${Math.abs(aheadByTco2e).toFixed(0)} tCO2e`
      : status === "behind"
        ? `Behind pathway by ${Math.abs(varianceTco2e).toFixed(0)} tCO2e`
        : "On track with pathway";

  return {
    asOfYear: input.asOfYear,
    expectedEmissions: expected,
    actualEmissions: actual,
    varianceTco2e,
    aheadByTco2e,
    status,
    onTrack: status !== "behind",
    message,
  };
}

export function parseMilestoneStatus(raw: unknown): MilestoneStatus | null {
  if (
    raw === "planned" ||
    raw === "in_progress" ||
    raw === "completed" ||
    raw === "missed"
  ) {
    return raw;
  }
  return null;
}

export function parsePathwayScope(raw: unknown): PathwayScope | null {
  if (raw === "1" || raw === "2" || raw === "3" || raw === "cross") return raw;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Legacy-compatible exports (stages / levers) used by older call sites        */
/* -------------------------------------------------------------------------- */

export type PathwayStage = {
  year: number;
  targetEmissions: number;
  leversApplied: {
    leverId: string;
    leverName: string;
    emissionReduction: number;
    capexRequired: number;
  }[];
  cumulativeCapex: number;
};

export type DecarbonizationPathway = {
  name: string;
  baselineYear: number;
  targetYear: number;
  baselineEmissions: number;
  targetEmissions: number;
  targetReduction: number;
  stages: PathwayStage[];
  scienceBasedTargetAlignment: {
    warming1_5C: boolean;
    warming2_0C: boolean;
    alignedWith: string;
  };
  costBenefitAnalysis: {
    totalCapex: number;
    totalSavings: number;
    roi: number;
    paybackPeriod: number;
  };
};

export type MilestonePathway = DecarbonizationPathway & {
  milestones: {
    year: number;
    targetEmissions: number;
    approvalRequired: boolean;
    approvedAt?: Date;
    approvedBy?: string;
  }[];
};

export type PathwayComparison = {
  pathways: DecarbonizationPathway[];
  recommendedPathway: string;
  rationale: string;
};

function planToLegacyStages(plan: PathwayPlanResult): PathwayStage[] {
  let cumulativeCapex = 0;
  return plan.milestones.map((m) => {
    cumulativeCapex += m.cost;
    return {
      year: m.year,
      targetEmissions: m.pathwayEmissions,
      leversApplied: [
        {
          leverId: `${m.scope}-${m.year}`,
          leverName: m.action,
          emissionReduction: m.emissionsSaved,
          capexRequired: m.cost,
        },
      ],
      cumulativeCapex,
    };
  });
}

export function generateOptimizedPathway(
  baselineEmissions: number,
  targetEmissions: number,
  baselineYear: number,
  targetYear: number,
  availableLevers: {
    id: string;
    name: string;
    maxReductionPercentage: number;
    priority: number;
  }[],
): DecarbonizationPathway {
  const interventions: InterventionTemplate[] = availableLevers
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((lever) => ({
      id: lever.id,
      action: lever.name,
      scope: "cross" as const,
      emissionsSaved:
        (lever.maxReductionPercentage / 100) * (baselineEmissions - targetEmissions),
      cost:
        (lever.maxReductionPercentage / 100) *
        (baselineEmissions - targetEmissions) *
        100,
    }));

  const plan = calculatePathway({
    baselineEmissions,
    targetEmissions,
    baselineYear,
    targetYear,
    interventions: interventions.length > 0 ? interventions : undefined,
  });

  const years = targetYear - baselineYear;
  const totalCapex = plan.costEstimate;
  const totalSavings = plan.milestones.reduce((s, m) => s + m.emissionsSaved * 50, 0);

  return {
    name: plan.name,
    baselineYear,
    targetYear,
    baselineEmissions,
    targetEmissions,
    targetReduction: plan.targetReduction,
    stages: planToLegacyStages(plan),
    scienceBasedTargetAlignment: plan.scienceBasedTargetAlignment,
    costBenefitAnalysis: {
      totalCapex,
      totalSavings,
      roi: totalCapex > 0 ? ((totalSavings - totalCapex) / totalCapex) * 100 : 0,
      paybackPeriod: totalCapex / Math.max(totalSavings / Math.max(years, 1), 1),
    },
  };
}

export function generateMilestonePathway(
  baselineEmissions: number,
  targetEmissions: number,
  baselineYear: number,
  targetYear: number,
  _milestonesTonsPerYear?: number[],
): MilestonePathway {
  const plan = calculatePathway({
    baselineEmissions,
    targetEmissions,
    baselineYear,
    targetYear,
  });
  const pathway = generateOptimizedPathway(
    baselineEmissions,
    targetEmissions,
    baselineYear,
    targetYear,
    [],
  );

  return {
    ...pathway,
    milestones: plan.timeline
      .filter((p) => p.year > baselineYear)
      .map((p) => ({
        year: p.year,
        targetEmissions: p.pathwayEmissions,
        approvalRequired: p.year % 3 === 0,
      })),
  };
}

export function comparePathways(pathways: DecarbonizationPathway[]): PathwayComparison {
  if (pathways.length === 0) {
    return {
      pathways: [],
      recommendedPathway: "No pathways",
      rationale: "No pathways provided",
    };
  }

  const scored = pathways.map((p) => ({
    pathway: p,
    score:
      (p.scienceBasedTargetAlignment.warming1_5C ? 50 : 25) +
      (p.costBenefitAnalysis.roi / 100) * 50,
  }));

  const best = scored.reduce((prev, current) =>
    current.score > prev.score ? current : prev,
  );

  const rationale = `Pathway "${best.pathway.name}" recommended based on ${
    best.pathway.scienceBasedTargetAlignment.warming1_5C
      ? "1.5°C SBTi alignment"
      : "2.0°C SBTi alignment"
  } and ${best.pathway.costBenefitAnalysis.roi.toFixed(0)}% ROI.`;

  return {
    pathways,
    recommendedPathway: best.pathway.name,
    rationale,
  };
}
