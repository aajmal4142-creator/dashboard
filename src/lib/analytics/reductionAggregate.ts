import type {
  ReductionAggregateQuality,
  ReductionProjectInput,
  ReductionProjectSummary,
  ReductionStatusCounts,
} from "./reductionTypes";

function emptyByStatus(): ReductionStatusCounts {
  return {
    planned: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
}

function safePlanned(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

/**
 * Pure rollup of reduction projects.
 *
 * - Planned totals always sum finite non-negative planned values.
 * - Actual totals never invent zero for null/missing actuals.
 * - Cancelled projects are counted in `byStatus` / planned inventory but excluded
 *   from actual-coverage quality (they are not expected to report actuals).
 */
export function summariseReductionProjects(
  projects: ReductionProjectInput[],
): ReductionProjectSummary {
  const byStatus = emptyByStatus();
  let plannedTotalTco2e = 0;
  let actualSum = 0;
  let projectsWithActual = 0;
  let projectsMissingActual = 0;
  let plannedWithActualTco2e = 0;
  let activeProjectCount = 0;
  let hasAnyMeasuredActual = false;

  for (const project of projects) {
    byStatus[project.status] += 1;
    const planned = safePlanned(project.plannedReductionTco2e);
    plannedTotalTco2e += planned;

    if (project.status === "cancelled") {
      continue;
    }

    activeProjectCount += 1;
    const actual = project.actualReductionTco2e;
    if (actual === null || actual === undefined || !Number.isFinite(actual)) {
      projectsMissingActual += 1;
      continue;
    }

    const actualSafe = actual < 0 ? 0 : actual;
    hasAnyMeasuredActual = true;
    projectsWithActual += 1;
    actualSum += actualSafe;
    plannedWithActualTco2e += planned;
  }

  let actualTotalTco2e: number | null = null;
  let varianceTco2e: number | null = null;
  let quality: ReductionAggregateQuality = "missing";
  let message: string | null = null;

  if (projects.length === 0) {
    quality = "missing";
    message = "No reduction projects yet.";
  } else if (!hasAnyMeasuredActual) {
    actualTotalTco2e = null;
    varianceTco2e = null;
    quality = "missing";
    message =
      activeProjectCount === 0
        ? "All projects are cancelled — no actual reduction to report."
        : "No measured actual reductions yet — missing actuals are not treated as zero.";
  } else {
    actualTotalTco2e = actualSum;
    varianceTco2e = actualSum - plannedWithActualTco2e;
    if (projectsMissingActual > 0) {
      quality = "partial";
      message = `${projectsMissingActual} active project${projectsMissingActual === 1 ? "" : "s"} missing actual reduction — partial total only.`;
    } else {
      quality = "measured";
      message = null;
    }
  }

  return {
    projectCount: projects.length,
    activeProjectCount,
    byStatus,
    plannedTotalTco2e,
    actualTotalTco2e,
    projectsWithActual,
    projectsMissingActual,
    varianceTco2e,
    plannedWithActualTco2e,
    quality,
    message,
  };
}
