import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { requirePermission } from "@/lib/policy/protect";
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

  return NextResponse.json({
    ok: true,
    id: updated.id,
    approvalState: updated.approvalState,
  });
}
