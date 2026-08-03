import type { Payload } from "payload";

import {
  createNotification,
  notifyOrganisationMembers,
} from "@/lib/notifications/createNotification";
import { shouldEscalate } from "./sla";

export type EscalateCronResult = {
  scanned: number;
  escalated: number;
  notified: number;
};

type RequestRow = {
  id: string;
  title?: string | null;
  organisation?: string | { id?: string } | null;
  assignee?: string | { id?: string; email?: string } | null;
  createdBy?: string | { id?: string } | null;
  requestStatus?: string | null;
  reviewStatus?: string | null;
  dueDate?: string | null;
  escalatedAt?: string | null;
  reminderCount?: number | null;
};

function relId(value: string | { id?: string } | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.id ? String(value.id) : null;
}

/**
 * Find open overdue internal requests and mark escalatedAt.
 * Notifies assignee + org admins in-app (email optional via caller).
 */
export async function escalateOverdueInternalRequests(
  payload: Payload,
  nowMs: number = Date.now(),
): Promise<EscalateCronResult> {
  // Fetch overdue open packs; filter escalatedAt in-memory (null/exists varies by adapter).
  const rows = await payload.find({
    collection: "internal-data-requests",
    where: {
      and: [
        { requestStatus: { not_equals: "submitted" } },
        { dueDate: { less_than: new Date(nowMs).toISOString() } },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });

  let escalated = 0;
  let notified = 0;
  const nowIso = new Date(nowMs).toISOString();

  for (const raw of rows.docs) {
    const row = raw as RequestRow;
    if (
      !shouldEscalate(
        {
          dueAt: row.dueDate,
          requestStatus: row.requestStatus,
          reviewStatus: row.reviewStatus,
          escalatedAt: row.escalatedAt,
        },
        nowMs,
      )
    ) {
      continue;
    }

    const orgId = relId(row.organisation);
    if (!orgId) continue;

    await payload.update({
      collection: "internal-data-requests",
      id: row.id,
      data: {
        escalatedAt: nowIso,
        lastReminderAt: nowIso,
        reminderCount: (row.reminderCount ?? 0) + 1,
      },
      overrideAccess: true,
    });
    escalated += 1;

    const title = "Data request overdue";
    const message = `"${row.title ?? "Request"}" is past its due date and has been escalated.`;
    const assigneeId = relId(row.assignee);
    if (assigneeId) {
      const id = await createNotification(payload, {
        organisationId: orgId,
        userId: assigneeId,
        type: "request_escalated",
        title,
        message,
        resourceType: "internal-data-request",
        resourceId: String(row.id),
      });
      if (id) notified += 1;
    }

    const exclude = [assigneeId, relId(row.createdBy)].filter((x): x is string =>
      Boolean(x),
    );
    notified += await notifyOrganisationMembers(payload, {
      organisationId: orgId,
      type: "request_escalated",
      title,
      message,
      resourceType: "internal-data-request",
      resourceId: String(row.id),
      excludeUserIds: exclude,
    });
  }

  return { scanned: rows.docs.length, escalated, notified };
}
