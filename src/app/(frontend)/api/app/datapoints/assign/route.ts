import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/write";
import config from "@/payload.config";

/** Assign datapoint ownership + due date. §18.1.2 */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.role === "viewer") {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  const body = (await req.json()) as {
    datapointId?: string;
    assignedTo?: string | null;
    dueDate?: string | null;
    taskStatus?: "open" | "submitted" | "approved";
  };
  if (!body.datapointId) {
    return NextResponse.json({ error: "datapointId required" }, { status: 400 });
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
    assignedTo: dp.assignedTo,
    dueDate: dp.dueDate,
    taskStatus: dp.taskStatus,
  };
  const updated = await payload.update({
    collection: "datapoints",
    id: dp.id,
    data: {
      assignedTo: body.assignedTo === null ? null : body.assignedTo,
      dueDate: body.dueDate === null ? null : body.dueDate,
      taskStatus: body.taskStatus ?? dp.taskStatus ?? "open",
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "datapoint.assign",
    entityType: "datapoints",
    entityId: dp.id,
    before,
    after: {
      assignedTo: updated.assignedTo,
      dueDate: updated.dueDate,
      taskStatus: updated.taskStatus,
    },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}
