import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  readChainState,
  serializeHistory,
  type ApprovalEntityKind,
} from "@/lib/approvals";
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
 * GET /api/app/approvals/[entityType]/[id]
 * Detail: current step, history, assignees.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { entityType: rawType, id } = await ctx.params;
  const entityType = parseEntity(rawType);
  if (!entityType) {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  const resource = entityType === "datapoint" ? "datapoint" : "report";
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    resource,
    id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const chain = readChainState(dp);
    return NextResponse.json({
      entityType: "datapoint",
      id: String(dp.id),
      title: dp.metricKey,
      value: typeof dp.value === "number" ? dp.value : null,
      unit: dp.unit ?? null,
      step: chain.step,
      status: chain.status,
      approvalState: dp.approvalState ?? "pending",
      approvalReason: dp.approvalReason ?? null,
      assigneeRole: dp.approvalAssigneeRole ?? null,
      assigneeUserId: relId(dp.approvalAssigneeUser),
      history: serializeHistory(dp),
      actions: {
        canAdvance: chain.status === "in_progress" && chain.step !== "lock",
        canReject: chain.status === "in_progress",
        canReturn:
          chain.status === "rejected" ||
          (chain.status === "in_progress" && chain.step !== "prepare"),
      },
    });
  }

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
  const chain = readChainState(report);
  return NextResponse.json({
    entityType: "report",
    id: String(report.id),
    title: report.framework,
    version: report.version,
    reportStatus: report.status,
    step: chain.step,
    status: chain.status,
    approvalState: null,
    approvalReason: null,
    assigneeRole: report.approvalAssigneeRole ?? null,
    assigneeUserId: relId(report.approvalAssigneeUser),
    history: serializeHistory(report),
    actions: {
      canAdvance:
        chain.status === "in_progress" &&
        chain.step !== "lock" &&
        chain.step !== "approve",
      canReject: chain.status === "in_progress",
      canReturn:
        chain.status === "rejected" ||
        (chain.status === "in_progress" && chain.step !== "prepare"),
      publishToLock: chain.step === "approve" && chain.status === "in_progress",
    },
  });
}
