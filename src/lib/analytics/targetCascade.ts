/**
 * Pure target-cascade helpers — zero I/O.
 * Org-level absolute tCO₂e targets → facility (optional owner) allocations
 * via share % or absolute child targets, with progress roll-up.
 *
 * Missing child progress is never treated as zero.
 */

export const CASCADE_STATUSES = ["draft", "active", "archived"] as const;
export type CascadeStatus = (typeof CASCADE_STATUSES)[number];

export const ALLOCATION_MODES = ["sharePct", "absolute"] as const;
export type AllocationMode = (typeof ALLOCATION_MODES)[number];

export type ProgressQuality = "measured" | "partial" | "missing";

export type CascadeAllocationInput = {
  /** Stable row id (array id or client key). */
  id: string;
  facilityId: string;
  ownerId?: string | null;
  mode: AllocationMode;
  /** 0–100 when mode = sharePct. */
  sharePct?: number | null;
  /** Absolute child target tCO₂e when mode = absolute. */
  absoluteTco2e?: number | null;
  notes?: string | null;
};

export type ShareValidationOpts = {
  /**
   * When true, sum of sharePct rows must equal 100 (±tolerance).
   * When false (default), sum must be ≤ 100.
   * Absolute-only cascades skip the share-sum check.
   */
  requireExact100?: boolean;
  /** Absolute tolerance for percent sums (default 0.01). */
  tolerancePct?: number;
  /** Org target tCO₂e — used to cap absolute + share coverage. */
  orgTargetTco2e: number;
};

export type ShareValidationError = {
  code:
    | "empty"
    | "invalid_facility"
    | "invalid_mode"
    | "invalid_share"
    | "invalid_absolute"
    | "share_sum"
    | "absolute_over_target"
    | "coverage_over_target"
    | "duplicate_row";
  message: string;
  allocationId?: string;
};

export type ShareValidationResult =
  | {
      ok: true;
      shareSumPct: number;
      allocatedTargetTco2e: number;
      unallocatedTargetTco2e: number;
      resolvedTargets: Record<string, number>;
    }
  | {
      ok: false;
      shareSumPct: number;
      allocatedTargetTco2e: number;
      unallocatedTargetTco2e: number;
      resolvedTargets: Record<string, number>;
      errors: ShareValidationError[];
    };

export type ChildProgressInput = {
  allocationId: string;
  facilityId: string;
  ownerId?: string | null;
  /** Resolved child target emissions (tCO₂e). */
  targetTco2e: number;
  /** Resolved child baseline emissions (tCO₂e). */
  baselineTco2e: number;
  /**
   * Current emissions. Null / non-finite → quality missing (never coerced to 0).
   */
  currentTco2e: number | null;
};

export type ChildProgressRow = {
  allocationId: string;
  facilityId: string;
  ownerId: string | null;
  targetTco2e: number;
  baselineTco2e: number;
  currentTco2e: number | null;
  quality: "measured" | "missing";
  /**
   * Progress toward reduction goal (achieved / required × 100).
   * Null when current missing or required reduction is zero.
   */
  progressTowardTargetPercent: number | null;
  reductionRequiredTco2e: number;
  reductionAchievedTco2e: number | null;
};

export type CascadeProgressRollup = {
  orgBaselineTco2e: number;
  orgTargetTco2e: number;
  allocatedTargetTco2e: number;
  unallocatedTargetTco2e: number;
  children: ChildProgressRow[];
  measuredChildCount: number;
  missingChildCount: number;
  /**
   * Target-weighted average of measured children only.
   * Null when no measured children contribute.
   */
  rolledProgressPercent: number | null;
  quality: ProgressQuality;
  message: string | null;
};

const DEFAULT_TOLERANCE = 0.01;

export function isCascadeStatus(value: unknown): value is CascadeStatus {
  return (
    typeof value === "string" && (CASCADE_STATUSES as readonly string[]).includes(value)
  );
}

export function isAllocationMode(value: unknown): value is AllocationMode {
  return (
    typeof value === "string" && (ALLOCATION_MODES as readonly string[]).includes(value)
  );
}

