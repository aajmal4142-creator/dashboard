import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { buildPcafSummary, listOrgFinancedEmissions, PCAF_DISCLAIMER } from "@/lib/pcaf";
import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/finance/pcaf/summary?periodId=
 * Portfolio-level PCAF attribution summary. Missing EVIC/emissions rows are
 * counted but never folded into totals as zero.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId") ?? undefined;

    const payload = await getPayload({ config });
    const exposures = await listOrgFinancedEmissions(payload, ctx.activeOrg.id, {
      periodId,
    });
    const summary = buildPcafSummary(exposures);

    return NextResponse.json({
      summary,
      total: exposures.length,
      disclaimer: PCAF_DISCLAIMER,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PCAF summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
