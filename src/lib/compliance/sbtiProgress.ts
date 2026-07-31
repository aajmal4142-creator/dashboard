/**
 * Pure SBTi progress calculation — zero I/O.
 * Progress = reduction achieved / reduction required.
 * On-track bands (per product spec): green >50%, yellow 25–50%, red <25%.
 */

export type SbtiOnTrackStatus = "green" | "yellow" | "red";

export type SbtiScopeKey = "Scope1" | "Scope2" | "Scope3";

export type SbtiScopeEmissions = {
  scope1: number;
  scope2: number;
  scope3: number;
};

export type SbtiProgressInput = {
  baselineEmissions: number;
  /** Absolute or intensity level at target year. */
  targetEmissions: number;
  /** Current absolute or intensity level (same unit as baseline/target). */
  currentEmissions: number;
  baselineYear: number;
  targetYear: number;
  /** Calendar year used for years remaining / elapsed (injected by caller). */
  asOfYear: number;
};

export type SbtiProgressResult = {
  baselineEmissions: number;
  targetEmissions: number;
  currentEmissions: number;
  /** Required cut from baseline to target, as % of baseline (0–100+). */
  reductionTargetPercent: number;
  /** Cut already achieved from baseline, as % of baseline (can be negative if increased). */
  reductionAchievedPercent: number;
  /**
   * Progress toward the reduction goal: achieved / required × 100.
   * 0 = no progress, 100 = target met, >100 = overshot.
   * Null when required reduction is zero (baseline already at/below target).
   */
  progressTowardTargetPercent: number | null;
  /** Remaining reduction needed per year (% of baseline), annualized over years remaining. */
  annualizedReductionNeededPercent: number | null;
  yearsRemaining: number;
  yearsElapsed: number;
  /** Linear time-expected progress (0–100) given elapsed / total span. */
  expectedProgressPercent: number;
  /** progressTowardTarget − expectedProgress (null when progress unavailable). */
  trajectoryGapPercent: number | null;
  onTrackStatus: SbtiOnTrackStatus;
};

/**
 * Derive target emissions from a reduction percent, or reduction percent from target.
 */
export function resolveTargetLevels(args: {
  baselineEmissions: number;
  targetEmissions?: number | null;
  reductionPercent?: number | null;
}): { targetEmissions: number; reductionPercent: number } {
  const baseline = args.baselineEmissions;
  if (!(baseline > 0) || !Number.isFinite(baseline)) {
    throw new Error("baselineEmissions must be a finite number greater than zero");
  }

  const hasTarget =
    args.targetEmissions !== null &&
    args.targetEmissions !== undefined &&
    Number.isFinite(args.targetEmissions);
  const hasReduction =
    args.reductionPercent !== null &&
    args.reductionPercent !== undefined &&
    Number.isFinite(args.reductionPercent);

  if (!hasTarget && !hasReduction) {
    throw new Error("Provide targetEmissions or reductionPercent");
  }

  if (hasTarget && hasReduction) {
    const derivedFromReduction = baseline * (1 - Number(args.reductionPercent) / 100);
    const target = Number(args.targetEmissions);
    if (Math.abs(derivedFromReduction - target) > 0.01 * baseline) {
      // Prefer explicit targetEmissions when both supplied inconsistently
      const reductionPercent = ((baseline - target) / baseline) * 100;
      return { targetEmissions: target, reductionPercent };
    }
    return {
      targetEmissions: target,
      reductionPercent: Number(args.reductionPercent),
    };
  }

  if (hasReduction) {
    const reductionPercent = Number(args.reductionPercent);
    return {
      targetEmissions: baseline * (1 - reductionPercent / 100),
      reductionPercent,
    };
  }

  const targetEmissions = Number(args.targetEmissions);
  const reductionPercent = ((baseline - targetEmissions) / baseline) * 100;
  return { targetEmissions, reductionPercent };
}

export function determineOnTrackStatus(
  progressTowardTargetPercent: number | null,
): SbtiOnTrackStatus {
  if (progressTowardTargetPercent === null) return "green";
  if (progressTowardTargetPercent > 50) return "green";
  if (progressTowardTargetPercent >= 25) return "yellow";
  return "red";
}

/**
 * Sum emissions for the scopes covered by an SBTi target.
 */
export function sumScopedEmissions(
  emissions: SbtiScopeEmissions,
  scopes: SbtiScopeKey[],
): number {
  let total = 0;
  for (const scope of scopes) {
    if (scope === "Scope1") total += emissions.scope1;
    else if (scope === "Scope2") total += emissions.scope2;
    else if (scope === "Scope3") total += emissions.scope3;
  }
  return total;
}

