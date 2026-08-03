/**
 * Pure SLA / escalation helpers for internal data requests.
 * Zero I/O — safe for Vitest without Payload/Next.
 */

export type SlaTone = "none" | "ok" | "due_soon" | "overdue" | "escalated";

export type SlaInput = {
  dueAt: string | null | undefined;
  /** Collection workflow: not_sent | sent | opened | submitted */
  requestStatus?: string | null;
  /** Review workflow: pending | submitted | approved | rejected */
  reviewStatus?: string | null;
  escalatedAt?: string | null;
};

/** Days before due when the badge switches to due_soon. */
export const SLA_DUE_SOON_DAYS = 3;

/** Assignee still owes values (collection SLA). */
export function isCollectionOpen(requestStatus?: string | null): boolean {
  return requestStatus !== "submitted";
}

export function parseDueMs(dueAt: string | null | undefined): number | null {
  if (dueAt == null || dueAt === "") return null;
  const ms = Date.parse(dueAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Whole calendar days from `now` to due (negative = overdue). */
export function daysUntilDue(
  dueAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  const dueMs = parseDueMs(dueAt);
  if (dueMs == null) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.ceil((dueMs - nowMs) / dayMs);
}

export function isOverdue(
  dueAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const dueMs = parseDueMs(dueAt);
  if (dueMs == null) return false;
  return dueMs < nowMs;
}

/**
 * Whether cron / escalate should mark this row and notify.
 * Open collection + past due + not already escalated.
 */
export function shouldEscalate(input: SlaInput, nowMs: number = Date.now()): boolean {
  if (!isCollectionOpen(input.requestStatus)) return false;
  if (input.escalatedAt) return false;
  return isOverdue(input.dueAt, nowMs);
}

/** Badge tone for list/detail UI. */
export function slaTone(input: SlaInput, nowMs: number = Date.now()): SlaTone {
  if (input.escalatedAt) return "escalated";
  if (!input.dueAt) return "none";
  if (!isCollectionOpen(input.requestStatus)) return "ok";
  const days = daysUntilDue(input.dueAt, nowMs);
  if (days == null) return "none";
  if (days < 0) return "overdue";
  if (days <= SLA_DUE_SOON_DAYS) return "due_soon";
  return "ok";
}

export function slaLabel(tone: SlaTone): string {
  switch (tone) {
    case "escalated":
      return "Escalated";
    case "overdue":
      return "Overdue";
    case "due_soon":
      return "Due soon";
    case "ok":
      return "On track";
    default:
      return "No due date";
  }
}
