import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { buildQuarterSummary, type CbamQuarter } from "@/lib/cbam";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function parseQuarter(value: unknown): CbamQuarter | null {
  const v = String(value ?? "").replace(/^q/i, "");
  if (v === "1" || v === "2" || v === "3" || v === "4") return v;
  return null;
}

/**
 * GET /api/app/compliance/cbam/summary?year=&quarter=
 * Draft quarterly summary: goods + liability estimate.
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
    const year = Number(url.searchParams.get("year"));
    const quarter = parseQuarter(url.searchParams.get("quarter"));

    if (!Number.isInteger(year) || year < 2023 || year > 2100) {
      return NextResponse.json(
        { error: "year query param must be an integer between 2023 and 2100" },
        { status: 400 },
      );
    }
    if (!quarter) {
      return NextResponse.json(
        { error: "quarter query param must be 1–4" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const summary = await buildQuarterSummary(payload, ctx.activeOrg.id, year, quarter);

    return NextResponse.json(summary);
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
