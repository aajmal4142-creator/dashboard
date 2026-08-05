import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { createUsageTracker, getUsageMeters, PLAN_LIMITS } from "@/lib/billing";
import config from "@/payload.config";

export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.activeOrg) {
      return NextResponse.json({ error: "No active organisation" }, { status: 403 });
    }

    const payload = await getPayload({ config });
    const tracker = createUsageTracker(payload);

    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "current";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const metersOnly =
      url.searchParams.get("meters") === "1" || url.searchParams.get("legacy") === "1";

    if (metersOnly) {
      const org = await payload.findByID({
        collection: "organisations",
        id: ctx.activeOrg.id,
        depth: 0,
        overrideAccess: true,
      });
      const meters = await getUsageMeters(org.id, org.plan);
      return NextResponse.json({
        plan: org.plan ?? "free",
        subscriptionStatus: org.subscriptionStatus ?? "none",
        stripeCustomerId: org.stripeCustomerId ?? null,
        usage: meters,
        catalog: PLAN_LIMITS,
      });
    }

    if (period === "current") {
      const usage = await tracker.getCurrentMonthUsage(ctx.activeOrg.id);
      return NextResponse.json({
        period: "current_month",
        usage,
      });
    }

    if (period === "history") {
      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: "startDate and endDate required for history period" },
          { status: 400 },
        );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return NextResponse.json(
          { error: "startDate must be before endDate" },
          { status: 400 },
        );
      }

      const history = await tracker.getUsageHistory(ctx.activeOrg.id, start, end);

      return NextResponse.json({
        period: "history",
        startDate: start,
        endDate: end,
        usage: history,
        total: history.length,
      });
    }

    const org = await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
      overrideAccess: true,
    });

    const meters = await getUsageMeters(org.id, org.plan);

    return NextResponse.json({
      plan: org.plan ?? "free",
      subscriptionStatus: org.subscriptionStatus ?? "none",
      stripeCustomerId: org.stripeCustomerId ?? null,
      usage: meters,
      catalog: PLAN_LIMITS,
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
