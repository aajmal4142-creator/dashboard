import { NextResponse } from "next/server";

import { biJson, listBiEmissions, requireBiAuth } from "@/lib/bi";

/**
 * GET /api/app/bi/emissions — period-scoped scope 1/2/3 totals (read-only).
 */
export async function GET(req: Request) {
  const auth = await requireBiAuth(req, "emissions");
  if (!auth.ok) return auth.response;

  try {
    const data = await listBiEmissions(auth.ctx.payload, auth.ctx.organisationId);
    return biJson(data, auth.ctx);
  } catch (error) {
    console.error("BI emissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: auth.ctx.rateLimitHeaders },
    );
  }
}
