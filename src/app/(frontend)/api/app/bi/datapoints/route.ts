import { NextResponse } from "next/server";

import { biJson, listBiDatapoints, parseBiPagination, requireBiAuth } from "@/lib/bi";

/**
 * GET /api/app/bi/datapoints — org datapoints for BI tools (read-only).
 * Query: limit, page, periodId (optional).
 */
export async function GET(req: Request) {
  const auth = await requireBiAuth(req, "datapoints");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const { limit, page } = parseBiPagination(url);
    const periodId = url.searchParams.get("periodId");
    const data = await listBiDatapoints(auth.ctx.payload, auth.ctx.organisationId, {
      limit,
      page,
      periodId,
    });
    return biJson(data, auth.ctx);
  } catch (error) {
    console.error("BI datapoints error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: auth.ctx.rateLimitHeaders },
    );
  }
}
