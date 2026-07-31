/**
 * Pure ISO 14064 checklist progress — zero I/O.
 */

export type Iso14064ItemStatus = "not_started" | "in_progress" | "completed" | "na";

export type Iso14064ChecklistStatus = "not_started" | "in_progress" | "completed";

export type Iso14064ProgressItem = {
  status: Iso14064ItemStatus;
  /** Count of linked evidence documents. */
  evidenceCount: number;
};

export type Iso14064ProgressResult = {
  total: number;
  applicable: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  na: number;
  percentComplete: number;
  label: string;
  checklistStatus: Iso14064ChecklistStatus;
};

/**
 * Whether an item may be marked completed.
 * MUST have at least one evidence link.
 */
export function canMarkItemComplete(evidenceCount: number): boolean {
  return Number.isFinite(evidenceCount) && evidenceCount >= 1;
}

/**
 * Compute checklist progress from section rows.
 * N/A items are excluded from the denominator.
 */
export function calculateIso14064Progress(
  items: Iso14064ProgressItem[],
): Iso14064ProgressResult {
  const total = items.length;
  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  let na = 0;

  for (const item of items) {
    if (item.status === "na") {
      na += 1;
      continue;
    }
    if (item.status === "completed") {
      completed += 1;
      continue;
    }
    if (item.status === "in_progress") {
      inProgress += 1;
      continue;
    }
    notStarted += 1;
  }

  const applicable = total - na;
  const percentComplete =
    applicable <= 0 ? 100 : Math.round((completed / applicable) * 1000) / 10;

  let checklistStatus: Iso14064ChecklistStatus;
  if (applicable > 0 && completed >= applicable) {
    checklistStatus = "completed";
  } else if (completed > 0 || inProgress > 0) {
    checklistStatus = "in_progress";
  } else {
    checklistStatus = "not_started";
  }

  const label = `${completed}/${applicable} items complete (${percentComplete}%)`;

  return {
    total,
    applicable,
    completed,
    inProgress,
    notStarted,
    na,
    percentComplete,
    label,
    checklistStatus,
  };
}

/**
 * Validate a requested item status transition.
 * Completing without evidence throws.
 */
export function assertItemCompletionAllowed(args: {
  nextStatus: Iso14064ItemStatus;
  evidenceCount: number;
}): void {
  if (args.nextStatus !== "completed") return;
  if (!canMarkItemComplete(args.evidenceCount)) {
    throw new Error(
      "Cannot mark complete without evidence. Attach at least one evidence link.",
    );
  }
}
