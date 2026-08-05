import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildFilingPack,
  buildQuarterSummary,
  filingPackToCsv,
  type CbamQuarter,
} from "@/lib/cbam";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function parseQuarter(value: unknown): CbamQuarter | null {
  const v = String(value ?? "").replace(/^q/i, "");
  if (v === "1" || v === "2" || v === "3" || v === "4") return v;
  return null;
}

/**
 * GET /api/app/compliance/cbam/filing-pack?year=&quarter=&format=json|csv
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
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();

    if (!Number.isInteger(year) || year < 2023 || year > 2100) {
      return NextResponse.json(
        { error: "year must be an integer between 2023 and 2100" },
        { status: 400 },
      );
    }
    if (!quarter) {
      return NextResponse.json({ error: "quarter must be 1–4" }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const summary = await buildQuarterSummary(payload, ctx.activeOrg.id, year, quarter);

    const pack = buildFilingPack({
      year,
      quarter,
      declaration: summary.declaration,
      goods: summary.goods,
      liability: summary.liability,
      declarant: {
        name: summary.declaration?.declarantName ?? null,
        eori: summary.declaration?.declarantEori ?? null,
        country: summary.declaration?.declarantCountry ?? null,
        email: summary.declaration?.declarantEmail ?? null,
      },
    });

    if (format === "csv") {
      const csv = filingPackToCsv(pack);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="cbam-filing-${year}-Q${quarter}.csv"`,
        },
      });
    }

    return NextResponse.json(pack);
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("CBAM filing pack error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
