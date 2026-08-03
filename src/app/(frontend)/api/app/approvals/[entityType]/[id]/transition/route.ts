import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  applyDatapointTransition,
  applyReportTransition,
  gateTransitionPermission,
  isApprovalAction,
  readChainState,
  type ApprovalEntityKind,
} from "@/lib/approvals";
import { datapointDocToRecord, validateDatapoint } from "@/lib/data/validationEngine";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

type Ctx = { params: Promise<{ entityType: string; id: string }> };

function relId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function parseEntity(value: string): ApprovalEntityKind | null {
  if (value === "datapoint" || value === "datapoints") return "datapoint";
  if (value === "report" || value === "reports") return "report";
  return null;
}

/**
 * POST /api/app/approvals/[entityType]/[id]/transition
 * Body: { action: advance|reject|return, note?, assigneeRole?, assigneeUserId?, skipValidation? }
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { entityType: rawType, id } = await ctx.params;
  const entityType = parseEntity(rawType);
  if (!entityType) {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    note?: string;
    assigneeRole?: string;
    assigneeUserId?: string;
    skipValidation?: boolean;
  };

  if (!isApprovalAction(body.action)) {
    return NextResponse.json(
      { error: "action must be advance, reject, or return" },
      { status: 400 },
    );
  }

  const resource = entityType === "datapoint" ? "datapoint" : "report";
  const canEdit = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    resource,
    id,
    "organisation",
  );
  const canApprove = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "approve",
    resource,
    id,
    "organisation",
  );

  const payload = await getPayload({ config });

  if (entityType === "datapoint") {
    let dp;
    try {
      dp = await payload.findByID({
        collection: "datapoints",
        id,
        depth: 0,
        overrideAccess: true,
      });
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (relId(dp.organisation) !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const state = readChainState(dp);
    const gate = gateTransitionPermission("datapoint", state, body.action, {
      canEdit,
      canApprove,
      membershipRole: auth.role,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.error ?? "Forbidden" }, { status: 403 });
    }

    // Validate before leaving prepare (submit to review) or locking.
    const needsValidation =
      body.action === "advance" &&
      (state.step === "prepare" || state.step === "approve") &&
      body.skipValidation !== true;
    if (needsValidation) {
      const validation = await validateDatapoint(
        auth.activeOrg.id,
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

    const result = await applyDatapointTransition(payload, id, {
      action: body.action,
      note: body.note,
      assigneeRole: body.assigneeRole,
      assigneeUserId: body.assigneeUserId,
      actorId: auth.user.id,
      organisationId: auth.activeOrg.id,
      membershipRole: auth.role,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
    }

    if (result.status === "locked") {
      const { createNotification, notifyOrganisationMembers } =
        await import("@/lib/notifications");
      const actorName =
        [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ").trim() ||
        auth.user.email;
      const metricLabel =
        typeof dp.metricKey === "string" && dp.metricKey.trim()
          ? dp.metricKey.trim()
          : "datapoint";
      const title = "Datapoint locked";
      const message = `${actorName} locked '${metricLabel}' through the approval chain`;
      const recipientIds = new Set<string>();
      const assigned = relId(dp.assignedTo);
      const entered = relId(dp.enteredBy);
      if (assigned) recipientIds.add(assigned);
      if (entered) recipientIds.add(entered);
      recipientIds.delete(auth.user.id);

      if (recipientIds.size > 0) {
        for (const userId of recipientIds) {
          await createNotification(payload, {
            organisationId: auth.activeOrg.id,
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
          organisationId: auth.activeOrg.id,
          excludeUserIds: [auth.user.id],
          type: "datapoint_approved",
          title,
          message,
          resourceType: "datapoint",
          resourceId: String(dp.id),
        });
      }

      const { buildDatapointApprovedEvent, runAutomationsForEvent } =
        await import("@/lib/automations");
      const numericValue = typeof dp.value === "number" ? dp.value : null;
      await runAutomationsForEvent(
        payload,
        buildDatapointApprovedEvent({
          organisationId: auth.activeOrg.id,
          datapointId: String(dp.id),
          metricKey: metricLabel,
          value: numericValue,
          approvalState: "approved",
          actorName,
        }),
        { actorId: auth.user.id },
      );
    }

    return NextResponse.json({
      ok: true,
      entityType: "datapoint",
      id: result.id,
      step: result.step,
      status: result.status,
      approvalState: result.approvalState,
      history: result.history,
    });
  }

  // report
  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (relId(report.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const state = readChainState(report);
  const gate = gateTransitionPermission("report", state, body.action, {
    canEdit,
    canApprove: canApprove || canEdit,
    membershipRole: auth.role,
  });
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.error ?? "Forbidden" }, { status: 403 });
  }

  const result = await applyReportTransition(payload, id, {
    action: body.action,
    note: body.note,
    assigneeRole: body.assigneeRole,
    assigneeUserId: body.assigneeUserId,
    actorId: auth.user.id,
    organisationId: auth.activeOrg.id,
    membershipRole: auth.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  }

  return NextResponse.json({
    ok: true,
    entityType: "report",
    id: result.id,
    step: result.step,
    status: result.status,
    reportStatus: result.reportStatus,
  });
}
