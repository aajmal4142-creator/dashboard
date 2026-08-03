import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { buildCertificateLedgerSummary, listOrgPeriods } from "@/lib/certificates";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/compliance/certificates/summary?periodId=
 * Active kWh inventory vs org electricity_kwh for coverage, plus
 * `marketBasedHook` (covered kWh / residual_mix dual readiness).
 * Location-based Scope 2 is unchanged; instruments wire into calculate() elsewhere.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "compliance",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId");

    const payload = await getPayload({ config });
    const [summary, periods] = await Promise.all([
      buildCertificateLedgerSummary(payload, ctx.activeOrg.id, periodId || null),
      listOrgPeriods(payload, ctx.activeOrg.id),
    ]);

    return NextResponse.json({ ...summary, periods });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Certificates summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
