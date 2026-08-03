import { getPayload } from "payload";
import type { Where } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  isApprovalStep,
  isChainStatus,
  readChainState,
  type ApprovalStep,
  type ChainStatus,
} from "@/lib/approvals";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function relId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export type ApprovalInboxItem = {
  entityType: "datapoint" | "report";
  id: string;
  title: string;
  subtitle: string | null;
  step: ApprovalStep;
  status: ChainStatus;
  approvalState: string | null;
  assigneeRole: string | null;
  assigneeUserId: string | null;
  updatedAt: string | null;
  value: number | null;
  unit: string | null;
};

/**
 * GET /api/app/approvals
 * Inbox of in-progress / rejected datapoints and draft reports awaiting chain action.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "datapoint",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const stepFilter = url.searchParams.get("step");
  const statusFilter = url.searchParams.get("status");
  const entityFilter = url.searchParams.get("entityType");
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "40") || 40),
  );

  const payload = await getPayload({ config });
  const orgId = ctx.activeOrg.id;
  const items: ApprovalInboxItem[] = [];

  if (entityFilter !== "report") {
    const dpClauses: Where[] = [
      { organisation: { equals: orgId } },
      {
        or: [
          { approvalChainStatus: { equals: "in_progress" } },
          { approvalChainStatus: { equals: "rejected" } },
          {
            and: [
              { approvalChainStatus: { exists: false } },
              { approvalState: { not_equals: "approved" } },
            ],
          },
        ],
      },
    ];
    if (isApprovalStep(stepFilter)) {
      dpClauses.push({ approvalStep: { equals: stepFilter } });
    }
    if (isChainStatus(statusFilter)) {
      dpClauses.push({ approvalChainStatus: { equals: statusFilter } });
    }
    const dpWhere: Where = { and: dpClauses };

    const dps = await payload.find({
      collection: "datapoints",
      where: dpWhere,
      limit,
      sort: "-updatedAt",
      depth: 0,
      overrideAccess: true,
    });

    for (const d of dps.docs) {
      const chain = readChainState(d);
      if (chain.status === "locked") continue;
      items.push({
        entityType: "datapoint",
        id: String(d.id),
        title: typeof d.metricKey === "string" ? d.metricKey : "Datapoint",
        subtitle: typeof d.unit === "string" ? d.unit : null,
        step: chain.step,
        status: chain.status,
        approvalState: typeof d.approvalState === "string" ? d.approvalState : null,
        assigneeRole:
          typeof d.approvalAssigneeRole === "string" ? d.approvalAssigneeRole : null,
        assigneeUserId: relId(d.approvalAssigneeUser),
        updatedAt: d.updatedAt ? String(d.updatedAt) : null,
        value: typeof d.value === "number" ? d.value : null,
        unit: typeof d.unit === "string" ? d.unit : null,
      });
    }
  }

  if (entityFilter !== "datapoint") {
    const reportClauses: Where[] = [
      { organisation: { equals: orgId } },
      { status: { equals: "draft" } },
      {
        or: [
          { approvalChainStatus: { not_equals: "locked" } },
          { approvalChainStatus: { exists: false } },
        ],
      },
    ];
    if (isApprovalStep(stepFilter) && stepFilter !== "lock") {
      reportClauses.push({ approvalStep: { equals: stepFilter } });
    }
    const reportWhere: Where = { and: reportClauses };

    const reports = await payload.find({
      collection: "reports",
      where: reportWhere,
      limit,
      sort: "-updatedAt",
      depth: 0,
      overrideAccess: true,
    });

    for (const r of reports.docs) {
      const chain = readChainState(r);
      if (chain.status === "locked") continue;
      items.push({
        entityType: "report",
        id: String(r.id),
        title: typeof r.framework === "string" ? r.framework : "Report",
        subtitle: `v${r.version ?? 1}`,
        step: chain.step,
        status: chain.status,
        approvalState: null,
        assigneeRole:
          typeof r.approvalAssigneeRole === "string" ? r.approvalAssigneeRole : null,
        assigneeUserId: relId(r.approvalAssigneeUser),
        updatedAt: r.updatedAt ? String(r.updatedAt) : null,
        value: null,
        unit: null,
      });
    }
  }

  items.sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });

  return NextResponse.json({
    items: items.slice(0, limit),
    total: items.length,
  });
}
