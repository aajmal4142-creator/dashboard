import { NextResponse } from "next/server";

import { biJson, listBiSuppliers, parseBiPagination, requireBiAuth } from "@/lib/bi";

/**
 * GET /api/app/bi/suppliers — org suppliers for BI tools (read-only).
 * Query: limit, page.
 */
export async function GET(req: Request) {
  const auth = await requireBiAuth(req, "suppliers");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const { limit, page } = parseBiPagination(url);
    const data = await listBiSuppliers(auth.ctx.payload, auth.ctx.organisationId, {
      limit,
      page,
    });
    return biJson(data, auth.ctx);
  } catch (error) {
    console.error("BI suppliers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: auth.ctx.rateLimitHeaders },
    );
  }
}
