import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { getUsageMeters, PLAN_LIMITS } from "@/lib/billing";
import config from "@/payload.config";

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });

  const usage = await getUsageMeters(org.id, org.plan);

  return NextResponse.json({
    plan: org.plan ?? "free",
    subscriptionStatus: org.subscriptionStatus ?? "none",
    stripeCustomerId: org.stripeCustomerId ?? null,
    usage,
    catalog: PLAN_LIMITS,
  });
}
