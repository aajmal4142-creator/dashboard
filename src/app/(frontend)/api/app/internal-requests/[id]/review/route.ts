import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  buildDatapointApprovalFollowUp,
  serializeInternalRequest,
} from "@/lib/internal-requests";
import { createNotification } from "@/lib/notifications/createNotification";
import config from "@/payload.config";

type RouteParams = { params: Promise<{ id: string }> };

function relId(value: string | { id?: string } | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.id ? String(value.id) : null;
}

/**
 * POST /api/app/internal-requests/[id]/review
 * Approve or reject after submit. Does not rewrite datapoint approvalState (F13).
 */
export async function POST(req: Request, { params }: RouteParams) {
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

  const body = (await req.json()) as {
    decision?: "approved" | "rejected";
    reviewerNotes?: string;
  };
  if (body.decision !== "approved" && body.decision !== "rejected") {
    return NextResponse.json(
      { error: "decision must be approved or rejected" },
      { status: 400 },
    );
  }
  if (body.decision === "rejected" && !body.reviewerNotes?.trim()) {
    return NextResponse.json(
      { error: "reviewerNotes required when rejecting" },
      { status: 400 },
    );
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

  if (row.requestStatus !== "submitted" && row.reviewStatus !== "submitted") {
    return NextResponse.json(
      { error: "Request must be submitted before review" },
      { status: 400 },
    );
  }
  if (row.reviewStatus === "approved" || row.reviewStatus === "rejected") {
    return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const updated = await payload.update({
    collection: "internal-data-requests",
    id: row.id,
    data: {
      reviewStatus: body.decision,
      reviewerNotes: body.reviewerNotes?.trim() || undefined,
      reviewedBy: ctx.user.id,
      reviewedAt: nowIso,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: orgId,
    actorId: ctx.user.id,
    action:
      body.decision === "approved"
        ? "internal_request.approve"
        : "internal_request.reject",
    entityType: "internal-data-requests",
    entityId: row.id,
    after: {
      reviewStatus: body.decision,
      reviewerNotes: body.reviewerNotes?.trim() ?? null,
    },
  });

  const assigneeId = relId(row.assignee);
  if (assigneeId) {
    await createNotification(payload, {
      organisationId: orgId,
      userId: assigneeId,
      type: "datapoint_approved",
      title:
        body.decision === "approved" ? "Data request approved" : "Data request rejected",
      message:
        body.decision === "approved"
          ? `"${row.title}" was approved.`
          : `"${row.title}" was rejected. ${body.reviewerNotes?.trim() ?? ""}`.trim(),
      resourceType: "internal-data-request",
      resourceId: String(row.id),
    });
  }

  const periodId = relId(row.period) ?? "";
  const metricKeys = (row.metricKeys ?? []).map((m) => m.key).filter(Boolean);
  const datapointHook = buildDatapointApprovalFollowUp({
    organisationId: orgId,
    periodId,
    metricKeys,
    reviewStatus: body.decision,
    reason: body.reviewerNotes?.trim(),
  });

  return NextResponse.json({
    ok: true,
    request: serializeInternalRequest(updated),
    datapointHook,
  });
}
