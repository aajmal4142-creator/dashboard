import { getPayload } from "payload";
import { NextResponse } from "next/server";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import {
  checkDatapointQuota,
  checkReportQuota,
  checkApiQuota,
} from "@/lib/billing/freeTierGates";

/**
 * GET /api/app/billing/free-tier/status
 * Get free tier quota status for current organization
 */
export async function GET(_request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "billing",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await getPayload({ config });

    // Check if on free tier
    const freeTier = await payload.find({
      collection: "free-tier-accounts",
      where: { organisation: { equals: ctx.activeOrg.id } },
      limit: 1,
    });

    if (!freeTier.docs?.[0]) {
      return NextResponse.json({
        onFreeTier: false,
        quotas: null,
      });
    }

    const datapointQuota = await checkDatapointQuota(ctx.activeOrg.id);
    const reportQuota = await checkReportQuota(ctx.activeOrg.id);
    const apiQuota = await checkApiQuota(ctx.activeOrg.id);

    return NextResponse.json({
      onFreeTier: true,
      quotas: {
        datapoints: datapointQuota,
        reports: reportQuota,
        apiCalls: apiQuota,
      },
      accountStatus: freeTier.docs[0].status,
      upgradedAt: freeTier.docs[0].upgradedAt,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching free tier status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