function finiteNonNeg(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Resolve a child's absolute target tCO₂e from share % or absolute entry.
 */
export function resolveChildTargetTco2e(
  orgTargetTco2e: number,
  allocation: CascadeAllocationInput,
): number | null {
  if (!(orgTargetTco2e >= 0) || !Number.isFinite(orgTargetTco2e)) return null;

  if (allocation.mode === "sharePct") {
    const pct = finiteNonNeg(allocation.sharePct);
    if (pct === null || pct > 100) return null;
    return (pct / 100) * orgTargetTco2e;
  }

  if (allocation.mode === "absolute") {
    return finiteNonNeg(allocation.absoluteTco2e);
  }

  return null;
}

/**
 * Resolve child baseline proportional to org baseline (share of org target weight,
 * or explicit share %).
 */
export function resolveChildBaselineTco2e(
  orgBaselineTco2e: number,
  orgTargetTco2e: number,
  allocation: CascadeAllocationInput,
): number | null {
  if (!(orgBaselineTco2e >= 0) || !Number.isFinite(orgBaselineTco2e)) return null;

  if (allocation.mode === "sharePct") {
    const pct = finiteNonNeg(allocation.sharePct);
    if (pct === null || pct > 100) return null;
    return (pct / 100) * orgBaselineTco2e;
  }

  const childTarget = resolveChildTargetTco2e(orgTargetTco2e, allocation);
  if (childTarget === null) return null;
  if (orgTargetTco2e > 0) {
    return (childTarget / orgTargetTco2e) * orgBaselineTco2e;
  }
  return 0;
}

/**
 * Validate allocation shares / absolute coverage against the org target.
 */
export function validateAllocationShares(
  allocations: CascadeAllocationInput[],
  opts: ShareValidationOpts,
): ShareValidationResult {
  const tolerance = opts.tolerancePct ?? DEFAULT_TOLERANCE;
  const requireExact = opts.requireExact100 === true;
  const orgTarget = opts.orgTargetTco2e;
  const errors: ShareValidationError[] = [];
  const resolvedTargets: Record<string, number> = {};

  if (!(orgTarget >= 0) || !Number.isFinite(orgTarget)) {
    errors.push({
      code: "invalid_absolute",
      message: "orgTargetTco2e must be a finite number ≥ 0.",
    });
  }

  if (allocations.length === 0) {
    errors.push({
      code: "empty",
      message: "At least one facility allocation is required.",
    });
    return {
      ok: false,
      shareSumPct: 0,
      allocatedTargetTco2e: 0,
      unallocatedTargetTco2e: Number.isFinite(orgTarget) ? orgTarget : 0,
      resolvedTargets,
      errors,
    };
  }

  const seenKeys = new Set<string>();
  let shareSumPct = 0;
  let allocatedTargetTco2e = 0;
  let hasShareRows = false;

  for (const row of allocations) {
    if (!row.id || typeof row.id !== "string") {
      errors.push({
        code: "duplicate_row",
        message: "Each allocation needs a stable id.",
      });
      continue;
    }

    if (!row.facilityId || typeof row.facilityId !== "string") {
      errors.push({
        code: "invalid_facility",
        message: "facilityId is required.",
        allocationId: row.id,
      });
      continue;
    }

    if (!isAllocationMode(row.mode)) {
      errors.push({
        code: "invalid_mode",
        message: "mode must be sharePct or absolute.",
        allocationId: row.id,
      });
      continue;
    }

    const ownerKey = row.ownerId?.trim() ? row.ownerId.trim() : "";
    const dedupeKey = `${row.facilityId}::${ownerKey}`;
    if (seenKeys.has(dedupeKey)) {
      errors.push({
        code: "duplicate_row",
        message:
          "Duplicate facility + owner allocation. Use a different owner or merge the row.",
        allocationId: row.id,
      });
      continue;
    }
    seenKeys.add(dedupeKey);

    if (row.mode === "sharePct") {
      hasShareRows = true;
      const pct = finiteNonNeg(row.sharePct);
      if (pct === null || pct > 100) {
        errors.push({
          code: "invalid_share",
          message: "sharePct must be a finite number between 0 and 100.",
          allocationId: row.id,
        });
        continue;
      }
      if (pct === 0) {
        errors.push({
          code: "invalid_share",
          message: "sharePct must be greater than 0.",
          allocationId: row.id,
        });
        continue;
      }
      shareSumPct += pct;
      const target = (pct / 100) * orgTarget;
      resolvedTargets[row.id] = target;
      allocatedTargetTco2e += target;
    } else {
      const abs = finiteNonNeg(row.absoluteTco2e);
      if (abs === null) {
        errors.push({
          code: "invalid_absolute",
          message: "absoluteTco2e must be a finite number ≥ 0.",
          allocationId: row.id,
        });
        continue;
      }
      if (abs === 0) {
        errors.push({
          code: "invalid_absolute",
          message: "absoluteTco2e must be greater than 0.",
          allocationId: row.id,
        });
        continue;
      }
      resolvedTargets[row.id] = abs;
      allocatedTargetTco2e += abs;
    }
  }

  if (hasShareRows) {
    if (requireExact) {
      if (Math.abs(shareSumPct - 100) > tolerance) {
        errors.push({
          code: "share_sum",
          message: `Share percentages must sum to 100% (got ${round2(shareSumPct)}%).`,
        });
      }
    } else if (shareSumPct > 100 + tolerance) {
      errors.push({
        code: "share_sum",
        message: `Share percentages must sum to ≤ 100% (got ${round2(shareSumPct)}%).`,
      });
    }
  }

  if (
    Number.isFinite(orgTarget) &&
    allocatedTargetTco2e > orgTarget + Math.max(tolerance, orgTarget * 0.0001)
  ) {
    errors.push({
      code: "coverage_over_target",
      message: `Allocated child targets (${round2(allocatedTargetTco2e)} tCO₂e) exceed org target (${round2(orgTarget)} tCO₂e).`,
    });
  }

  const unallocatedTargetTco2e = Number.isFinite(orgTarget)
    ? Math.max(0, orgTarget - allocatedTargetTco2e)
    : 0;

  if (errors.length > 0) {
    return {
      ok: false,
      shareSumPct,
      allocatedTargetTco2e,
      unallocatedTargetTco2e,
      resolvedTargets,
      errors,
    };
  }

  return {
    ok: true,
    shareSumPct,
    allocatedTargetTco2e,
    unallocatedTargetTco2e,
    resolvedTargets,
  };
}

/**
 * Progress for one child: reduction achieved / reduction required.
 * Missing current → null progress (never silent zero).
 */
export function calculateChildProgress(input: {
  baselineTco2e: number;
  targetTco2e: number;
  currentTco2e: number | null;
}): {
  quality: "measured" | "missing";
  progressTowardTargetPercent: number | null;
  reductionRequiredTco2e: number;
  reductionAchievedTco2e: number | null;
} {
  const baseline = input.baselineTco2e;
  const target = input.targetTco2e;
  const required = baseline - target;

  if (
    input.currentTco2e === null ||
    input.currentTco2e === undefined ||
    !Number.isFinite(input.currentTco2e)
  ) {
    return {
      quality: "missing",
      progressTowardTargetPercent: null,
      reductionRequiredTco2e: required,
      reductionAchievedTco2e: null,
    };
  }

  const current = input.currentTco2e;
  const achieved = baseline - current;

  if (!(Math.abs(required) > 1e-9)) {
    return {
      quality: "measured",
      progressTowardTargetPercent: null,
      reductionRequiredTco2e: required,
      reductionAchievedTco2e: achieved,
    };
  }

  return {
    quality: "measured",
    progressTowardTargetPercent: (achieved / required) * 100,
    reductionRequiredTco2e: required,
    reductionAchievedTco2e: achieved,
  };
}

/**
 * Roll up child progress to org cascade level.
 * Missing children are excluded from the weighted average — never counted as 0%.
 */
export function rollupChildProgress(args: {
  orgBaselineTco2e: number;
  orgTargetTco2e: number;
  children: ChildProgressInput[];
}): CascadeProgressRollup {
  const orgBaseline = args.orgBaselineTco2e;
  const orgTarget = args.orgTargetTco2e;
  let allocatedTargetTco2e = 0;

  const children: ChildProgressRow[] = args.children.map((c) => {
    allocatedTargetTco2e += c.targetTco2e;
    const calc = calculateChildProgress({
      baselineTco2e: c.baselineTco2e,
      targetTco2e: c.targetTco2e,
      currentTco2e: c.currentTco2e,
    });
    return {
      allocationId: c.allocationId,
      facilityId: c.facilityId,
      ownerId: c.ownerId?.trim() ? c.ownerId.trim() : null,
      targetTco2e: c.targetTco2e,
      baselineTco2e: c.baselineTco2e,
      currentTco2e: calc.quality === "missing" ? null : Number(c.currentTco2e),
      quality: calc.quality,
      progressTowardTargetPercent: calc.progressTowardTargetPercent,
      reductionRequiredTco2e: calc.reductionRequiredTco2e,
      reductionAchievedTco2e: calc.reductionAchievedTco2e,
    };
  });

  const measured = children.filter((c) => c.quality === "measured");
  const missingChildCount = children.length - measured.length;

  let weightSum = 0;
  let weightedProgress = 0;
  for (const c of measured) {
    if (c.progressTowardTargetPercent === null) continue;
    const w = c.targetTco2e > 0 ? c.targetTco2e : 0;
    if (!(w > 0)) continue;
    weightSum += w;
    weightedProgress += c.progressTowardTargetPercent * w;
  }

  const rolledProgressPercent = weightSum > 0 ? weightedProgress / weightSum : null;

  let quality: ProgressQuality;
  let message: string | null = null;

  if (children.length === 0) {
    quality = "missing";
    message = "No child allocations to roll up.";
  } else if (missingChildCount === children.length) {
    quality = "missing";
    message =
      "All child facilities are missing current emissions — roll-up unavailable (not treated as zero).";
  } else if (missingChildCount > 0) {
    quality = "partial";
    message = `${missingChildCount} of ${children.length} child facilities missing current emissions; roll-up uses measured children only.`;
  } else if (rolledProgressPercent === null) {
    quality = "measured";
    message = "Required reduction is zero for measured children — progress undefined.";
  } else {
    quality = "measured";
    message = null;
  }

  return {
    orgBaselineTco2e: orgBaseline,
    orgTargetTco2e: orgTarget,
    allocatedTargetTco2e,
    unallocatedTargetTco2e: Math.max(0, orgTarget - allocatedTargetTco2e),
    children,
    measuredChildCount: measured.length,
    missingChildCount,
    rolledProgressPercent,
    quality,
    message,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
