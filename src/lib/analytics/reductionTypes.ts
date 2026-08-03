export const REDUCTION_PROJECT_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type ReductionProjectStatus = (typeof REDUCTION_PROJECT_STATUSES)[number];

export type ReductionProjectInput = {
  status: ReductionProjectStatus;
  plannedReductionTco2e: number;
  /** Null/undefined = not yet measured — must not become silent zero in totals. */
  actualReductionTco2e: number | null | undefined;
};

export type ReductionStatusCounts = Record<ReductionProjectStatus, number>;

export type ReductionAggregateQuality = "measured" | "partial" | "missing";

export type ReductionProjectSummary = {
  projectCount: number;
  /** Non-cancelled projects expected to eventually report actuals. */
  activeProjectCount: number;
  byStatus: ReductionStatusCounts;
  plannedTotalTco2e: number;
  /**
   * Sum of known actuals only. Null when no active project has a measured actual
   * (missing ≠ zero).
   */
  actualTotalTco2e: number | null;
  projectsWithActual: number;
  projectsMissingActual: number;
  /**
   * actualTotal − plannedTotal for active projects that have actuals only
   * (partial variance). Null when no measured actuals exist.
   */
  varianceTco2e: number | null;
  /**
   * Planned total for active projects that already have an actual — used with
   * variance so partial rollups are comparable.
   */
  plannedWithActualTco2e: number;
  quality: ReductionAggregateQuality;
  message: string | null;
};

export const REDUCTION_STATUS_LABELS: Record<ReductionProjectStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function isReductionProjectStatus(
  value: unknown,
): value is ReductionProjectStatus {
  return (
    value === "planned" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "cancelled"
  );
}