/**
 * Apply a scenario reduction % to selected scopes and return the new total
 * across the SBTi scopesCovered set.
 */
export function applyScenarioReduction(args: {
  currentByScope: SbtiScopeEmissions;
  scopesCovered: SbtiScopeKey[];
  scenarioReductionPercent: number;
  scenarioScopes: SbtiScopeKey[];
}): number {
  const factor = 1 - Math.max(0, Math.min(100, args.scenarioReductionPercent)) / 100;
  const scenarioSet = new Set(args.scenarioScopes);

  const adjusted: SbtiScopeEmissions = {
    scope1: scenarioSet.has("Scope1")
      ? args.currentByScope.scope1 * factor
      : args.currentByScope.scope1,
    scope2: scenarioSet.has("Scope2")
      ? args.currentByScope.scope2 * factor
      : args.currentByScope.scope2,
    scope3: scenarioSet.has("Scope3")
      ? args.currentByScope.scope3 * factor
      : args.currentByScope.scope3,
  };

  return sumScopedEmissions(adjusted, args.scopesCovered);
}

export function calculateSbtiProgress(input: SbtiProgressInput): SbtiProgressResult {
  const {
    baselineEmissions,
    targetEmissions,
    currentEmissions,
    baselineYear,
    targetYear,
    asOfYear,
  } = input;

  if (
    !Number.isFinite(baselineEmissions) ||
    !Number.isFinite(targetEmissions) ||
    !Number.isFinite(currentEmissions)
  ) {
    throw new Error("Emissions values must be finite numbers");
  }
  if (targetYear < baselineYear) {
    throw new Error("targetYear must be greater than or equal to baselineYear");
  }

  const spanYears = Math.max(0, targetYear - baselineYear);
  const yearsElapsed = Math.max(0, Math.min(spanYears, asOfYear - baselineYear));
  const yearsRemaining = Math.max(0, targetYear - asOfYear);

  const reductionRequired = baselineEmissions - targetEmissions;
  const reductionAchieved = baselineEmissions - currentEmissions;

  const reductionTargetPercent =
    baselineEmissions > 0 ? (reductionRequired / baselineEmissions) * 100 : 0;
  const reductionAchievedPercent =
    baselineEmissions > 0 ? (reductionAchieved / baselineEmissions) * 100 : 0;

  let progressTowardTargetPercent: number | null;
  if (Math.abs(reductionRequired) < 1e-9) {
    progressTowardTargetPercent = currentEmissions <= targetEmissions ? 100 : 0;
  } else if (reductionRequired < 0) {
    // Target is an increase (unusual) — treat as met when current >= target
    progressTowardTargetPercent =
      currentEmissions >= targetEmissions
        ? 100
        : (reductionAchieved / reductionRequired) * 100;
  } else {
    progressTowardTargetPercent = (reductionAchieved / reductionRequired) * 100;
  }

  const expectedProgressPercent =
    spanYears === 0 ? 100 : (yearsElapsed / spanYears) * 100;

  const remainingReductionPercent =
    baselineEmissions > 0
      ? ((currentEmissions - targetEmissions) / baselineEmissions) * 100
      : 0;

  const annualizedReductionNeededPercent =
    yearsRemaining > 0
      ? remainingReductionPercent / yearsRemaining
      : remainingReductionPercent > 0
        ? remainingReductionPercent
        : 0;

  const trajectoryGapPercent =
    progressTowardTargetPercent === null
      ? null
      : progressTowardTargetPercent - expectedProgressPercent;

  const onTrackStatus = determineOnTrackStatus(progressTowardTargetPercent);

  return {
    baselineEmissions,
    targetEmissions,
    currentEmissions,
    reductionTargetPercent,
    reductionAchievedPercent,
    progressTowardTargetPercent,
    annualizedReductionNeededPercent,
    yearsRemaining,
    yearsElapsed,
    expectedProgressPercent,
    trajectoryGapPercent,
    onTrackStatus,
  };
}

export function sbtiRegistrySearchUrl(orgName: string): string {
  const q = encodeURIComponent(orgName.trim());
  return `https://sciencebasedtargets.org/companies-taking-action#search=${q}`;
}

export function scenarioScopeToSbti(
  scopes: Array<"1" | "2" | "3" | 1 | 2 | 3 | string>,
): SbtiScopeKey[] {
  const out: SbtiScopeKey[] = [];
  for (const s of scopes) {
    const v = String(s);
    if ((v === "1" || v === "Scope1") && !out.includes("Scope1")) out.push("Scope1");
    if ((v === "2" || v === "Scope2") && !out.includes("Scope2")) out.push("Scope2");
    if ((v === "3" || v === "Scope3") && !out.includes("Scope3")) out.push("Scope3");
  }
  return out;
}
