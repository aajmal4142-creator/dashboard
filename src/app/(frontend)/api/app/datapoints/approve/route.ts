import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { requirePermission } from "@/lib/policy/protect";
import { datapointDocToRecord, validateDatapoint } from "@/lib/data/validationEngine";
import config from "@/payload.config";

/** Admin/owner approve or reject a datapoint. §15.1.2 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    datapointId?: string;
    approvalState?: "approved" | "rejected" | "pending";
    reason?: string;
    /** When true, skip custom validation rules (admin override). */
    skipValidation?: boolean;
  };
  if (!body.datapointId || !body.approvalState) {
    return NextResponse.json(
      { error: "datapointId and approvalState required" },
      { status: 400 },
    );
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "approve",
    "datapoint",
    body.datapointId,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.approvalState === "rejected" && !body.reason?.trim()) {
    return NextResponse.json(
      { error: "A reason is required when rejecting a datapoint" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });
  const dp = await payload.findByID({
    collection: "datapoints",
    id: body.datapointId,
    depth: 0,
    overrideAccess: true,
  });
  const orgId =
    typeof dp.organisation === "string" ? dp.organisation : dp.organisation?.id;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.approvalState === "approved" && body.skipValidation !== true) {
    const validation = await validateDatapoint(
      ctx.activeOrg.id,
      datapointDocToRecord(dp),
    );
    if (!validation.canApprove) {
      return NextResponse.json(
        {
          error: "Datapoint failed validation rules",
          valid: false,
          canApprove: false,
          errors: validation.errors,
          warnings: validation.warnings,
          violations: validation.violations,
        },
        { status: 422 },
      );
    }
  }

  const before = {
    approvalState: dp.approvalState,
    approvalReason: dp.approvalReason,
  };
  const updated = await payload.update({
    collection: "datapoints",
    id: dp.id,
    data: {
      approvalState: body.approvalState,
      approvalReason: body.approvalState === "rejected" ? body.reason!.trim() : null,
      taskStatus: body.approvalState === "approved" ? "approved" : dp.taskStatus,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: `datapoint.${body.approvalState}`,
    entityType: "datapoints",
    entityId: dp.id,
    before,
    after: {
      approvalState: updated.approvalState,
      approvalReason: updated.approvalReason,
    },
  });

  if (body.approvalState === "approved") {
    const { createNotification, notifyOrganisationMembers } =
      await import("@/lib/notifications");
    const actorName =
      [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(" ").trim() ||
      ctx.user.email;
    const metricLabel =
      typeof dp.metricKey === "string" && dp.metricKey.trim()
        ? dp.metricKey.trim()
        : "datapoint";
    const title = "Datapoint approved";
    const message = `${actorName} approved '${metricLabel}'`;
    const recipientIds = new Set<string>();
    const assigned =
      typeof dp.assignedTo === "string"
        ? dp.assignedTo
        : dp.assignedTo && typeof dp.assignedTo === "object"
          ? dp.assignedTo.id
          : null;
    const entered =
      typeof dp.enteredBy === "string"
        ? dp.enteredBy
        : dp.enteredBy && typeof dp.enteredBy === "object"
          ? dp.enteredBy.id
          : null;
    if (assigned) recipientIds.add(assigned);
    if (entered) recipientIds.add(entered);
    recipientIds.delete(ctx.user.id);

    if (recipientIds.size > 0) {
      for (const userId of recipientIds) {
        await createNotification(payload, {
          organisationId: ctx.activeOrg.id,
          userId,
          type: "datapoint_approved",
          title,
          message,
          resourceType: "datapoint",
          resourceId: String(dp.id),
        });
      }
    } else {
      await notifyOrganisationMembers(payload, {
        organisationId: ctx.activeOrg.id,
        excludeUserIds: [ctx.user.id],
        type: "datapoint_approved",
        title,
        message,
        resourceType: "datapoint",
        resourceId: String(dp.id),
      });
    }

    const { buildDatapointApprovedEvent, runAutomationsForEvent } =
      await import("@/lib/automations");
    const numericValue =
      typeof updated.value === "number"
        ? updated.value
        : typeof dp.value === "number"
          ? dp.value
          : null;
    await runAutomationsForEvent(
      payload,
      buildDatapointApprovedEvent({
        organisationId: ctx.activeOrg.id,
        datapointId: String(dp.id),
        metricKey: metricLabel,
        value: numericValue,
        approvalState: "approved",
        actorName,
      }),
      { actorId: ctx.user.id },
    );
  }

  return NextResponse.json({
    ok: true,
    id: updated.id,
    approvalState: updated.approvalState,
  });
}
