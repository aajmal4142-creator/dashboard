import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { serializeInternalRequest, shouldEscalate } from "@/lib/internal-requests";
import {
  createNotification,
  notifyOrganisationMembers,
} from "@/lib/notifications/createNotification";
import config from "@/payload.config";

type RouteParams = { params: Promise<{ id: string }> };

function relId(value: string | { id?: string } | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.id ? String(value.id) : null;
}

/** POST /api/app/internal-requests/[id]/escalate — admin manual escalate. */
export async function POST(_req: Request, { params }: RouteParams) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { id } = await params;
  const payload = await getPayload({ config });
  const row = await payload.findByID({
    collection: "internal-data-requests",
    id,
    depth: 0,
    overrideAccess: true,
  });

  const orgId = relId(row.organisation);
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nowMs = Date.now();
  if (
    !shouldEscalate(
      {
        dueAt: row.dueDate,
        requestStatus: row.requestStatus,
        reviewStatus: row.reviewStatus,
        escalatedAt: row.escalatedAt,
      },
      nowMs,
    ) &&
    row.escalatedAt
  ) {
    return NextResponse.json({ error: "Already escalated" }, { status: 409 });
  }

  const nowIso = new Date(nowMs).toISOString();
  const updated = await payload.update({
    collection: "internal-data-requests",
    id: row.id,
    data: {
      escalatedAt: nowIso,
      lastReminderAt: nowIso,
      reminderCount: (row.reminderCount ?? 0) + 1,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: orgId,
    actorId: ctx.user.id,
    action: "internal_request.escalate",
    entityType: "internal-data-requests",
    entityId: row.id,
    after: { escalatedAt: nowIso },
  });

  const title = "Data request escalated";
  const message = `"${row.title}" was escalated by an admin.`;
  const assigneeId = relId(row.assignee);
  if (assigneeId) {
    await createNotification(payload, {
      organisationId: orgId,
      userId: assigneeId,
      type: "request_escalated",
      title,
      message,
      resourceType: "internal-data-request",
      resourceId: String(row.id),
    });
  }
  await notifyOrganisationMembers(payload, {
    organisationId: orgId,
    type: "request_escalated",
    title,
    message,
    resourceType: "internal-data-request",
    resourceId: String(row.id),
    excludeUserIds: [ctx.user.id, assigneeId].filter((x): x is string => Boolean(x)),
  });

  return NextResponse.json({
    ok: true,
    request: serializeInternalRequest(updated),
  });
}
