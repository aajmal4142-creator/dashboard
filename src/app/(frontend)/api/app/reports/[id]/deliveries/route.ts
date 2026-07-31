import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { listReportDeliveries } from "@/lib/webhooks/reportDelivery";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function orgIdOf(value: unknown): string {
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

/**
 * GET /api/app/reports/[id]/deliveries
 * Delivery history for report.generated webhook attempts.
 */
export async function GET(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: reportId } = await ctx.params;
  const payload = await getPayload({ config });

  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id: reportId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (orgIdOf(report.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limitRaw = new URL(req.url).searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 100;

  const deliveries = await listReportDeliveries({
    reportId,
    organisationId: auth.activeOrg.id,
    limit: Number.isFinite(limit) ? limit : 100,
  });

  return NextResponse.json({
    ok: true,
    report_id: reportId,
    deliveries,
  });
}
